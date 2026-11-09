import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { CloudError, type CloudSession, type Provider } from "./client";

const credentials = z.object({
  token: z.string().min(1).max(4096), refreshToken: z.string().min(1).max(4096).optional(),
  expiresAt: z.number().int().positive().nullable(), owner: z.string().regex(/^[1-9][0-9]*$/),
  teamId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(), projectId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(),
});
const rowSchema = z.object({ credentials: z.string().max(16000).nullable(), status: z.enum(["connected", "reauthorization_required"]), revision: z.uuid() });
export type StoredConnection = { session: CloudSession | null; status: "connected" | "reauthorization_required"; revision: string };

export function hasConnectionStore() { return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY && process.env.GITHUB_SESSION_SECRET); }
function config() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const secret = process.env.GITHUB_SESSION_SECRET;
  if (!url || !secretKey || !secret || secret.length < 32) throw new CloudError(503, "storage_unavailable");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co") || parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new CloudError(503, "storage_unavailable");
  return { url: parsed.origin, secretKey, key: createHash("sha256").update(`${secret}:autops-cloud-connections:v1`).digest() };
}
function seal(provider: Provider, session: CloudSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config().key, iv);
  cipher.setAAD(Buffer.from(`${session.owner}:${provider}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials.parse(session)), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
function unseal(owner: string, provider: Provider, value: string): CloudSession {
  try {
    const bytes = Buffer.from(value, "base64url");
    const cipher = createDecipheriv("aes-256-gcm", config().key, bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    cipher.setAAD(Buffer.from(`${owner}:${provider}`));
    const session = credentials.parse(JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8")));
    if (session.owner !== owner) throw new Error("Owner mismatch");
    return session;
  } catch { throw new CloudError(503, "storage_unavailable"); }
}
function selector(owner: string, provider: Provider) {
  if (!/^[1-9][0-9]*$/.test(owner)) throw new CloudError(401, "github_required");
  return `github_user_id=eq.${owner}&provider=eq.${provider}`;
}
async function database(path: string, method = "GET", body?: unknown) {
  const cfg = config();
  const response = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method, headers: { apikey: cfg.secretKey, Authorization: `Bearer ${cfg.secretKey}`, "Content-Type": "application/json",
      Prefer: method === "POST" && !path.startsWith("rpc/") ? "resolution=merge-duplicates,return=representation" : "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new CloudError(503, "storage_unavailable");
  return response.status === 204 ? null : response.json();
}
export async function readConnection(owner: string, provider: Provider): Promise<StoredConnection | null> {
  const rows = z.array(rowSchema).parse(await database(`autops_connections?${selector(owner, provider)}&select=credentials,status,revision`));
  const row = rows[0];
  return row ? { session: row.credentials ? unseal(owner, provider, row.credentials) : null, status: row.status, revision: row.revision } : null;
}
export async function saveConnection(provider: Provider, session: CloudSession, expectedRevision?: string, lease?: string) {
  const body = { github_user_id: session.owner, provider, credentials: seal(provider, session), status: "connected",
    revision: randomUUID(), refresh_lease: null, refresh_locked_until: null, updated_at: new Date().toISOString() };
  const result = expectedRevision
    ? await database(`autops_connections?${selector(session.owner, provider)}&revision=eq.${expectedRevision}${lease ? `&refresh_lease=eq.${lease}` : ""}`, "PATCH", body)
    : await database("autops_connections?on_conflict=github_user_id,provider", "POST", body);
  if (!Array.isArray(result) || result.length !== 1) throw new CloudError(409, "connection_changed");
  return { session, status: "connected" as const, revision: body.revision };
}
export async function disconnectConnection(owner: string, provider: Provider) {
  await database(`autops_connections?${selector(owner, provider)}`, "DELETE");
}
export async function invalidateConnection(owner: string, provider: Provider, revision: string) {
  await database(`autops_connections?${selector(owner, provider)}&revision=eq.${revision}`, "PATCH", {
    credentials: null, status: "reauthorization_required", revision: randomUUID(), refresh_lease: null, refresh_locked_until: null, updated_at: new Date().toISOString(),
  });
}
export async function claimRefresh(owner: string, provider: Provider, revision: string, lease: string) {
  selector(owner, provider);
  return (await database("rpc/autops_claim_refresh", "POST", { p_user_id: owner, p_provider: provider, p_revision: revision, p_lease: lease })) === true;
}
export async function releaseRefresh(owner: string, provider: Provider, lease: string) {
  await database(`autops_connections?${selector(owner, provider)}&refresh_lease=eq.${lease}`, "PATCH", { refresh_lease: null, refresh_locked_until: null });
}
