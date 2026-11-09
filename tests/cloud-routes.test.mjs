import { afterEach, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { handleCloudRequest, getCloudCookieName } from "../lib/cloud/handlers";
import { createSession, getCookieName, getSession } from "../lib/github/session";

const secret = "test-only-secret-with-at-least-32-characters";
const config = { clientId: "test-client", clientSecret: "test-secret", slug: "autops-test", secret };
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const github = { token: "github-test-token", expiresAt: Math.floor(Date.now() / 1000) + 3600, user: { id: 1, login: "alice" } };
const githubCookie = `${getCookieName("session")}=${createSession(github, secret, 3600)}`;
function request(provider, action, options = {}) {
  return new NextRequest(`http://localhost:3000/api/cloud/${provider}/${action}`, {
    ...options, headers: { cookie: githubCookie, ...options.headers },
  });
}
async function connect(provider) {
  const start = await handleCloudRequest(request(provider, "start"), provider, "start", config);
  const flowName = getCloudCookieName(provider, "flow");
  const flowCookie = start.cookies.get(flowName).value;
  const flow = getSession(flowCookie, secret);
  globalThis.fetch = async (url) => {
    expect(String(url)).toContain(provider === "vercel" ? "api.vercel.com/v2/oauth/access_token" : "api.supabase.com/v1/oauth/token");
    return Response.json({ access_token: "private-cloud-token", expires_in: 3600, team_id: provider === "vercel" ? "team_1" : undefined });
  };
  const callback = await handleCloudRequest(request(provider, `callback?code=code&state=${flow.state}`, {
    headers: { cookie: `${githubCookie}; ${flowName}=${flowCookie}` },
  }), provider, "callback", config);
  expect(callback.headers.get("location")).toBe(`http://localhost:3000/onboarding?cloud=${provider}&result=connected`);
  const sessionName = getCloudCookieName(provider, "session");
  return { cookie: `${githubCookie}; ${sessionName}=${callback.cookies.get(sessionName).value}`, callback };
}

test("unconfigured provider is explicit and does not start OAuth", async () => {
  const result = await handleCloudRequest(request("vercel", "session"), "vercel", "session", null);
  expect(await result.json()).toEqual({ configured: false, connected: false, project: null });
});

test("start requires GitHub identity and creates isolated state; Supabase uses PKCE", async () => {
  const denied = await handleCloudRequest(request("vercel", "start", { headers: { cookie: "" } }), "vercel", "start", config);
  expect(denied.status).toBe(401);
  for (const provider of ["vercel", "supabase"]) {
    const result = await handleCloudRequest(request(provider, "start"), provider, "start", config);
    const url = new URL(result.headers.get("location"));
    expect(url.searchParams.get("state").length).toBeGreaterThan(30);
    expect(result.headers.get("set-cookie")).toContain("HttpOnly");
    expect(url.origin).toBe(provider === "vercel" ? "https://vercel.com" : "https://api.supabase.com");
    if (provider === "supabase") expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  }
});

test("forged callback does not exchange tokens or trust a redirect URL", async () => {
  globalThis.fetch = async () => { throw new Error("must not call upstream"); };
  const result = await handleCloudRequest(request("vercel", "callback?code=x&state=forged&next=https://evil.example"), "vercel", "callback", config);
  expect(result.headers.get("location")).toBe("http://localhost:3000/onboarding?cloud=vercel&result=invalid_oauth_state");
});

test("provider callbacks keep tokens encrypted and out of response bodies", async () => {
  for (const provider of ["vercel", "supabase"]) {
    const { callback } = await connect(provider);
    expect(callback.headers.get("set-cookie")).not.toContain("private-cloud-token");
    expect(await callback.text()).not.toContain("private-cloud-token");
    expect(callback.headers.get("cache-control")).toBe("no-store");
  }
});

test("selection is checked against provider access and ignores supplied metadata", async () => {
  const { cookie } = await connect("supabase");
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([String(url), options.method]);
    return Response.json([{ id: "project-ref", name: "My database", region: "ap-northeast-2", status: "ACTIVE_HEALTHY", database: { password: "never-return-this" } }]);
  };
  const selection = (projectId) => handleCloudRequest(request("supabase", "selection", {
    method: "POST", headers: { cookie, origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify({ projectId, name: "forged" }),
  }), "supabase", "selection", config);
  expect((await selection("inaccessible")).status).toBe(403);
  const result = await selection("project-ref");
  expect(await result.json()).toEqual({ project: { id: "project-ref", name: "My database", region: "ap-northeast-2", status: "ACTIVE_HEALTHY" } });
  expect(calls.every(([, method]) => method === "GET")).toBe(true);
});

test("cross-origin writes, unknown providers, and upstream permission failures are rejected", async () => {
  expect((await handleCloudRequest(request("vercel", "selection", { method: "POST", headers: { origin: "https://evil.example" } }), "vercel", "selection", config)).status).toBe(403);
  expect((await handleCloudRequest(request("unknown", "start"), "unknown", "start", config)).status).toBe(404);
  const { cookie } = await connect("vercel");
  globalThis.fetch = async () => new Response("private provider error", { status: 403 });
  const result = await handleCloudRequest(request("vercel", "projects", { headers: { cookie } }), "vercel", "projects", config);
  expect(result.status).toBe(403);
  expect(await result.text()).not.toContain("private provider error");
});

test("OAuth callback is bound to the GitHub account that started it", async () => {
  const start = await handleCloudRequest(request("supabase", "start"), "supabase", "start", config);
  const flowName = getCloudCookieName("supabase", "flow");
  const encryptedFlow = start.cookies.get(flowName).value;
  const flow = getSession(encryptedFlow, secret);
  const other = `${getCookieName("session")}=${createSession({ ...github, user: { id: 2, login: "bob" } }, secret, 3600)}`;
  globalThis.fetch = async () => { throw new Error("must not exchange for different owner"); };
  const result = await handleCloudRequest(request("supabase", `callback?code=x&state=${flow.state}`, {
    headers: { cookie: `${other}; ${flowName}=${encryptedFlow}` },
  }), "supabase", "callback", config);
  expect(result.headers.get("location")).toContain("result=invalid_oauth_state");
  expect(result.cookies.get(getCloudCookieName("supabase", "session"))).toBeUndefined();
});

test("expired, tampered, or different-owner sessions never query the provider", async () => {
  const { cookie, callback } = await connect("vercel");
  const sessionName = getCloudCookieName("vercel", "session");
  const session = getSession(callback.cookies.get(sessionName).value, secret);
  globalThis.fetch = async () => { throw new Error("must not query provider"); };
  for (const value of [createSession({ ...session, expiresAt: 1 }, secret, 3600), createSession({ ...session, owner: "someone-else" }, secret, 3600), "tampered"]) {
    const result = await handleCloudRequest(request("vercel", "overview", { headers: { cookie: `${githubCookie}; ${sessionName}=${value}` } }), "vercel", "overview", config);
    expect(result.status).toBe(401);
  }
  const missingOtherProvider = await handleCloudRequest(request("supabase", "session", { headers: { cookie } }), "supabase", "session", config);
  expect((await missingOtherProvider.json()).connected).toBe(false);
});

test("Vercel follows pagination with team scope and never returns provider secrets", async () => {
  const { cookie } = await connect("vercel");
  const urls = [];
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    urls.push(url);
    expect(options.method).toBe("GET");
    expect(url.searchParams.get("teamId")).toBe("team_1");
    return Response.json({
      projects: [{ id: url.searchParams.has("until") ? "prj_2" : "prj_1", name: "Website", framework: "nextjs", env: [{ value: "secret-value" }] }],
      pagination: { next: url.searchParams.has("until") ? null : 123 },
    });
  };
  const result = await handleCloudRequest(request("vercel", "projects", { headers: { cookie } }), "vercel", "projects", config);
  const data = await result.json();
  expect(data.projects.map((project) => project.id)).toEqual(["prj_1", "prj_2"]);
  expect(JSON.stringify(data)).not.toContain("secret-value");
  expect(urls[1].searchParams.get("until")).toBe("123");
});

test("selected Vercel overview contains only safe fields and requests only that project", async () => {
  const { cookie, callback } = await connect("vercel");
  const sessionName = getCloudCookieName("vercel", "session");
  const session = getSession(callback.cookies.get(sessionName).value, secret);
  const selectedCookie = `${githubCookie}; ${sessionName}=${createSession({ ...session, projectId: "prj_1" }, secret, 3600)}`;
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    expect(options.method).toBe("GET");
    expect(url.searchParams.get("teamId")).toBe("team_1");
    if (url.pathname === "/v9/projects/prj_1") return Response.json({ id: "prj_1", name: "Website", framework: "nextjs", env: [{ value: "private-env" }] });
    expect(url.pathname).toBe("/v6/deployments");
    expect(url.searchParams.get("projectId")).toBe("prj_1");
    return Response.json({ deployments: [{ uid: "dpl_1", state: "READY", created: 1000, meta: { secret: "private-meta" } }] });
  };
  const result = await handleCloudRequest(request("vercel", "overview", { headers: { cookie: selectedCookie } }), "vercel", "overview", config);
  const data = await result.json();
  expect(data.project).toEqual({ id: "prj_1", name: "Website", framework: "nextjs" });
  expect(data.deployment).toEqual({ id: "dpl_1", state: "READY", createdAt: 1000 });
  expect(JSON.stringify(data)).not.toContain("private-");
  const unselected = await handleCloudRequest(request("vercel", "overview", { headers: { cookie } }), "vercel", "overview", config);
  expect(unselected.status).toBe(400);
});

test("Supabase overview strips connection details and never requests SQL or API keys", async () => {
  const { callback } = await connect("supabase");
  const sessionName = getCloudCookieName("supabase", "session");
  const session = getSession(callback.cookies.get(sessionName).value, secret);
  const cookie = `${githubCookie}; ${sessionName}=${createSession({ ...session, projectId: "project-ref" }, secret, 3600)}`;
  globalThis.fetch = async (input, options) => {
    expect(String(input)).toBe("https://api.supabase.com/v1/projects/project-ref");
    expect(options.method).toBe("GET");
    return Response.json({ id: "project-ref", name: "Database", region: "ap-northeast-2", status: "ACTIVE_HEALTHY", database: { host: "private-host" } });
  };
  const result = await handleCloudRequest(request("supabase", "overview", { headers: { cookie } }), "supabase", "overview", config);
  const data = await result.json();
  expect(data.project.status).toBe("ACTIVE_HEALTHY");
  expect(JSON.stringify(data)).not.toContain("private-host");
});

test("removed selection is not reported connected to a project, and 401 clears provider session", async () => {
  const { callback } = await connect("supabase");
  const sessionName = getCloudCookieName("supabase", "session");
  const session = getSession(callback.cookies.get(sessionName).value, secret);
  const cookie = `${githubCookie}; ${sessionName}=${createSession({ ...session, projectId: "removed" }, secret, 3600)}`;
  globalThis.fetch = async () => Response.json([]);
  const result = await handleCloudRequest(request("supabase", "session", { headers: { cookie } }), "supabase", "session", config);
  expect((await result.json()).project).toBeNull();
  globalThis.fetch = async () => new Response("revoked", { status: 401 });
  const revoked = await handleCloudRequest(request("supabase", "projects", { headers: { cookie } }), "supabase", "projects", config);
  expect(revoked.status).toBe(401);
  expect(revoked.cookies.get(sessionName).value).toBe("");
});

test("disconnect works without server config and only clears browser cookies", async () => {
  globalThis.fetch = async () => { throw new Error("must not revoke shared installation"); };
  const result = await handleCloudRequest(request("vercel", "session", { method: "DELETE", headers: { origin: "http://localhost:3000" } }), "vercel", "session", null);
  expect(result.status).toBe(200);
  expect(result.cookies.get(getCloudCookieName("vercel", "session")).value).toBe("");
});
