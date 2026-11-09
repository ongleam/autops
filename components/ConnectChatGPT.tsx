"use client";

import Image from "next/image";
import { useState } from "react";

export default function ConnectChatGPT() {
  const [status, setStatus] = useState("");

  async function copyServerUrl() {
    try {
      await navigator.clipboard.writeText("https://autops-app.vercel.app/api/mcp");
      setStatus("Server URL copied. In ChatGPT, choose Add custom MCP server and paste it.");
    } catch {
      setStatus("Copy the server URL from the connection guide below, then paste it in ChatGPT.");
    }
  }

  return (
    <div className="mt-3">
      <a href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer" onClick={copyServerUrl} className="inline-flex min-h-12 items-center gap-3 rounded-lg border border-[#18181b] bg-white px-5 text-sm font-semibold text-[#18181b] hover:bg-[#f4f4f5]">
        <Image src="/brands/chatgpt.svg" alt="" width={20} height={20} aria-hidden="true" className="shrink-0" />
        Connect ChatGPT <span aria-hidden="true">↗</span>
      </a>
      <p className="mt-2 text-xs leading-6 text-[#71717a]">Copies the server URL and opens ChatGPT. Complete setup and OAuth there.</p>
      <p className="mt-1 text-xs leading-6 text-[#52525b] empty:hidden" role="status">{status}</p>
    </div>
  );
}
