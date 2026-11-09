import { cookies } from "next/headers";
import Link from "next/link";
import { EMAIL_SESSION_COOKIE, getAuthConfig, getEmailUser, safeReturnPath } from "@/lib/auth/session";

export const metadata = { title: "이메일 로그인 — autops", referrer: "no-referrer" };
const messages: Record<string, string> = {
  setup: "이메일 로그인을 준비하고 있어요. 잠시 후 다시 시도해주세요.",
  invalid: "올바른 이메일과 8자 이상의 비밀번호를 입력해주세요.",
  failed: "로그인 또는 가입을 완료하지 못했어요. 입력 정보와 이메일 인증 여부를 확인해주세요.",
  confirmation: "가입 가능한 이메일이라면 인증 메일이 도착해요. 메일 인증 후 로그인해주세요.",
};
export default async function Login({ searchParams }: { searchParams: Promise<{ message?: string; next?: string }> }) {
  const query = await searchParams;
  const next = safeReturnPath(query.next);
  const configured = !!getAuthConfig();
  const user = await getEmailUser((await cookies()).get(EMAIL_SESSION_COOKIE)?.value);
  return <main className="mx-auto max-w-md px-6 py-16">
    <Link href="/" className="text-2xl font-bold">autops.</Link>
    <h1 className="mt-8 text-2xl font-semibold">이메일로 로그인</h1>
    <p className="mt-3 text-sm leading-6 text-neutral-600">Email sign in · GitHub 저장소 권한은 별도로 연결해요.</p>
    {user ? <div className="mt-8 space-y-5">
      <p>{user.email} 계정으로 로그인했어요.</p>
      <Link href={next} className="block rounded-lg bg-[#2e4030] px-5 py-3 text-center text-white">계속하기</Link>
      <form action="/api/auth/logout" method="POST"><button type="submit" className="rounded-lg border px-5 py-3">로그아웃</button></form>
    </div> : <>
      {(!configured || query.message) && <p role="status" className="mt-6 text-sm leading-6">{!configured ? messages.setup : messages[query.message ?? ""] ?? "다시 시도해주세요."}</p>}
      <form action="/api/auth/login" method="POST" className="mt-8 space-y-5">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-medium">이메일 / Email<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={!configured} className="mt-2 block w-full rounded-lg border px-4 py-3" /></label>
        <label className="block text-sm font-medium">비밀번호 / Password<input name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={128} disabled={!configured} className="mt-2 block w-full rounded-lg border px-4 py-3" /></label>
        <button type="submit" disabled={!configured} className="w-full rounded-lg bg-[#2e4030] px-5 py-3 text-white disabled:opacity-50">로그인 / Sign in</button>
        <button type="submit" formAction="/api/auth/signup" disabled={!configured} className="w-full rounded-lg border px-5 py-3 disabled:opacity-50">이 이메일로 가입 / Sign up</button>
      </form>
      <p className="mt-5 text-xs leading-6 text-neutral-600">가입 후 이메일 인증이 필요할 수 있어요. 로그인은 최대 1시간 유지돼요.</p>
    </>}
  </main>;
}
