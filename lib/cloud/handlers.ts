import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSession, getSession, getCookieName, type GitHubSession } from "../github/session";
import { createGitHubClient } from "../github/client";
import { CloudError, getCloudProjects, getCloudOverview, getProjectSelection, type CloudConfig, type CloudSession, type Provider } from "./client";
import { getCloudConnectionStatus, parseCloudToken, withCloudConnection } from "./connections";
import { disconnectConnection, hasConnectionStore, readConnection, saveConnection } from "./store";

const MESSAGES: Record<string, string> = {
  setup_required: "Service connection setup is required. Contact your administrator.",
  storage_unavailable: "Connection storage is unavailable. Your saved connection has not been removed. Try again later.",
  github_required: "Sign in with GitHub first.",
  reconnect: "Authorization was revoked or could not be refreshed. Reconnect to continue.",
  reauthorization_required: "Authorization was revoked or could not be refreshed. Reconnect to continue.",
  not_connected: "Connect this service once to save it to your account.",
  forbidden: "Please try again from this page.",
  project_forbidden: "You do not have access to this project. Review the projects allowed by the service.",
  invalid_request: "Check the request format.", select_project: "Select a project to inspect first.",
  provider_unavailable: "Could not check service information. Your saved connection has not been removed.",
  connection_changed: "The connection changed during this request. Refresh and try again.",
  refresh_in_progress: "The connection is being refreshed. Try again shortly.",
};
type Flow = { state: string; verifier: string; origin: string; owner: string };
export function getCloudCookieName(provider: Provider, kind: "session" | "flow") {
  return `${process.env.NODE_ENV === "production" ? "__Host-" : ""}autops-${provider}-${kind}`;
}
function setCookie(response: NextResponse, provider: Provider, kind: "session" | "flow", value: string, maxAge: number) {
  response.cookies.set(getCloudCookieName(provider, kind), value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
}
async function getIdentity(request: NextRequest) {
  const secret = process.env.GITHUB_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new CloudError(503, "setup_required");
  const github = getSession<GitHubSession>(request.cookies.get(getCookieName("session"))?.value, secret);
  if (!github || github.expiresAt <= Math.floor(Date.now() / 1000)) throw new CloudError(401, "github_required");
  const user = await createGitHubClient(github.token).getUser();
  if (user.id !== github.user.id) throw new CloudError(401, "github_required");
  return { owner: String(user.id), github, secret };
}
function hasMatchingState(received: string | null, expected: string) {
  if (!received || received.length > 256) return false;
  const actual = Buffer.from(received), reference = Buffer.from(expected);
  return actual.length === reference.length && timingSafeEqual(actual, reference);
}
function target(request: NextRequest, provider: Provider, result: string) {
  const url = new URL("/onboarding", request.url);
  url.search = new URLSearchParams({ cloud: provider, result }).toString();
  return url;
}
async function callback(request: NextRequest, provider: Provider, config: CloudConfig, owner: string) {
  let result = "invalid_oauth_state";
  const flow = getSession<Flow>(request.cookies.get(getCloudCookieName(provider, "flow"))?.value, config.secret);
  if (flow && flow.owner === owner && flow.origin === request.nextUrl.origin && hasMatchingState(request.nextUrl.searchParams.get("state"), flow.state)) {
    if (request.nextUrl.searchParams.has("error")) result = "access_denied";
    else {
      const code = request.nextUrl.searchParams.get("code");
      if (code && code.length <= 1024) {
        try {
          const redirectUri = new URL(`/api/cloud/${provider}/callback`, flow.origin).href;
          const body: Record<string, string> = provider === "vercel" ? { client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: redirectUri }
            : { grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: flow.verifier };
          const response = await fetch(provider === "vercel" ? "https://api.vercel.com/v2/oauth/access_token" : "https://api.supabase.com/v1/oauth/token", {
            method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json",
              ...(provider === "supabase" ? { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}` } : {}) },
            body: new URLSearchParams(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) throw new CloudError(401, "reauthorization_required");
          const session = parseCloudToken(provider, await response.json(), owner);
          const projects = await getCloudProjects(provider, session);
          const previous = await readConnection(owner, provider);
          const previousProject = previous?.session?.projectId;
          await saveConnection(provider, { ...session, ...(projects.some((project) => project.id === previousProject) ? { projectId: previousProject } : {}) });
          result = "connected";
        } catch (error) { result = error instanceof CloudError && error.code === "storage_unavailable" ? "storage_unavailable" : "authorization_failed"; }
      }
    }
  }
  const response = NextResponse.redirect(target(request, provider, result), 303);
  setCookie(response, provider, "flow", "", 0);
  setCookie(response, provider, "session", "", 0);
  return response;
}
function protect(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer"); response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export async function handleCloudRequest(request: NextRequest, providerName: string, action: string, config: CloudConfig | null): Promise<NextResponse> {
  if (providerName !== "vercel" && providerName !== "supabase") return protect(NextResponse.json({ error: "not_found" }, { status: 404 }));
  const provider = providerName;
  try {
    if (request.method !== "GET" && request.headers.get("origin") !== request.nextUrl.origin) throw new CloudError(403, "forbidden");
    const { owner, github, secret } = await getIdentity(request);
    if (!hasConnectionStore()) throw new CloudError(503, "storage_unavailable");
    if (request.method === "DELETE" && action === "session") {
      await disconnectConnection(owner, provider);
      const response = NextResponse.json({ disconnected: true });
      setCookie(response, provider, "session", "", 0); setCookie(response, provider, "flow", "", 0);
      return protect(response);
    }
    if (!config && request.method === "GET" && action === "session") return protect(NextResponse.json({ configured: false, connected: false, status: "setup_required", project: null }));
    if (!config) throw new CloudError(503, "setup_required");
    // Only migrate a legacy browser credential whose original authenticated owner still matches.
    const legacy = getSession<CloudSession>(request.cookies.get(getCloudCookieName(provider, "session"))?.value, secret);
    if (legacy && legacy.expiresAt && legacy.expiresAt > Math.floor(Date.now() / 1000) &&
      legacy.owner === createHash("sha256").update(`${github.user.id}:${github.token}`).digest("hex") && !(await readConnection(owner, provider))) {
      await getCloudProjects(provider, legacy);
      await saveConnection(provider, { ...legacy, owner, expiresAt: provider === "vercel" ? null : legacy.expiresAt });
    }
    if (request.method === "GET" && action === "start") {
      const existing = await getCloudConnectionStatus(owner, provider);
      if (existing.connected) return protect(NextResponse.redirect(target(request, provider, "connected"), 303));
      if (existing.status === "unavailable") throw new CloudError(503, "provider_unavailable");
      const flow: Flow = { state: randomBytes(32).toString("base64url"), verifier: randomBytes(32).toString("base64url"), origin: request.nextUrl.origin, owner };
      const url = new URL(provider === "vercel" ? `https://vercel.com/integrations/${config.slug}/new` : "https://api.supabase.com/v1/oauth/authorize");
      url.searchParams.set("state", flow.state);
      if (provider === "supabase") {
        url.searchParams.set("client_id", config.clientId); url.searchParams.set("response_type", "code");
        url.searchParams.set("redirect_uri", new URL("/api/cloud/supabase/callback", flow.origin).href);
        url.searchParams.set("code_challenge", createHash("sha256").update(flow.verifier).digest("base64url")); url.searchParams.set("code_challenge_method", "S256");
      }
      const response = NextResponse.redirect(url);
      setCookie(response, provider, "flow", createSession(flow, config.secret, 600), 600);
      return protect(response);
    }
    if (request.method === "GET" && action === "callback") return protect(await callback(request, provider, config, owner));
    if (request.method === "GET" && action === "session") {
      const status = await getCloudConnectionStatus(owner, provider);
      if (status.status === "unavailable") throw new CloudError(503, "provider_unavailable");
      return protect(NextResponse.json(status));
    }
    const result = await withCloudConnection(owner, provider, async (session, revision) => {
      if (request.method === "GET" && action === "overview") return getCloudOverview(provider, session);
      if (request.method === "GET" && action === "projects") return { projects: await getCloudProjects(provider, session) };
      if (request.method === "POST" && action === "selection") {
        if (!request.headers.get("content-type")?.startsWith("application/json")) throw new CloudError(400, "invalid_request");
        const body = await request.text();
        if (body.length > 1024) throw new CloudError(400, "invalid_request");
        let input: unknown; try { input = JSON.parse(body); } catch { throw new CloudError(400, "invalid_request"); }
        const project = getProjectSelection(input, await getCloudProjects(provider, session));
        await saveConnection(provider, { ...session, projectId: project.id }, revision);
        return { project };
      }
      throw new CloudError(404, "not_found");
    });
    return protect(NextResponse.json(result));
  } catch (error) {
    const known = error instanceof CloudError ? error : new CloudError(502, "provider_unavailable");
    return protect(NextResponse.json({ error: known.code, message: MESSAGES[known.code] ?? "Could not complete the request." }, { status: known.status }));
  }
}
