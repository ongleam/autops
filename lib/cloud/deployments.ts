import { z } from "zod/v4";
import { CloudError, getCloudProjects, getProjectSelection, type CloudSession } from "./client";
import { withCloudConnection } from "./connections";
import { getSelectedRepositoryFile, type RepositoryConnection } from "../github/selected-repository";

export const commitSha = z.string().regex(/^[a-f0-9]{40}$/);
export const deploymentId = z.string().regex(/^[a-zA-Z0-9_-]{1,256}$/);

async function vercel(session: CloudSession, path: string, body?: object) {
  const url = new URL(path, "https://api.vercel.com");
  if (session.teamId) url.searchParams.set("teamId", session.teamId);
  const response = await fetch(url, { method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${body ? session.logsToken : session.token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (response.status === 401 || response.status === 403) throw new CloudError(403, "deployment_permission_required");
  if (!response.ok) throw new CloudError(502, `deployment_http_${response.status}`);
  return response.json();
}

async function linkedProject(session: CloudSession, connection: RepositoryConnection) {
  if (!session.projectId) throw new CloudError(400, "select_project");
  const project = getProjectSelection({ projectId: session.projectId }, await getCloudProjects("vercel", session));
  const details = z.object({ id: z.string(), link: z.object({ type: z.literal("github"), repoId: z.union([z.string(), z.number()]) }).nullable().optional() })
    .parse(await vercel(session, `/v9/projects/${encodeURIComponent(project.id)}`));
  if (details.id !== project.id || String(details.link?.repoId) !== String(connection.repository.id)) throw new CloudError(403, "deployment_repository_mismatch");
  return project;
}

function result(data: unknown, projectId: string, expectedCommit: string) {
  const value = z.object({ id: z.string().optional(), uid: z.string().optional(), url: z.string().optional(), readyState: z.string().optional(), state: z.string().optional(),
    projectId: z.string().optional(), gitSource: z.object({ sha: z.string().optional() }).optional(), meta: z.object({ githubCommitSha: z.string().optional() }).optional() }).parse(data);
  const commit = value.gitSource?.sha ?? value.meta?.githubCommitSha ?? null;
  const state = value.readyState ?? value.state ?? "UNKNOWN";
  return { deploymentId: value.id ?? value.uid, projectId, url: value.url ? `https://${value.url}` : null, state, commit,
    expectedCommit, commitVerified: commit === expectedCommit, ready: state === "READY" && commit === expectedCommit,
    validation: "Provider build readiness is separate from tests, user-facing functionality, and performance improvement." };
}

export async function deployProject(owner: string, connection: RepositoryConnection, commit: string, target: "preview" | "production") {
  commitSha.parse(commit);
  const source = await getSelectedRepositoryFile(connection, "package.json");
  if (source.commit !== commit) throw new CloudError(409, "deployment_source_changed");
  return withCloudConnection(owner, "vercel", async session => {
    const project = await linkedProject(session, connection);
    if (!session.logsToken || session.deploymentProjectId !== project.id) throw new CloudError(403, "deployment_consent_required");
    getProjectSelection({ projectId: project.id }, await getCloudProjects("vercel", { ...session, token: session.logsToken }));
    const data = await vercel(session, "/v13/deployments", { name: project.name, project: project.id,
      gitSource: { type: "github", repoId: String(connection.repository.id), ref: connection.repository.defaultBranch, sha: commit },
      ...(target === "production" ? { target } : {}) });
    return { ...result(data, project.id, commit), requestedTarget: target };
  });
}

export async function getDeploymentStatus(owner: string, connection: RepositoryConnection, id: string, commit: string) {
  deploymentId.parse(id); commitSha.parse(commit);
  return withCloudConnection(owner, "vercel", async session => {
    const project = await linkedProject(session, connection);
    const data = await vercel(session, `/v13/deployments/${encodeURIComponent(id)}`);
    if (z.object({ projectId: z.string() }).parse(data).projectId !== project.id) throw new CloudError(403, "project_forbidden");
    return result(data, project.id, commit);
  });
}
