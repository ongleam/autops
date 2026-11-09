import { expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import { getRepositoryFile } from "../lib/github/repository";
import { diagnoseProject } from "../lib/projects/diagnostics";

const repository = { full_name: "ongleam/compiled-ex-project", id: 1450908978, private: false };
const product = { id: 1, title: "상품 / Product", price: 100, seller_id: 2, seller: { id: 2, name: "Demo" } };

test("repository reader rejects unapproved paths before network access", async () => {
  await expect(getRepositoryFile(".env", async () => { throw new Error("network must not run"); })).rejects.toThrow("file_not_allowed");
});

test("public MCP never exposes a repository that became private", async () => {
  await expect(getRepositoryFile("README.md", async () => Response.json({ ...repository, private: true }))).rejects.toThrow("public_repository_required");
});

test("repository read uses a read-only token scoped to the one installed repository", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  let requestedScope;
  const request = async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/installation")) return Response.json({ id: 10 });
    if (path.endsWith("/access_tokens")) { requestedScope = JSON.parse(options.body); return Response.json({ token: "test-only-installation-token" }); }
    if (path.endsWith("/commits/main")) return Response.json({ sha: "a".repeat(40) });
    if (path.includes("/contents/")) {
      expect(options.headers.Authorization).toBe("Bearer test-only-installation-token");
      expect(new URL(url).searchParams.get("ref")).toBe("a".repeat(40));
      return Response.json({ content: Buffer.from("# Public demo").toString("base64"), encoding: "base64", size: 13, sha: "b".repeat(40) });
    }
    return Response.json(repository);
  };
  const result = await getRepositoryFile("README.md", request, { appId: "123", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }) });
  expect(requestedScope).toEqual({ repository_ids: [1450908978], permissions: { contents: "read", metadata: "read" } });
  expect(result.content).toBe("# Public demo");
  expect(result.commit).toBe("a".repeat(40));
  expect(JSON.stringify(result)).not.toContain("test-only-installation-token");
});

test("diagnosis measures real response fields and marks CPU and memory unavailable", async () => {
  const request = async (url) => {
    expect(new URL(url).origin).toBe("https://compiled-ex-project.vercel.app");
    const mode = new URL(url).searchParams.get("mode");
    return Response.json({ products: [product], mode, databaseRequests: mode === "n-plus-one" ? 2 : 1, elapsedMs: 20, requestId: "fixture" });
  };
  const result = await diagnoseProject(request, async () => ({ commit: "a".repeat(40), fileSha: "b".repeat(40), path: "lib/products.ts", content: "public source" }));
  expect(result.modes["n-plus-one"].samples).toHaveLength(3);
  expect(result.modes.joined.samples).toHaveLength(3);
  expect(result.sameProducts).toBe(true);
  expect(result.cpu.status).toBe("unavailable");
  expect(result.memory.status).toBe("unavailable");
  expect(result.deployedCommitVerified).toBe(false);
});

test("failed API responses cannot count as fast successful samples", async () => {
  const result = await diagnoseProject(async () => Response.json({ error: "DB unavailable" }, { status: 503 }), async () => ({ commit: "a".repeat(40), fileSha: "b".repeat(40), path: "lib/products.ts", content: "public source" }));
  expect(result.modes.joined.failures).toBe(3);
  expect(result.modes.joined.p95Ms).toBeNull();
  expect(result.sameProducts).toBe(false);
});

test("different product results fail the correctness comparison", async () => {
  const result = await diagnoseProject(async (url) => Response.json({ products: [{ ...product, price: new URL(url).searchParams.get("mode") === "joined" ? 999 : 100 }], databaseRequests: 1, elapsedMs: 1, requestId: "fixture" }), async () => ({ commit: "a".repeat(40), fileSha: "b".repeat(40), path: "lib/products.ts", content: "public source" }));
  expect(result.sameProducts).toBe(false);
});
