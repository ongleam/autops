import { cookies } from "next/headers";
import Logo from "@/components/Logo";
import ServiceIcon from "@/components/ServiceIcon";
import { getConsent, CLOUD_SCOPE, REPOSITORY_READ_SCOPE, REPOSITORY_WRITE_SCOPE } from "@/lib/mcp/oauth";

export const instant = false;
export const metadata = { robots: { index: false, follow: false }, alternates: { canonical: "/connect/chatgpt" }, title: "Connect ChatGPT account — autops", referrer: "same-origin" };
export default async function ChatGPTConsent({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  const { flow: value } = await searchParams;
  const flow = getConsent(value, await cookies());
  return <main className="mx-auto max-w-xl px-6 py-16">
    <Logo className="text-2xl" />
    <h1 className="mt-8 flex items-center gap-3 text-2xl font-semibold"><ServiceIcon service="chatgpt" className="h-8 w-8" />Connect your GitHub account to ChatGPT</h1>
    {flow ? <>
      <p className="mt-5 leading-8">Allow ChatGPT to read your GitHub account name and repositories authorized for the GitHub App through autops.</p>
      {flow.scope.split(" ").includes(REPOSITORY_READ_SCOPE) && <p className="mt-4 leading-8">Allow source reads from the repository selected on autops. Repository access is checked again for every request.</p>}
      {flow.scope.split(" ").includes(REPOSITORY_WRITE_SCOPE)
        ? <p className="mt-4 leading-8 font-semibold">Allow reviewed source-file updates on the selected repository’s default branch. Each write requires the current file SHA and creates a GitHub commit. Commits may trigger your existing deployment pipeline. No workflow, credential or hidden files can be edited.</p>
        : <p className="mt-4 leading-8">Code changes are not authorized by this connection.</p>}
      {flow.scope.split(" ").includes(CLOUD_SCOPE) && <p className="mt-4 leading-8">Allow ChatGPT to validate the Vercel and Supabase connections saved to this GitHub account, including accessible projects, selected project, connection status, and recent project server logs requested for diagnosis. Provider tokens remain encrypted on the server and are never returned to ChatGPT.</p>}
      <p className="mt-4 leading-8">No direct deployment permission is granted. Access tokens expire after one hour. {flow.refreshAllowed
        ? "If GitHub supplies a refresh token, ChatGPT can renew access automatically within the same account, selected repository and approved permissions until the refresh token expires or access is revoked. Otherwise, reconnect after access expires."
        : "Reconnect after access expires."}</p>
      <form action="/oauth/authorize" method="POST" className="mt-8 flex gap-4">
        <input type="hidden" name="flow" value={value} />
        <button type="submit" name="decision" value="allow" className="rounded-lg bg-[#2e4030] px-5 py-3 text-white">Authorize with GitHub</button>
        <button type="submit" name="decision" value="deny" className="rounded-lg border px-5 py-3">Cancel</button>
      </form>
    </> : <p className="mt-5 leading-8">This connection request is expired or invalid. Reconnect from the ChatGPT plugin.</p>}
  </main>;
}
