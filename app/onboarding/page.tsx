import type { Metadata } from "next";
import { cookies } from "next/headers";
import GitHubOnboarding from "@/components/onboarding/GitHubOnboarding";
import { hasPendingMcpAuthorization, MCP_PENDING_COOKIE } from "@/lib/mcp/oauth";

export const metadata: Metadata = { robots: { index: false, follow: false }, alternates: { canonical: "/onboarding" }, title: "Service connections — autops" };
export const instant = false;

export default async function OnboardingPage() {
  const pending = hasPendingMcpAuthorization((await cookies()).get(MCP_PENDING_COOKIE)?.value);
  return <GitHubOnboarding resumeChatGPT={pending} />;
}
