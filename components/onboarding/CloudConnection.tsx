"use client";

import { useEffect, useState } from "react";
import type { CloudOverview, CloudProject, Provider } from "@/lib/cloud/client";

type Connection = { configured: boolean; connected: boolean; project: CloudProject | null };
type Props = { provider: Provider; enabled: boolean };
const LABELS = { vercel: "Vercel", supabase: "Supabase" };
const CALLBACK_MESSAGES: Record<string, string> = {
  connected: "권한 승인을 완료했어요. 조회할 프로젝트를 선택해주세요.",
  invalid_oauth_state: "인증 요청이 만료됐거나 일치하지 않아요. 다시 연결해주세요.",
  access_denied: "연결을 취소했어요. 준비되면 다시 연결해주세요.",
  authorization_failed: "인증을 완료하지 못했어요. 다시 연결해주세요.",
};

async function getConnection(provider: Provider, signal?: AbortSignal) {
  const base = `/api/cloud/${provider}`;
  const response = await fetch(`${base}/session`, { cache: "no-store", signal });
  const data = await response.json();
  if (response.status === 401) return { connection: { configured: true, connected: false, project: null } as Connection, projects: [] as CloudProject[], notice: data.message as string };
  if (!response.ok) throw new Error(data.message || "연결 상태를 확인하지 못했어요.");
  if (!data.connected) return { connection: data as Connection, projects: [] as CloudProject[], notice: "" };
  const projectsResponse = await fetch(`${base}/projects`, { cache: "no-store", signal });
  const projectsData = await projectsResponse.json();
  if (!projectsResponse.ok) throw new Error(projectsData.message || "프로젝트 목록을 가져오지 못했어요.");
  return { connection: data as Connection, projects: projectsData.projects as CloudProject[], notice: "" };
}

export default function CloudConnection({ provider, enabled }: Props) {
  const name = LABELS[provider];
  const base = `/api/cloud/${provider}`;
  const [connection, setConnection] = useState<Connection | null>(null);
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [selected, setSelected] = useState("");
  const [overview, setOverview] = useState<CloudOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function applyConnection(data: Awaited<ReturnType<typeof getConnection>>) {
    setConnection(data.connection);
    setProjects(data.projects);
    setSelected(data.connection.project?.id ?? "");
    setOverview(null);
    setNotice(data.notice);
    setLoading(false);
  }

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    getConnection(provider, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      applyConnection(data);
      const params = new URLSearchParams(window.location.search);
      if (params.get("cloud") === provider) {
        setNotice(CALLBACK_MESSAGES[params.get("result") ?? ""] ?? "연결을 다시 시도해주세요.");
        params.delete("cloud");
        params.delete("result");
        window.history.replaceState(null, "", `/onboarding${params.size ? `?${params}` : ""}`);
      }
    }).catch((cause) => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "연결 상태를 확인하지 못했어요.");
      setLoading(false);
    });
    return () => controller.abort();
  }, [provider, enabled]);

  async function refresh() {
    setLoading(true);
    setError("");
    setOverview(null);
    try { applyConnection(await getConnection(provider)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "다시 시도해주세요."); }
    finally { setLoading(false); }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOverview(null);
    try {
      const response = await fetch(`${base}/selection`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "프로젝트를 선택하지 못했어요.");
      setConnection((current) => current && { ...current, project: data.project });
      setNotice("프로젝트를 선택했어요. 읽기 전용 조회를 시작할 수 있어요.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "다시 시도해주세요."); }
    finally { setBusy(false); }
  }

  async function getOverview() {
    setBusy(true);
    setError("");
    setOverview(null);
    try {
      const response = await fetch(`${base}/overview`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "프로젝트를 조회하지 못했어요.");
      setOverview(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "다시 시도해주세요."); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${base}/session`, { method: "DELETE" });
      if (!response.ok) throw new Error("연결을 해제하지 못했어요.");
      setConnection((current) => current && { ...current, connected: false, project: null });
      setProjects([]);
      setSelected("");
      setOverview(null);
      setNotice(`이 브라우저의 연결을 해제했어요. 계정 권한은 ${name} 설정에서 철회할 수 있어요.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "다시 시도해주세요."); }
    finally { setBusy(false); }
  }

  return (
    <section className="gh-card cloud-card" aria-labelledby={`${provider}-title`} aria-busy={enabled && (loading || busy)}>
      <div className="gh-title"><span className="gh-icon" aria-hidden="true">{provider === "vercel" ? "▲" : "ϟ"}</span><div><h2 id={`${provider}-title`}>{name} 프로젝트 연결</h2><p>{provider === "vercel" ? "프로젝트와 최근 배포 상태를 읽기 전용으로 조회해요." : "프로젝트 이름, 리전과 상태를 읽기 전용으로 조회해요."}</p></div></div>
      {!enabled ? <p className="gh-empty">GitHub 계정을 먼저 연결해주세요.</p> : loading ? <p role="status">연결 상태를 확인하고 있어요…</p> : !connection ? <p>연결 상태를 다시 확인해주세요.</p> : !connection.configured ? (
        <div className="gh-empty"><strong>{name} 연결을 준비하고 있어요</strong><p>관리자가 서비스 연결 설정을 완료하면 사용할 수 있어요.</p><button type="button" className="button secondary" onClick={refresh}>설정 다시 확인</button></div>
      ) : !connection.connected ? (
        <div className="gh-empty"><p>{name}에서 권한을 승인하고 조회할 프로젝트를 선택해주세요.</p><button type="button" className="button primary" onClick={() => window.location.assign(new URL(`${base}/start`, window.location.origin).href)}>{name} 연결하기 ↗</button></div>
      ) : (
        <>
          <div className="gh-account"><span>{name} 권한 승인됨</span><button type="button" onClick={disconnect} disabled={busy}>연결 해제</button></div>
          <form onSubmit={save}>
            <div className="gh-repositoryHeading"><label htmlFor={`${provider}-project`}>조회할 프로젝트</label><button type="button" onClick={refresh} disabled={busy}>목록 새로고침 ↻</button></div>
            <select className="gh-search" id={`${provider}-project`} value={selected} onChange={(event) => setSelected(event.target.value)} disabled={busy} required>
              <option value="">프로젝트를 선택해주세요</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.id}</option>)}
            </select>
            {!projects.length && <p className="gh-empty">접근할 수 있는 프로젝트가 없어요. 서비스의 프로젝트 접근 권한을 확인해주세요.</p>}
            <div className="gh-actions"><button type="submit" className="button primary" disabled={!selected || busy}>이 프로젝트 선택하기</button></div>
          </form>
          {connection.project && <div className="gh-connected"><strong>✓ {connection.project.name}</strong><span>{connection.project.id}</span><button type="button" className="button secondary" onClick={getOverview} disabled={busy}>프로젝트 상태 조회 ↻</button></div>}
          {overview && <div className="cloud-overview" role="status"><dl>
            <dt>프로젝트</dt><dd>{overview.project.name}</dd>
            {overview.project.framework !== undefined && <><dt>프레임워크</dt><dd>{overview.project.framework ?? "설정 없음"}</dd></>}
            {overview.project.region && <><dt>리전</dt><dd>{overview.project.region}</dd></>}
            {overview.project.status && <><dt>상태</dt><dd>{overview.project.status}</dd></>}
            {provider === "vercel" && <><dt>최근 배포</dt><dd>{overview.deployment ? `${overview.deployment.state} · ${new Date(overview.deployment.createdAt).toLocaleString()}` : "배포 기록 없음"}</dd></>}
            <dt>조회 시각</dt><dd>{new Date(overview.checkedAt).toLocaleString()}</dd>
          </dl></div>}
        </>
      )}
      {enabled && error && <div className="gh-error" role="alert">{error}<button type="button" onClick={refresh} disabled={loading || busy}>연결 다시 확인</button><button type="button" onClick={() => window.location.assign(new URL(`${base}/start`, window.location.origin).href)} disabled={loading || busy}>{name} 다시 연결</button></div>}
      {enabled && <p className="gh-notice" role="status" aria-live="polite">{notice}</p>}
    </section>
  );
}
