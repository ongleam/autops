import { createPrivateKey } from "node:crypto";
import { createAppJwt } from "./client";

export const REPOSITORY_FILES = ["README.md", "package.json", "lib/products.ts", "app/api/products/route.ts"] as const;
const REPOSITORY_PATH = "/repos/ongleam/compiled-ex-project";

export async function getRepositoryFile(
  path: string,
  request: typeof fetch = fetch,
  credentials = { appId: process.env.GITHUB_APP_ID, privateKey: process.env.GITHUB_APP_PRIVATE_KEY },
) {
  if (!(REPOSITORY_FILES as readonly string[]).includes(path)) throw new Error("file_not_allowed");
  async function github(apiPath: string, token?: string, body?: object) {
    const response = await request(`https://api.github.com${apiPath}`, {
      method: body ? "POST" : "GET",
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10",
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("github_repository_unavailable");
    return response.json();
  }
  // This endpoint is public. Never publish content from private repositories through it.
  const repository = await github(REPOSITORY_PATH);
  if (repository.full_name !== "ongleam/compiled-ex-project" || repository.private !== false || !Number.isSafeInteger(repository.id)) {
    throw new Error("public_repository_required");
  }
  if (!credentials.appId || !credentials.privateKey) throw new Error("github_app_setup_required");
  const jwt = createAppJwt(credentials.appId, createPrivateKey(credentials.privateKey));
  const installation = await github(`${REPOSITORY_PATH}/installation`, jwt);
  if (!Number.isSafeInteger(installation.id) || installation.id <= 0) throw new Error("github_installation_unavailable");
  const authorization = await github(`/app/installations/${installation.id}/access_tokens`, jwt, {
    repository_ids: [repository.id], permissions: { contents: "read", metadata: "read" },
  });
  if (typeof authorization.token !== "string") throw new Error("github_installation_unavailable");
  const commit = await github(`${REPOSITORY_PATH}/commits/main`, authorization.token);
  if (typeof commit.sha !== "string" || !/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error("github_repository_unavailable");
  const file = await github(`${REPOSITORY_PATH}/contents/${path}?ref=${commit.sha}`, authorization.token);
  if (file.encoding !== "base64" || typeof file.content !== "string" || typeof file.sha !== "string" || !Number.isSafeInteger(file.size) || file.size > 100_000) {
    throw new Error("github_file_unavailable");
  }
  const content = Buffer.from(file.content, "base64");
  if (content.length > 100_000) throw new Error("github_file_unavailable");
  return { repository: repository.full_name as string, branch: "main", commit: commit.sha as string, path,
    fileSha: file.sha as string, content: new TextDecoder("utf-8", { fatal: true }).decode(content),
    sourceUrl: `https://github.com/ongleam/compiled-ex-project/blob/${commit.sha}/${path}`,
    retrievedAt: new Date().toISOString(), authentication: "GitHub App installation token; contents and metadata read-only" };
}
