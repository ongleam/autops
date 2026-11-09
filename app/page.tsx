"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import ProjectSetupForm from "@/components/setup/ProjectSetupForm";
import ConnectionGuide from "@/components/setup/ConnectionGuide";
import { DEFAULT_PROJECT_SETTINGS, DEMO_PROJECT, type ProjectSettings } from "@/components/setup/types";

export default function Home() {
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_PROJECT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [mcpReady, setMcpReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/project-context", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((context) => {
        if (context?.repository === DEMO_PROJECT.repository && context?.capabilities?.context === true) {
          setMcpReady(true);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "https://autops-app.vercel.app",
  );
  const updateSettings = useCallback((next: ProjectSettings) => {
    setSettings(next);
    setSaved(false);
  }, []);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6 sm:py-8">
      <header className="flex items-center justify-between">
        <Logo className="text-xl" />
        <Link href="/login" className="inline-flex min-h-11 items-center text-sm text-[#71717a] hover:text-[#2563eb]">Sign in</Link>
      </header>
      <section className="py-16 sm:py-24" aria-labelledby="landing-title">
        <h1 id="landing-title" className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Connect your service.<br />Check it with AI.</h1>
        <p className="mt-5 text-sm leading-7 text-[#71717a]">Sign in with GitHub and check your project in ChatGPT.</p>
        <Link href="/login" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#18181b] px-6 text-sm font-semibold text-white hover:bg-[#3f3f46]">Get started with GitHub <span className="ml-3" aria-hidden="true">→</span></Link>
      </section>
      <div className="grid gap-3">
        <details className="rounded-lg border border-[var(--line)] bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium">ChatGPT connection guide</summary>
          <div className="mt-4 grid gap-3"><ConnectionGuide settings={settings} mcpUrl={`${origin}/api/mcp`} serverReady={mcpReady} /></div>
        </details>
        <details id="project" className="rounded-lg border border-[var(--line)] bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium">Project settings{saved && <span className="ml-2 text-xs text-[#2563eb]">Saved</span>}</summary>
          <div className="mt-4"><ProjectSetupForm settings={settings} onChange={updateSettings} onSaved={() => setSaved(true)} /></div>
        </details>
      </div>
      <section className="mt-20 border-t border-[var(--line)] pt-12" aria-labelledby="pricing-title">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#2563eb]">Pricing concept</p>
        <h2 id="pricing-title" className="mt-3 text-2xl font-semibold tracking-tight">More time for the work that matters.</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-[#71717a]">Verification and deployment take human hours. Our simple unit is time available each day to run that loop.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <h3 className="font-semibold">Free</h3>
            <p className="mt-4 text-3xl font-semibold">3 hours<span className="text-sm font-normal text-[#71717a]"> / day</span></p>
            <p className="mt-4 text-xl font-semibold">$0</p>
            <p className="mt-5 text-sm leading-6">A daily window for verification and deployment workflows.</p>
          </div>
          <div className="rounded-xl border border-[#18181b] bg-white p-5">
            <h3 className="font-semibold">Pro</h3>
            <p className="mt-4 text-3xl font-semibold">24 hours<span className="text-sm font-normal text-[#71717a]"> / day</span></p>
            <p className="mt-4 text-xl font-semibold">$20<span className="text-sm font-normal text-[#71717a]"> / month</span></p>
            <p className="mt-5 text-sm leading-6">Keep the verification and deployment loop available all day.</p>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-[#71717a]">Time-based access and billing are a proposed model, not active limits or paid features. Deployment automation is not available yet; live API diagnostics currently support the public demo project only.</p>
      </section>
      <footer className="mt-10 flex gap-5 text-xs text-[#71717a]">
        <Link href="/terms" className="py-2">Terms</Link>
        <Link href="/privacy" className="py-2">Privacy</Link>
      </footer>
    </main>
  );
}
