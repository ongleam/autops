"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
    <section id={provider} className="bg-white border border-solid border-[var(--line)] rounded-[7px] p-8 shadow-[0_12px_36px_#18181b06] max-[600px]:py-[23px] max-[600px]:px-4.5 mt-6" aria-labelledby={`${provider}-title`} aria-busy={enabled && (loading || busy)}>
      <div className="flex gap-[15px] items-center mb-7 [&_h2]:m-0 [&_h2]:text-[20px] [&_h2]:tracking-[-.6px] [&_p]:text-[12px] [&_p]:text-[#71717a] [&_p]:mt-2 [&_p]:mx-0 [&_p]:mb-0 max-[600px]:[&_h2]:text-[18px]"><Image src={`/brands/${provider}.svg`} alt="" width={120} height={28} className="h-6 w-30 shrink-0 object-contain object-left" /><div><h2 id={`${provider}-title`}>{name} 프로젝트 연결</h2><p>{provider === "vercel" ? "최근 배포 · 읽기 전용" : "리전 및 상태 · 읽기 전용"}</p></div></div>
      {!enabled ? <p className="text-center py-5.5 px-3 text-[#71717a] leading-[1.9] text-[13px] [&_h3]:text-[17px] [&_h3]:text-[var(--foreground)] [&_p]:mb-6">GitHub 계정을 먼저 연결해주세요.</p> : loading ? <p role="status">연결 상태를 확인하고 있어요…</p> : !connection ? <p>연결 상태를 다시 확인해주세요.</p> : !connection.configured ? (
        <div className="text-center py-5.5 px-3 text-[#71717a] leading-[1.9] text-[13px] [&_h3]:text-[17px] [&_h3]:text-[var(--foreground)] [&_p]:mb-6"><strong>{name} 연결을 준비하고 있어요</strong><p>관리자가 서비스 연결 설정을 완료하면 사용할 수 있어요.</p><button type="button" className="inline-flex items-center justify-center gap-3 border border-solid border-[#d4d4d8] bg-white rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#f4f4f5]" onClick={refresh}>설정 다시 확인</button></div>
      ) : !connection.connected ? (
        <div className="text-center py-5.5 px-3 text-[#71717a] leading-[1.9] text-[13px] [&_h3]:text-[17px] [&_h3]:text-[var(--foreground)] [&_p]:mb-6"><p>{name}에서 권한을 승인하고 조회할 프로젝트를 선택해주세요.</p><button type="button" className="inline-flex items-center justify-center gap-3 border border-solid border-[#18181b] bg-[#18181b] rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#3f3f46] text-white" onClick={() => window.location.assign(new URL(`${base}/start`, window.location.origin).href)}>{name} 연결하기 ↗</button></div>
      ) : (
        <>
          <div className="border-t border-solid border-t-[var(--line)] py-4.5 px-0 flex justify-between items-center gap-3 text-[12px] text-[#71717a] [&_strong]:text-[#27272a] [&_button]:bg-transparent [&_button]:border-0 [&_button]:text-[12px] [&_button]:underline [&_button]:underline-offset-[4px] max-[600px]:items-start"><span>{name} 권한 승인됨</span><button type="button" onClick={disconnect} disabled={busy}>연결 해제</button></div>
          <form onSubmit={save}>
            <div className="[&_button]:bg-transparent [&_button]:border-0 [&_button]:text-[12px] [&_button]:underline [&_button]:underline-offset-[4px] flex justify-between items-center gap-2.5 my-4 mx-0 font-semibold text-[13px] [&_button]:font-normal [&_button]:text-[#71717a]"><label htmlFor={`${provider}-project`}>조회할 프로젝트</label><button type="button" onClick={refresh} disabled={busy}>목록 새로고침 ↻</button></div>
            <select className="w-full bg-[#fafafa] border border-solid border-[#e4e4e7] rounded-[6px] p-[13px] [font:inherit] focus-visible:outline-[2px] focus-visible:outline-solid focus-visible:outline-[#52525b] focus-visible:outline-offset-[2px]" id={`${provider}-project`} value={selected} onChange={(event) => setSelected(event.target.value)} disabled={busy} required>
              <option value="">프로젝트를 선택해주세요</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.id}</option>)}
            </select>
            {!projects.length && <p className="text-center py-5.5 px-3 text-[#71717a] leading-[1.9] text-[13px] [&_h3]:text-[17px] [&_h3]:text-[var(--foreground)] [&_p]:mb-6">접근할 수 있는 프로젝트가 없어요. 서비스의 프로젝트 접근 권한을 확인해주세요.</p>}
            <div className="flex gap-4 items-center justify-between mt-5.5 max-[600px]:items-stretch max-[600px]:flex-col"><button type="submit" className="inline-flex items-center justify-center gap-3 border border-solid border-[#18181b] bg-[#18181b] rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#3f3f46] text-white" disabled={!selected || busy}>이 프로젝트 선택하기</button></div>
          </form>
          {connection.project && <div className="bg-[#f4f4f5] border border-solid border-[#e4e4e7] rounded-[5px] p-4.5 mt-6 mx-0 mb-6 flex items-start flex-col gap-2.5 [overflow-wrap:anywhere] [&_span]:text-[12px] [&_span]:text-[#52525b] [&_a]:mt-2"><strong>✓ {connection.project.name}</strong><span>{connection.project.id}</span><button type="button" className="inline-flex items-center justify-center gap-3 border border-solid border-[#d4d4d8] bg-white rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#f4f4f5]" onClick={getOverview} disabled={busy}>프로젝트 상태 조회 ↻</button></div>}
          {overview && <div className="text-[13px] border-t border-solid border-t-[var(--line)] pt-4 [&_dl]:grid [&_dl]:grid-cols-[90px_minmax(0,1fr)] [&_dl]:gap-3 [&_dt]:text-[#71717a] [&_dd]:m-0 [&_dd]:[overflow-wrap:anywhere]" role="status"><dl>
            <dt>프로젝트</dt><dd>{overview.project.name}</dd>
            {overview.project.framework !== undefined && <><dt>프레임워크</dt><dd>{overview.project.framework ?? "설정 없음"}</dd></>}
            {overview.project.region && <><dt>리전</dt><dd>{overview.project.region}</dd></>}
            {overview.project.status && <><dt>상태</dt><dd>{overview.project.status}</dd></>}
            {provider === "vercel" && <><dt>최근 배포</dt><dd>{overview.deployment ? `${overview.deployment.state} · ${new Date(overview.deployment.createdAt).toLocaleString()}` : "배포 기록 없음"}</dd></>}
            <dt>조회 시각</dt><dd>{new Date(overview.checkedAt).toLocaleString()}</dd>
          </dl></div>}
        </>
      )}
      {enabled && error && <div className="[&_button]:bg-transparent [&_button]:border-0 [&_button]:text-[12px] [&_button]:underline [&_button]:underline-offset-[4px] p-4 mt-5 bg-[#f4f4f5] text-[#b91c1c] rounded-[6px] text-[13px] leading-[1.8] [&_button]:block [&_button]:mt-2 [&_button]:text-inherit [&_button]:p-0" role="alert">{error}<button type="button" onClick={refresh} disabled={loading || busy}>연결 다시 확인</button><button type="button" onClick={() => window.location.assign(new URL(`${base}/start`, window.location.origin).href)} disabled={loading || busy}>{name} 다시 연결</button></div>}
      {enabled && <p className="mt-4 mx-0 mb-0 text-[12px] text-[#52525b] leading-[1.8] empty:hidden" role="status" aria-live="polite">{notice}</p>}
    </section>
  );
}
