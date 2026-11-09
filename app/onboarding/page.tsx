import type { Metadata } from "next";
import GitHubOnboarding from "@/components/onboarding/GitHubOnboarding";

export const metadata: Metadata = { title: "서비스 연결 — autops" };

export default function OnboardingPage() {
  return <GitHubOnboarding />;
}
