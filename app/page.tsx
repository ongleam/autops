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
    <div className="app-shell setup-shell">
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`}>
        <a className="brand" href="#project" aria-label="Compiled 홈"><span className="brand-mark">c<span>↗</span></span>compiled<span className="brand-dot">.</span></a>
        <div className="setup-workspace"><span className="workspace-icon">C</span><div><strong>내 프로젝트 시작하기</strong><small>YOUR FIRST CONNECTION</small></div></div>
        <p className="nav-label">GET STARTED</p>
        <nav aria-label="설정 단계">
          {steps.map((step) => (
            <a key={step.id} href={`#${step.id}`} className={`nav-item ${active === step.id ? "selected" : ""}`} onClick={() => { setActive(step.id); setMenuOpen(false); }}>
              <span className="setup-nav-number">{step.number}</span>{step.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom"><div className="help-box"><span className="help-spark">✧</span><strong>처음이어도 괜찮아요</strong><p>프로젝트부터 AI 연결까지,<br />한 번에 하나씩 준비해요.</p><a href="https://github.com/ongleam/compiled-17/issues/1" target="_blank" rel="noreferrer">개발 중인 기능 살펴보기 ↗</a></div><div className="setup-side-footer">COMPILED · EARLY ACCESS</div></div>
      </aside>

      <div className="main-shell">
        <header className="topbar"><div className="breadcrumb"><button type="button" className="mobile-menu" aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button><span>워크스페이스</span><span className="slash">/</span><strong>프로젝트 설정</strong></div><span className="setup-preview-label">설정 프리뷰</span></header>
        <main className="setup-page">
          <div className="setup-heading"><div className="eyebrow">LESS GUESSWORK. MORE CONFIDENCE.</div><h1>내 서비스의 다음 단계,<br className="setup-mobile-break" /> 함께 준비해요<span>.</span></h1><p>프로젝트를 정하고, AI에 연결하고, 첫 점검을 준비하세요.</p></div>
          <section className="setup-intro" aria-label="설정 흐름">
            <div className="setup-intro-copy"><span className="setup-kicker">YOUR PROJECT, CONNECTED.</span><h2>기술이 어려워도<br />시작은 간단하게.</h2><p>계정의 비밀번호나 API 키 없이,<br />먼저 프로젝트 정보부터 준비할 수 있어요.</p></div>
            <ol className="setup-journey">{steps.map((step) => <li key={step.id}><a href={`#${step.id}`} onClick={() => setActive(step.id)}><span>{step.number}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div><b aria-hidden="true">↗</b></a></li>)}</ol>
          </section>

          <div className="setup-columns">
            <div className="setup-main-column">
              <section id="project" className="setup-project-card" aria-labelledby="project-title">
                <div className="setup-section-heading"><div><span className="setup-section-step">STEP 01</span><h2 id="project-title">어떤 서비스를 살펴볼까요?</h2><p>이 브라우저에 보관할 기본 정보를 입력해주세요.</p></div><span className={`setup-local-state ${saved ? "is-saved" : ""}`}>{saved ? "브라우저에 저장됨" : "기본 정보"}</span></div>
                <GitHubConnection />
                <ProjectSetupForm settings={settings} onChange={updateSettings} onSaved={() => setSaved(true)} />
              </section>
              <ConnectionGuide settings={settings} mcpUrl={`${origin}/api/mcp`} serverReady={mcpReady} />
            </div>
            <aside className="setup-context-column" aria-label="프로젝트 안내">
              <div className="setup-project-summary"><div className="setup-summary-icon" aria-hidden="true">⑂</div><span className="setup-kicker">DEMO PROJECT</span><h2>{settings.name.trim() || "나의 첫 서비스"}</h2><a href={DEMO_PROJECT.repository} target="_blank" rel="noreferrer">ongleam/<br /><strong>compiled-ex-project</strong> ↗</a><div className="setup-branch"><span aria-hidden="true">⑂</span> {DEMO_PROJECT.branch}<span>공개 저장소</span></div></div>
              <div className="setup-honest-note"><span aria-hidden="true">ⓘ</span><h3>준비와 실행을 구분해요</h3><p>입력한 설정은 이 브라우저에만 보관돼요. GitHub 인증·실제 진단·예약 실행 상태는 아직 이 화면에서 확인하지 않아요.</p></div>
              <div className="setup-outcome"><span className="setup-kicker">WHAT COMES NEXT</span><h3>얼마나 나아졌는지,<br />근거로 확인할 수 있도록.</h3><p>이후 진단 기능이 연결되면 CPU·메모리·응답 속도의 변경 전후를 AI 대화에서 비교해드려요.</p><span className="setup-future-tag">진단 기능 준비 중</span></div>
            </aside>
          </div>
          <footer className="setup-footer"><span>✳ 기술은 복잡해도, 시작은 명확하게.</span><span>프로젝트 설정 · 읽기 연결부터 차근차근</span></footer>
        </main>
      </div>
    </div>
  );
}
