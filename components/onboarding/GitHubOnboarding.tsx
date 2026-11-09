"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Repository } from "@/lib/github/session";
import "./github-onboarding.css";

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
    <main className="gh-page">
      <header className="gh-header"><Link className="brand" href="/">autops<span className="brand-dot">.</span></Link><Link href="/">프로젝트로 돌아가기</Link></header>
      <div className="gh-intro"><p className="eyebrow">LET’S CONNECT YOUR PROJECT</p><h1>내 저장소에서 시작해요.</h1><p>GitHub에서 허용한 저장소를 연결하고,<br />내 서비스의 다음 단계를 준비해주세요.</p></div>
      <ol className="gh-steps" aria-label="연결 단계"><li aria-current={!connection?.user ? "step" : undefined}><span>01</span>GitHub 인증</li><li aria-current={connection?.user && !connection.repository ? "step" : undefined}><span>02</span>저장소 선택</li><li aria-current={connection?.repository ? "step" : undefined}><span>03</span>연결 확인</li></ol>
      <section className="gh-card" aria-labelledby="github-title" aria-busy={loading || saving}>
        <div className="gh-title"><span className="gh-icon" aria-hidden="true">⑂</span><div><h2 id="github-title">GitHub 저장소 연결</h2><p>선택한 저장소의 읽기 권한부터 시작해요.</p></div></div>
        {loading ? <p role="status">연결 상태를 확인하고 있어요…</p> : !connection ? <p>연결 상태를 확인한 뒤 다시 진행해주세요.</p> : !connection.configured ? (
          <div className="gh-empty"><strong>GitHub 연결을 준비하고 있어요</strong><p>관리자가 GitHub App 설정을 완료하면 저장소를 연결할 수 있어요.</p><button className="button secondary" onClick={refresh}>설정 다시 확인</button></div>
        ) : !connection.user ? (
          <div className="gh-empty"><h3>GitHub 계정을 연결해주세요</h3><p>인증 후 App을 설치하고 허용할 저장소를 선택해요.<br />비밀번호나 개인 토큰을 입력할 필요가 없어요.</p><button className="button primary" onClick={() => window.location.assign(new URL("/api/github/start", window.location.origin).href)}>GitHub로 계속하기</button></div>
        ) : (
          <>
            <div className="gh-account"><span><strong>@{connection.user.login}</strong> 계정 인증됨</span><button type="button" onClick={disconnect} disabled={saving}>연결 해제</button></div>
            {connection.repository && <div className="gh-connected" role="status"><strong>✓ {connection.repository.fullName}</strong><span>{connection.repository.defaultBranch} · {connection.repository.private ? "비공개" : "공개"} 저장소</span><Link className="button primary" href="/">프로젝트로 이동 →</Link></div>}
            <form onSubmit={save}>
              <div className="gh-repositoryHeading"><label htmlFor="repository-search">연결할 저장소</label><button type="button" onClick={refresh} disabled={saving}>목록 새로고침 ↻</button></div>
              <input className="gh-search" id="repository-search" type="search" value={query} placeholder="소유자 또는 저장소 이름 검색" onChange={(event) => setQuery(event.target.value)} />
              <fieldset className="gh-repositories" disabled={saving}><legend className="gh-srOnly">저장소 선택</legend>{visible.map((repo) => <label className="gh-repository" key={`${repo.installationId}:${repo.id}`}><input type="radio" name="repository" value={`${repo.installationId}:${repo.id}`} checked={selected === `${repo.installationId}:${repo.id}`} onChange={(event) => setSelected(event.target.value)} /><span><strong>{repo.fullName}</strong><small>{repo.defaultBranch || "빈 저장소"} · {repo.private ? "비공개" : "공개"}</small></span></label>)}</fieldset>
              {!visible.length && <p className="gh-empty">{repositories.length ? "검색 결과가 없어요." : "아직 접근할 수 있는 저장소가 없어요. 아래에서 App을 설치하거나 저장소 접근을 허용해주세요. 조직의 승인이 필요할 수도 있어요."}</p>}
              <div className="gh-actions"><button className="gh-accessButton" type="button" onClick={() => window.location.assign(new URL("/api/github/install", window.location.origin).href)}>GitHub에서 저장소 접근 설정</button><button type="submit" className="button primary" disabled={!selected || saving}>{saving ? "처리 중…" : "이 저장소 연결하기 →"}</button></div>
            </form>
          </>
        )}
        {error && <div className="gh-error" role="alert">{error}<button type="button" onClick={refresh} disabled={loading || saving}>다시 확인</button></div>}
        <p className="gh-notice" role="status" aria-live="polite">{notice}</p>
      </section>
      <footer className="gh-footer"><strong>연결은 코드 변경이나 배포를 시작하지 않아요.</strong><p>연결은 이 브라우저의 보호된 세션에 보관되며, 최대 8시간 후 다시 인증해야 해요.<br />GitHub App 권한은 GitHub 설정에서 변경하거나 제거할 수 있어요.</p></footer>
    </main>
  );
}
