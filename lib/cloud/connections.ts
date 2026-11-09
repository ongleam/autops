import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { CloudError, getCloudProjects, type CloudConfig, type CloudSession, type Provider } from "./client";
import { getCloudConfig } from "./config";
import { claimRefresh, invalidateConnection, readConnection, releaseRefresh, saveConnection, type StoredConnection } from "./store";

const tokenSchema = z.object({
  access_token: z.string().min(1).max(4096), refresh_token: z.string().min(1).max(4096).optional(),
  expires_in: z.number().int().positive().optional(), team_id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).nullable().optional(),
});
export function parseCloudToken(provider: Provider, value: unknown, owner: string, previous?: CloudSession): CloudSession {
  const token = tokenSchema.parse(value);
  if (provider === "supabase" && (!token.expires_in || (!token.refresh_token && !previous?.refreshToken))) throw new CloudError(401, "reauthorization_required");
  return { token: token.access_token, owner, expiresAt: token.expires_in ? Math.floor(Date.now() / 1000) + token.expires_in : null,
    ...(token.refresh_token || previous?.refreshToken ? { refreshToken: token.refresh_token ?? previous?.refreshToken } : {}),
    ...(provider === "vercel" && token.team_id ? { teamId: token.team_id } : previous?.teamId ? { teamId: previous.teamId } : {}),
    ...(previous?.projectId ? { projectId: previous.projectId } : {}),
    ...(provider === "vercel" && previous?.logsToken ? { logsToken: previous.logsToken } : {}) };
}

async function refresh(owner: string, provider: Provider, stored: StoredConnection, config: CloudConfig): Promise<StoredConnection> {
  if (provider !== "supabase" || !stored.session?.refreshToken) {
    await invalidateConnection(owner, provider, stored.revision);
    throw new CloudError(401, "reauthorization_required");
  }
  const lease = randomUUID();
  if (!(await claimRefresh(owner, provider, stored.revision, lease))) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const updated = await readConnection(owner, provider);
      if (!updated?.session) throw new CloudError(401, "reauthorization_required");
      if (updated.revision !== stored.revision) return updated;
    }
    throw new CloudError(503, "refresh_in_progress");
  }
  try {
    const response = await fetch("https://api.supabase.com/v1/oauth/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}` },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: stored.session.refreshToken }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 400 || response.status === 401) {
      await invalidateConnection(owner, provider, stored.revision);
      throw new CloudError(401, "reauthorization_required");
    }
    if (!response.ok) throw new CloudError(502, "provider_unavailable");
    return await saveConnection(provider, parseCloudToken(provider, await response.json(), owner, stored.session), stored.revision, lease);
  } finally { await releaseRefresh(owner, provider, lease); }
}

export async function withCloudConnection<T>(owner: string, provider: Provider, action: (session: CloudSession, revision: string) => Promise<T>): Promise<T> {
  const config = getCloudConfig(provider);
  if (!config) throw new CloudError(503, "setup_required");
  let stored = await readConnection(owner, provider);
  if (!stored?.session) throw new CloudError(401, stored?.status === "reauthorization_required" ? "reauthorization_required" : "not_connected");
  if (stored.session.expiresAt !== null && stored.session.expiresAt <= Math.floor(Date.now() / 1000) + 60) stored = await refresh(owner, provider, stored, config);
  if (!stored.session) throw new CloudError(401, "reauthorization_required");
  try { return await action(stored.session, stored.revision); }
  catch (error) {
    if (!(error instanceof CloudError) || error.status !== 401) throw error;
    const updated = await refresh(owner, provider, stored, config);
    if (!updated.session) throw new CloudError(401, "reauthorization_required");
    try { return await action(updated.session, updated.revision); }
    catch (retryError) {
      if (retryError instanceof CloudError && retryError.status === 401) await invalidateConnection(owner, provider, updated.revision);
      throw retryError;
    }
  }
}

export async function getCloudConnectionStatus(owner: string, provider: Provider) {
  const checkedAt = new Date().toISOString();
  try {
    return await withCloudConnection(owner, provider, async (session) => {
      const projects = await getCloudProjects(provider, session);
      return { configured: true, connected: true, status: "connected", ...(provider === "vercel" ? { logsConfigured: Boolean(session.logsToken) } : {}), project: projects.find((project) => project.id === session.projectId) ?? null,
        ...(session.teamId ? { teamId: session.teamId } : {}), checkedAt };
    });
  } catch (error) {
    const known = error instanceof CloudError ? error : new CloudError(502, "provider_unavailable");
    const status = known.code === "not_connected" ? "not_connected" : known.status === 401 ? "reauthorization_required"
      : known.code === "setup_required" ? "setup_required" : known.status === 403 ? "permission_required" : "unavailable";
    return { configured: known.code !== "setup_required", connected: false, status, project: null, checkedAt };
  }
}
