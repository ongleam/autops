import { z } from "zod/v4";
import type { Repository } from "./session";

export class RepositoryError extends Error {}
export type RepositoryConnection = { token: string; repository: Repository };
const sha = z.string().regex(/^[a-f0-9]{40}$/);
export const sourcePath = z.string().max(256).refine((path) => {
  const segments = path.split("/");
  return segments.every((segment) => /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(segment) && !/^(secrets?|credentials?)([.-]|$)/i.test(segment)) &&
    /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|py|sql)$/.test(path);
}, "Use a source file path. Hidden paths, credentials, workflows and traversal are not allowed.");
export const updateFileInput = z.object({
  path: sourcePath,
  expectedSha: sha.describe("Exact fileSha returned by get_repository_file. Re-read if the file changed."),
  content: z.string().max(100_000).refine((value) => Buffer.byteLength(value, "utf8") <= 100_000, "File exceeds 100 KB."),
  message: z.string().trim().min(1).max(200),
}).strict();

function getApiPath(connection: RepositoryConnection) {
  const { fullName } = connection.repository;
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(fullName)) throw new RepositoryError("Invalid repository.");
  return `/repos/${fullName}`;
}

async function requestGitHub(connection: RepositoryConnection, path: string, request: typeof fetch, body?: object) {
  const response = await request(`https://api.github.com${getApiPath(connection)}${path}`, {
    method: body ? "PUT" : "GET",
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${connection.token}`,
      "X-GitHub-Api-Version": "2026-03-10", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401) throw new RepositoryError("GitHub authentication expired. Reconnect autops.");
  if (response.status === 403) throw new RepositoryError("GitHub denied access. For changes, approve Contents: Read and write for the GitHub App installation, then reconnect autops.");
  if (response.status === 409 || response.status === 422) throw new RepositoryError("The file changed or the branch disallows this update. Re-read the file and check branch protection.");
  if (response.status === 404) throw new RepositoryError("The selected repository or file is unavailable. Check the selected repository and GitHub App access.");
  if (!response.ok) throw new RepositoryError("GitHub is unavailable. No success was confirmed; check the repository before retrying a write.");
  return response.json();
}

export async function getSelectedRepositoryFile(connection: RepositoryConnection, inputPath: string, request: typeof fetch = fetch) {
  const path = sourcePath.parse(inputPath);
  const ref = encodeURIComponent(connection.repository.defaultBranch);
  const commit = z.object({ sha }).parse(await requestGitHub(connection, `/commits/${ref}`, request));
  const file = z.object({ type: z.literal("file"), encoding: z.literal("base64"), content: z.string(), sha,
    size: z.number().int().min(0).max(100_000) }).parse(await requestGitHub(connection,
    `/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${commit.sha}`, request));
  const bytes = Buffer.from(file.content, "base64");
  if (bytes.length > 100_000 || bytes.length !== file.size) throw new RepositoryError("File size could not be verified.");
  const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return { repository: connection.repository.fullName, branch: connection.repository.defaultBranch, commit: commit.sha,
    path, fileSha: file.sha, content, sourceUrl: `https://github.com/${connection.repository.fullName}/blob/${commit.sha}/${path}`,
    retrievedAt: new Date().toISOString(), authentication: "OAuth-authenticated GitHub App user token; selected repository only" };
}

export async function updateSelectedRepositoryFile(connection: RepositoryConnection, input: unknown, request: typeof fetch = fetch) {
  const change = updateFileInput.parse(input);
  const current = await getSelectedRepositoryFile(connection, change.path, request);
  if (current.fileSha !== change.expectedSha) throw new RepositoryError("The file changed. Re-read it and review the change before retrying.");
  if (current.content === change.content) return { status: "unchanged", repository: current.repository, path: current.path, fileSha: current.fileSha };
  const result = z.object({ content: z.object({ sha }), commit: z.object({ sha }) }).parse(await requestGitHub(connection,
    `/contents/${change.path.split("/").map(encodeURIComponent).join("/")}`, request, {
      message: change.message, content: Buffer.from(change.content, "utf8").toString("base64"), sha: change.expectedSha,
      branch: connection.repository.defaultBranch,
    }));
  return { status: "committed", repository: current.repository, branch: current.branch, path: current.path,
    previousFileSha: current.fileSha, fileSha: result.content.sha, commit: result.commit.sha,
    commitUrl: `https://github.com/${current.repository}/commit/${result.commit.sha}`,
    validation: "GitHub confirmed the commit. Repository tests and deployment are not verified by this tool." };
}
