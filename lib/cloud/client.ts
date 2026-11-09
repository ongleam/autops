import { z } from "zod/v4";

export type Provider = "vercel" | "supabase";
export type CloudConfig = { clientId: string; clientSecret: string; slug?: string; secret: string };
export type CloudSession = { token: string; refreshToken?: string; logsToken?: string; expiresAt: number | null; owner: string; teamId?: string; projectId?: string };
export type CloudProject = { id: string; name: string; region?: string; status?: string; framework?: string | null };
export type CloudOverview = { project: CloudProject; deployment?: { id: string; state: string; createdAt: number } | null; checkedAt: string };

export class CloudError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

const text = z.string().min(1).max(256);
const projectId = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const vercelProject = z.object({ id: projectId, name: text, framework: z.string().max(100).nullable().optional() });
const supabaseProject = z.object({ id: projectId, name: text, region: text, status: text });

export async function getProviderJson(url: URL | string, token: string) {
  const response = await fetch(url, {
    method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401) throw new CloudError(401, "reconnect");
  if (response.status === 403 || response.status === 404) throw new CloudError(403, "project_forbidden");
  if (!response.ok) throw new CloudError(502, "provider_unavailable");
  return response.json();
}

function getVercelUrl(path: string, session: CloudSession) {
  const url = new URL(path, "https://api.vercel.com");
  if (session.teamId) url.searchParams.set("teamId", session.teamId);
  return url;
}

export async function getCloudProjects(provider: Provider, session: CloudSession): Promise<CloudProject[]> {
  if (provider === "supabase") {
    return z.array(supabaseProject).parse(await getProviderJson("https://api.supabase.com/v1/projects", session.token));
  }
  let projects: CloudProject[] = [];
  let until: number | null = null;
  for (let page = 0; page < 100; page += 1) {
    const url = getVercelUrl("/v9/projects", session);
    url.searchParams.set("limit", "100");
    if (until !== null) url.searchParams.set("until", String(until));
    const data = z.object({ projects: z.array(vercelProject), pagination: z.object({ next: z.number().nullable() }).optional() })
      .parse(await getProviderJson(url, session.token));
    projects = [...projects, ...data.projects];
    const next = data.pagination?.next ?? null;
    if (next === null) return projects;
    if (next === until) throw new CloudError(502, "provider_unavailable");
    until = next;
  }
  throw new CloudError(502, "provider_unavailable");
}

export function getProjectSelection(input: unknown, projects: CloudProject[]) {
  const parsed = z.object({ projectId }).safeParse(input);
  if (!parsed.success) throw new CloudError(400, "invalid_request");
  const project = projects.find((item) => item.id === parsed.data.projectId);
  if (!project) throw new CloudError(403, "project_forbidden");
  return project;
}

export async function getCloudOverview(provider: Provider, session: CloudSession): Promise<CloudOverview> {
  if (!session.projectId) throw new CloudError(400, "select_project");
  const id = encodeURIComponent(session.projectId);
  if (provider === "supabase") {
    const project = supabaseProject.parse(await getProviderJson(`https://api.supabase.com/v1/projects/${id}`, session.token));
    if (project.id !== session.projectId) throw new CloudError(502, "provider_unavailable");
    return { project, checkedAt: new Date().toISOString() };
  }
  const project = vercelProject.parse(await getProviderJson(getVercelUrl(`/v9/projects/${id}`, session), session.token));
  if (project.id !== session.projectId) throw new CloudError(502, "provider_unavailable");
  const url = getVercelUrl("/v6/deployments", session);
  url.searchParams.set("projectId", session.projectId);
  url.searchParams.set("limit", "1");
  const result = z.object({ deployments: z.array(z.object({ uid: text, state: text, created: z.number() })) })
    .parse(await getProviderJson(url, session.token));
  const latest = result.deployments[0];
  return { project, deployment: latest ? { id: latest.uid, state: latest.state, createdAt: latest.created } : null, checkedAt: new Date().toISOString() };
}
