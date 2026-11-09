import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createGitHubClient } from "@/lib/github/client";
import { getCookieName, getSession, type GitHubSession } from "@/lib/github/session";

export const instant = false;
export const metadata = { title: "GitHub 로그인 — autops", referrer: "same-origin" };

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
    <Link href="/" className="text-xl font-semibold">autops.</Link>
    <h1 className="mt-12 text-3xl font-semibold tracking-tight">GitHub로 로그인</h1>
    <p className="mt-4 text-sm leading-7 text-[#71717a]">사용하던 GitHub 계정으로 시작하세요.<br />로그인 후 연결할 저장소를 선택할 수 있어요.</p>
    <form action="/api/github/start" method="GET"><button type="submit" className="mt-8 flex min-h-12 items-center justify-center rounded-lg bg-[#18181b] px-5 text-sm font-semibold text-white hover:bg-[#3f3f46]">GitHub로 계속하기 <span className="ml-3" aria-hidden="true">→</span></button></form>
    <p className="mt-4 text-xs leading-6 text-[#71717a]">비밀번호나 개인 토큰을 autops에 입력할 필요 없어요.</p>
  </main>;
}
