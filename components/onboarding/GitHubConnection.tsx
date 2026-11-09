"use client";

import { useEffect, useState } from "react";

export default function GitHubConnection() {
  const [label, setLabel] = useState("Checking connection…");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/github/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        setLabel(!data.configured ? "GitHub App setup required" : data.repository?.fullName || (data.user ? "Select a repository" : "Connect your account"));
      })
      .catch(() => { if (!controller.signal.aborted) setLabel("Verify connection"); });
    return () => controller.abort();
  }, []);
  return <div id="connections" className="gap-3 flex items-center justify-between flex-wrap p-3.5 bg-[#fafafa] border border-solid border-[var(--line)] rounded-[5px] text-[12px] mb-6.5 [&_a]:text-[11px] [&_a]:py-[7px] [&_a]:px-2.5 [&_a]:min-h-8"><span className="min-w-0 [overflow-wrap:anywhere]"><span className="mr-1.5 text-[#52525b]">⑂</span> GitHub <span className="block text-[11px] text-[#71717a] mt-1.5 mr-0 mb-0 ml-5.5">{label}</span></span><a className="inline-flex items-center justify-center gap-3 border border-solid border-[#d4d4d8] bg-white rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#f4f4f5]" href="/onboarding">Connect account</a></div>;
}
