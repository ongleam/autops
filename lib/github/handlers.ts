import { handleMcpGitHubCallback } from "../mcp/oauth";
import { createHash, createPrivateKey, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAppJwt, createGitHubClient, GitHubError, validateSelection } from "./client";
import { createSession, getSession, getCookieName, type GitHubSession, type OAuthFlow } from "./session";

const MAX_SESSION_AGE = 8 * 60 * 60;
const MESSAGES: Record<string, string> = {
  setup_required: "GitHub App 서버 설정이 필요해요. 관리자에게 문의해주세요.",
  reconnect: "GitHub 인증이 만료되었거나 해제됐어요. 다시 연결해주세요.",
  forbidden: "이 요청을 허용할 수 없어요. 현재 페이지에서 다시 시도해주세요.",
  invalid_repository: "연결할 저장소를 선택해주세요.",
  repository_forbidden: "이 저장소의 접근 권한이 없어요. GitHub에서 허용한 저장소를 확인해주세요.",
  github_unavailable: "GitHub 정보를 가져오지 못했어요. 잠시 후 다시 시도해주세요.",
  invalid_request: "요청 형식을 확인해주세요.",
};

function getConfig() {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const secret = process.env.GITHUB_SESSION_SECRET;
  if (!appId || !/^\d+$/.test(appId) || !clientId || !clientSecret || !privateKey || !secret || secret.length < 32) return null;
  return { appId, clientId, clientSecret, privateKey, secret };
}

function protect(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

function setCookie(response: NextResponse, kind: "session" | "flow", value: string, maxAge: number) {
  response.cookies.set(getCookieName(kind), value, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge,
  });
}

function saveSession(response: NextResponse, session: GitHubSession, secret: string) {
  const lifetime = Math.min(MAX_SESSION_AGE, session.expiresAt - Math.floor(Date.now() / 1000));
  const value = createSession(session, secret, lifetime);
  if (value.length > 3800 || lifetime <= 0) throw new GitHubError(401, "reconnect");
  setCookie(response, "session", value, lifetime);
}

function requireSession(request: NextRequest, secret: string) {
  const session = getSession<GitHubSession>(request.cookies.get(getCookieName("session"))?.value, secret);
  if (!session || session.expiresAt <= Math.floor(Date.now() / 1000)) throw new GitHubError(401, "reconnect");
  return session;
}

function hasMatchingState(received: string | null, expected: string) {
  if (!received) return false;
  const actual = Buffer.from(received);
  const reference = Buffer.from(expected);
  return actual.length === reference.length && timingSafeEqual(actual, reference);
}

async function callback(request: NextRequest, config: NonNullable<ReturnType<typeof getConfig>>) {
  const target = new URL("/onboarding", request.url);
  const response = NextResponse.redirect(target, 303);
  const flow = getSession<OAuthFlow>(request.cookies.get(getCookieName("flow"))?.value, config.secret);
  setCookie(response, "flow", "", 0);
  if (!flow || flow.origin !== request.nextUrl.origin || !hasMatchingState(request.nextUrl.searchParams.get("state"), flow.state)) {
    target.searchParams.set("error", "invalid_oauth_state");
  } else if (request.nextUrl.searchParams.has("error")) {
    target.searchParams.set("error", "access_denied");
  } else {
    const code = request.nextUrl.searchParams.get("code");
    if (!code || code.length > 512) {
      target.searchParams.set("error", "invalid_oauth_state");
    } else {
      try {
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST", headers: { Accept: "application/json" },
          body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code,
            redirect_uri: new URL("/api/github/callback", flow.origin).href, code_verifier: flow.verifier }),
          cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
        });
        if (!tokenResponse.ok) throw new GitHubError(502, "github_unavailable");
        const token = await tokenResponse.json();
        if (typeof token.access_token !== "string" || !token.access_token || token.error) throw new GitHubError(401, "reconnect");
        const user = await createGitHubClient(token.access_token).getUser();
        const lifetime = Number.isSafeInteger(token.expires_in) && token.expires_in > 0 ? Math.min(token.expires_in, MAX_SESSION_AGE) : MAX_SESSION_AGE;
        saveSession(response, { token: token.access_token, expiresAt: Math.floor(Date.now() / 1000) + lifetime, user }, config.secret);
      } catch {
        target.searchParams.set("error", "authorization_failed");
      }
    }
  }
  response.headers.set("Location", target.href);
  return response;
}

export async function handleGitHubRequest(request: NextRequest, action: string): Promise<NextResponse> {
  try {
    if (request.method !== "GET" && request.headers.get("origin") !== request.nextUrl.origin) throw new GitHubError(403, "forbidden");
    // Clearing the browser session must remain possible even during configuration changes.
    if (request.method === "DELETE" && action === "session") {
      const response = NextResponse.json({ disconnected: true });
      setCookie(response, "session", "", 0);
      setCookie(response, "flow", "", 0);
      return protect(response);
    }
    const config = getConfig();
    if (!config && request.method === "GET" && action === "session") return protect(NextResponse.json({ configured: false, user: null, repository: null }));
    if (!config) throw new GitHubError(503, "setup_required");

    if (request.method === "GET" && action === "start") {
      const state = randomBytes(32).toString("base64url");
      const verifier = randomBytes(32).toString("base64url");
      const flow: OAuthFlow = { state, verifier, origin: request.nextUrl.origin };
      const url = new URL("https://github.com/login/oauth/authorize");
      url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: new URL("/api/github/callback", flow.origin).href,
        state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
      const response = NextResponse.redirect(url);
      setCookie(response, "flow", createSession(flow, config.secret, 600), 600);
      return protect(response);
    }
    if (request.method === "GET" && action === "callback") {
      if (request.nextUrl.searchParams.get("state")?.startsWith("mcp.")) return protect(handleMcpGitHubCallback(request));
      return protect(await callback(request, config));
    }
    if (request.method === "GET" && action === "session" && !request.cookies.has(getCookieName("session"))) {
      return protect(NextResponse.json({ configured: true, user: null, repository: null }));
    }

    const session = requireSession(request, config.secret);
    if (request.method === "GET" && action === "install") {
      const jwt = createAppJwt(config.appId, createPrivateKey(config.privateKey));
      const app = await createGitHubClient(jwt).getApp();
      return protect(NextResponse.redirect(`https://github.com/apps/${app.slug}/installations/new`));
    }
    if ((request.method === "GET" && (action === "repositories" || action === "session")) || (request.method === "POST" && action === "selection")) {
      const repositories = await createGitHubClient(session.token).getRepositories(config.appId);
      if (action === "repositories") return protect(NextResponse.json({ repositories }));
      if (action === "selection") {
        if (!request.headers.get("content-type")?.startsWith("application/json")) throw new GitHubError(400, "invalid_request");
        const body = await request.text();
        if (body.length > 1024) throw new GitHubError(400, "invalid_request");
        let input: unknown;
        try { input = JSON.parse(body); } catch { throw new GitHubError(400, "invalid_request"); }
        const repository = validateSelection(input, repositories);
        const response = NextResponse.json({ repository });
        saveSession(response, { ...session, repository }, config.secret);
        return protect(response);
      }
      const repository = repositories.find((item) => item.id === session.repository?.id && item.installationId === session.repository?.installationId) || null;
      return protect(NextResponse.json({ configured: true, user: session.user, repository }));
    }
    return protect(NextResponse.json({ error: "not_found" }, { status: 404 }));
  } catch (error) {
    const known = error instanceof GitHubError ? error : new GitHubError(502, "github_unavailable");
    const response = NextResponse.json({ error: known.code, message: MESSAGES[known.code] }, { status: known.status });
    if (known.status === 401) setCookie(response, "session", "", 0);
    return protect(response);
  }
}
