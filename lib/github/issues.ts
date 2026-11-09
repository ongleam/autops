import { z } from "zod/v4";
import { RepositoryError, type RepositoryConnection } from "./selected-repository";

export const issueNumber = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const body = z.string().trim().min(1).max(20_000);
export const createIssueInput = z.object({ title: z.string().trim().min(1).max(200), body }).strict();
export const commentIssueInput = z.object({ issueNumber, body }).strict();
export const updateIssueInput = z.object({ issueNumber, state: z.enum(["open", "closed"]) }).strict();
const issue = z.object({ number: issueNumber, title: z.string(), body: z.string().nullable(), state: z.enum(["open", "closed"]),
  html_url: z.url(), user: z.object({ login: z.string() }), pull_request: z.unknown().optional() });

async function request(connection: RepositoryConnection, path: string, method: "GET" | "POST" | "PATCH", payload?: object, fetcher: typeof fetch = fetch) {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(connection.repository.fullName)) throw new RepositoryError("Invalid repository.");
  const response = await fetcher(`https://api.github.com/repos/${connection.repository.fullName}/issues${path}`, {
    method, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${connection.token}`,
      "X-GitHub-Api-Version": "2026-03-10", "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401) throw new RepositoryError("GitHub authentication expired. Reconnect autops.");
  if (response.status === 403) throw new RepositoryError("GitHub denied issue access. Approve Issues: Read and write for the selected repository's GitHub App installation, then reauthorize autops with issues.write.");
  if (!response.ok) throw new RepositoryError("GitHub did not confirm the issue operation. Check the selected repository before retrying a write.");
  return response.json();
}

function result(connection: RepositoryConnection, data: unknown) {
  const parsed = issue.parse(data);
  if (parsed.pull_request !== undefined) throw new RepositoryError("This tool manages issues, not pull requests.");
  return { repository: connection.repository.fullName, number: parsed.number, title: parsed.title, body: parsed.body,
    state: parsed.state, url: parsed.html_url, author: parsed.user.login };
}

export async function getIssue(connection: RepositoryConnection, number: number, fetcher: typeof fetch = fetch) {
  return result(connection, await request(connection, `/${issueNumber.parse(number)}`, "GET", undefined, fetcher));
}
export async function createIssue(connection: RepositoryConnection, input: unknown, fetcher: typeof fetch = fetch) {
  return result(connection, await request(connection, "", "POST", createIssueInput.parse(input), fetcher));
}
export async function commentIssue(connection: RepositoryConnection, input: unknown, fetcher: typeof fetch = fetch) {
  const parsed = commentIssueInput.parse(input);
  await getIssue(connection, parsed.issueNumber, fetcher);
  const data = z.object({ id: z.number().int().positive(), html_url: z.url() }).parse(await request(connection, `/${parsed.issueNumber}/comments`, "POST", { body: parsed.body }, fetcher));
  return { repository: connection.repository.fullName, issueNumber: parsed.issueNumber, commentId: data.id, url: data.html_url };
}
export async function updateIssue(connection: RepositoryConnection, input: unknown, fetcher: typeof fetch = fetch) {
  const parsed = updateIssueInput.parse(input);
  await getIssue(connection, parsed.issueNumber, fetcher);
  return result(connection, await request(connection, `/${parsed.issueNumber}`, "PATCH", { state: parsed.state }, fetcher));
}
