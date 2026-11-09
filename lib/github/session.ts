import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type Repository = {
  id: number;
  installationId: number;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  url: string;
};

export type GitHubSession = {
  token: string;
  expiresAt: number;
  user: { id: number; login: string };
  repository?: Repository;
};

export type OAuthFlow = { state: string; verifier: string; origin: string };

export function getCookieName(kind: "session" | "flow", production = process.env.NODE_ENV === "production") {
  return `${production ? "__Host-" : ""}autops-github-${kind}`;
}

export function createSession(data: unknown, secret: string, lifetime: number, now = Math.floor(Date.now() / 1000)) {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(secret).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ expiresAt: now + lifetime, data }), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function readSession<T>(value: string | undefined, secret: string, now = Math.floor(Date.now() / 1000)): { data: T; expiresAt: number } | null {
  if (!value || value.length > 3800) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    const key = createHash("sha256").update(secret).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const plaintext = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
    const payload = JSON.parse(plaintext.toString("utf8"));
    return Number.isFinite(payload.expiresAt) && payload.expiresAt > now ? { data: payload.data as T, expiresAt: payload.expiresAt } : null;
  } catch {
    return null;
  }
}

export function getSession<T>(value: string | undefined, secret: string, now = Math.floor(Date.now() / 1000)): T | null {
  return readSession<T>(value, secret, now)?.data ?? null;
}
