import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { authorizationMetadata, handleOAuth, ISSUER, MCP_FLOW_COOKIE } from "../lib/mcp/oauth";

const names = ["GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "GITHUB_SESSION_SECRET"];
const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
const redirect = "https://chatgpt.com/connector_platform_oauth_redirect";
const challenge = createHash("sha256").update("test-verifier-with-more-than-forty-three-characters").digest("base64url");
beforeEach(() => {
  process.env.GITHUB_APP_CLIENT_ID = "test-client";
  process.env.GITHUB_APP_CLIENT_SECRET = "test-secret";
  process.env.GITHUB_SESSION_SECRET = "test-only-session-secret-with-at-least-32-characters";
});
afterEach(() => {
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
  for (const uri of [redirect, "https://chatgpt.com/connector/oauth/test-callback-id"]) {
    const response = await register(uri);
    expect(response.status).toBe(201);
    expect((await response.json()).redirect_uris).toEqual([uri]);
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

test("denied consent returns bound state and issuer to the registered callback", async () => {
  const { client_id: clientId } = await (await register()).json();
  const authorization = await authorize(clientId);
  expect(authorization.status).toBe(303);
  const flow = new URL(authorization.headers.get("location")).searchParams.get("flow");
  const nonce = authorization.cookies.get(MCP_FLOW_COOKIE).value;
  const response = await handleOAuth(new NextRequest(`${ISSUER}/oauth/authorize`, {
    method: "POST", headers: { origin: ISSUER, cookie: `${MCP_FLOW_COOKIE}=${nonce}` },
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
