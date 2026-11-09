import type { Metadata } from "next";
import GitHubOnboarding from "@/components/onboarding/GitHubOnboarding";

export const metadata: Metadata = { title: "GitHub 저장소 연결 — autops" };

export default function OnboardingPage() {
  return <GitHubOnboarding />;
}
