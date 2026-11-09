import { expect, test } from "bun:test";
import { createPrivateKey, generateKeyPairSync, verify } from "node:crypto";
import { createSession, getSession, readSession, getCookieName } from "../lib/github/session";
import { createGitHubClient, createAppJwt, validateSelection } from "../lib/github/client";

const secret = "test-only-session-secret-with-at-least-32-characters";

test("session encrypts credentials, rejects tampering, and expires", () => {
  const value = createSession({ token: "test-private-token" }, secret, 60, 1000);
  expect(value).not.toContain("test-private-token");
  expect(getSession(value, secret, 1001)).toEqual({ token: "test-private-token" });
  expect(readSession(value, secret, 1001)).toEqual({ data: { token: "test-private-token" }, expiresAt: 1060 });
  expect(readSession(value, secret, 1060)).toBeNull();
  expect(readSession(value, secret + "other", 1001)).toBeNull();
  expect(getSession(value, secret, 1060)).toBeNull();
  expect(getSession(value.slice(0, -4) + "abcd", secret, 1001)).toBeNull();
  expect(getSession(value, secret + "other", 1001)).toBeNull();
});

test("session cookies use production host restrictions", () => {
  expect(getCookieName("session", true)).toBe("__Host-autops-github-session");
  expect(getCookieName("session", false)).toBe("autops-github-session");
});

test("App JWT uses RS256 and a short expiration", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwt = createAppJwt("123", createPrivateKey(privateKey.export({ type: "pkcs8", format: "pem" })), 1000);
  const [header, payload, signature] = jwt.split(".");
  expect(JSON.parse(Buffer.from(header, "base64url"))).toEqual({ alg: "RS256", typ: "JWT" });
  expect(JSON.parse(Buffer.from(payload, "base64url"))).toEqual({ iss: "123", iat: 940, exp: 1540 });
  expect(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url"))).toBe(true);
});

test("repository discovery follows all pages and excludes suspended or foreign installations", async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push([url, options]);
    const path = new URL(url).pathname + new URL(url).search;
    if (path === "/user/installations?per_page=100&page=1") return Response.json({ installations: [
      { id: 10, app_id: 123, suspended_at: null },
      { id: 20, app_id: 999, suspended_at: null },
      { id: 30, app_id: 123, suspended_at: "2026-01-01" },
    ] });
    if (path === "/user/installations/10/repositories?per_page=100&page=1") return Response.json({ repositories: [
      { id: 1, full_name: "alice/project", default_branch: "develop", private: true, archived: false, disabled: false },
    ] }, { headers: { link: '<https://api.github.com/user/installations/10/repositories?per_page=100&page=2>; rel="next"' } });
    if (path === "/user/installations/10/repositories?per_page=100&page=2") return Response.json({ repositories: [
      { id: 2, full_name: "alice/second", default_branch: "main", private: false, archived: false, disabled: false },
    ] });
    throw new Error("unexpected request: " + path);
  };
  const repositories = await createGitHubClient("test-token", request).getRepositories("123");
  expect(repositories).toHaveLength(2);
  expect(repositories[0]).toEqual({ id: 1, installationId: 10, fullName: "alice/project", defaultBranch: "develop", private: true, url: "https://github.com/alice/project" });
  expect(calls.every(([url, options]) => url.startsWith("https://api.github.com/") && options.headers.Authorization === "Bearer test-token" && options.cache === "no-store")).toBe(true);
});

test("selection accepts only server-discovered repositories", () => {
  const repository = { id: 1, installationId: 10, fullName: "alice/project", defaultBranch: "main" };
  expect(validateSelection({ repositoryId: 1, installationId: 10 }, [repository])).toEqual(repository);
  expect(() => validateSelection({ repositoryId: 1, installationId: 99 }, [repository])).toThrow();
  expect(() => validateSelection({ repositoryId: "1", installationId: 10 }, [repository])).toThrow();
  expect(() => validateSelection({ repositoryId: -1, installationId: 10 }, [repository])).toThrow();
});

test("GitHub authorization failure becomes a safe reconnect response", async () => {
  const client = createGitHubClient("do-not-expose", async () => Response.json({ message: "do-not-expose" }, { status: 401 }));
  await expect(client.getRepositories("123")).rejects.toMatchObject({ status: 401, code: "reconnect" });
});

test("GitHub pagination never follows an arbitrary remote URL", async () => {
  const calls = [];
  const request = async (url) => {
    calls.push(url);
    return Response.json({ installations: [] }, { headers: { link: '<https://attacker.example/steal>; rel="next"' } });
  };
  await expect(createGitHubClient("test-token", request).getRepositories("123")).rejects.toThrow();
  expect(calls).toHaveLength(1);
});

