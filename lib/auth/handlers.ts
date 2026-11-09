import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { authRequest, EMAIL_SESSION_COOKIE, encodeEmailSession, getAuthConfig, getEmailSession, getEmailUser, safeReturnPath } from "./session";

const credentials = z.object({ email: z.email().max(254), password: z.string().min(8).max(128) });
const tokenSchema = z.object({ access_token: z.string().min(1).max(2800), expires_in: z.number().int().positive(), user: z.object({ id: z.string().uuid(), email: z.email() }) });

function protect(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
function redirect(request: NextRequest, next: string, message?: string) {
  const url = new URL(message ? "/login" : next, request.nextUrl.origin);
  if (message) { url.searchParams.set("message", message); url.searchParams.set("next", next); }
  return protect(NextResponse.redirect(url, 303));
}
function setSession(response: NextResponse, value: string, maxAge: number) {
  response.cookies.set(EMAIL_SESSION_COOKIE, value, { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge });
  return response;
}

export async function handleEmailAuth(request: NextRequest, action: string) {
  if (action === "session" && request.method === "GET") return protect(NextResponse.json({ configured: !!getAuthConfig(), user: await getEmailUser(request.cookies.get(EMAIL_SESSION_COOKIE)?.value) }));
  if (request.method !== "POST") return protect(NextResponse.json({ error: "not_found" }, { status: 404 }));
  if (request.headers.get("origin") !== request.nextUrl.origin) return protect(NextResponse.json({ error: "forbidden" }, { status: 403 }));
  let next = "/onboarding";
  try {
    const text = await request.text();
    if (text.length > 8192 || !request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return redirect(request, next, "invalid");
    const body = new URLSearchParams(text);
    next = safeReturnPath(body.get("next"));
    if (action === "logout") {
      const session = getEmailSession(request.cookies.get(EMAIL_SESSION_COOKIE)?.value);
      if (session) { try { await authRequest("logout?scope=local", { method: "POST" }, session.accessToken); } catch { /* Clear the browser session even if the provider is unavailable. */ } }
      return setSession(redirect(request, "/login"), "", 0);
    }
    if (action !== "login" && action !== "signup") return protect(NextResponse.json({ error: "not_found" }, { status: 404 }));
    if (!getAuthConfig()) return redirect(request, next, "setup");
    const input = credentials.safeParse({ email: body.get("email"), password: body.get("password") });
    if (!input.success) return redirect(request, next, "invalid");
    const response = await authRequest(action === "signup" ? "signup" : "token?grant_type=password", { method: "POST", body: JSON.stringify(input.data) });
    const payload: unknown = await response.json();
    if (!response.ok) return redirect(request, next, "failed");
    const token = tokenSchema.safeParse(payload);
    if (!token.success) return redirect(request, next, action === "signup" ? "confirmation" : "failed");
    const lifetime = Math.min(token.data.expires_in, 3600);
    const value = encodeEmailSession({ accessToken: token.data.access_token, expiresAt: Math.floor(Date.now() / 1000) + lifetime, user: token.data.user }, lifetime);
    return setSession(redirect(request, next), value, lifetime);
  } catch { return redirect(request, next, "failed"); }
}
