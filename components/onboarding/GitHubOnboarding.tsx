"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Repository } from "@/lib/github/session";
import CloudConnection from "./CloudConnection";

type Connection = { configured: boolean; user: { id: number; login: string } | null; repository: Repository | null };
const CALLBACK_ERRORS: Record<string, string> = {
  invalid_oauth_state: "인증 요청이 만료됐거나 일치하지 않아요. GitHub 연결을 다시 시작해주세요.",
  access_denied: "GitHub 연결을 취소했어요. 준비되면 다시 연결해주세요.",
  authorization_failed: "GitHub 인증을 완료하지 못했어요. 다시 시도해주세요.",
};

async function getConnection(signal?: AbortSignal) {
  const response = await fetch("/api/github/session", { cache: "no-store", signal });
  const data = await response.json();
  if (response.status === 401) return {
    connection: { configured: true, user: null, repository: null } as Connection,
    repositories: [] as Repository[], notice: data.message as string,
  };
  if (!response.ok) throw new Error(data.message || "연결 상태를 확인하지 못했어요.");
  if (!data.user) return { connection: data as Connection, repositories: [] as Repository[], notice: "" };
  const repositoriesResponse = await fetch("/api/github/repositories", { cache: "no-store", signal });
  const repositoriesData = await repositoriesResponse.json();
  if (!repositoriesResponse.ok) throw new Error(repositoriesData.message || "저장소 목록을 가져오지 못했어요.");
  return { connection: data as Connection, repositories: repositoriesData.repositories as Repository[], notice: "" };
}

export default function GitHubOnboarding() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function applyConnection(data: Awaited<ReturnType<typeof getConnection>>) {
    setConnection(data.connection);
    setRepositories(data.repositories);
    const repo = data.connection.repository;
    setSelected(repo ? `${repo.installationId}:${repo.id}` : "");
    const callbackError = new URLSearchParams(window.location.search).get("error");
    setNotice(callbackError ? CALLBACK_ERRORS[callbackError] || "GitHub 연결을 다시 시도해주세요." : data.notice);
    if (callbackError) window.history.replaceState(null, "", "/onboarding");
    setLoading(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    getConnection(controller.signal).then((data) => {
      if (!controller.signal.aborted) applyConnection(data);
    }).catch((cause) => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "연결 정보를 가져오지 못했어요.");
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  function refresh() {
    setLoading(true);
    setError("");
    getConnection().then(applyConnection).catch((cause) => {
      setError(cause instanceof Error ? cause.message : "연결 정보를 가져오지 못했어요.");
      setLoading(false);
    });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const repository = repositories.find((item) => `${item.installationId}:${item.id}` === selected);
    if (!repository) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/github/selection", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: repository.id, installationId: repository.installationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "저장소를 연결하지 못했어요.");
      setConnection((current) => current && { ...current, repository: data.repository });
      setNotice("저장소를 연결했어요. 진단과 코드 변경은 별도로 시작해주세요.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장소를 연결하지 못했어요.");
    } finally { setSaving(false); }
  }

  async function disconnect() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/github/session", { method: "DELETE" });
      if (!response.ok) throw new Error("연결을 해제하지 못했어요.");
      setConnection((current) => current && { ...current, user: null, repository: null });
      setRepositories([]);
      setSelected("");
      setNotice("이 브라우저의 연결을 해제했어요. GitHub App 설치는 유지돼요.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "다시 시도해주세요."); }
    finally { setSaving(false); }
  }

  const visible = repositories.filter((repo) => repo.fullName.toLowerCase().includes(query.toLowerCase()));
  return (
    <main className="w-full max-w-205 pt-7.5 px-8 pb-15 m-auto [&_button:disabled]:opacity-50 [&_button:disabled]:cursor-wait max-[600px]:pt-5.5 max-[600px]:px-4.5 max-[600px]:pb-10">
      <header className="flex items-center justify-between gap-4 text-[12px] text-[#71717a] max-[600px]:[&>a:last-child]:text-[10px]"><Link className="flex items-center gap-2.5 py-0 px-3 text-[25px] font-[750] tracking-[-1px]" href="/">autops<span className="text-inherit">.</span></Link><Link href="/">프로젝트로 돌아가기</Link></header>
      <div className="mt-[65px] mx-0 mb-8 [&_h1]:text-[36px] [&>p:last-child]:text-[#71717a] [&>p:last-child]:leading-[1.9] [&>p:last-child]:mt-4.5 max-[600px]:mt-[45px] max-[600px]:[&_h1]:text-[28px]"><p className="text-[10px] tracking-[1.4px] text-[#a1a1aa] font-semibold mb-2.5 max-[640px]:text-[9px]">LET’S CONNECT YOUR PROJECT</p><h1>내 서비스를 연결해요.</h1><p>GitHub 저장소와 Vercel·Supabase 프로젝트를 선택하고,<br />내 서비스의 상태를 읽기 전용으로 확인해주세요.</p></div>
      <ol className="list-none p-0 flex gap-7 text-[#71717a] text-[12px] mb-6.5 flex-wrap [&_li]:flex [&_li]:gap-2 [&_li]:items-center [&_span]:[font-family:monospace] [&_span]:text-[11px] [&_[aria-current]]:text-[#27272a] [&_[aria-current]]:font-bold max-[600px]:gap-[17px] max-[600px]:text-[11px]" aria-label="연결 단계"><li aria-current={!connection?.user ? "step" : undefined}><span>01</span>GitHub 인증</li><li aria-current={connection?.user && !connection.repository ? "step" : undefined}><span>02</span>저장소 선택</li><li aria-current={connection?.repository ? "step" : undefined}><span>03</span>연결 확인</li></ol>
      <section className="bg-white border border-solid border-[var(--line)] rounded-[7px] p-8 shadow-[0_12px_36px_#18181b06] max-[600px]:py-[23px] max-[600px]:px-4.5" aria-labelledby="github-title" aria-busy={loading || saving}>
        <div className="flex gap-[15px] items-center mb-7 [&_h2]:m-0 [&_h2]:text-[20px] [&_h2]:tracking-[-.6px] [&_p]:text-[12px] [&_p]:text-[#71717a] [&_p]:mt-2 [&_p]:mx-0 [&_p]:mb-0 max-[600px]:[&_h2]:text-[18px]"><span className="grid place-items-center w-12 h-12 rounded-[12px] bg-[#f4f4f5] text-[28px] text-[#52525b]" aria-hidden="true">⑂</span><div><h2 id="github-title">GitHub 저장소 연결</h2><p>선택한 저장소의 읽기 권한부터 시작해요.</p></div></div>
        {loading ? <p role="status">연결 상태를 확인하고 있어요…</p> : !connection ? <p>연결 상태를 확인한 뒤 다시 진행해주세요.</p> : !connection.configured ? (
          <div className="text-center py-5.5 px-3 text-[#71717a] leading-[1.9] text-[13px] [&_h3]:text-[17px] [&_h3]:text-[var(--foreground)] [&_p]:mb-6"><strong>GitHub 연결을 준비하고 있어요</strong><p>관리자가 GitHub App 설정을 완료하면 저장소를 연결할 수 있어요.</p><button className="inline-flex items-center justify-center gap-3 border border-solid border-[#d4d4d8] bg-white rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#f4f4f5]" onClick={refresh}>설정 다시 확인</button></div>
        ) : !connection.user ? (
          <div className="text-center py-5.5 px-3 text-[#71717a] leading-[1.9] text-[13px] [&_h3]:text-[17px] [&_h3]:text-[var(--foreground)] [&_p]:mb-6"><h3>GitHub 계정을 연결해주세요</h3><p>인증 후 App을 설치하고 허용할 저장소를 선택해요.<br />비밀번호나 개인 토큰을 입력할 필요가 없어요.</p><button className="inline-flex items-center justify-center gap-3 border border-solid border-[#18181b] bg-[#18181b] rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#3f3f46] text-white" onClick={() => window.location.assign(new URL("/api/github/start", window.location.origin).href)}>GitHub로 계속하기</button></div>
        ) : (
          <>
            <div className="border-t border-solid border-t-[var(--line)] py-4.5 px-0 flex justify-between items-center gap-3 text-[12px] text-[#71717a] [&_strong]:text-[#27272a] [&_button]:bg-transparent [&_button]:border-0 [&_button]:text-[12px] [&_button]:underline [&_button]:underline-offset-[4px] max-[600px]:items-start"><span><strong>@{connection.user.login}</strong> 계정 인증됨</span><button type="button" onClick={disconnect} disabled={saving}>연결 해제</button></div>
            {connection.repository && <div className="bg-[#f4f4f5] border border-solid border-[#e4e4e7] rounded-[5px] p-4.5 mt-0.5 mx-0 mb-6 flex items-start flex-col gap-2.5 [overflow-wrap:anywhere] [&_span]:text-[12px] [&_span]:text-[#52525b] [&_a]:mt-2" role="status"><strong>✓ {connection.repository.fullName}</strong><span>{connection.repository.defaultBranch} · {connection.repository.private ? "비공개" : "공개"} 저장소</span><Link className="inline-flex items-center justify-center gap-3 border border-solid border-[#18181b] bg-[#18181b] rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#3f3f46] text-white" href="/">프로젝트로 이동 →</Link></div>}
            <form onSubmit={save}>
              <div className="[&_button]:bg-transparent [&_button]:border-0 [&_button]:text-[12px] [&_button]:underline [&_button]:underline-offset-[4px] flex justify-between items-center gap-2.5 my-4 mx-0 font-semibold text-[13px] [&_button]:font-normal [&_button]:text-[#71717a]"><label htmlFor="repository-search">연결할 저장소</label><button type="button" onClick={refresh} disabled={saving}>목록 새로고침 ↻</button></div>
              <input className="w-full bg-[#fafafa] border border-solid border-[#e4e4e7] rounded-[6px] p-[13px] [font:inherit] focus-visible:outline-[2px] focus-visible:outline-solid focus-visible:outline-[#52525b] focus-visible:outline-offset-[2px]" id="repository-search" type="search" value={query} placeholder="소유자 또는 저장소 이름 검색" onChange={(event) => setQuery(event.target.value)} />
              <fieldset className="border-0 my-3.5 mx-0 p-0 max-h-85 overflow-auto" disabled={saving}><legend className="absolute w-[1px] h-[1px] p-0 m-[-1px] overflow-hidden [clip:rect(0,0,0,0)] whitespace-nowrap border-0">저장소 선택</legend>{visible.map((repo) => <label className="flex gap-3 items-center border border-solid border-[var(--line)] rounded-[7px] p-[15px] my-2 mx-0 cursor-pointer [&:has(input:checked)]:border-[#71717a] [&:has(input:checked)]:bg-[#f4f4f5] [&_input]:accent-[#2563eb] [&_input]:w-[17px] [&_input]:h-[17px] [&_input]:shrink-0 [&_strong]:block [&_strong]:text-[13px] [&_strong]:[overflow-wrap:anywhere] [&_small]:block [&_small]:mt-1.5 [&_small]:text-[#71717a] [&_small]:text-[11px]" key={`${repo.installationId}:${repo.id}`}><input type="radio" name="repository" value={`${repo.installationId}:${repo.id}`} checked={selected === `${repo.installationId}:${repo.id}`} onChange={(event) => setSelected(event.target.value)} /><span><strong>{repo.fullName}</strong><small>{repo.defaultBranch || "빈 저장소"} · {repo.private ? "비공개" : "공개"}</small></span></label>)}</fieldset>
              {!visible.length && <p className="text-center py-5.5 px-3 text-[#71717a] leading-[1.9] text-[13px] [&_h3]:text-[17px] [&_h3]:text-[var(--foreground)] [&_p]:mb-6">{repositories.length ? "검색 결과가 없어요." : "아직 접근할 수 있는 저장소가 없어요. 아래에서 App을 설치하거나 저장소 접근을 허용해주세요. 조직의 승인이 필요할 수도 있어요."}</p>}
              <div className="flex gap-4 items-center justify-between mt-5.5 max-[600px]:items-stretch max-[600px]:flex-col"><button className="bg-transparent border-0 p-0 text-[12px] text-[#52525b] underline underline-offset-[4px] max-[600px]:text-center max-[600px]:p-2" type="button" onClick={() => window.location.assign(new URL("/api/github/install", window.location.origin).href)}>GitHub에서 저장소 접근 설정</button><button type="submit" className="inline-flex items-center justify-center gap-3 border border-solid border-[#18181b] bg-[#18181b] rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#3f3f46] text-white" disabled={!selected || saving}>{saving ? "처리 중…" : "이 저장소 연결하기 →"}</button></div>
            </form>
          </>
        )}
        {error && <div className="[&_button]:bg-transparent [&_button]:border-0 [&_button]:text-[12px] [&_button]:underline [&_button]:underline-offset-[4px] p-4 mt-5 bg-[#f4f4f5] text-[#b91c1c] rounded-[6px] text-[13px] leading-[1.8] [&_button]:block [&_button]:mt-2 [&_button]:text-inherit [&_button]:p-0" role="alert">{error}<button type="button" onClick={refresh} disabled={loading || saving}>다시 확인</button></div>}
        <p className="mt-4 mx-0 mb-0 text-[12px] text-[#52525b] leading-[1.8] empty:hidden" role="status" aria-live="polite">{notice}</p>
      </section>
      <CloudConnection key={`vercel-${connection?.user?.id ?? "guest"}`} provider="vercel" enabled={Boolean(connection?.user)} />
      <CloudConnection key={`supabase-${connection?.user?.id ?? "guest"}`} provider="supabase" enabled={Boolean(connection?.user)} />
      <footer className="text-center text-[12px] text-[#71717a] my-6.5 mx-0 [&_strong]:font-medium [&_strong]:text-[#52525b] [&_p]:leading-[1.9] max-[600px]:text-[11px]"><strong>연결은 코드 변경이나 배포를 시작하지 않아요.</strong><p>연결은 이 브라우저의 보호된 세션에 보관돼요. 토큰 만료 또는 최대 8시간 후 다시 인증해야 해요.<br />각 서비스 설정에서 앱 권한을 철회할 수 있어요.</p></footer>
    </main>
  );
}
