import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import McpUrlCopy from "@/components/McpUrlCopy";
import GitHubIcon from "@/components/GitHubIcon";
import ConnectChatGPT from "@/components/ConnectChatGPT";
import ServiceIcon from "@/components/ServiceIcon";

const description = "autops helps solo builders inspect GitHub code, Vercel and Supabase projects, and available logs through ChatGPT. Connect your project and understand what to improve next.";

export const metadata: Metadata = {
  title: "autops — AI DevOps for solo builders",
  description,
  alternates: { canonical: "/" },
  openGraph: { title: "autops — AI DevOps for solo builders", description, url: "/", siteName: "autops", type: "website" },
  twitter: { card: "summary_large_image", title: "autops — AI DevOps for solo builders", description, images: ["/opengraph-image"] },
};

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "autops",
  url: "https://autops-app.vercel.app/",
  description,
};

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6 sm:py-8">
      {/* JSON-LD is static site data; escaping '<' keeps the script safe. */}
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website).replace(/</g, "\\u003c") }} />
      <header className="flex items-center justify-between">
        <Logo className="text-xl" />
        <Link href="/login" className="inline-flex min-h-11 items-center gap-2 text-sm text-[#71717a] hover:text-[#2563eb]"><GitHubIcon className="h-4 w-4" />Sign in</Link>
      </header>
      <section className="py-16 sm:py-20" aria-labelledby="landing-title">
        <h1 id="landing-title" className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Build alone.<br />Operate with AI.</h1>
        <p className="mt-5 max-w-lg text-sm leading-7 text-[#71717a]">Connect your code and services to ChatGPT. Understand what is happening and decide what to improve next.</p>
        <Link href="/login" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#18181b] px-6 text-sm font-semibold text-white hover:bg-[#3f3f46]"><GitHubIcon className="mr-3 h-5 w-5" />Get started with GitHub <span className="ml-3" aria-hidden="true">→</span></Link>
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
            <h3 className="flex items-center gap-2 font-semibold"><ServiceIcon service="chatgpt" className="h-4 w-4" />Connect autops in ChatGPT</h3>
            <p className="mt-1 leading-7 text-[#71717a]">Use the button below, then follow the connection guide. You will need a ChatGPT account that allows custom MCP connections.</p>
            <ConnectChatGPT />
          </li>
          <li className="pl-2">
            <h3 className="font-semibold">Ask about your service</h3>
            <p className="mt-1 leading-7 text-[#71717a]">Start a new chat, type @ and select autops, then send the message below. Check that the answer shows your GitHub account and selected repository.</p>
          </li>
        </ol>
        <blockquote className="mt-6 border-l-2 border-[var(--line)] pl-4 text-sm leading-7 text-[#52525b]">Show my connected GitHub account and selected repository. Explain what you can inspect with my current connections.</blockquote>
        <details open className="mt-6 rounded-lg border border-[var(--line)] p-4 text-sm">
          <summary className="cursor-pointer font-medium"><span className="inline-flex items-center gap-2 align-middle"><ServiceIcon service="chatgpt" />ChatGPT connection guide</span></summary>
          <div className="mt-4 space-y-3 leading-7 text-[#71717a]">
            <p>Open <a href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer" className="underline underline-offset-4">ChatGPT Plugins</a>, select <strong className="text-[#27272a]">+</strong> (Add), then <strong className="text-[#27272a]">Add custom MCP server</strong>. Already have autops? Refresh that connection instead.</p>
            <p>Name it <strong className="text-[#27272a]">autops</strong>, choose <strong className="text-[#27272a]">Server URL</strong>, and paste this address:</p>
            <McpUrlCopy />
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
