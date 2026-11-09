import { cookies } from "next/headers";
import Logo from "@/components/Logo";
import { redirect } from "next/navigation";
import { createGitHubClient } from "@/lib/github/client";
import { getCookieName, getSession, type GitHubSession } from "@/lib/github/session";

export const instant = false;
export const metadata = { title: "GitHub sign-in — autops", referrer: "same-origin" };

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

  return <main className="mx-auto w-full max-w-md px-6 py-16">
    <Logo className="text-xl" />
    <h1 className="mt-12 text-3xl font-semibold tracking-tight">Sign in with GitHub</h1>
    <p className="mt-4 text-sm leading-7 text-[#71717a]">Start with your GitHub account.<br />Choose a repository after signing in.</p>
    <form action="/api/github/start" method="GET"><button type="submit" className="mt-8 flex min-h-12 items-center justify-center rounded-lg bg-[#18181b] px-5 text-sm font-semibold text-white hover:bg-[#3f3f46]">Continue with GitHub <span className="ml-3" aria-hidden="true">→</span></button></form>
    <p className="mt-4 text-xs leading-6 text-[#71717a]">No password or personal token is required on autops.</p>
  </main>;
}
