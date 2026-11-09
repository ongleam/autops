import { cookies } from "next/headers";
import Link from "next/link";
import { getConsent, MCP_FLOW_COOKIE } from "@/lib/mcp/oauth";

export const instant = false;
export const metadata = { title: "ChatGPT 계정 연결 — autops", referrer: "same-origin" };
export default async function ChatGPTConsent({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  const { flow: value } = await searchParams;
  const flow = getConsent(value, (await cookies()).get(MCP_FLOW_COOKIE)?.value);
  return <main className="mx-auto max-w-xl px-6 py-16">
    <Link href="/" className="text-2xl font-bold">autops.</Link>
    <h1 className="mt-8 text-2xl font-semibold">ChatGPT에 GitHub 계정 연결</h1>
    {flow ? <>
      <p className="mt-5 leading-8">ChatGPT가 autops를 통해 GitHub 계정 이름과 GitHub App에 허용한 저장소 목록을 읽을 수 있도록 연결합니다.</p>
      <p className="mt-4 leading-8">코드 변경·배포 권한은 제공하지 않습니다. Vercel·Supabase 웹 연결은 별도이며, 이번 연결에 포함되지 않습니다. 연결은 1시간 후 만료되며 다시 인증할 수 있습니다.</p>
      <form action="/oauth/authorize" method="POST" className="mt-8 flex gap-4">
        <input type="hidden" name="flow" value={value} />
        <button type="submit" name="decision" value="allow" className="rounded-lg bg-[#2e4030] px-5 py-3 text-white">GitHub로 인증하고 연결</button>
        <button type="submit" name="decision" value="deny" className="rounded-lg border px-5 py-3">취소</button>
      </form>
    </> : <p className="mt-5 leading-8">연결 요청이 만료되었거나 유효하지 않습니다. ChatGPT 플러그인에서 다시 연결해주세요.</p>}
  </main>;
}
