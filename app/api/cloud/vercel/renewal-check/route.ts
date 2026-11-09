import { NextRequest, NextResponse } from "next/server";
import { createGitHubClient } from "@/lib/github/client";
import { getCookieName, getSession, type GitHubSession } from "@/lib/github/session";
import { readConnection } from "@/lib/cloud/store";

export async function GET() {
  return new Response('<!doctype html><html lang="en"><title>Vercel renewal check</title><form method="post"><button>Check same-team token renewal</button></form></html>', {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'" },
  });
}

export async function POST(request: NextRequest) {
  const respond = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") !== request.nextUrl.origin) return respond({ error: "forbidden" }, 403);
  const secret = process.env.GITHUB_SESSION_SECRET;
  if (!secret) return respond({ error: "setup_required" }, 503);
  const github = getSession<GitHubSession>(request.cookies.get(getCookieName("session"))?.value, secret);
  if (!github || github.expiresAt <= Date.now() / 1000) return respond({ error: "github_required" }, 401);
  try {
    const user = await createGitHubClient(github.token).getUser();
    if (user.id !== github.user.id) return respond({ error: "github_required" }, 401);
    const session = (await readConnection(String(user.id), "vercel"))?.session;
    if (!session?.logsToken || !session.teamId) return respond({ error: "logs_token_required" }, 400);
    const headers = { Authorization: `Bearer ${session.logsToken}`, "Content-Type": "application/json" };
    const options = { headers, cache: "no-store" as const, redirect: "error" as const, signal: AbortSignal.timeout(10_000) };
    const metadata = await fetch("https://api.vercel.com/v5/user/tokens/current", options);
    const current = metadata.ok ? await metadata.json() : null;
    const scopes = current?.token?.scopes;
    if (metadata.ok && (!Array.isArray(scopes) || scopes.length !== 1 || scopes[0].type !== "team" || scopes[0].teamId !== session.teamId)) return respond({ error: "same_team_scope_required", renewable: false });
    const created = await fetch(`https://api.vercel.com/v3/user/tokens?teamId=${encodeURIComponent(session.teamId)}`, {
      ...options, method: "POST", body: JSON.stringify({ name: "autops-renewal-check", expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }),
    });
    if (!created.ok) {
      const failure = await created.json().catch(() => null);
      return respond({ metadataStatus: metadata.status, creationStatus: created.status, error: typeof failure?.error?.code === "string" ? failure.error.code : "renewal_denied", renewable: false });
    }
    const candidate = await created.json();
    const id = candidate.token?.id;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(id)) return respond({ error: "unexpected_token_metadata", renewable: false }, 502);
    const cleanup = await fetch(`https://api.vercel.com/v3/user/tokens/${id}`, { ...options, method: "DELETE" });
    const candidateScopes = candidate.token?.scopes;
    const sameScope = Array.isArray(candidateScopes) && candidateScopes.length === 1 && candidateScopes[0].type === "team" && candidateScopes[0].teamId === session.teamId;
    return respond({ metadataStatus: metadata.status, creationStatus: created.status, cleanupStatus: cleanup.status, renewable: metadata.ok && sameScope && cleanup.ok });
  } catch { return respond({ error: "renewal_check_unavailable" }, 502); }
}
