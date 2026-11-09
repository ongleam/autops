import { afterEach, beforeEach, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { handleGitHubRequest } from "../lib/github/handlers";
import { createSession, getSession, getCookieName } from "../lib/github/session";

const originalFetch = globalThis.fetch;
const names = ["GITHUB_APP_ID", "GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "GITHUB_APP_PRIVATE_KEY", "GITHUB_SESSION_SECRET"];
const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
const secret = "test-only-session-secret-with-at-least-32-characters";
beforeEach(() => {
  process.env.GITHUB_APP_ID = "123";
  process.env.GITHUB_APP_CLIENT_ID = "test-client-id";
  process.env.GITHUB_APP_CLIENT_SECRET = "test-client-secret";
  process.env.GITHUB_APP_PRIVATE_KEY = "test-key-not-used-for-user-flow";
  process.env.GITHUB_SESSION_SECRET = secret;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of names) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
});
function request(action, options = {}) { return new NextRequest(`http://localhost:3000/api/github/${action}`, options); }
function sessionCookie(repository) {
  const data = { token: "test-user-token", expiresAt: Math.floor(Date.now() / 1000) + 3600, user: { id: 1, login: "alice" }, repository };
  return `${getCookieName("session")}=${createSession(data, secret, 3600)}`;
}

test("OAuth start sends random state and PKCE with an HttpOnly flow cookie", async () => {
  const result = await handleGitHubRequest(request("start"), "start");
  expect(result.status).toBe(307);
  const location = new URL(result.headers.get("location"));
  expect(location.origin).toBe("https://github.com");
  expect(location.searchParams.get("code_challenge_method")).toBe("S256");
  expect(location.searchParams.get("state").length).toBeGreaterThan(30);
  expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/github/callback");
  expect(result.headers.get("set-cookie")).toContain("HttpOnly");
});

test("forged OAuth callback never exchanges a code", async () => {
  globalThis.fetch = async () => { throw new Error("must not call GitHub"); };
  const result = await handleGitHubRequest(request("callback?code=attacker&state=forged"), "callback");
  expect(result.status).toBe(303);
  expect(result.headers.get("location")).toBe("http://localhost:3000/onboarding?error=invalid_oauth_state");
});

test("valid callback exchanges PKCE and sets encrypted session without returning token", async () => {
  const flow = createSession({ state: "test-state", verifier: "test-verifier", origin: "http://localhost:3000" }, secret, 600);
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url, options]);
    if (url === "https://github.com/login/oauth/access_token") return Response.json({ access_token: "test-private-token", expires_in: 3600 });
    if (url === "https://api.github.com/user") return Response.json({ id: 1, login: "alice" });
    throw new Error("unexpected URL");
  };
  const result = await handleGitHubRequest(request("callback?code=test-code&state=test-state", { headers: { cookie: `${getCookieName("flow")}=${flow}` } }), "callback");
  expect(result.status).toBe(303);
  expect(calls[0][1].body.get("code_verifier")).toBe("test-verifier");
  expect(result.cookies.get(getCookieName("session")).value).not.toContain("test-private-token");
  expect(result.headers.get("cache-control")).toBe("no-store");
});

test("cross-origin selection and unauthenticated repository requests are rejected", async () => {
  const denied = await handleGitHubRequest(request("selection", { method: "POST", headers: { origin: "https://attacker.example" } }), "selection");
  expect(denied.status).toBe(403);
  const result = await handleGitHubRequest(request("repositories"), "repositories");
  expect(result.status).toBe(401);
});

test("selection rechecks GitHub access and stores canonical repository metadata", async () => {
  globalThis.fetch = async (url) => {
    if (url.includes("/user/installations?")) return Response.json({ installations: [{ id: 10, app_id: 123, suspended_at: null }] });
    return Response.json({ repositories: [{ id: 5, full_name: "alice/project", default_branch: "develop", private: true, archived: false, disabled: false }] });
  };
  const result = await handleGitHubRequest(request("selection", {
    method: "POST", headers: { origin: "http://localhost:3000", cookie: sessionCookie(), "content-type": "application/json" },
    body: JSON.stringify({ repositoryId: 5, installationId: 10, fullName: "attacker/override" }),
  }), "selection");
  expect(result.status).toBe(200);
  expect((await result.json()).repository.fullName).toBe("alice/project");
  const saved = getSession(result.cookies.get(getCookieName("session")).value, secret);
  expect(saved.repository.defaultBranch).toBe("develop");
});

test("removed repository access is not reported as connected", async () => {
  globalThis.fetch = async () => Response.json({ installations: [] });
  const result = await handleGitHubRequest(request("session", { headers: { cookie: sessionCookie({ id: 5, installationId: 10, fullName: "alice/project" }) } }), "session");
  expect((await result.json()).repository).toBeNull();
});

test("disconnect clears this session and never uninstalls the shared GitHub App", async () => {
  globalThis.fetch = async () => { throw new Error("must not uninstall"); };
  const result = await handleGitHubRequest(request("session", { method: "DELETE", headers: { origin: "http://localhost:3000" } }), "session");
  expect(result.status).toBe(200);
  expect(result.headers.get("set-cookie")).toContain("Max-Age=0");
});

test("unconfigured server reports setup required and does not simulate connection", async () => {
  delete process.env.GITHUB_APP_ID;
  const result = await handleGitHubRequest(request("session"), "session");
  expect(await result.json()).toEqual({ configured: false, user: null, repository: null });
});
