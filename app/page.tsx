"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import ProjectSetupForm from "@/components/setup/ProjectSetupForm";
import ConnectionGuide from "@/components/setup/ConnectionGuide";
import GitHubConnection from "@/components/onboarding/GitHubConnection";
import { DEFAULT_PROJECT_SETTINGS, DEMO_PROJECT, type ProjectSettings } from "@/components/setup/types";

export default function Home() {
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_PROJECT_SETTINGS);
  const [mcpReady, setMcpReady] = useState(false);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "https://autops-app.vercel.app",
  );

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

  return (
    <>
      <header className="site-header">
        <Link className="brand" href="/">autops<span className="brand-dot">.</span></Link>
        <span>GitHub · MCP · ChatGPT</span>
      </header>
      <main className="setup-page">
        <div className="setup-heading">
          <h1>서비스를 연결하고,<br />AI와 점검을 시작하세요.</h1>
          <p>프로젝트 설정부터 ChatGPT 연결까지 한곳에서 준비해요.</p>
        </div>
        <section id="project" className="setup-card" aria-labelledby="project-title">
          <header className="section-title"><span>01</span><h2 id="project-title">프로젝트 설정</h2></header>
          <ProjectSetupForm settings={settings} onChange={setSettings} />
          <GitHubConnection />
        </section>
        <ConnectionGuide settings={settings} mcpUrl={`${origin}/api/mcp`} serverReady={mcpReady} />
      </main>
    </>
  );
}
