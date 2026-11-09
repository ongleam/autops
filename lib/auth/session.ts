import { z } from "zod/v4";
import { createSession, getSession } from "../github/session";

export const EMAIL_SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-autops-email" : "autops-email";
const userSchema = z.object({ id: z.string().uuid(), email: z.email() });
const sessionSchema = z.object({ accessToken: z.string().min(1).max(2800), expiresAt: z.number().int().positive(), user: userSchema });
export type EmailSession = z.infer<typeof sessionSchema>;

export function getAuthConfig() {
  const url = process.env.SUPABASE_AUTH_URL;
  const publishableKey = process.env.SUPABASE_AUTH_PUBLISHABLE_KEY;
  const secret = process.env.GITHUB_SESSION_SECRET;
  if (!url || !publishableKey || !secret || secret.length < 32) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co") || parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return { url: parsed.origin, publishableKey, secret: `${secret}:autops-email` };
  } catch { return null; }
}

export function getEmailSession(value: string | undefined) {
  const config = getAuthConfig();
  if (!config) return null;
  const parsed = sessionSchema.safeParse(getSession<unknown>(value, config.secret));
  return parsed.success && parsed.data.expiresAt > Math.floor(Date.now() / 1000) ? parsed.data : null;
}

export function encodeEmailSession(session: EmailSession, lifetime: number) {
  const config = getAuthConfig();
  if (!config) throw new Error("setup_required");
  const value = createSession(sessionSchema.parse(session), config.secret, lifetime);
  if (value.length > 3800) throw new Error("session_too_large");
  return value;
}

export async function authRequest(path: string, init: RequestInit = {}, accessToken?: string) {
  const config = getAuthConfig();
  if (!config) throw new Error("setup_required");
  return fetch(`${config.url}/auth/v1/${path}`, { ...init, headers: { apikey: config.publishableKey,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), "Content-Type": "application/json" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
}

export async function getEmailUser(value: string | undefined) {
  const session = getEmailSession(value);
  if (!session) return null;
  try {
    const response = await authRequest("user", {}, session.accessToken);
    const user = userSchema.safeParse(await response.json());
    return response.ok && user.success && user.data.id === session.user.id ? user.data : null;
  } catch { return null; }
}

export function safeReturnPath(value: unknown) {
  if (typeof value !== "string" || !value || value.length > 4096 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/onboarding";
  const url = new URL(value, "https://autops-app.vercel.app");
  return url.origin === "https://autops-app.vercel.app" && ["/", "/onboarding", "/connect/chatgpt"].includes(url.pathname) ? `${url.pathname}${url.search}` : "/onboarding";
}
