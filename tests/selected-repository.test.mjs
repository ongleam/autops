import { expect, test } from "bun:test";
import { getSelectedRepositoryFile, sourcePath, updateSelectedRepositoryFile } from "../lib/github/selected-repository";

const fileSha = "a".repeat(40);
const commitSha = "b".repeat(40);
const newSha = "c".repeat(40);
const connection = { token: "test-user-token", repository: { id: 10, installationId: 20, fullName: "alice/selected", defaultBranch: "main", private: true, url: "https://github.com/alice/selected" } };
function getProvider(requests) {
  return async (input, options) => {
    requests.push({ url: String(input), options });
    expect(options.headers.Authorization).toBe("Bearer test-user-token");
    if (String(input).endsWith("/commits/main")) return Response.json({ sha: commitSha });
    if (options.method === "PUT") return Response.json({ content: { sha: newSha }, commit: { sha: newSha } });
    return Response.json({ type: "file", encoding: "base64", content: Buffer.from("original").toString("base64"), sha: fileSha, size: 8 });
  };
}

test("selected source reads use its user token and pin contents to the verified commit", async () => {
  const requests = [];
  const result = await getSelectedRepositoryFile(connection, "lib/products.ts", getProvider(requests));
  expect(result.repository).toBe("alice/selected");
  expect(result.content).toBe("original");
  expect(requests[1].url).toBe(`https://api.github.com/repos/alice/selected/contents/lib/products.ts?ref=${commitSha}`);
});

test("writes require the current SHA and only update the selected default branch", async () => {
  const requests = [];
  const result = await updateSelectedRepositoryFile(connection, { path: "lib/products.ts", expectedSha: fileSha, content: "수정된 내용", message: "fix: update selected source" }, getProvider(requests));
  expect(result.status).toBe("committed");
  const write = requests.find((request) => request.options.method === "PUT");
  expect(write.url).toBe("https://api.github.com/repos/alice/selected/contents/lib/products.ts");
  const body = JSON.parse(write.options.body);
  expect(body.branch).toBe("main");
  expect(body.sha).toBe(fileSha);
  expect(Buffer.from(body.content, "base64").toString("utf8")).toBe("수정된 내용");
});

test("stale SHA never writes and unchanged contents never create a commit", async () => {
  const requests = [];
  const provider = getProvider(requests);
  await expect(updateSelectedRepositoryFile(connection, { path: "lib/products.ts", expectedSha: newSha, content: "changed", message: "fix" }, provider)).rejects.toThrow("file changed");
  expect(requests.every((request) => request.options.method === "GET")).toBe(true);
  const result = await updateSelectedRepositoryFile(connection, { path: "lib/products.ts", expectedSha: fileSha, content: "original", message: "fix" }, provider);
  expect(result.status).toBe("unchanged");
  expect(requests.every((request) => request.options.method === "GET")).toBe(true);
});

test("credential, workflow and traversal paths are blocked before any provider request", () => {
  for (const path of [".env", ".env.local", "../secret.ts", "lib/../secret.ts", ".github/workflows/deploy.yml", "config/credentials.json", "/absolute.ts", "lib/file.ts?ref=other"]) {
    expect(sourcePath.safeParse(path).success).toBe(false);
  }
});
