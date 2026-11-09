import type { CloudConfig, Provider } from "./client";

export function getCloudConfig(provider: Provider): CloudConfig | null {
  const secret = process.env.GITHUB_SESSION_SECRET;
  const clientId = (provider === "vercel" ? process.env.VERCEL_INTEGRATION_CLIENT_ID : process.env.SUPABASE_OAUTH_CLIENT_ID)?.trim();
  const clientSecret = (provider === "vercel" ? process.env.VERCEL_INTEGRATION_CLIENT_SECRET : process.env.SUPABASE_OAUTH_CLIENT_SECRET)?.trim();
  const slug = process.env.VERCEL_INTEGRATION_SLUG?.trim();
  if (!secret || secret.length < 32 || !clientId || !clientSecret || (provider === "vercel" && (!slug || !/^[a-z0-9-]+$/.test(slug)))) return null;
  return { secret, clientId, clientSecret, ...(provider === "vercel" ? { slug } : {}) };
}
