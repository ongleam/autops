import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { createSession, getSession, getCookieName, type GitHubSession } from "../github/session";
import { createGitHubClient } from "../github/client";
import { MCP_URL } from "../projects/context";

export const ISSUER = new URL(MCP_URL).origin;
export const ACCOUNT_SCOPE = "accounts.read";
const FLOW_COOKIE = "__Host-autops-mcp-flow";
const clientSchema = z.object({ redirectUris: z.array(z.string()).min(1).max(5) });
const flowSchema = z.object({
  clientId: z.string(), redirectUri: z.string(), challenge: z.string(), state: z.string(), nonce: z.string(),
  ownerId: z.number().int().positive().nullable(), repositoryId: z.number().int().positive().nullable(),
});
type Flow = z.infer<typeof flowSchema>;
const grantSchema = flowSchema.extend({ code: z.string().min(1).max(512) });
const accessSchema = z.object({
  issuer: z.literal(ISSUER), audience: z.literal(MCP_URL), scope: z.literal(ACCOUNT_SCOPE),
  token: z.string().min(1).max(2048), userId: z.number().int().positive(), repositoryId: z.number().int().positive().nullable(),
});

function config() {
  const secret = process.env.GITHUB_SESSION_SECRET;
  const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
  if (!secret || secret.length < 32 || !clientId || !clientSecret) throw new Error("setup_required");
  return { secret, clientId, clientSecret };
}

function key(purpose: string) { return `${config().secret}:autops-mcp:${purpose}`; }
function decode<T extends z.ZodType>(value: string | undefined, purpose: string, schema: T): z.infer<T> | null {
  const parsed = schema.safeParse(getSession<unknown>(value, key(purpose)));
  return parsed.success ? parsed.data : null;
}
function encode(data: unknown, purpose: string, age: number) { return createSession(data, key(purpose), age); }

function validRedirect(value: string) {
  try {
    const url = new URL(value);
    return url.origin === "https://chatgpt.com" && !url.hash && !url.username && !url.password &&
      (url.pathname === "/connector_platform_oauth_redirect" ||
        /^\/connector\/oauth\/[a-zA-Z0-9_-]+$/.test(url.pathname) ||
        url.pathname === "/connector_platform/oauth/callback" || /^\/aip\/[a-zA-Z0-9_-]+\/oauth\/callback$/.test(url.pathname));
  } catch { return false; }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "Pragma": "no-cache", "Access-Control-Allow-Origin": "https://chatgpt.com" } });
}
function setFlow(response: NextResponse, nonce: string, value: string, maxAge: number) {
  response.cookies.set(`${FLOW_COOKIE}-${nonce}`, value, { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export function authorizationMetadata() {
  return { issuer: ISSUER, authorization_endpoint: `${ISSUER}/oauth/authorize`, token_endpoint: `${ISSUER}/oauth/token`,
    authorization_response_iss_parameter_supported: true,
    registration_endpoint: `${ISSUER}/oauth/register`, response_types_supported: ["code"], grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["none"], code_challenge_methods_supported: ["S256"], scopes_supported: [ACCOUNT_SCOPE] };
}
export function resourceMetadata() {
  return { resource: MCP_URL, authorization_servers: [ISSUER], scopes_supported: [ACCOUNT_SCOPE], bearer_methods_supported: ["header"] };
}

export function getConsent(flowValue: string | undefined, cookies: { get(name: string): { value: string } | undefined }) {
  const flow = decode(flowValue, "consent", flowSchema);
  return flow && flow.nonce === cookies.get(`${FLOW_COOKIE}-${flow.nonce}`)?.value ? flow : null;
}
export const MCP_FLOW_COOKIE = FLOW_COOKIE;

export async function handleOAuth(request: NextRequest, action: string) {
  try {
    const cfg = config();
    if (request.nextUrl.origin !== ISSUER) return json({ error: "invalid_request" }, 400);
    if (action === "register" && request.method === "POST") {
      const body = await request.text();
      if (body.length > 8192) return json({ error: "invalid_request" }, 400);
      const input = z.object({ redirect_uris: z.array(z.string().max(512)).min(1).max(5), token_endpoint_auth_method: z.literal("none").optional() })
        .safeParse(JSON.parse(body));
      if (!input.success || !input.data.redirect_uris.every(validRedirect)) return json({ error: "invalid_redirect_uri" }, 400);
      return json({ client_id: encode({ redirectUris: input.data.redirect_uris }, "client", 365 * 86400),
        redirect_uris: input.data.redirect_uris, token_endpoint_auth_method: "none", grant_types: ["authorization_code"], response_types: ["code"] }, 201);
    }
    if (action === "authorize" && request.method === "GET") {
      const q = request.nextUrl.searchParams;
      const clientId = q.get("client_id") || "";
      const client = decode(clientId, "client", clientSchema);
      const redirectUri = q.get("redirect_uri") || "";
      const challenge = q.get("code_challenge") || "";
      const state = q.get("state") || "";
      if (!client || !client.redirectUris.includes(redirectUri) || !validRedirect(redirectUri) || q.get("response_type") !== "code" ||
        q.get("code_challenge_method") !== "S256" || !/^[a-zA-Z0-9_-]{43}$/.test(challenge) || !state || state.length > 512 ||
        (q.has("scope") && q.get("scope") !== ACCOUNT_SCOPE) || (q.has("resource") && q.get("resource") !== MCP_URL)) {
        return json({ error: "invalid_request" }, 400);
      }
      const github = getSession<GitHubSession>(request.cookies.get(getCookieName("session"))?.value, cfg.secret);
      const valid = github && github.expiresAt > Math.floor(Date.now() / 1000) ? github : null;
      const flow: Flow = { clientId, redirectUri, challenge, state, nonce: randomBytes(32).toString("base64url"),
        ownerId: valid?.user.id ?? null, repositoryId: valid?.repository?.id ?? null };
      const target = new URL("/connect/chatgpt", ISSUER);
      target.searchParams.set("flow", encode(flow, "consent", 600));
      return setFlow(NextResponse.redirect(target, 303), flow.nonce, flow.nonce, 600);
    }
    if (action === "authorize" && request.method === "POST") {
      if (request.headers.get("origin") !== ISSUER) return json({ error: "access_denied" }, 403);
      const text = await request.text();
      if (text.length > 8192) return json({ error: "invalid_request" }, 400);
      const body = new URLSearchParams(text);
      const flow = getConsent(body.get("flow") || undefined, request.cookies);
      if (!flow) return json({ error: "invalid_request", error_description: "Authorization expired. Start again in ChatGPT." }, 400);
      if (body.get("decision") !== "allow") {
        const target = new URL(flow.redirectUri);
        target.search = new URLSearchParams({ error: "access_denied", state: flow.state, iss: ISSUER }).toString();
        return setFlow(NextResponse.redirect(target, 303), flow.nonce, "", 0);
      }
      const state = `mcp.${randomBytes(32).toString("base64url")}`;
      const target = new URL("https://github.com/login/oauth/authorize");
      target.search = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: `${ISSUER}/api/github/callback`, state,
        code_challenge: flow.challenge, code_challenge_method: "S256" }).toString();
      const response = setFlow(NextResponse.redirect(target, 303), flow.nonce, "", 0);
      return setFlow(response, state, encode({ ...flow, nonce: state }, "github-flow", 600), 600);
    }
    if (action === "token" && request.method === "POST") {
      const text = await request.text();
      if (text.length > 16384) return json({ error: "invalid_request" }, 400);
      const input = new URLSearchParams(text);
      const grant = decode(input.get("code") || undefined, "code", grantSchema);
      const verifier = input.get("code_verifier") || "";
      if (input.get("grant_type") !== "authorization_code" || !grant || input.get("client_id") !== grant.clientId ||
        input.get("redirect_uri") !== grant.redirectUri || !/^[a-zA-Z0-9._~-]{43,128}$/.test(verifier) ||
        createHash("sha256").update(verifier).digest("base64url") !== grant.challenge ||
        (input.has("resource") && input.get("resource") !== MCP_URL)) return json({ error: "invalid_grant" }, 400);
      // GitHub consumes the upstream code once, including across serverless instances.
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST", headers: { Accept: "application/json" }, body: new URLSearchParams({ client_id: cfg.clientId,
          client_secret: cfg.clientSecret, code: grant.code, redirect_uri: `${ISSUER}/api/github/callback`, code_verifier: verifier }),
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      });
      const token = z.object({ access_token: z.string().min(1).max(2048), expires_in: z.number().int().positive().optional() }).safeParse(await response.json());
      if (!response.ok || !token.success) return json({ error: "invalid_grant" }, 400);
      const user = await createGitHubClient(token.data.access_token).getUser();
      if (grant.ownerId && grant.ownerId !== user.id) return json({ error: "invalid_grant", error_description: "Connect the same GitHub account used on autops." }, 400);
      const lifetime = Math.min(3600, token.data.expires_in ?? 3600);
      return json({ access_token: encode({ issuer: ISSUER, audience: MCP_URL, scope: ACCOUNT_SCOPE, token: token.data.access_token,
        userId: user.id, repositoryId: grant.repositoryId }, "access", lifetime), token_type: "Bearer", expires_in: lifetime, scope: ACCOUNT_SCOPE });
    }
    return json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "server_error", error_description: "Unable to complete authorization. Restart the connection from ChatGPT." }, 503);
  }
}

export function handleMcpGitHubCallback(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state") || "";
  if (!/^mcp\.[a-zA-Z0-9_-]{43}$/.test(state)) return json({ error: "invalid_request" }, 400);
  const flow = decode(request.cookies.get(`${FLOW_COOKIE}-${state}`)?.value, "github-flow", flowSchema);
  if (!flow || flow.nonce !== state) return json({ error: "invalid_request" }, 400);
  const target = new URL(flow.redirectUri);
  target.searchParams.set("state", flow.state);
  target.searchParams.set("iss", ISSUER);
  const code = request.nextUrl.searchParams.get("code");
  if (!code || code.length > 512 || request.nextUrl.searchParams.has("error")) target.searchParams.set("error", "access_denied");
  else target.searchParams.set("code", encode({ ...flow, code }, "code", 60));
  return setFlow(NextResponse.redirect(target, 303), flow.nonce, "", 0);
}

export async function getConnectedAccounts(request: Request | undefined) {
  const value = request?.headers.get("authorization")?.match(/^Bearer ([a-zA-Z0-9_-]+)$/i)?.[1];
  const access = decode(value, "access", accessSchema);
  if (!access) return null;
  const client = createGitHubClient(access.token);
  const user = await client.getUser();
  if (user.id !== access.userId) return null;
  const appId = process.env.GITHUB_APP_ID;
  if (!appId) throw new Error("setup_required");
  const repositories = await client.getRepositories(appId);
  return { github: { connected: true, user, repository: repositories.find((repo) => repo.id === access.repositoryId) ?? null, repositories },
    checkedAt: new Date().toISOString(),
    cloudAccounts: { status: "not_shared", message: "Vercel and Supabase browser connections are separate and are not shared with this MCP authorization." } };
}
