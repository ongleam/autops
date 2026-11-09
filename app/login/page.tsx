import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createGitHubClient } from "@/lib/github/client";
import { getCookieName, getSession, type GitHubSession } from "@/lib/github/session";

export const instant = false;
export const metadata = { robots: { index: false, follow: false }, alternates: { canonical: "/login" }, title: "GitHub sign-in — autops", referrer: "same-origin" };

async function hasGitHubSession() {
  const secret = process.env.GITHUB_SESSION_SECRET;
  const value = (await cookies()).get(getCookieName("session"))?.value;
  const session = secret ? getSession<GitHubSession>(value, secret) : null;
  let authenticated = false;
  if (session && session.expiresAt > Math.floor(Date.now() / 1000)) {
    try {
      const user = await createGitHubClient(session.token).getUser();
      authenticated = user.id === session.user.id;
    } catch { /* Expired or revoked sessions start a new GitHub sign-in. */ }
  }
  return authenticated;
}

export default async function Login() {
  if (await hasGitHubSession()) redirect("/onboarding");
  redirect("/api/github/start");
}
