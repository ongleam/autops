import Link from "next/link";
import Logo from "@/components/Logo";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6 sm:py-8">
      <header className="flex items-center justify-between">
        <Logo className="text-xl" />
        <Link href="/login" className="inline-flex min-h-11 items-center text-sm text-[#71717a] hover:text-[#2563eb]">Sign in</Link>
      </header>
      <section className="py-16 sm:py-20" aria-labelledby="landing-title">
        <h1 id="landing-title" className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Build alone.<br />Operate with AI.</h1>
        <p className="mt-5 max-w-lg text-sm leading-7 text-[#71717a]">Connect your code and services to ChatGPT. Understand what is happening and decide what to improve next.</p>
        <Link href="/login" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#18181b] px-6 text-sm font-semibold text-white hover:bg-[#3f3f46]">Get started with GitHub <span className="ml-3" aria-hidden="true">→</span></Link>
      </section>
      <section className="border-t border-[var(--line)] py-10" aria-labelledby="why-title">
        <h2 id="why-title" className="text-xl font-semibold tracking-tight">Why we built autops</h2>
        <p className="mt-4 text-sm leading-7 text-[#71717a]">AI makes it easier to launch a service. Keeping it running still means understanding errors, checking changes, and managing deployments.</p>
        <p className="mt-3 text-sm leading-7 text-[#71717a]">We built autops to help solo builders do that work with AI, starting with their code, service status, and logs in one conversation.</p>
      </section>
      <section className="border-t border-[var(--line)] py-10" aria-labelledby="how-title">
        <h2 id="how-title" className="text-xl font-semibold tracking-tight">How to use it</h2>
        <ol className="mt-6 list-decimal space-y-5 pl-5 text-sm marker:text-[#71717a]">
          <li className="pl-2">
            <h3 className="font-semibold">Connect your project</h3>
            <p className="mt-1 leading-7 text-[#71717a]">Sign in with GitHub, install the autops GitHub App for the repositories you choose, then select a repository and click Connect this repository. Vercel and Supabase are optional.</p>
          </li>
          <li className="pl-2">
            <h3 className="font-semibold">Connect autops in ChatGPT</h3>
            <p className="mt-1 leading-7 text-[#71717a]">Follow the connection guide below to add autops in ChatGPT. You will need a ChatGPT account that allows custom MCP connections.</p>
          </li>
          <li className="pl-2">
            <h3 className="font-semibold">Ask about your service</h3>
            <p className="mt-1 leading-7 text-[#71717a]">Start a new chat, type @ and select autops, then send the message below. Check that the answer shows your GitHub account and selected repository.</p>
          </li>
        </ol>
        <blockquote className="mt-6 border-l-2 border-[var(--line)] pl-4 text-sm leading-7 text-[#52525b]">Show my connected GitHub account and selected repository. Explain what you can inspect with my current connections.</blockquote>
        <details id="chatgpt" open className="mt-6 rounded-lg border border-[var(--line)] p-4 text-sm">
          <summary className="cursor-pointer font-medium">ChatGPT connection guide</summary>
          <div className="mt-4 space-y-3 leading-7 text-[#71717a]">
            <p>Open <a href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer" className="underline underline-offset-4">ChatGPT Plugins</a>, select <strong className="text-[#27272a]">+</strong> (Add), then <strong className="text-[#27272a]">Add custom MCP server</strong>. Already have autops? Refresh that connection instead.</p>
            <p>Name it <strong className="text-[#27272a]">autops</strong>, choose <strong className="text-[#27272a]">Server URL</strong>, and paste this address:</p>
            <p className="break-all rounded-md bg-[#f4f4f5] px-3 py-2 font-mono text-xs text-[#27272a]">https://autops-app.vercel.app/api/mcp</p>
            <p>Select <strong className="text-[#27272a]">OAuth</strong> and leave the client ID and secret empty for automatic registration. Review the notice and select <strong className="text-[#27272a]">Create as a plugin</strong>. Complete authorization with the same GitHub account and selected repository.</p>
            <p>Allow account and repository reads; cloud reads are needed only for connected providers. Source edits require separate write permission.</p>
            <p>Cannot find the add option? Ask your workspace administrator about custom MCP access. Repository missing? Return to <Link href="/onboarding" className="underline underline-offset-4">GitHub connections</Link>, use Manage repository access in GitHub, then refresh the list.</p>
            <a href="https://developers.openai.com/apps-sdk/deploy/connect-chatgpt" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">Official ChatGPT connection help</a>
          </div>
        </details>
      </section>
      <section className="border-t border-[var(--line)] pt-8" aria-labelledby="today-title">
        <h2 id="today-title" className="text-sm font-semibold">Available today</h2>
        <p className="mt-3 text-sm leading-7 text-[#71717a]">Read source files, inspect connected services, and request source edits with write permission. API diagnostics support the public demo only. Automatic deployment and scheduling are not available yet.</p>
        <a href="https://github.com/ongleam/autops#readme" className="mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4">Read the full guide <span className="ml-2" aria-hidden="true">→</span></a>
      </section>
      <footer className="mt-10 flex gap-5 text-xs text-[#71717a]">
        <Link href="/terms" className="py-2">Terms</Link>
        <Link href="/privacy" className="py-2">Privacy</Link>
      </footer>
    </main>
  );
}
