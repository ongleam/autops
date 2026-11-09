import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Demo terms — Autops" };

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 leading-relaxed">
      <Link href="/">Back to Autops</Link>
      <h1 className="mt-6 text-3xl font-semibold">Autops demo terms</h1>
      <p className="mt-3">Hackathon demo · Updated November 9, 2026</p>
      <h2 className="mt-8 text-xl font-semibold">1. Available features</h2>
      <p className="mt-3">Autops is a demo that connects GitHub repositories and Vercel or Supabase projects to read authorized project information and deployment status. Connecting alone does not start code changes, deployments, SQL execution, or database row access.</p>
      <h2 className="mt-8 text-xl font-semibold">2. Connections and permissions</h2>
      <p className="mt-3">Connect only accounts and projects you are authorized to access. Review permissions on each provider authorization screen. Autops requests information within those permissions. Provider terms and access policies also apply.</p>
      <p className="mt-3">With separate repository.write consent, requested source changes can be committed to the selected repository’s default branch and may trigger existing CI/deployments. Review changes first. A commit does not verify tests or deployment.</p>
      <h2 className="mt-8 text-xl font-semibold">3. Demo limitations</h2>
      <p className="mt-3">This demo has no service-level agreement (SLA). Features and availability may change. Displayed status depends on the time of the query and provider response. Recheck the provider dashboard before making operational decisions. Instructions and query results do not mean diagnosis, changes, or deployment have been completed.</p>
      <h2 className="mt-8 text-xl font-semibold">4. Ending use</h2>
      <p className="mt-3">Disconnect this browser from the onboarding page. This does not revoke provider-side app installations or permissions. To fully revoke access, also remove app permissions in GitHub, Vercel, or Supabase account or organization settings.</p>
      <h2 className="mt-8 text-xl font-semibold">5. Operator and contact</h2>
      <p className="mt-3">Operated by ongleam · <a href="mailto:dev@ongleam.com">dev@ongleam.com</a></p>
      <p className="mt-3">Connection data is described in the <Link href="/privacy">Privacy policy</Link>.</p>
      <hr className="my-8" />
      <section lang="en" aria-label="English summary">
        <h2 className="mt-8 text-xl font-semibold">English summary</h2>
        <p className="mt-3">Autops is a hackathon demo for connecting accounts and reading authorized project and deployment information. Connecting does not execute code changes, deployments, SQL, or database row queries. Connect only accounts and projects you are authorized to access. Provider terms also apply.</p>
        <p className="mt-3">No SLA is offered for this demo. Features and availability may change; verify operational information with the provider. Disconnecting clears this browser’s connection; revoke the app separately in the provider’s settings. Operator: ongleam. Contact: <a href="mailto:dev@ongleam.com">dev@ongleam.com</a>.</p>
      </section>
    </main>
  );
}
