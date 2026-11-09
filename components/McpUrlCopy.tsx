"use client";

import { useRef, useState } from "react";
import { MCP_URL } from "@/lib/projects/context";

export default function McpUrlCopy() {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setMessage("Copied. Paste this URL into ChatGPT.");
    } catch {
      input.current?.select();
      setMessage("URL selected. Copy it manually.");
    }
  }

  return <div className="flex flex-wrap items-center gap-2">
    <input ref={input} aria-label="autops MCP server URL" className="min-w-0 flex-1 rounded-md bg-[#f4f4f5] px-3 py-2 font-mono text-xs text-[#27272a]" readOnly value={MCP_URL} />
    <button type="button" onClick={copy} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-xs font-medium hover:bg-[#f4f4f5]">Copy URL</button>
    <span className="w-full text-xs" role="status" aria-live="polite">{message}</span>
  </div>;
}
