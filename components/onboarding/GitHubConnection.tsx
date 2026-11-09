"use client";

import { useEffect, useState } from "react";

export default function GitHubConnection() {
  const [label, setLabel] = useState("연결 확인 중…");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/github/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        setLabel(data.repository?.fullName || (data.user ? "저장소 선택 필요" : "저장소 연결 필요"));
      })
      .catch(() => { if (!controller.signal.aborted) setLabel("연결 확인 필요"); });
    return () => controller.abort();
  }, []);
  return <div id="connections" className="connection-footer" style={{ gap: 12 }}><span style={{ minWidth: 0, overflowWrap: "anywhere" }}><span className="github-mini">⑂</span> GitHub <span className="connection-check">{label}</span></span><a className="button" href="/onboarding">저장소 연결 <span>↗</span></a></div>;
}
