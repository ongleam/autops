"use client";

import { useState } from "react";
import type { CloudProject } from "@/lib/cloud/client";

export default function VercelDeploymentAccess({ project, enabled, tokenConfigured, onSaved }: {
  project: CloudProject; enabled: boolean; tokenConfigured: boolean; onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function update() {
    setBusy(true);
    try {
      const response = await fetch("/api/cloud/vercel/deployment-access", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled, projectId: project.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not update deployment access.");
      setMessage(data.deploymentsEnabled ? "Project deployment access enabled. Authorize cloud.deploy in your MCP connection before requesting a deployment." : "Deployment access disabled.");
      onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update deployment access."); }
    finally { setBusy(false); }
  }
  return <details className="mt-6 border-t border-solid border-[#e4e4e7] pt-4">
    <summary className="cursor-pointer text-sm font-medium">Vercel deployments · {enabled ? "Enabled" : "Not enabled"}</summary>
    <p className="mt-3 text-sm leading-6">Allow autops to use your saved Vercel API token to create deployments for <strong>{project.name}</strong>. Production requests can change the live service. Each request must match the selected GitHub repository and an exact source commit.</p>
    <p className="mt-2 text-sm leading-6">This is separate from log access and also requires cloud.deploy consent in your MCP connection. Your token must allow deployments for this team.</p>
    {!tokenConfigured && <p className="mt-2 text-sm">Connect a Vercel API token under Vercel server logs first.</p>}
    <button type="button" disabled={busy || (!enabled && !tokenConfigured)} onClick={update} className="mt-3 min-h-11 rounded-md border border-solid border-[#d4d4d8] p-3 text-sm">{busy ? "Saving…" : enabled ? "Disable project deployments" : `Allow deployments for ${project.name}`}</button>
    <p role="status" className="mt-2 text-sm">{message}</p>
  </details>;
}
