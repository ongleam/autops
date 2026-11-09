import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { createSession, getSession, getCookieName, type GitHubSession } from "../github/session";
import { CloudError, getCloudProjects, getCloudOverview, getProjectSelection, type CloudConfig, type CloudSession, type Provider } from "./client";

const MAX_AGE = 8 * 60 * 60;
const MESSAGES: Record<string, string> = {
  setup_required: "서비스 연결 설정이 필요해요. 관리자에게 문의해주세요.",
  github_required: "GitHub 계정을 먼저 연결해주세요.",
  reconnect: "서비스 인증이 만료되었거나 해제됐어요. 다시 연결해주세요.",
  forbidden: "현재 페이지에서 다시 시도해주세요.",
  project_forbidden: "프로젝트 접근 권한이 없어요. 서비스에서 허용한 프로젝트를 확인해주세요.",
  invalid_request: "요청 형식을 확인해주세요.",
  select_project: "조회할 프로젝트를 먼저 선택해주세요.",
  provider_unavailable: "서비스 정보를 가져오지 못했어요. 잠시 후 다시 시도해주세요.",
};
type Flow = { state: string; verifier: string; origin: string; owner: string };

export function getCloudCookieName(provider: Provider, kind: "session" | "flow") {
  return `${process.env.NODE_ENV === "production" ? "__Host-" : ""}autops-${provider}-${kind}`;
}

function setCookie(response: NextResponse, provider: Provider, kind: "session" | "flow", value: string, maxAge: number) {
  response.cookies.set(getCloudCookieName(provider, kind), value, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge,
  });
}

function saveSession(response: NextResponse, provider: Provider, session: CloudSession, secret: string) {
  const lifetime = Math.min(MAX_AGE, session.expiresAt - Math.floor(Date.now() / 1000));
  const value = createSession(session, secret, lifetime);
  if (value.length > 3800 || lifetime <= 0) throw new CloudError(401, "reconnect");
  setCookie(response, provider, "session", value, lifetime);
}

function getOwner(request: NextRequest, secret: string) {
  const github = getSession<GitHubSession>(request.cookies.get(getCookieName("session"))?.value, secret);
  if (!github || github.expiresAt <= Math.floor(Date.now() / 1000)) throw new CloudError(401, "github_required");
  return createHash("sha256").update(`${github.user.id}:${github.token}`).digest("hex");
}

function hasMatchingState(received: string | null, expected: string) {
  if (!received || received.length > 256) return false;
  const actual = Buffer.from(received);
  const reference = Buffer.from(expected);
  return actual.length === reference.length && timingSafeEqual(actual, reference);
}

async function callback(request: NextRequest, provider: Provider, config: CloudConfig, owner: string) {
  const target = new URL("/onboarding", request.url);
  target.searchParams.set("cloud", provider);
  const response = NextResponse.redirect(target, 303);
  const flow = getSession<Flow>(request.cookies.get(getCloudCookieName(provider, "flow"))?.value, config.secret);
  setCookie(response, provider, "flow", "", 0);
  if (!flow || flow.owner !== owner || flow.origin !== request.nextUrl.origin || !hasMatchingState(request.nextUrl.searchParams.get("state"), flow.state)) {
    target.searchParams.set("result", "invalid_oauth_state");
  } else if (request.nextUrl.searchParams.has("error")) {
    target.searchParams.set("result", "access_denied");
  } else {
    const code = request.nextUrl.searchParams.get("code");
    if (!code || code.length > 1024) target.searchParams.set("result", "invalid_oauth_state");
    else {
      try {
        const redirectUri = new URL(`/api/cloud/${provider}/callback`, flow.origin).href;
        const body: Record<string, string> = provider === "vercel"
          ? { client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: redirectUri }
          : { grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: flow.verifier };
        const tokenResponse = await fetch(provider === "vercel" ? "https://api.vercel.com/v2/oauth/access_token" : "https://api.supabase.com/v1/oauth/token", {
          method: "POST", headers: {
            "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json",
            ...(provider === "supabase" ? { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}` } : {}),
          }, body: new URLSearchParams(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
        });
        if (!tokenResponse.ok) throw new CloudError(401, "reconnect");
        const token = z.object({
          access_token: z.string().min(1).max(2048), expires_in: z.number().int().positive().optional(),
          team_id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).nullable().optional(), error: z.unknown().optional(),
        }).parse(await tokenResponse.json());
        if (token.error || (provider === "supabase" && !token.expires_in)) throw new CloudError(401, "reconnect");
        saveSession(response, provider, {
          token: token.access_token, owner, expiresAt: Math.floor(Date.now() / 1000) + Math.min(token.expires_in ?? MAX_AGE, MAX_AGE),
          ...(provider === "vercel" && token.team_id ? { teamId: token.team_id } : {}),
        }, config.secret);
        target.searchParams.set("result", "connected");
      } catch { target.searchParams.set("result", "authorization_failed"); }
    }
  }
  response.headers.set("Location", target.href);
  return response;
}

function protect(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export async function handleCloudRequest(request: NextRequest, providerName: string, action: string, config: CloudConfig | null): Promise<NextResponse> {
  if (providerName !== "vercel" && providerName !== "supabase") return protect(NextResponse.json({ error: "not_found" }, { status: 404 }));
  const provider = providerName;
  try {
    if (request.method !== "GET" && request.headers.get("origin") !== request.nextUrl.origin) throw new CloudError(403, "forbidden");
    if (request.method === "DELETE" && action === "session") {
      const response = NextResponse.json({ disconnected: true });
      setCookie(response, provider, "session", "", 0);
      setCookie(response, provider, "flow", "", 0);
      return protect(response);
    }
    if (!config && request.method === "GET" && action === "session") return protect(NextResponse.json({ configured: false, connected: false, project: null }));
    if (!config) throw new CloudError(503, "setup_required");
    const owner = getOwner(request, config.secret);
    if (request.method === "GET" && action === "start") {
      if (provider === "vercel" && (!config.slug || !/^[a-z0-9-]+$/.test(config.slug))) throw new CloudError(503, "setup_required");
      const flow: Flow = { state: randomBytes(32).toString("base64url"), verifier: randomBytes(32).toString("base64url"), origin: request.nextUrl.origin, owner };
      const url = new URL(provider === "vercel" ? `https://vercel.com/integrations/${config.slug}/new` : "https://api.supabase.com/v1/oauth/authorize");
      url.searchParams.set("state", flow.state);
      if (provider === "supabase") {
        url.searchParams.set("client_id", config.clientId);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("redirect_uri", new URL("/api/cloud/supabase/callback", flow.origin).href);
        url.searchParams.set("code_challenge", createHash("sha256").update(flow.verifier).digest("base64url"));
        url.searchParams.set("code_challenge_method", "S256");
      }
      const response = NextResponse.redirect(url);
      setCookie(response, provider, "flow", createSession(flow, config.secret, 600), 600);
      return protect(response);
    }
    if (request.method === "GET" && action === "callback") return protect(await callback(request, provider, config, owner));
    const session = getSession<CloudSession>(request.cookies.get(getCloudCookieName(provider, "session"))?.value, config.secret);
    if (!session && request.method === "GET" && action === "session") return protect(NextResponse.json({ configured: true, connected: false, project: null }));
    if (!session || session.owner !== owner || session.expiresAt <= Math.floor(Date.now() / 1000)) throw new CloudError(401, "reconnect");
    if (request.method === "GET" && action === "overview") return protect(NextResponse.json(await getCloudOverview(provider, session)));
    if ((request.method === "GET" && (action === "session" || action === "projects")) || (request.method === "POST" && action === "selection")) {
      const projects = await getCloudProjects(provider, session);
      if (action === "projects") return protect(NextResponse.json({ projects }));
      if (action === "session") return protect(NextResponse.json({ configured: true, connected: true, project: projects.find((project) => project.id === session.projectId) ?? null }));
      if (!request.headers.get("content-type")?.startsWith("application/json")) throw new CloudError(400, "invalid_request");
      const body = await request.text();
      if (body.length > 1024) throw new CloudError(400, "invalid_request");
      let input: unknown;
      try { input = JSON.parse(body); } catch { throw new CloudError(400, "invalid_request"); }
      const project = getProjectSelection(input, projects);
      const response = NextResponse.json({ project });
      saveSession(response, provider, { ...session, projectId: project.id }, config.secret);
      return protect(response);
    }
    return protect(NextResponse.json({ error: "not_found" }, { status: 404 }));
  } catch (error) {
    const known = error instanceof CloudError ? error : new CloudError(502, "provider_unavailable");
    const response = NextResponse.json({ error: known.code, message: MESSAGES[known.code] }, { status: known.status });
    if (known.status === 401) setCookie(response, provider, "session", "", 0);
    return protect(response);
  }
}
