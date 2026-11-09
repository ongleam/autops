"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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
        return section && section.getBoundingClientRect().top <= window.innerHeight * 0.3;
      });
      setActive(current?.id ?? steps[0].id);
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateActiveSection);
    };
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      cancelAnimationFrame(frame);
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
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`}>
        <a className="brand" href="#project" aria-label="autops 홈"><span className="brand-mark">a</span>autops</a>
        <div className="workspace"><span className="workspace-icon">W</span><div><strong>개인 워크스페이스</strong><small>프로젝트 관리</small></div></div>
        <p className="nav-label">워크스페이스</p>
        <nav aria-label="설정 단계">
          {steps.map((step) => (
            <a key={step.id} href={`#${step.id}`} className={`nav-item ${active === step.id ? "selected" : ""}`} aria-current={active === step.id ? "location" : undefined} onClick={() => { setActive(step.id); setMenuOpen(false); }}>
              <span className="nav-number">{step.number}</span>{step.label}
            </a>
          ))}
          <a className="nav-item" href="/onboarding"><span className="nav-number">⑂</span>GitHub 연결</a>
        </nav>
        <div className="sidebar-bottom">
          <a className="support-link" href="https://github.com/ongleam/autops/issues" target="_blank" rel="noreferrer">도움말 및 피드백 <span aria-hidden="true">→</span></a>
          <div className="workspace-profile"><span className="profile-icon">W</span><div><strong>개인 워크스페이스</strong><small>로컬 설정 모드</small></div><span className="version">v0.1</span></div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar"><div className="breadcrumb"><button type="button" className="mobile-menu" aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button><span>워크스페이스</span><span className="slash">/</span><strong>프로젝트 설정</strong></div><a className="topbar-link" href="/onboarding">연결 관리</a></header>
        <main className="setup-page">
          <div className="page-title-row"><div><div className="eyebrow">PROJECT SETTINGS</div><h1>프로젝트 설정</h1><p>서비스 정보를 저장하고 AI 도구를 연결하세요.</p></div><a className="secondary-button" href={DEMO_PROJECT.repository} target="_blank" rel="noreferrer">데모 저장소 보기 <span aria-hidden="true">→</span></a></div>
          <ol className="setup-progress" aria-label="설정 순서">{steps.map((step) => <li key={step.id}><a href={`#${step.id}`} onClick={() => setActive(step.id)}><span className={`progress-number ${active === step.id ? "current" : ""}`}>{step.number}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div></a></li>)}</ol>
          <div className="setup-columns">
            <div className="setup-main-column">
              <section id="project" className="setup-project-card" aria-labelledby="project-title">
                <div className="setup-section-heading"><div><h2 id="project-title">기본 정보</h2><p>점검할 프로젝트의 이름과 서비스 주소를 관리합니다.</p></div><span className={`setup-local-state ${saved ? "is-saved" : ""}`}>{saved ? "저장됨" : "브라우저에 저장"}</span></div>
                <GitHubConnection />
                <ProjectSetupForm settings={settings} onChange={updateSettings} onSaved={() => setSaved(true)} />
              </section>
              <ConnectionGuide settings={settings} mcpUrl={`${origin}/api/mcp`} serverReady={mcpReady} />
            </div>
            <aside className="setup-context-column" aria-label="프로젝트 안내">
              <section className="context-section"><h2>프로젝트 요약</h2><div className="project-avatar" aria-hidden="true">{(settings.name.trim() || "P").slice(0, 1).toUpperCase()}</div><h3 className="project-name">{settings.name.trim() || "나의 첫 서비스"}</h3><p className="context-caption">고정 데모 프로젝트</p><dl className="project-details"><div><dt>브랜치</dt><dd><code>{DEMO_PROJECT.branch}</code></dd></div><div><dt>공개 범위</dt><dd>공개 저장소</dd></div><div><dt>설정 상태</dt><dd>{saved ? "저장됨" : "저장 전"}</dd></div></dl><a className="repository-link" href={DEMO_PROJECT.repository} target="_blank" rel="noreferrer">ongleam / compiled-ex-project <span aria-hidden="true">→</span></a></section>
              <section className="context-section"><h2>사용 가능한 기능</h2><ul className="capability-list"><li><span className="capability-dot" />프로젝트 정보 조회<span>읽기 전용</span></li><li><span className="capability-dot" />MCP 연결 안내<span>읽기 전용</span></li><li><span className="capability-dot" />공개 소스 · API 진단<span>읽기 전용</span></li><li className="unavailable"><span className="capability-dot" />코드 변경<span>준비 중</span></li><li className="unavailable"><span className="capability-dot" />자동 실행 · 배포<span>준비 중</span></li></ul></section>
              <div className="context-note"><h3>설정은 어디에 저장되나요?</h3><p>프로젝트 기본 정보는 현재 브라우저에 저장됩니다. GitHub 계정 연결은 별도로 진행해야 합니다.</p></div>
            </aside>
          </div>
          <footer className="setup-footer"><span>autops</span><span>프로젝트 설정 및 연결 관리</span></footer>
        </main>
      </div>
    </div>
  );
}
