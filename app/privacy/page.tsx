import type { Metadata } from "next";
import Link from "next/link";

const description = "Learn how autops handles connected GitHub, Vercel, and Supabase account data, OAuth credentials, service logs, and disconnection.";
export const metadata: Metadata = {
  title: "Privacy policy — autops", description, alternates: { canonical: "/privacy" },
  openGraph: { title: "Privacy policy — autops", description, url: "/privacy", siteName: "autops", type: "website", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Privacy policy — autops", description, images: ["/opengraph-image"] },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 leading-relaxed">
      <Link href="/">Back to Autops</Link>
      <h1 className="mt-6 text-3xl font-semibold">Autops demo privacy policy</h1>
      <p className="mt-3">Hackathon demo · Updated November 9, 2026</p>
      <h2 className="mt-8 text-xl font-semibold">1. Information and purposes</h2>
      <p className="mt-3">To connect accounts and verify permissions, we process your GitHub account ID and username, selected repository ID, name and branch, selected Vercel or Supabase project IDs, and OAuth tokens. Queries request information needed by the UI, including project name, framework, region, status, and recent deployment status.</p>
      <p className="mt-3">The current read-only connection feature does not provide database row access, SQL execution, project API keys, or environment variable access. GitHub and Supabase use OAuth. Vercel runtime logs optionally use a separate team API token entered only in the dedicated password field; it is verified, encrypted per GitHub user, and used only to verify project access and read logs. Removing the log token does not disconnect project OAuth.</p>
      <p className="mt-3">Authorized MCP tools return selected source-file content and SHAs to ChatGPT. With separate write consent, requested changes and commit messages are sent to GitHub. Hidden paths, credentials and workflows are excluded. ChatGPT handles returned information under its own policies.</p>
      <h2 className="mt-8 text-xl font-semibold">2. Storage and retention</h2>
      <p className="mt-3">GitHub browser sessions use encrypted HttpOnly cookies, with Secure in production, for up to eight hours. Vercel and Supabase credentials and selected projects are stored in the Autops Supabase database, encrypted with AES-256-GCM and bound to the verified GitHub user ID.</p>
      <p className="mt-3">ChatGPT receives encrypted Autops access tokens and, when GitHub supports token rotation, encrypted Autops refresh tokens. These are bound to the approved account, repository, client and permissions. Access tokens expire after one hour; refresh tokens expire no later than GitHub’s refresh token and renew access without another sign-in. Revocation or refresh expiry requires reconnecting.</p>
      <p className="mt-3">Cloud credentials, including Supabase refresh tokens and optional Vercel log API tokens, remain stored until you disconnect the provider. Refreshable tokens are renewed on demand. Revoked connections require authorization again. With cloud.read consent, MCP returns your accessible projects and requested recent server logs to ChatGPT; provider credentials are never returned. Logs are not retained by Autops, but may contain application data and are handled by ChatGPT under its policies.</p>
      <h2 className="mt-8 text-xl font-semibold">3. External services</h2>
      <p className="mt-3">Autops is hosted on Vercel and communicates with GitHub, Vercel, and Supabase APIs you connect. Providers process authorization and API requests under their own policies. Hosting and integration providers may create standard security and access logs. The Autops demo does not sell personal information or add analytics cookies for advertising.</p>
      <h2 className="mt-8 text-xl font-semibold">4. Disconnection and revocation</h2>
      <p className="mt-3">Disconnect a cloud provider on the onboarding page to delete its server-stored connection for your GitHub account. Clearing browser cookies signs out the browser but does not delete saved cloud connections. Provider-side permissions and installations remain separate. Fully revoke them in each service account or organization settings. Do not send passwords, tokens, or secrets when contacting us.</p>
      <h2 className="mt-8 text-xl font-semibold">5. Contact</h2>
      <p className="mt-3">Operated by ongleam · <a href="mailto:dev@ongleam.com">dev@ongleam.com</a></p>
      <p className="mt-3"><Link href="/terms">Demo terms</Link></p>
      <hr className="my-8" />
      <section lang="en" aria-label="English summary">
        <h2 className="mt-8 text-xl font-semibold">English summary</h2>
        <p className="mt-3">Autops processes GitHub identity, selected repository and cloud project identifiers, OAuth tokens, and project/deployment information to provide authorized read-only connections. Cloud connections and refresh tokens are encrypted in the server database per GitHub user and persist across browser sign-ins. Authorized MCP tools can read that user’s projects and requested recent logs. GitHub browser cookies expire separately.</p>
        <p className="mt-3">Autops is hosted on Vercel and communicates with GitHub, Vercel, and Supabase. Provider security/access logs may be generated under their own policies. The demo does not sell personal data or add advertising analytics cookies. Disconnect the cloud provider to delete its saved server connection; revoke provider access separately. Contact: <a href="mailto:dev@ongleam.com">dev@ongleam.com</a>.</p>
      </section>
    </main>
  );
}
