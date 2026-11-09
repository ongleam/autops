import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { authorizationMetadata, handleOAuth, ISSUER, MCP_FLOW_COOKIE, MCP_PENDING_COOKIE } from "../lib/mcp/oauth";
import { createSession, getSession } from "../lib/github/session";

const names = ["GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "GITHUB_SESSION_SECRET"];
const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
const redirect = "https://chatgpt.com/connector_platform_oauth_redirect";
const challenge = createHash("sha256").update("test-verifier-with-more-than-forty-three-characters").digest("base64url");
const originalFetch = globalThis.fetch;
beforeEach(() => {
  process.env.GITHUB_APP_CLIENT_ID = "test-client";
  process.env.GITHUB_APP_CLIENT_SECRET = "test-secret";
  process.env.GITHUB_SESSION_SECRET = "test-only-session-secret-with-at-least-32-characters";
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of names) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
});

async function register(redirectUri = redirect) {
  return handleOAuth(new NextRequest(`${ISSUER}/oauth/register`, {
    method: "POST", body: JSON.stringify({ redirect_uris: [redirectUri], token_endpoint_auth_method: "none" }),
  }), "register");
}
function authorize(clientId, values = {}) {
  const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: "code",
    state: "test-state", code_challenge: challenge, code_challenge_method: "S256", ...values });
  return handleOAuth(new NextRequest(`${ISSUER}/oauth/authorize?${query}`), "authorize");
}

test("ChatGPT stable and connection-specific redirects register successfully", async () => {
  expect(authorizationMetadata().authorization_response_iss_parameter_supported).toBe(true);
  expect(authorizationMetadata().grant_types_supported).toEqual(["authorization_code", "refresh_token"]);
  for (const uri of [redirect, "https://chatgpt.com/connector/oauth/test-callback-id"]) {
    const response = await register(uri);
    expect(response.status).toBe(201);
    expect((await response.json()).redirect_uris).toEqual([uri]);
  }
});

const verifier = "test-verifier-with-more-than-forty-three-characters";
const boundScope = "accounts.read cloud.read repository.read repository.write";
const githubTokens = { access_token: "upstream-access", expires_in: 28800, refresh_token: "upstream-refresh", refresh_token_expires_in: 15897600 };
function tokenRequest(values) {
  return handleOAuth(new NextRequest(`${ISSUER}/oauth/token`, {
    method: "POST", body: new URLSearchParams(values).toString(),
  }), "token");
}
function seal(data, purpose, age = 60, now) {
  return createSession(data, `${process.env.GITHUB_SESSION_SECRET}:autops-mcp:${purpose}`, age, now);
}
function unseal(value, purpose) {
  return getSession(value, `${process.env.GITHUB_SESSION_SECRET}:autops-mcp:${purpose}`);
}
async function createGrant(clientId, tokens = githubTokens, refreshAllowed = true) {
  globalThis.fetch = async (url) => {
    if (url === "https://github.com/login/oauth/access_token") return Response.json(tokens);
    if (url === "https://api.github.com/user") return Response.json({ id: 7, login: "alice" });
    throw new Error("Unexpected upstream URL");
  };
  const code = seal({ clientId, redirectUri: redirect, challenge, state: "state", nonce: "nonce", ownerId: 7,
    repositoryId: 42, scope: boundScope, code: "upstream-code", ...(refreshAllowed ? { refreshAllowed: true } : {}) }, "code");
  return tokenRequest({ grant_type: "authorization_code", client_id: clientId, redirect_uri: redirect, code, code_verifier: verifier });
}

test("expiring GitHub grants receive an opaque client-bound refresh token", async () => {
  const { client_id: clientId, grant_types: grantTypes } = await (await register()).json();
  expect(grantTypes).toContain("refresh_token");
  const result = await createGrant(clientId);
  expect(result.status).toBe(200);
  const data = await result.json();
  expect(data.expires_in).toBe(3600);
  expect(data.refresh_token_expires_in).toBe(15897600);
  expect(unseal(data.access_token, "access").authorizationGrant).toBe("authorization_code");
  expect(data.refresh_token).not.toContain("upstream-refresh");
  expect(data.access_token).not.toContain("upstream-access");
  expect(unseal(data.refresh_token, "refresh")).toEqual({ issuer: ISSUER, audience: `${ISSUER}/api/mcp`, scope: boundScope,
    userId: 7, repositoryId: 42, clientIdHash: createHash("sha256").update(clientId).digest("hex"), refreshToken: "upstream-refresh" });
  expect(result.headers.get("cache-control")).toBe("no-store");
});

test("non-expiring GitHub tokens keep one-hour MCP access without a refresh grant", async () => {
  const { client_id: clientId } = await (await register()).json();
  const data = await (await createGrant(clientId, { access_token: "non-expiring-access" })).json();
  expect(data.expires_in).toBe(3600);
  expect(data.refresh_token).toBeUndefined();
});

test("an authorization issued before renewal consent does not gain a refresh grant", async () => {
  const { client_id: clientId } = await (await register()).json();
  const data = await (await createGrant(clientId, githubTokens, false)).json();
  expect(data.expires_in).toBe(3600);
  expect(data.refresh_token).toBeUndefined();
});

test("refresh rotates upstream credentials while preserving identity and narrowing permissions", async () => {
  const { client_id: clientId } = await (await register()).json();
  const initial = await (await createGrant(clientId)).json();
  globalThis.fetch = async (url, options) => {
    if (url === "https://github.com/login/oauth/access_token") {
      expect(options.method).toBe("POST");
      expect(options.body.get("grant_type")).toBe("refresh_token");
      expect(options.body.get("refresh_token")).toBe("upstream-refresh");
      expect(options.body.get("client_id")).toBe("test-client");
      expect(options.body.get("client_secret")).toBe("test-secret");
      return Response.json({ ...githubTokens, access_token: "rotated-access", refresh_token: "rotated-refresh" });
    }
    expect(url).toBe("https://api.github.com/user");
    return Response.json({ id: 7, login: "alice" });
  };
  const response = await tokenRequest({ grant_type: "refresh_token", client_id: clientId, refresh_token: initial.refresh_token,
    scope: "accounts.read repository.read", resource: `${ISSUER}/api/mcp`, repositoryId: "999", userId: "999" });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.scope).toBe("accounts.read repository.read");
  expect(data.expires_in).toBe(3600);
  expect(data.refresh_token).not.toBe(initial.refresh_token);
  expect(unseal(data.refresh_token, "refresh")).toMatchObject({ refreshToken: "rotated-refresh", userId: 7, repositoryId: 42,
    scope: "accounts.read repository.read", issuer: ISSUER, audience: `${ISSUER}/api/mcp` });
  expect(unseal(data.access_token, "access")).toMatchObject({ token: "rotated-access", userId: 7, repositoryId: 42, scope: data.scope, authorizationGrant: "refresh_token" });
  expect(JSON.stringify(data)).not.toContain("rotated-");
  const enlarged = await tokenRequest({ grant_type: "refresh_token", client_id: clientId, refresh_token: data.refresh_token, scope: boundScope });
  expect(enlarged.status).toBe(400);
  expect((await enlarged.json()).error).toBe("invalid_scope");
});

test("refresh rejects wrong client, issuer, audience, scope expansion, expiry and tampering before contacting GitHub", async () => {
  const { client_id: clientId } = await (await register()).json();
  const initial = await (await createGrant(clientId)).json();
  const refresh = unseal(initial.refresh_token, "refresh");
  globalThis.fetch = async () => { throw new Error("Invalid refresh must not contact GitHub"); };
  const values = { grant_type: "refresh_token", client_id: clientId, refresh_token: initial.refresh_token };
  for (const override of [
    { client_id: "other-client" },
    { resource: "https://attacker.example/mcp" },
    { refresh_token: "tampered" },
    { refresh_token: seal({ ...refresh, issuer: "https://attacker.example" }, "refresh") },
    { refresh_token: seal({ ...refresh, audience: "https://attacker.example/mcp" }, "refresh") },
    { refresh_token: seal(refresh, "refresh", 1, Math.floor(Date.now() / 1000) - 10) },
  ]) {
    const response = await tokenRequest({ ...values, ...override });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_grant");
  }
  const expanded = await tokenRequest({ ...values, scope: `${boundScope} admin` });
  expect(expanded.status).toBe(400);
  expect((await expanded.json()).error).toBe("invalid_scope");
});

test("GitHub single-use refresh rotation rejects a replayed MCP refresh token", async () => {
  const { client_id: clientId } = await (await register()).json();
  const initial = await (await createGrant(clientId)).json();
  let consumed = false;
  globalThis.fetch = async (url) => {
    if (url === "https://api.github.com/user") return Response.json({ id: 7, login: "alice" });
    if (consumed) return Response.json({ error: "bad_refresh_token" }, { status: 400 });
    consumed = true;
    return Response.json({ ...githubTokens, refresh_token: "rotated-refresh" });
  };
  const values = { grant_type: "refresh_token", client_id: clientId, refresh_token: initial.refresh_token };
  expect((await tokenRequest(values)).status).toBe(200);
  const replay = await tokenRequest(values);
  expect(replay.status).toBe(400);
  expect((await replay.json()).error).toBe("invalid_grant");
});

test("refresh never issues access for a different GitHub user or an unrotated upstream token", async () => {
  const { client_id: clientId } = await (await register()).json();
  const initial = await (await createGrant(clientId)).json();
  const values = { grant_type: "refresh_token", client_id: clientId, refresh_token: initial.refresh_token };
  for (const tokens of [{ ...githubTokens, refresh_token: "rotated-refresh" }, githubTokens]) {
    globalThis.fetch = async (url) => url === "https://api.github.com/user"
      ? Response.json({ id: 99, login: "bob" }) : Response.json(tokens);
    const response = await tokenRequest(values);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_grant");
  }
});

test("registration rejects attacker origins and unsupported ChatGPT paths", async () => {
  for (const uri of ["https://chatgpt.com.attacker.example/connector/oauth/demo", "https://attacker.example/callback", "https://chatgpt.com/unrelated", `${redirect}#fragment`]) {
    expect((await register(uri)).status).toBe(400);
  }
});

test("authorization rejects forged clients and missing S256 PKCE", async () => {
  expect((await authorize("forged-client")).status).toBe(400);
  const { client_id: clientId } = await (await register()).json();
  expect((await authorize(clientId, { code_challenge: "" })).status).toBe(400);
  expect((await authorize(clientId, { code_challenge_method: "plain" })).status).toBe(400);
  expect((await authorize(clientId, { redirect_uri: "https://attacker.example/callback" })).status).toBe(400);
});

test("repository authorization resumes after onboarding without losing OAuth state", async () => {
  const { client_id: clientId } = await (await register()).json();
  const pending = await authorize(clientId, { scope: "accounts.read repository.read", ignored: "not-preserved" });
  expect(pending.status).toBe(303);
  expect(pending.headers.get("location")).toBe(`${ISSUER}/onboarding`);
  const cookie = pending.cookies.get(MCP_PENDING_COOKIE);
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.secure).toBe(true);
  const resumed = await handleOAuth(new NextRequest(`${ISSUER}/oauth/resume`, {
    headers: { cookie: `${cookie.name}=${cookie.value}` },
  }), "resume");
  const target = new URL(resumed.headers.get("location"));
  expect(target.origin + target.pathname).toBe(`${ISSUER}/oauth/authorize`);
  expect(target.searchParams.get("state")).toBe("test-state");
  expect(target.searchParams.get("code_challenge")).toBe(challenge);
  expect(target.searchParams.get("client_id")).toBe(clientId);
  expect(target.searchParams.has("ignored")).toBe(false);
  expect(resumed.cookies.get(MCP_PENDING_COOKIE).maxAge).toBe(0);
});

test("missing or forged pending authorization returns to onboarding", async () => {
  for (const cookie of ["", `${MCP_PENDING_COOKIE}=forged`]) {
    const response = await handleOAuth(new NextRequest(`${ISSUER}/oauth/resume`, { headers: { cookie } }), "resume");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${ISSUER}/onboarding`);
  }
});

test("denied consent returns bound state and issuer to the registered callback", async () => {
  const { client_id: clientId } = await (await register()).json();
  const authorization = await authorize(clientId);
  expect(authorization.status).toBe(303);
  const flow = new URL(authorization.headers.get("location")).searchParams.get("flow");
  const cookie = authorization.cookies.getAll().find((item) => item.name.startsWith(MCP_FLOW_COOKIE));
  const response = await handleOAuth(new NextRequest(`${ISSUER}/oauth/authorize`, {
    method: "POST", headers: { origin: ISSUER, cookie: `${cookie.name}=${cookie.value}` },
    body: new URLSearchParams({ flow, decision: "deny" }).toString(),
  }), "authorize");
  const callback = new URL(response.headers.get("location"));
  expect(callback.origin + callback.pathname).toBe(redirect);
  expect(callback.searchParams.get("error")).toBe("access_denied");
  expect(callback.searchParams.get("state")).toBe("test-state");
  expect(callback.searchParams.get("iss")).toBe(ISSUER);
});

test("cross-origin authorization and forged token grants are rejected", async () => {
  const consent = await handleOAuth(new NextRequest(`${ISSUER}/oauth/authorize`, {
    method: "POST", headers: { origin: "https://attacker.example" }, body: "decision=allow",
  }), "authorize");
  expect(consent.status).toBe(403);
  const exchange = await handleOAuth(new NextRequest(`${ISSUER}/oauth/token`, {
    method: "POST", body: "grant_type=authorization_code&code=forged&code_verifier=forged",
  }), "token");
  expect(exchange.status).toBe(400);
  expect((await exchange.json()).error).toBe("invalid_grant");
});
