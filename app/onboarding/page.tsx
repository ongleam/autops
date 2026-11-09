import type { Metadata } from "next";
import GitHubOnboarding from "@/components/onboarding/GitHubOnboarding";

export const metadata: Metadata = { title: "Service connections — autops" };

export default function OnboardingPage() {
  return <GitHubOnboarding />;
}
