import { cookies } from "next/headers";
import Link from "next/link";
import { EMAIL_SESSION_COOKIE, getAuthConfig, getEmailUser, safeReturnPath } from "@/lib/auth/session";

export const instant = false;
export const metadata = { title: "Email sign-in — autops", referrer: "no-referrer" };
const messages: Record<string, string> = {
  setup: "Email sign-in is not configured yet. Please try again later.",
  invalid: "Enter a valid email and a password of at least 8 characters.",
  failed: "Could not complete sign-in or sign-up. Check your details and email confirmation.",
  confirmation: "If the email is eligible, a confirmation email will arrive. Confirm your email before signing in.",
};
export default async function Login({ searchParams }: { searchParams: Promise<{ message?: string; next?: string }> }) {
  const query = await searchParams;
  const next = safeReturnPath(query.next);
  const configured = !!getAuthConfig();
  const user = await getEmailUser((await cookies()).get(EMAIL_SESSION_COOKIE)?.value);
  return <main className="mx-auto max-w-md px-6 py-16">
    <Link href="/" className="text-2xl font-bold">autops.</Link>
    <h1 className="mt-8 text-2xl font-semibold">Sign in with email</h1>
    <p className="mt-3 text-sm leading-6 text-neutral-600">Email sign-in. Connect GitHub repository permissions separately.</p>
    {user ? <div className="mt-8 space-y-5">
      <p>{user.email} is signed in.</p>
      <Link href={next} className="block rounded-lg bg-[#2e4030] px-5 py-3 text-center text-white">Continue</Link>
      <form action="/api/auth/logout" method="POST"><button type="submit" className="rounded-lg border px-5 py-3">Sign out</button></form>
    </div> : <>
      {(!configured || query.message) && <p role="status" className="mt-6 text-sm leading-6">{!configured ? messages.setup : messages[query.message ?? ""] ?? "Please try again."}</p>}
      <form action="/api/auth/login" method="POST" className="mt-8 space-y-5">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-medium">Email<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={!configured} className="mt-2 block w-full rounded-lg border px-4 py-3" /></label>
        <label className="block text-sm font-medium">Password<input name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={128} disabled={!configured} className="mt-2 block w-full rounded-lg border px-4 py-3" /></label>
        <button type="submit" disabled={!configured} className="w-full rounded-lg bg-[#2e4030] px-5 py-3 text-white disabled:opacity-50">Sign in</button>
        <button type="submit" formAction="/api/auth/signup" disabled={!configured} className="w-full rounded-lg border px-5 py-3 disabled:opacity-50">Sign up with this email</button>
      </form>
      <p className="mt-5 text-xs leading-6 text-neutral-600">Email confirmation may be required. Sign-in sessions last up to one hour.</p>
    </>}
  </main>;
}
