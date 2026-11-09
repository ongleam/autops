"use client";

import VercelLogAccess from "./VercelLogAccess";

import { useEffect, useState } from "react";
import ServiceIcon from "@/components/ServiceIcon";
import type { CloudOverview, CloudProject, Provider } from "@/lib/cloud/client";

type Connection = { configured: boolean; connected: boolean; status?: string; logsConfigured?: boolean; project: CloudProject | null };
type Props = { provider: Provider; enabled: boolean };
const LABELS = { vercel: "Vercel", supabase: "Supabase" };
const CALLBACK_MESSAGES: Record<string, string> = {
  connected: "Authorization complete. Select a project to inspect.",
  invalid_oauth_state: "The authorization request expired or did not match. Reconnect to continue.",
  access_denied: "Connection canceled. Reconnect when you are ready.",
  authorization_failed: "Authorization failed. Please reconnect.",
  storage_unavailable: "Authorization could not be saved. Check again before retrying the connection.",
};

async function getConnection(provider: Provider, signal?: AbortSignal) {
  const base = `/api/cloud/${provider}`;
  const response = await fetch(`${base}/session`, { cache: "no-store", signal });
  const data = await response.json();
  if (response.status === 401) return { connection: { configured: true, connected: false, project: null } as Connection, projects: [] as CloudProject[], notice: data.message as string };
  if (!response.ok) throw new Error(data.message || "Could not check the connection.");
  if (!data.connected) return { connection: data as Connection, projects: [] as CloudProject[], notice: data.status === "reauthorization_required" ? "Access was revoked or could not be refreshed. Reconnect this provider." : data.status === "permission_required" ? "The saved connection needs project access. Review provider permissions." : "" };
  const projectsResponse = await fetch(`${base}/projects`, { cache: "no-store", signal });
  const projectsData = await projectsResponse.json();
  if (!projectsResponse.ok) throw new Error(projectsData.message || "Could not load projects.");
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
        setNotice(CALLBACK_MESSAGES[params.get("result") ?? ""] ?? "Please reconnect.");
        params.delete("cloud");
        params.delete("result");
        window.history.replaceState(null, "", `/onboarding${params.size ? `?${params}` : ""}`);
      }
    }).catch((cause) => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Could not check the connection.");
      setLoading(false);
    });
    return () => controller.abort();
  }, [provider, enabled]);

  async function refresh() {
    setLoading(true);
    setError("");
    setOverview(null);
    try { applyConnection(await getConnection(provider)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
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
      if (!response.ok) throw new Error(data.message || "Could not select the project.");
      setConnection((current) => current && { ...current, project: data.project });
      setNotice("Project selected. You can now inspect it with read-only access.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }

  async function getOverview() {
    setBusy(true);
    setError("");
    setOverview(null);
    try {
      const response = await fetch(`${base}/overview`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not inspect the project.");
      setOverview(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${base}/session`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not disconnect.");
      setConnection((current) => current && { ...current, connected: false, project: null });
      setProjects([]);
      setSelected("");
      setOverview(null);
      setNotice(`Disconnected ${name} from your autops account. Revoke provider permissions in ${name} settings if needed.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <section id={provider} className="bg-white border border-solid border-[var(--line)] rounded-[7px] p-8 shadow-[0_12px_36px_#18181b06] max-[600px]:py-[23px] max-[600px]:px-4.5 mt-6" aria-labelledby={`${provider}-title`} aria-busy={enabled && (loading || busy)}>
      <div className="flex gap-[15px] items-center mb-7 [&_h2]:m-0 [&_h2]:text-[20px] [&_h2]:tracking-[-.6px] [&_p]:text-[12px] [&_p]:text-[#71717a] [&_p]:mt-2 [&_p]:mx-0 [&_p]:mb-0 max-[600px]:[&_h2]:text-[18px]"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-[#f4f4f5]"><ServiceIcon service={provider} className="h-7 w-7" /></span><div><h2 id={`${provider}-title`}>{name} project connection</h2><p>{provider === "vercel" ? "Recent deployment · Read-only" : "Region and status · Read-only"}</p></div></div>
      {!enabled ? <p className="text-center py-5.5 px-3 text-[#71717a] leading-[1.9] text-[13px] [&_h3]:text-[17px] [&_h3]:text-[var(--foreground)] [&_p]:mb-6">Connect your GitHub account first.</p> : loading ? <p role="status">Checking connection…</p> : !connection ? <p>Check the connection again.</p> : !connection.configured ? (
        <div className="text-center py-5.5 px-3 text-[#71717a] leading-[1.9] text-[13px] [&_h3]:text-[17px] [&_h3]:text-[var(--foreground)] [&_p]:mb-6"><strong>{name} connection is being configured</strong><p>Available once your administrator configures this integration.</p><button type="button" className="inline-flex items-center justify-center gap-3 border border-solid border-[#d4d4d8] bg-white rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#f4f4f5]" onClick={refresh}>Check setup again</button></div>
      ) : !connection.connected ? (
        <div className="text-center py-5.5 px-3 text-[#71717a] leading-[1.9] text-[13px] [&_h3]:text-[17px] [&_h3]:text-[var(--foreground)] [&_p]:mb-6"><p>{name}: authorize access and select a project to inspect.</p><button type="button" className="inline-flex items-center justify-center gap-3 border border-solid border-[#18181b] bg-[#18181b] rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#3f3f46] text-white" onClick={() => window.location.assign(new URL(`${base}/start`, window.location.origin).href)}><ServiceIcon service={provider} className={provider === "vercel" ? "h-5 w-5 invert" : "h-5 w-5"} />{name} Connect</button></div>
      ) : (
        <>
          <div className="border-t border-solid border-t-[var(--line)] py-4.5 px-0 flex justify-between items-center gap-3 text-[12px] text-[#71717a] [&_strong]:text-[#27272a] [&_button]:bg-transparent [&_button]:border-0 [&_button]:text-[12px] [&_button]:underline [&_button]:underline-offset-[4px] max-[600px]:items-start"><span>{name} access authorized</span><button type="button" onClick={disconnect} disabled={busy}>Disconnect</button></div>
          <a className="inline-block text-xs underline underline-offset-4" href={`${base}/start?reauthorize=1`}>Review service permissions</a>
          <form onSubmit={save}>
            <div className="[&_button]:bg-transparent [&_button]:border-0 [&_button]:text-[12px] [&_button]:underline [&_button]:underline-offset-[4px] flex justify-between items-center gap-2.5 my-4 mx-0 font-semibold text-[13px] [&_button]:font-normal [&_button]:text-[#71717a]"><label htmlFor={`${provider}-project`}>Project to inspect</label><button type="button" onClick={refresh} disabled={busy}>Refresh list</button></div>
            <select className="w-full bg-[#fafafa] border border-solid border-[#e4e4e7] rounded-[6px] p-[13px] [font:inherit] focus-visible:outline-[2px] focus-visible:outline-solid focus-visible:outline-[#52525b] focus-visible:outline-offset-[2px]" id={`${provider}-project`} value={selected} onChange={(event) => setSelected(event.target.value)} disabled={busy} required>
              <option value="">Select a project</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.id}</option>)}
            </select>
            {!projects.length && <p className="text-center py-5.5 px-3 text-[#71717a] leading-[1.9] text-[13px] [&_h3]:text-[17px] [&_h3]:text-[var(--foreground)] [&_p]:mb-6">No accessible projects. Check your project access in the service.</p>}
            <div className="flex gap-4 items-center justify-between mt-5.5 max-[600px]:items-stretch max-[600px]:flex-col"><button type="submit" className="inline-flex items-center justify-center gap-3 border border-solid border-[#18181b] bg-[#18181b] rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#3f3f46] text-white" disabled={!selected || busy}>Select this project</button></div>
          </form>
          {provider === "vercel" && <VercelLogAccess configured={Boolean(connection.logsConfigured)} projectSelected={Boolean(connection.project)} onSaved={refresh} />}
          {connection.project && <div className="bg-[#f4f4f5] border border-solid border-[#e4e4e7] rounded-[5px] p-4.5 mt-6 mx-0 mb-6 flex items-start flex-col gap-2.5 [overflow-wrap:anywhere] [&_span]:text-[12px] [&_span]:text-[#52525b] [&_a]:mt-2"><strong>✓ {connection.project.name}</strong><span>{connection.project.id}</span><button type="button" className="inline-flex items-center justify-center gap-3 border border-solid border-[#d4d4d8] bg-white rounded-[5px] py-[9px] px-3 whitespace-nowrap text-[12px] font-medium min-h-9 hover:bg-[#f4f4f5]" onClick={getOverview} disabled={busy}>Refresh project status</button></div>}
          {overview && <div className="text-[13px] border-t border-solid border-t-[var(--line)] pt-4 [&_dl]:grid [&_dl]:grid-cols-[90px_minmax(0,1fr)] [&_dl]:gap-3 [&_dt]:text-[#71717a] [&_dd]:m-0 [&_dd]:[overflow-wrap:anywhere]" role="status"><dl>
            <dt>Project</dt><dd>{overview.project.name}</dd>
            {overview.project.framework !== undefined && <><dt>Framework</dt><dd>{overview.project.framework ?? "Not configured"}</dd></>}
            {overview.project.region && <><dt>Region</dt><dd>{overview.project.region}</dd></>}
            {overview.project.status && <><dt>Status</dt><dd>{overview.project.status}</dd></>}
            {provider === "vercel" && <><dt>Latest deployment</dt><dd>{overview.deployment ? `${overview.deployment.state} · ${new Date(overview.deployment.createdAt).toLocaleString("en-US")}` : "No deployments"}</dd></>}
            <dt>Checked at</dt><dd>{new Date(overview.checkedAt).toLocaleString("en-US")}</dd>
          </dl></div>}
        </>
      )}
      {enabled && error && <div className="[&_button]:bg-transparent [&_button]:border-0 [&_button]:text-[12px] [&_button]:underline [&_button]:underline-offset-[4px] p-4 mt-5 bg-[#f4f4f5] text-[#b91c1c] rounded-[6px] text-[13px] leading-[1.8] [&_button]:block [&_button]:mt-2 [&_button]:text-inherit [&_button]:p-0" role="alert">{error}<button type="button" onClick={refresh} disabled={loading || busy}>Check connection again</button><button type="button" onClick={() => window.location.assign(new URL(`${base}/start`, window.location.origin).href)} disabled={loading || busy}>{name} Reconnect</button></div>}
      {enabled && <p className="mt-4 mx-0 mb-0 text-[12px] text-[#52525b] leading-[1.8] empty:hidden" role="status" aria-live="polite">{notice}</p>}
    </section>
  );
}
