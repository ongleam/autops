"use client";

import { useState } from "react";

export default function VercelLogAccess({ configured, projectSelected, onSaved }: { configured: boolean; projectSelected: boolean; onSaved: () => Promise<void> }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await update("POST");
  }
  async function update(method: "POST" | "DELETE") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/cloud/vercel/logs-token", { method, headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ token }) : undefined });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not verify Vercel log access. Your saved connection is unchanged.");
      setToken("");
      setMessage(method === "POST" ? "Log access verified and saved to your account." : "Log token removed. Project access is unchanged.");
      await onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update log access."); }
    finally { setBusy(false); }
  }
  return <details className="mt-6 border-t border-solid border-[#e4e4e7] pt-4">
    <summary className="cursor-pointer text-sm font-medium">Vercel server logs · {configured ? "Token saved" : "Connect token"}</summary>
    <p className="mt-3 text-sm leading-6">Vercel Integration OAuth does not grant runtime log access. Connect a team API token once to read logs through autops MCP. It is encrypted on the server for your GitHub account and never returned to ChatGPT.</p>
    <p className="mt-2 text-sm leading-6">API tokens may allow more than read access. Select only your Vercel team and a short expiry in <a className="underline" href="https://vercel.com/account/settings/tokens" target="_blank" rel="noopener noreferrer">Vercel token settings</a>. Autops uses this token only to verify project access and read logs.</p>
    <form onSubmit={save} className="mt-3 flex flex-col gap-3">
      <label htmlFor="vercel-logs-token" className="text-sm">Vercel API token</label>
      <input id="vercel-logs-token" type="password" autoComplete="off" spellCheck={false} value={token} onChange={(event) => setToken(event.target.value)} minLength={20} maxLength={4096} required disabled={busy} className="rounded-md border border-solid border-[#d4d4d8] p-3" />
      <button type="submit" disabled={busy || !projectSelected || !token} className="rounded-md border border-solid border-[#d4d4d8] p-3 text-sm">{busy ? "Checking log access…" : "Verify and save log token"}</button>
    </form>
    {!projectSelected && <p className="mt-2 text-sm">Select a project first.</p>}
    {configured && <button type="button" onClick={() => update("DELETE")} disabled={busy} className="mt-3 text-sm underline">Remove log token</button>}
    <p role="status" className="mt-2 text-sm">{message}</p>
  </details>;
}
