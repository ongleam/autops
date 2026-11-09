"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import ServiceConnections from "@/components/setup/ServiceConnections";
import GitHubConnection from "@/components/onboarding/GitHubConnection";
import ProjectSetupForm from "@/components/setup/ProjectSetupForm";
import ConnectionGuide from "@/components/setup/ConnectionGuide";
import { DEFAULT_PROJECT_SETTINGS, DEMO_PROJECT, type ProjectSettings } from "@/components/setup/types";

const steps = [
  { id: "project", number: "01", label: "프로젝트 설정", detail: "진단할 서비스를 알려주세요" },
  { id: "mcp", number: "02", label: "MCP 연결", detail: "사용하는 AI와 이어주세요" },
  { id: "schedule", number: "03", label: "ChatGPT에서 시작", detail: "프롬프트와 예약을 준비해요" },
];

export default function Home() {
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_PROJECT_SETTINGS);
  const [active, setActive] = useState("project");
  const [saved, setSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
  useEffect(() => {
    let frame = 0;
    const updateActiveSection = () => {
      const current = [...steps].reverse().find((step) => {
        const section = document.getElementById(step.id);
        return section && section.getBoundingClientRect().top <= window.innerHeight * 0.5;
      });
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      setActive(atBottom ? steps[steps.length - 1].id : current?.id ?? steps[0].id);
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateActiveSection);
    };
    const observer = new ResizeObserver(scheduleUpdate);
    steps.forEach((step) => {
      const section = document.getElementById(step.id);
      if (section) observer.observe(section);
    });
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
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
    <div className="flex min-h-[100vh]">
      <aside className="w-58 fixed [inset:0_auto_0_0] bg-white border-r border-solid border-r-[var(--line)] pt-7 px-4 pb-0 flex flex-col z-[30] max-[1150px]:w-52 max-[640px]:hidden max-[640px]:w-58 max-[640px]:shadow-[8px_0_32px_#18181b12] max-[640px]:[&[data-open]]:flex max-[640px]:[&[data-open]]:[top:60px]" data-open={menuOpen || undefined}>
        <a className="flex items-center gap-2.5 py-0 px-3 text-[25px] font-[750] tracking-[-1px]" href="#project" aria-label="autops 홈"><span className="grid place-items-center w-7.5 h-7.5 bg-[#18181b] text-white text-[26px] rounded-[7px] leading-none font-semibold tracking-[-2px] pr-0.5">a</span>autops</a>
        <div className="flex items-center gap-2.5 border border-solid border-[var(--line)] rounded-[6px] p-3 my-7.5 mx-0 [&_strong]:block [&_strong]:text-[12px] [&_strong]:font-semibold [&_small]:block [&_small]:text-[var(--muted)] [&_small]:text-[11px] [&_small]:mt-[5px] max-[960px]:py-2.5 max-[960px]:px-2"><span className="w-7.5 h-7.5 grid place-items-center shrink-0 border border-solid border-[var(--line)] rounded-[5px] bg-[#f4f4f5] text-[#52525b] text-[12px] font-semibold">W</span><div><strong>개인 워크스페이스</strong><small>프로젝트 관리</small></div></div>
        <p className="mt-0 mx-3 mb-3 text-[#a1a1aa] text-[11px] font-medium">워크스페이스</p>
        <nav aria-label="설정 단계">
          {steps.map((step) => (
            <a key={step.id} href={`#${step.id}`} className="flex items-center gap-3 p-3 my-[3px] mx-0 rounded-[5px] text-[#71717a] text-[13px] hover:bg-[#f4f4f5] hover:text-[#27272a] [&[aria-current=location]]:bg-[#eff6ff] [&[aria-current=location]]:text-[#1d4ed8] [&[aria-current=location]]:font-semibold" aria-current={active === step.id ? "location" : undefined} onClick={() => { setActive(step.id); setMenuOpen(false); }}>
              <span className="text-[11px] leading-[1.5] [font-family:monospace] [opacity:.8] w-5">{step.number}</span>{step.label}
            </a>
          ))}
          <a className="flex items-center gap-3 p-3 my-[3px] mx-0 rounded-[5px] text-[#71717a] text-[13px] hover:bg-[#f4f4f5] hover:text-[#27272a] [&[aria-current=location]]:bg-[#eff6ff] [&[aria-current=location]]:text-[#1d4ed8] [&[aria-current=location]]:font-semibold" href="/onboarding"><span className="text-[11px] leading-[1.5] [font-family:monospace] [opacity:.8] w-5">⑂</span>GitHub 연결</a>
        </nav>
        <div className="mt-auto pt-12.5">
          <a className="flex justify-between text-[#71717a] text-[12px] py-3.5 px-3 hover:text-[#18181b]" href="https://github.com/ongleam/autops/issues" target="_blank" rel="noreferrer">도움말 및 피드백 <span aria-hidden="true">→</span></a>
          <div className="[&_strong]:block [&_strong]:text-[11px] [&_strong]:font-semibold [&_small]:block [&_small]:text-[var(--muted)] [&_small]:text-[10px] [&_small]:mt-[5px] flex items-center gap-[9px] border-t border-solid border-t-[var(--line)] mt-3 mx-[-16px] mb-0 py-4.5 px-4"><span className="w-7.5 h-7.5 grid place-items-center shrink-0 border border-solid border-[var(--line)] rounded-[5px] bg-[#f4f4f5] text-[#52525b] text-[12px] font-semibold">W</span><div><strong>개인 워크스페이스</strong><small>로컬 설정 모드</small></div><span className="ml-auto text-[10px] [font-family:monospace] text-[#a1a1aa]">v0.1</span></div>
        </div>
      </aside>
      <div className="ml-58 flex-1 min-w-0 max-[1150px]:ml-52 max-[640px]:ml-0">
        <header className="h-[65px] flex justify-between items-center py-0 px-10 border-b border-solid border-b-[var(--line)] bg-white gap-3 max-[1150px]:py-0 max-[1150px]:px-6 max-[640px]:h-15 max-[640px]:py-0 max-[640px]:px-4.5"><div className="flex items-center gap-4 text-[12px] text-[#71717a] [&_strong]:font-medium [&_strong]:text-[#27272a] max-[640px]:gap-2.5 max-[640px]:text-[11px]"><button type="button" className="hidden max-[640px]:block max-[640px]:bg-transparent max-[640px]:border-0 max-[640px]:text-[17px] max-[640px]:p-1" aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button><span>워크스페이스</span><span className="text-[#d4d4d8]">/</span><strong>프로젝트 설정</strong></div><a className="text-[12px] text-[#52525b] hover:text-[var(--accent)] max-[640px]:text-[11px]" href="/onboarding">연결 관리</a></header>
        <main className="max-w-350 m-auto pt-10.5 px-10 pb-0 min-[1600px]:pt-12 max-[1150px]:pt-8 max-[1150px]:px-6 max-[1150px]:pb-0 max-[640px]:pt-7 max-[640px]:px-4.5 max-[640px]:pb-0">
          <div className="flex items-center justify-between gap-5 mb-8 [&_p]:text-[13px] [&_p]:text-[#71717a] [&_p]:mt-2.5 [&_p]:mx-0 [&_p]:mb-0 [&_p]:leading-[1.7] max-[960px]:items-start max-[640px]:mb-6 max-[640px]:gap-3 max-[640px]:flex-wrap max-[640px]:[&_p]:text-[12px]"><div><div className="text-[10px] tracking-[1.4px] text-[#a1a1aa] font-semibold mb-2.5 max-[640px]:text-[9px]">PROJECT SETTINGS</div><h1>프로젝트 설정</h1><p>서비스 연결 → 설정 → ChatGPT 시작</p></div><a className="inline-flex items-center justify-center gap-3 border border-solid border-[#d4d4d8] bg-white rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#f4f4f5] max-[960px]:text-[11px] max-[640px]:text-[11px] max-[640px]:py-[7px] max-[640px]:px-2.5" href={DEMO_PROJECT.repository} target="_blank" rel="noreferrer">데모 저장소 보기 <span aria-hidden="true">→</span></a></div>
          <ServiceConnections />
          <ol className="list-none grid grid-cols-[repeat(3,1fr)] py-5 px-6 mt-0 mx-0 mb-7.5 bg-white border border-solid border-[var(--line)] rounded-[7px] [&_li+li]:border-l [&_li+li]:border-solid [&_li+li]:border-l-[var(--line)] [&_li+li]:pl-6 [&_a]:flex [&_a]:items-center [&_a]:gap-3 [&_strong]:block [&_strong]:text-[12px] [&_strong]:font-semibold [&_small]:block [&_small]:mt-[5px] [&_small]:text-[11px] [&_small]:text-[#a1a1aa] max-[1150px]:p-4.5 max-[1150px]:[&_li+li]:pl-4.5 max-[1150px]:[&_small]:hidden max-[960px]:[&_a]:gap-2 max-[960px]:[&_strong]:text-[11px] max-[960px]:[&_li+li]:pl-3 max-[640px]:py-4 max-[640px]:px-3 max-[640px]:mb-6 max-[640px]:gap-2 max-[640px]:[&_a]:items-start max-[640px]:[&_a]:flex-col max-[640px]:[&_a]:gap-[9px] max-[640px]:[&_li+li]:pl-2.5 max-[640px]:[&_strong]:text-[10px] max-[640px]:[&_strong]:leading-[1.5]" aria-label="설정 순서">{steps.map((step) => <li key={step.id}><a href={`#${step.id}`} onClick={() => setActive(step.id)}><span className="w-7.5 h-7.5 grid place-items-center border border-solid border-[var(--line)] rounded-full text-[11px] [font-family:monospace] text-[#71717a] shrink-0 [&[data-current]]:bg-[#18181b] [&[data-current]]:border-[#18181b] [&[data-current]]:text-white max-[640px]:w-[25px] max-[640px]:h-[25px] max-[640px]:text-[10px]" data-current={active === step.id || undefined}>{step.number}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div></a></li>)}</ol>
          <div className="grid grid-cols-[minmax(0,1fr)_264px] gap-8 [align-items:start] max-[1150px]:grid-cols-[minmax(0,1fr)_220px] max-[1150px]:gap-6 max-[960px]:grid-cols-[minmax(0,1fr)]">
            <div className="grid gap-6 min-w-0">
              <section id="project" className="bg-white border border-solid border-[var(--line)] rounded-[7px] p-7 min-w-0 max-[1150px]:p-6 max-[640px]:py-5 max-[640px]:px-4" aria-labelledby="project-title">
                <div className="flex items-start justify-between gap-4 mb-6 [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:tracking-[-.3px] [&_h2]:mt-0 [&_h2]:mx-0 [&_h2]:mb-2 [&_p]:text-[12px] [&_p]:text-[#71717a] [&_p]:leading-[1.7] [&_p]:m-0 max-[640px]:gap-2.5 max-[640px]:flex-wrap max-[640px]:[&_h2]:text-[16px] max-[640px]:[&_p]:text-[11px]"><div><h2 id="project-title">기본 정보</h2><p>점검할 서비스를 알려주세요.</p></div><span className="text-[10px] py-[5px] px-[7px] bg-[#f4f4f5] border border-solid border-[var(--line)] rounded-[4px] text-[#71717a] whitespace-nowrap [&[data-saved]]:text-[#1d4ed8] [&[data-saved]]:bg-[#eff6ff] [&[data-saved]]:border-[#dbeafe]" data-saved={saved || undefined}>{saved ? "저장됨" : "브라우저에 저장"}</span></div>
                <GitHubConnection />
                <ProjectSetupForm settings={settings} onChange={updateSettings} onSaved={() => setSaved(true)} />
              </section>
              <ConnectionGuide settings={settings} mcpUrl={`${origin}/api/mcp`} serverReady={mcpReady} />
            </div>
            <aside className="min-w-0 max-[960px]:grid max-[960px]:grid-cols-[1fr_1fr] max-[960px]:gap-6 max-[640px]:grid-cols-[1fr] max-[640px]:gap-6" aria-label="프로젝트 안내">
              <section className="pt-0 px-0 pb-[25px] mb-6 border-b border-solid border-b-[var(--line)] [&_h2]:text-[12px] [&_h2]:text-[#52525b] [&_h2]:font-semibold [&_h2]:mt-[3px] [&_h2]:mx-0 [&_h2]:mb-5.5 max-[960px]:mb-0"><h2>프로젝트 요약</h2><div className="grid place-items-center w-10.5 h-10.5 border border-solid border-[var(--line)] rounded-[8px] bg-white text-[18px] font-semibold text-[#52525b] mb-3.5" aria-hidden="true">{(settings.name.trim() || "P").slice(0, 1).toUpperCase()}</div><h3 className="text-[16px] font-semibold [overflow-wrap:anywhere] mt-0 mx-0 mb-1.5 tracking-[-.3px]">{settings.name.trim() || "나의 첫 서비스"}</h3><p className="text-[11px] text-[#a1a1aa] m-0">고정 데모 프로젝트</p><dl className="text-[11px] my-5.5 mx-0 [&>div]:flex [&>div]:justify-between [&>div]:gap-[15px] [&>div]:my-[15px] [&>div]:mx-0 [&_dt]:text-[#71717a] [&_dd]:m-0 [&_dd]:text-[#52525b] [&_code]:text-[10px] [&_code]:bg-[#f0f0f2] [&_code]:py-[3px] [&_code]:px-1.5 [&_code]:rounded-[3px]"><div><dt>브랜치</dt><dd><code>{DEMO_PROJECT.branch}</code></dd></div><div><dt>공개 범위</dt><dd>공개 저장소</dd></div><div><dt>설정 상태</dt><dd>{saved ? "저장됨" : "저장 전"}</dd></div></dl><a className="text-[11px] leading-[1.8] text-[#52525b] [overflow-wrap:anywhere] flex gap-2 justify-between hover:text-[#2563eb]" href={DEMO_PROJECT.repository} target="_blank" rel="noreferrer">ongleam / compiled-ex-project <span aria-hidden="true">→</span></a></section>
              <section className="pt-0 px-0 pb-[25px] mb-6 border-b border-solid border-b-[var(--line)] [&_h2]:text-[12px] [&_h2]:text-[#52525b] [&_h2]:font-semibold [&_h2]:mt-[3px] [&_h2]:mx-0 [&_h2]:mb-5.5 max-[960px]:mb-0"><h2>사용 가능한 기능</h2><ul className="list-none p-0 m-0 grid gap-4.5 [&_li]:flex [&_li]:items-center [&_li]:gap-2 [&_li]:text-[11px] [&_li]:text-[#52525b] [&_li>span:last-child]:ml-auto [&_li>span:last-child]:text-[10px] [&_li>span:last-child]:text-[#a1a1aa] [&_li[data-unavailable]]:text-[#a1a1aa]"><li><span className="w-[5px] h-[5px] bg-[#2563eb] rounded-full shrink-0 [li[data-unavailable]_&]:bg-[#d4d4d8]" />프로젝트 정보 조회<span>읽기 전용</span></li><li><span className="w-[5px] h-[5px] bg-[#2563eb] rounded-full shrink-0 [li[data-unavailable]_&]:bg-[#d4d4d8]" />MCP 연결 안내<span>읽기 전용</span></li><li><span className="w-[5px] h-[5px] bg-[#2563eb] rounded-full shrink-0 [li[data-unavailable]_&]:bg-[#d4d4d8]" />공개 소스 · API 진단<span>읽기 전용</span></li><li data-unavailable><span className="w-[5px] h-[5px] bg-[#2563eb] rounded-full shrink-0 [li[data-unavailable]_&]:bg-[#d4d4d8]" />코드 변경<span>준비 중</span></li><li data-unavailable><span className="w-[5px] h-[5px] bg-[#2563eb] rounded-full shrink-0 [li[data-unavailable]_&]:bg-[#d4d4d8]" />자동 실행 · 배포<span>준비 중</span></li></ul></section>
              <div className="[&_h3]:text-[12px] [&_h3]:font-medium [&_h3]:mt-0 [&_h3]:mx-0 [&_h3]:mb-2.5 [&_h3]:text-[#52525b] [&_p]:text-[12px] [&_p]:leading-[1.9] [&_p]:text-[#a1a1aa] [&_p]:m-0 max-[960px]:col-span-full max-[640px]:col-auto"><h3>설정은 어디에 저장되나요?</h3><p>기본 정보는 이 브라우저에만 저장됩니다.</p></div>
            </aside>
          </div>
          <footer className="flex items-center justify-between gap-3 text-[11px] text-[#a1a1aa] py-7 px-0 [&>span:first-child]:font-semibold [&>span:first-child]:tracking-[-.3px] [&>span:first-child]:text-[#71717a] max-[640px]:text-[10px]"><span>autops</span><span>프로젝트 설정 및 연결 관리</span></footer>
        </main>
      </div>
    </div>
  );
}
