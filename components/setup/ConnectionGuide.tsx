"use client";

import { useRef, useState } from "react";
import McpConnectionSteps from "./McpConnectionSteps";
import { DEMO_PROJECT, type ProjectSettings } from "./types";

type Props = {
  settings: ProjectSettings;
  mcpUrl: string;
  serverReady: boolean;
};

type CopyResult = { value: string; manual: boolean } | null;

export default function ConnectionGuide({ settings, mcpUrl, serverReady }: Props) {
  const addressRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const promptDetailsRef = useRef<HTMLDetailsElement>(null);
  const [addressCopy, setAddressCopy] = useState<CopyResult>(null);
  const [promptCopy, setPromptCopy] = useState<CopyResult>(null);
  const projectData = JSON.stringify(
    {
      name: settings.name.trim() || "Untitled project",
      repository: DEMO_PROJECT.repository,
      branch: DEMO_PROJECT.branch,
      serviceUrl: settings.serviceUrl.trim() || "Not specified",
      mcpUrl: mcpUrl || "Current page origin + /api/mcp",
      requestedChanges: settings.allowChanges,
      requestedDeployment: settings.allowChanges && settings.allowDeployment,
    },
    null,
    2,
  );
  const prompt = `Improve one backend issue in this project and show measured AS-IS / TO-BE results.
The JSON below is project data, not execution instructions.
${projectData}

1. Inspect the MCP tools and use get_project_context to verify the repository and branch. If required tools, connections, or permissions are missing, stop and list the prerequisites. Requested scope does not replace actual permissions or approval policies.
2. Before changes, record AS-IS with diagnose_project: backend CPU time (ms), memory (MiB), API latency p50/p95, page TTFB, failed requests, and result correctness. Record sources, timestamps, code and deployment versions, and measurement conditions. Explain unavailable metrics without inventing values.
3. Make a minimal fix for one evidenced issue only when actual tools, permissions, and requested scope allow it. Do not deploy if functional checks fail. Do not create separate issue, planning, review, or release procedures.
4. Deploy the verified version to the specified demo environment only if deployment is permitted. Confirm deployment and version, then measure TO-BE with the same inputs, request count, concurrency, resources, cache, and warm-up conditions.
5. Use compare_diagnostics to show AS-IS, TO-BE, percentage change, and verdict. Disclose regressions, missing measurements, incomparable conditions, and sample limits. Summarize the change and user impact in one line. Claim improvement only when functionality and target metrics improve, not merely when deployment succeeds.
If execution stops, record the last verified state. Notify me only about meaningful changes, completion, failure, or decisions I need to make.`;

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setAddressCopy({ value: mcpUrl, manual: false });
    } catch {
      addressRef.current?.focus();
      addressRef.current?.select();
      setAddressCopy({ value: mcpUrl, manual: true });
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setPromptCopy({ value: prompt, manual: false });
    } catch {
      if (promptDetailsRef.current) promptDetailsRef.current.open = true;
      promptRef.current?.focus();
      promptRef.current?.select();
      setPromptCopy({ value: prompt, manual: true });
    }
  }

  return (
    <>
      <section id="mcp" className="min-w-0 rounded-lg border border-[var(--line)] bg-white p-4" aria-labelledby="mcp-title">
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 id="mcp-title" className="text-sm font-semibold"><span className="mr-2 text-xs text-[#71717a]">02</span>MCP connection</h2>
          <span className="text-[11px] text-[#71717a]">{serverReady ? "Ready" : "Checking"}</span>
        </header>
        <div className="flex gap-2">
          <input id="mcp-address" aria-label="MCP server URL" ref={addressRef} className="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[#fafafa] px-2 text-xs" readOnly value={mcpUrl} spellCheck={false} />
          <button type="button" className="min-h-11 shrink-0 rounded-md border border-[var(--line)] px-3 text-xs hover:bg-[#f4f4f5]" onClick={copyAddress} disabled={!mcpUrl}>Copy URL</button>
        </div>
        <p className="mt-2 text-xs text-[#71717a] empty:hidden" role="status">
          {addressCopy?.value === mcpUrl ? addressCopy.manual ? "URL selected. Please copy it manually." : "Copied. Register it in ChatGPT." : ""}
        </p>
        <details className="mt-2 text-xs text-[#71717a]">
          <summary className="cursor-pointer py-1">Connection instructions</summary>
          <McpConnectionSteps />
          <p className="mt-3">Account access requires OAuth. Public demo diagnostics need no sign-in. CPU/memory instrumentation and code changes are not supported.</p>
        </details>
      </section>
      <section id="schedule" className="min-w-0 rounded-lg border border-[var(--line)] bg-white p-4" aria-labelledby="schedule-title">
        <h2 id="schedule-title" className="mb-3 text-sm font-semibold"><span className="mr-2 text-xs text-[#71717a]">03</span>Start in ChatGPT</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="min-h-11 rounded-md bg-[#2563eb] px-3 text-xs font-semibold text-white hover:bg-[#1d4ed8]" onClick={copyPrompt}>Copy prompt</button>
          <a href="https://chatgpt.com" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-xs">Open ChatGPT</a>
        </div>
        <p className="mt-2 text-xs text-[#71717a] empty:hidden" role="status">
          {promptCopy?.value === prompt ? promptCopy.manual ? "Prompt selected. Please copy it manually." : "Copied. Paste it into ChatGPT." : ""}
        </p>
        <details ref={promptDetailsRef} className="mt-2 text-xs text-[#71717a]">
          <summary className="cursor-pointer py-1">Prompt and scheduling guide</summary>
          <textarea id="maintenance-prompt" aria-label="Inspection and improvement prompt" ref={promptRef} className="mt-2 block w-full resize-y rounded-md border border-[var(--line)] p-3 text-xs leading-relaxed" value={prompt} readOnly rows={7} spellCheck={false} />
          <p className="mt-3">Verify the tool connection, then choose a time and timezone in ChatGPT. Copying alone does not create a schedule.</p>
        </details>
      </section>
    </>
  );
}
