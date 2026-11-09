"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import ServiceConnections from "@/components/setup/ServiceConnections";
import GitHubConnection from "@/components/onboarding/GitHubConnection";
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
    <main className="mx-auto max-w-190 px-4 py-5 sm:py-7">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl">autops<span className="text-[#2563eb]">.</span></h1>
        <a href="/onboarding" className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-white px-3 text-xs hover:bg-[#f4f4f5]">GitHub 연결 ↗</a>
      </header>
      <ServiceConnections />
      <div className="grid gap-2">
        <section id="project" aria-label="프로젝트 설정" className="rounded-lg border border-[var(--line)] bg-white p-4">
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              <span className="mr-2 text-xs text-[#71717a]">01</span>프로젝트 설정
              {saved && <span className="ml-2 text-xs font-normal text-[#2563eb]">저장됨</span>}
            </summary>
            <GitHubConnection />
            <ProjectSetupForm settings={settings} onChange={updateSettings} onSaved={() => setSaved(true)} />
          </details>
        </section>
        <ConnectionGuide settings={settings} mcpUrl={`${origin}/api/mcp`} serverReady={mcpReady} />
            <details className="text-xs text-[#71717a]"><summary className="cursor-pointer text-sm text-[#71717a] py-2">상세 정보</summary>
              <section className="pt-0 px-0 pb-[25px] mb-6 border-b border-solid border-b-[var(--line)] [&_h2]:text-[12px] [&_h2]:text-[#52525b] [&_h2]:font-semibold [&_h2]:mt-[3px] [&_h2]:mx-0 [&_h2]:mb-5.5 max-[960px]:mb-0"><h2>프로젝트 요약</h2><div className="grid place-items-center w-10.5 h-10.5 border border-solid border-[var(--line)] rounded-[8px] bg-white text-[18px] font-semibold text-[#52525b] mb-3.5" aria-hidden="true">{(settings.name.trim() || "P").slice(0, 1).toUpperCase()}</div><h3 className="text-[16px] font-semibold [overflow-wrap:anywhere] mt-0 mx-0 mb-1.5 tracking-[-.3px]">{settings.name.trim() || "나의 첫 서비스"}</h3><p className="text-[11px] text-[#a1a1aa] m-0">고정 데모 프로젝트</p><dl className="text-[11px] my-5.5 mx-0 [&>div]:flex [&>div]:justify-between [&>div]:gap-[15px] [&>div]:my-[15px] [&>div]:mx-0 [&_dt]:text-[#71717a] [&_dd]:m-0 [&_dd]:text-[#52525b] [&_code]:text-[10px] [&_code]:bg-[#f0f0f2] [&_code]:py-[3px] [&_code]:px-1.5 [&_code]:rounded-[3px]"><div><dt>브랜치</dt><dd><code>{DEMO_PROJECT.branch}</code></dd></div><div><dt>공개 범위</dt><dd>공개 저장소</dd></div><div><dt>설정 상태</dt><dd>{saved ? "저장됨" : "저장 전"}</dd></div></dl><a className="text-[11px] leading-[1.8] text-[#52525b] [overflow-wrap:anywhere] flex gap-2 justify-between hover:text-[#2563eb]" href={DEMO_PROJECT.repository} target="_blank" rel="noreferrer">ongleam / compiled-ex-project <span aria-hidden="true">→</span></a></section>
              <section className="pt-0 px-0 pb-[25px] mb-6 border-b border-solid border-b-[var(--line)] [&_h2]:text-[12px] [&_h2]:text-[#52525b] [&_h2]:font-semibold [&_h2]:mt-[3px] [&_h2]:mx-0 [&_h2]:mb-5.5 max-[960px]:mb-0"><h2>사용 가능한 기능</h2><ul className="list-none p-0 m-0 grid gap-4.5 [&_li]:flex [&_li]:items-center [&_li]:gap-2 [&_li]:text-[11px] [&_li]:text-[#52525b] [&_li>span:last-child]:ml-auto [&_li>span:last-child]:text-[10px] [&_li>span:last-child]:text-[#a1a1aa] [&_li[data-unavailable]]:text-[#a1a1aa]"><li><span className="w-[5px] h-[5px] bg-[#2563eb] rounded-full shrink-0 [li[data-unavailable]_&]:bg-[#d4d4d8]" />프로젝트 정보 조회<span>읽기 전용</span></li><li><span className="w-[5px] h-[5px] bg-[#2563eb] rounded-full shrink-0 [li[data-unavailable]_&]:bg-[#d4d4d8]" />MCP 연결 안내<span>읽기 전용</span></li><li><span className="w-[5px] h-[5px] bg-[#2563eb] rounded-full shrink-0 [li[data-unavailable]_&]:bg-[#d4d4d8]" />공개 소스 · API 진단<span>읽기 전용</span></li><li data-unavailable><span className="w-[5px] h-[5px] bg-[#2563eb] rounded-full shrink-0 [li[data-unavailable]_&]:bg-[#d4d4d8]" />코드 변경<span>준비 중</span></li><li data-unavailable><span className="w-[5px] h-[5px] bg-[#2563eb] rounded-full shrink-0 [li[data-unavailable]_&]:bg-[#d4d4d8]" />자동 실행 · 배포<span>준비 중</span></li></ul></section>
              <div className="[&_h3]:text-[12px] [&_h3]:font-medium [&_h3]:mt-0 [&_h3]:mx-0 [&_h3]:mb-2.5 [&_h3]:text-[#52525b] [&_p]:text-[12px] [&_p]:leading-[1.9] [&_p]:text-[#a1a1aa] [&_p]:m-0 max-[960px]:col-span-full max-[640px]:col-auto"><h3>설정은 어디에 저장되나요?</h3><p>기본 정보는 이 브라우저에만 저장됩니다.</p></div>
            </details>

      </div>
    </main>
  );
}
