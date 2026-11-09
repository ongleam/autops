"use client";

import Link from "next/link";
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
        <Link href="/" className="text-xl font-semibold" aria-label="autops home">autops<span className="text-[#2563eb]">.</span></Link>
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
      <footer className="mt-10 flex gap-5 text-xs text-[#71717a]">
        <Link href="/terms" className="py-2">Terms</Link>
        <Link href="/privacy" className="py-2">Privacy</Link>
      </footer>
    </main>
  );
}
