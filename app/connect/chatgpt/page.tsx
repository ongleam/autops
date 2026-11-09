import { cookies } from "next/headers";
import Logo from "@/components/Logo";
import { getConsent } from "@/lib/mcp/oauth";

export const instant = false;
export const metadata = { title: "Connect ChatGPT account — autops", referrer: "same-origin" };
export default async function ChatGPTConsent({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  const { flow: value } = await searchParams;
  const flow = getConsent(value, await cookies());
  return <main className="mx-auto max-w-xl px-6 py-16">
    <Logo className="text-2xl" />
    <h1 className="mt-8 text-2xl font-semibold">Connect your GitHub account to ChatGPT</h1>
    {flow ? <>
      <p className="mt-5 leading-8">Allow ChatGPT to read your GitHub account name and repositories authorized for the GitHub App through autops.</p>
      <p className="mt-4 leading-8">This does not grant code-change or deployment permissions. Vercel and Supabase web connections are separate and are not included. This connection expires after one hour and can be reauthorized.</p>
      <form action="/oauth/authorize" method="POST" className="mt-8 flex gap-4">
        <input type="hidden" name="flow" value={value} />
        <button type="submit" name="decision" value="allow" className="rounded-lg bg-[#2e4030] px-5 py-3 text-white">Authorize with GitHub</button>
        <button type="submit" name="decision" value="deny" className="rounded-lg border px-5 py-3">Cancel</button>
      </form>
    </> : <p className="mt-5 leading-8">This connection request is expired or invalid. Reconnect from the ChatGPT plugin.</p>}
  </main>;
}
