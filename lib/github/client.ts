import { createSign, type KeyObject } from "node:crypto";
import type { Repository } from "./session";

export class GitHubError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export function createAppJwt(appId: string, privateKey: KeyObject, now = Math.floor(Date.now() / 1000)) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: appId, iat: now - 60, exp: now + 540 })).toString("base64url");
  const content = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(content).sign(privateKey, "base64url");
  return `${content}.${signature}`;
}

type Installation = { id: number; app_id: number; suspended_at: string | null };
type GitHubRepository = { id: number; full_name: string; default_branch: string; private: boolean; archived: boolean; disabled: boolean };

export function createGitHubClient(token: string, request: typeof fetch = fetch) {
  async function get<T>(path: string): Promise<{ data: T; next: boolean }> {
    const response = await request(`https://api.github.com${path}`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2026-03-10" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new GitHubError(response.status === 401 ? 401 : 502, response.status === 401 ? "reconnect" : "github_unavailable");
    const link = response.headers.get("link") || "";
    const next = link.split(",").find((part) => /rel="next"/.test(part));
    if (next) {
      const match = next.match(/<([^>]+)>/);
      const expected = new URL(`https://api.github.com${path}`);
      const target = match && new URL(match[1]);
      if (!target || target.origin !== expected.origin || target.pathname !== expected.pathname || target.username || target.password) {
        throw new GitHubError(502, "github_unavailable");
      }
    }
    return { data: await response.json() as T, next: Boolean(next) };
  }

  async function getPages<T>(path: string, field: string): Promise<T[]> {
    let result: T[] = [];
    for (let page = 1; ; page += 1) {
      const { data, next } = await get<Record<string, T[]>>(`${path}?per_page=100&page=${page}`);
      if (!Array.isArray(data[field])) throw new GitHubError(502, "github_unavailable");
      result = result.concat(data[field]);
      if (!next) return result;
    }
  }

  return {
    async getUser() {
      const { data } = await get<{ id: number; login: string }>("/user");
      if (!Number.isSafeInteger(data.id) || typeof data.login !== "string") throw new GitHubError(502, "github_unavailable");
      return { id: data.id, login: data.login };
    },
    async getApp() {
      const { data } = await get<{ slug: string }>("/app");
      if (!/^[a-z0-9-]+$/.test(data.slug)) throw new GitHubError(502, "github_unavailable");
      return data;
    },
    async getRepositories(appId: string): Promise<Repository[]> {
      const installations = await getPages<Installation>("/user/installations", "installations");
      const available = installations.filter((item) => String(item.app_id) === appId && !item.suspended_at);
      const groups = await Promise.all(available.map(async (installation) => {
        if (!Number.isSafeInteger(installation.id) || installation.id <= 0) throw new GitHubError(502, "github_unavailable");
        const repositories = await getPages<GitHubRepository>(`/user/installations/${installation.id}/repositories`, "repositories");
        return repositories.filter((repo) => !repo.archived && !repo.disabled).map((repo) => {
          if (!Number.isSafeInteger(repo.id) || repo.id <= 0 || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo.full_name) || typeof repo.default_branch !== "string" || typeof repo.private !== "boolean") {
            throw new GitHubError(502, "github_unavailable");
          }
          return { id: repo.id, installationId: installation.id, fullName: repo.full_name, defaultBranch: repo.default_branch, private: repo.private, url: `https://github.com/${repo.full_name}` };
        });
      }));
      return groups.flat();
    },
  };
}

export function validateSelection(input: unknown, repositories: Repository[]): Repository {
  if (!input || typeof input !== "object" || !("repositoryId" in input) || !("installationId" in input) ||
    !Number.isSafeInteger(input.repositoryId) || !Number.isSafeInteger(input.installationId)) {
    throw new GitHubError(400, "invalid_repository");
  }
  const repository = repositories.find((item) => item.id === input.repositoryId && item.installationId === input.installationId);
  if (!repository) throw new GitHubError(403, "repository_forbidden");
  return repository;
}
