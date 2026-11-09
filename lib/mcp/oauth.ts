import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { getCloudConnectionStatus } from "../cloud/connections";
import { createSession, getSession, readSession, getCookieName, type GitHubSession } from "../github/session";
import { createGitHubClient } from "../github/client";
import { MCP_URL } from "../projects/context";
import type { RepositoryConnection } from "../github/selected-repository";

export const ISSUER = new URL(MCP_URL).origin;
export const ACCOUNT_SCOPE = "accounts.read";
export const CLOUD_SCOPE = "cloud.read";
export const REPOSITORY_READ_SCOPE = "repository.read";
export const REPOSITORY_WRITE_SCOPE = "repository.write";
const SCOPES = [ACCOUNT_SCOPE, CLOUD_SCOPE, REPOSITORY_READ_SCOPE, REPOSITORY_WRITE_SCOPE];
const scopeSchema = z.string().max(256).refine((value) => {
  const scopes = value.split(" ");
  return scopes.includes(ACCOUNT_SCOPE) && scopes.every((scope) => SCOPES.includes(scope)) &&
    (!scopes.includes(REPOSITORY_WRITE_SCOPE) || scopes.includes(REPOSITORY_READ_SCOPE));
});
const FLOW_COOKIE = "__Host-autops-mcp-flow";
const PENDING_COOKIE = "__Host-autops-mcp-pending";
const pendingSchema = z.object({ query: z.string().max(4096) });
export const MCP_PENDING_COOKIE = PENDING_COOKIE;
const clientSchema = z.object({ redirectUris: z.array(z.string()).min(1).max(5) });
const flowSchema = z.object({
  clientId: z.string(), redirectUri: z.string(), challenge: z.string(), state: z.string(), nonce: z.string(),
  ownerId: z.number().int().positive().nullable(), repositoryId: z.number().int().positive().nullable(),
  scope: scopeSchema.default(ACCOUNT_SCOPE),
  refreshAllowed: z.boolean().default(false),
});
type Flow = z.infer<typeof flowSchema>;
const grantSchema = flowSchema.extend({ code: z.string().min(1).max(512) });
const accessSchema = z.object({
  issuer: z.literal(ISSUER), audience: z.literal(MCP_URL), scope: scopeSchema,
  token: z.string().min(1).max(2048), userId: z.number().int().positive(), repositoryId: z.number().int().positive().nullable(),
  authorizationGrant: z.enum(["authorization_code", "refresh_token", "legacy"]).default("legacy"),
});
const refreshSchema = accessSchema.omit({ token: true, authorizationGrant: true }).extend({
  clientIdHash: z.string().regex(/^[a-f0-9]{64}$/), refreshToken: z.string().min(1).max(2048),
});
const githubTokenSchema = z.object({
  access_token: z.string().min(1).max(2048), expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).max(2048).optional(), refresh_token_expires_in: z.number().int().positive().optional(),
});
const MAX_REFRESH_AGE = 15897600;

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
function getClientIdHash(clientId: string) { return createHash("sha256").update(clientId).digest("hex"); }

function createTokens(token: z.infer<typeof githubTokenSchema>, clientId: string, scope: string, userId: number, repositoryId: number | null, refreshAllowed = true, authorizationGrant: "authorization_code" | "refresh_token" = "authorization_code") {
  const identity = { issuer: ISSUER, audience: MCP_URL, scope, userId, repositoryId };
  const lifetime = Math.min(3600, token.expires_in ?? 3600);
  const refreshAge = Math.min(token.refresh_token_expires_in ?? 0, MAX_REFRESH_AGE);
  return json({ access_token: encode({ ...identity, token: token.access_token, authorizationGrant }, "access", lifetime),
    token_type: "Bearer", expires_in: lifetime, scope,
    ...(refreshAllowed && token.expires_in && token.refresh_token && refreshAge > 0 ? {
      refresh_token: encode({ ...identity, clientIdHash: getClientIdHash(clientId), refreshToken: token.refresh_token }, "refresh", refreshAge),
      refresh_token_expires_in: refreshAge,
    } : {}),
  });
}

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
    registration_endpoint: `${ISSUER}/oauth/register`, response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"], code_challenge_methods_supported: ["S256"], scopes_supported: SCOPES };
}
export function resourceMetadata() {
  return { resource: MCP_URL, authorization_servers: [ISSUER], scopes_supported: SCOPES, bearer_methods_supported: ["header"] };
}

export function getConsent(flowValue: string | undefined, cookies: { get(name: string): { value: string } | undefined }) {
  const flow = decode(flowValue, "consent", flowSchema);
  return flow && flow.nonce === cookies.get(`${FLOW_COOKIE}-${flow.nonce}`)?.value ? flow : null;
}
export const MCP_FLOW_COOKIE = FLOW_COOKIE;
export function hasPendingMcpAuthorization(value: string | undefined) {
  return Boolean(value && decode(value, "pending", pendingSchema));
}

export async function handleOAuth(request: NextRequest, action: string) {
  try {
    const cfg = config();
    if (request.nextUrl.origin !== ISSUER) return json({ error: "invalid_request" }, 400);
    if (action === "resume" && request.method === "GET") {
      const pending = decode(request.cookies.get(PENDING_COOKIE)?.value, "pending", pendingSchema);
      const target = new URL(pending ? "/oauth/authorize" : "/onboarding", ISSUER);
      if (pending) target.search = pending.query;
      const response = NextResponse.redirect(target, 303);
      response.cookies.set(PENDING_COOKIE, "", { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }
    if (action === "register" && request.method === "POST") {
      const body = await request.text();
      if (body.length > 8192) return json({ error: "invalid_request" }, 400);
      const input = z.object({ redirect_uris: z.array(z.string().max(512)).min(1).max(5), token_endpoint_auth_method: z.literal("none").optional() })
        .safeParse(JSON.parse(body));
      if (!input.success || !input.data.redirect_uris.every(validRedirect)) return json({ error: "invalid_redirect_uri" }, 400);
      return json({ client_id: encode({ redirectUris: input.data.redirect_uris }, "client", 365 * 86400),
        redirect_uris: input.data.redirect_uris, token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }, 201);
    }
    if (action === "authorize" && request.method === "GET") {
      const q = request.nextUrl.searchParams;
      const clientId = q.get("client_id") || "";
      const client = decode(clientId, "client", clientSchema);
      const redirectUri = q.get("redirect_uri") || "";
      const challenge = q.get("code_challenge") || "";
      const state = q.get("state") || "";
      const scope = scopeSchema.safeParse(q.get("scope") ?? ACCOUNT_SCOPE);
      if (!client || !client.redirectUris.includes(redirectUri) || !validRedirect(redirectUri) || q.get("response_type") !== "code" ||
        q.get("code_challenge_method") !== "S256" || !/^[a-zA-Z0-9_-]{43}$/.test(challenge) || !state || state.length > 512 ||
        !scope.success || (q.has("resource") && q.get("resource") !== MCP_URL)) {
        return json({ error: "invalid_request" }, 400);
      }
      const github = getSession<GitHubSession>(request.cookies.get(getCookieName("session"))?.value, cfg.secret);
      const valid = github && github.expiresAt > Math.floor(Date.now() / 1000) ? github : null;
      if (scope.data.includes(REPOSITORY_READ_SCOPE) && !valid?.repository) {
        const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", state,
          code_challenge: challenge, code_challenge_method: "S256", scope: scope.data, resource: MCP_URL }).toString();
        const pending = encode({ query }, "pending", 600);
        if (pending.length > 3800) return json({ error: "invalid_request" }, 400);
        const response = NextResponse.redirect(new URL("/onboarding", ISSUER), 303);
        response.cookies.set(PENDING_COOKIE, pending,
          { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
        response.headers.set("Cache-Control", "no-store");
        response.headers.set("Referrer-Policy", "no-referrer");
        return response;
      }
      const flow: Flow = { clientId, redirectUri, challenge, state, nonce: randomBytes(32).toString("base64url"),
        ownerId: valid?.user.id ?? null, repositoryId: valid?.repository?.id ?? null, scope: scope.data, refreshAllowed: true };
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
      if (input.get("grant_type") === "refresh_token") {
        const refresh = decode(input.get("refresh_token") || undefined, "refresh", refreshSchema);
        const clientId = input.get("client_id") || "";
        if (!refresh || getClientIdHash(clientId) !== refresh.clientIdHash || !decode(clientId, "client", clientSchema) ||
          (input.has("resource") && input.get("resource") !== MCP_URL)) return json({ error: "invalid_grant" }, 400);
        const scope = scopeSchema.safeParse(input.get("scope") ?? refresh.scope);
        if (!scope.success || scope.data.split(" ").some((value) => !refresh.scope.split(" ").includes(value))) {
          return json({ error: "invalid_scope" }, 400);
        }
        // GitHub rotates and consumes the upstream refresh token across serverless instances.
        const response = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST", headers: { Accept: "application/json" }, body: new URLSearchParams({ client_id: cfg.clientId,
            client_secret: cfg.clientSecret, grant_type: "refresh_token", refresh_token: refresh.refreshToken }),
          cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
        });
        const token = githubTokenSchema.safeParse(await response.json());
        if (!response.ok || !token.success || !token.data.expires_in || !token.data.refresh_token ||
          !token.data.refresh_token_expires_in || token.data.refresh_token === refresh.refreshToken) return json({ error: "invalid_grant" }, 400);
        const user = await createGitHubClient(token.data.access_token).getUser();
        if (user.id !== refresh.userId) return json({ error: "invalid_grant" }, 400);
        return createTokens(token.data, clientId, scope.data, refresh.userId, refresh.repositoryId, true, "refresh_token");
      }
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
      const token = githubTokenSchema.safeParse(await response.json());
      if (!response.ok || !token.success) return json({ error: "invalid_grant" }, 400);
      const user = await createGitHubClient(token.data.access_token).getUser();
      if (grant.ownerId && grant.ownerId !== user.id) return json({ error: "invalid_grant", error_description: "Connect the same GitHub account used on autops." }, 400);
      return createTokens(token.data, grant.clientId, grant.scope, user.id, grant.repositoryId, grant.refreshAllowed);
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

function getAccess(request: Request | undefined) {
  const value = request?.headers.get("authorization")?.match(/^Bearer ([a-zA-Z0-9_-]+)$/i)?.[1];
  if (!value) return null;
  const envelope = readSession<unknown>(value, key("access"));
  const access = accessSchema.safeParse(envelope?.data);
  return envelope && access.success ? { ...access.data, expiresAt: envelope.expiresAt } : null;
}

export class McpAuthorizationError extends Error {
  constructor(public scope: string) { super("Connect or reauthorize autops with the requested account and repository permissions."); }
}

export async function getCloudOwner(request: Request | undefined) {
  const access = getAccess(request);
  if (!access || !access.scope.split(" ").includes(CLOUD_SCOPE)) throw new McpAuthorizationError(`${ACCOUNT_SCOPE} ${CLOUD_SCOPE}`);
  const user = await createGitHubClient(access.token).getUser();
  if (user.id !== access.userId) throw new McpAuthorizationError(`${ACCOUNT_SCOPE} ${CLOUD_SCOPE}`);
  return String(user.id);
}

export async function getRepositoryConnection(request: Request | undefined, requiredScope = REPOSITORY_READ_SCOPE): Promise<RepositoryConnection> {
  const access = getAccess(request);
  const required = [ACCOUNT_SCOPE, REPOSITORY_READ_SCOPE, ...(requiredScope === REPOSITORY_WRITE_SCOPE ? [REPOSITORY_WRITE_SCOPE] : [])].join(" ");
  if (!access || !access.scope.split(" ").includes(requiredScope)) throw new McpAuthorizationError(required);
  const client = createGitHubClient(access.token);
  const user = await client.getUser();
  if (user.id !== access.userId) throw new McpAuthorizationError(required);
  const appId = process.env.GITHUB_APP_ID;
  if (!appId) throw new Error("setup_required");
  const repository = (await client.getRepositories(appId)).find((repo) => repo.id === access.repositoryId);
  if (!repository) throw new Error("Select an accessible repository on autops, then reconnect the ChatGPT plugin.");
  return { token: access.token, repository };
}

export async function getConnectedAccounts(request: Request | undefined) {
  const access = getAccess(request);
  if (!access) return null;
  const client = createGitHubClient(access.token);
  const user = await client.getUser();
  if (user.id !== access.userId) return null;
  const appId = process.env.GITHUB_APP_ID;
  if (!appId) throw new Error("setup_required");
  const repositories = await client.getRepositories(appId);
  return { github: { connected: true, user, repository: repositories.find((repo) => repo.id === access.repositoryId) ?? null, repositories },
    permissions: { repositoryRead: access.scope.split(" ").includes(REPOSITORY_READ_SCOPE), repositoryWrite: access.scope.split(" ").includes(REPOSITORY_WRITE_SCOPE) },
    authorization: { grantType: access.authorizationGrant, expiresAt: new Date(access.expiresAt * 1000).toISOString() },
    checkedAt: new Date().toISOString(),
    cloudAccounts: access.scope.split(" ").includes(CLOUD_SCOPE)
      ? { status: "checked", vercel: await getCloudConnectionStatus(String(user.id), "vercel"), supabase: await getCloudConnectionStatus(String(user.id), "supabase") }
      : { status: "authorization_required", requiredScope: CLOUD_SCOPE } };
}
