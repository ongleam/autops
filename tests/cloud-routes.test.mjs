import { afterEach, beforeEach, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { handleCloudRequest, getCloudCookieName } from "../lib/cloud/handlers";
import { createSession, getCookieName, getSession } from "../lib/github/session";
import { saveConnection, readConnection, disconnectConnection } from "../lib/cloud/store";
import { withCloudConnection } from "../lib/cloud/connections";
import { getUserProjectLogs, cloudLogsInput } from "../lib/cloud/mcp";

const secret = "test-only-secret-with-at-least-32-characters";
const config = { clientId: "fixture-client", clientSecret: "fixture-secret", slug: "autops-test", secret };
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let rows, refreshCount, providerStatus, logReads;
const projects = [{ id: "project_a", name: "Alice project", region: "ap-northeast-2", status: "ACTIVE_HEALTHY" }];
function cookie(id = 1, token = "github-one") {
  return `${getCookieName("session")}=${createSession({ token, expiresAt: Math.floor(Date.now()/1000)+3600, user: { id, login: `user${id}` } }, secret, 3600)}`;
}
function request(provider, action, options = {}, identity = cookie()) {
  return new NextRequest(`http://localhost:3000/api/cloud/${provider}/${action}`, { ...options, headers: { cookie: identity, ...options.headers } });
}
const session = (owner = "1", extra = {}) => ({ owner, token: `cloud-${owner}`, expiresAt: null, teamId: "team_a", projectId: "project_a", ...extra });
beforeEach(() => {
  Object.assign(process.env, { GITHUB_SESSION_SECRET: secret, SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_SECRET_KEY: "fixture-secret-key",
    VERCEL_INTEGRATION_CLIENT_ID: config.clientId, VERCEL_INTEGRATION_CLIENT_SECRET: config.clientSecret, VERCEL_INTEGRATION_SLUG: config.slug,
    SUPABASE_OAUTH_CLIENT_ID: config.clientId, SUPABASE_OAUTH_CLIENT_SECRET: config.clientSecret });
  rows = []; refreshCount = 0; providerStatus = 200; logReads = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.hostname === "api.github.com") return Response.json({ id: 1, login: "alice" });
    if (url.hostname === "fixture.supabase.co") {
      const body = init.body ? JSON.parse(init.body) : {};
      if (url.pathname.endsWith("autops_claim_refresh")) {
        const row = rows.find(r => String(r.github_user_id) === body.p_user_id && r.provider === body.p_provider && r.revision === body.p_revision && !r.refresh_lease);
        if (row) row.refresh_lease = body.p_lease;
        return Response.json(Boolean(row));
      }
      const matches = row => [...url.searchParams].filter(([k]) => !["select", "on_conflict"].includes(k)).every(([k,v]) => String(row[k]) === v.slice(3));
      if (init.method === "POST") { rows = [...rows.filter(r => !(String(r.github_user_id) === String(body.github_user_id) && r.provider === body.provider)), body]; return Response.json([body]); }
      const found = rows.filter(matches);
      if (init.method === "PATCH") rows = rows.map(r => matches(r) ? { ...r, ...body } : r);
      if (init.method === "DELETE") rows = rows.filter(r => !matches(r));
      return Response.json(init.method === "PATCH" ? found.map(r => ({...r,...body})) : found);
    }
    if (url.pathname.endsWith("/oauth/token") || url.pathname.endsWith("/oauth/access_token")) {
      refreshCount++;
      return Response.json({ access_token: "rotated-access", refresh_token: "rotated-refresh", expires_in: 3600, team_id: "team_a" });
    }
    if (String(init.headers?.Authorization).includes("bad-vercel-log-token")) return Response.json({}, {status:401});
    if (providerStatus !== 200) return Response.json({}, {status: providerStatus});
    if (url.pathname === "/v1/observability/events") {
      logReads++;
      if (/forbidden-vercel-log-token|live-only-vercel-log-token/.test(String(init.headers?.Authorization))) return Response.json({}, {status:403});
      expect(JSON.parse(init.body).scope.projectIds).toEqual(["project_a"]);
      return Response.json({events:[{message:"Bearer cloud-1",timestamp:new Date().toISOString()}],pagination:{hasMore:false}});
    }
    if (url.pathname.endsWith("/runtime-logs")) {
      logReads++;
      if (String(init.headers?.Authorization).includes("forbidden-vercel-log-token")) return Response.json({}, {status:403});
      expect(url.pathname).toContain("/projects/project_a/deployments/deployment_a/");
      return new Response(JSON.stringify({timestampInMs:Date.now(),level:"info",message:"Bearer cloud-1",source:"serverless"})+"\n",{headers:{"Content-Type":"application/x-ndjson"}});
    }
    if (url.pathname === "/v9/projects/project_a") return Response.json(projects[0]);
    if (url.pathname === "/v6/deployments") return Response.json({deployments:[{uid:"deployment_a",state:"READY",created:Date.now()}]});
    if (url.pathname.includes("/analytics/")) {
      logReads++;
      if (url.hostname === "api.supabase.com") return Response.json({result:[{ timestamp:"2026-11-09",event_message:"Bearer cloud-1" }]});
      throw new Error("Unexpected log provider");
    }
    return Response.json(url.hostname === "api.vercel.com" ? { projects } : projects);
  };
});
afterEach(() => { globalThis.fetch = originalFetch; process.env = { ...originalEnv }; });

test("same GitHub user with a new login token restores cloud selection without cloud cookies", async () => {
  await saveConnection("vercel", session());
  const result = await handleCloudRequest(request("vercel", "session", {}, cookie(1, "new-github-token")), "vercel", "session", config);
  expect((await result.json()).project.id).toBe("project_a");
  const start = await handleCloudRequest(request("vercel", "start"), "vercel", "start", config);
  expect(start.headers.get("location")).toContain("/onboarding?cloud=vercel&result=connected");
  expect(refreshCount).toBe(0);
});
test("server credentials are encrypted and bound to user and provider", async () => {
  await saveConnection("vercel", session());
  expect(JSON.stringify(rows)).not.toContain("cloud-1");
  expect(await readConnection("2", "vercel")).toBeNull();
  rows = rows.map(r => ({...r,github_user_id:"2"}));
  await expect(readConnection("2", "vercel")).rejects.toMatchObject({code:"storage_unavailable"});
});
test("disconnect only deletes that user's provider connection", async () => {
  await saveConnection("vercel", session()); await saveConnection("vercel", session("2")); await saveConnection("supabase", session());
  await disconnectConnection("1", "vercel");
  expect(await readConnection("1", "vercel")).toBeNull();
  expect((await readConnection("2", "vercel")).session.owner).toBe("2");
  expect((await readConnection("1", "supabase")).session.owner).toBe("1");
});
test("Supabase refresh rotates encrypted credentials once under concurrent requests", async () => {
  await saveConnection("supabase", session("1",{expiresAt:1,refreshToken:"old-refresh"}));
  const tokens = await Promise.all([1,2].map(() => withCloudConnection("1","supabase",async s => s.token)));
  expect(tokens).toEqual(["rotated-access","rotated-access"]); expect(refreshCount).toBe(1);
  const stored = await readConnection("1","supabase"); expect(stored.session.refreshToken).toBe("rotated-refresh"); expect(stored.session.projectId).toBe("project_a");
});
test("provider permission and temporary errors retain stored credentials", async () => {
  await saveConnection("vercel",session());
  for (const status of [403,500]) {
    providerStatus=status;
    const result=await handleCloudRequest(request("vercel","session"),"vercel","session",config);
    expect(result.status).toBe(status===403?200:503);
    expect((await readConnection("1","vercel")).session.token).toBe("cloud-1");
  }
});
test("revoked Vercel access is marked for reauthorization rather than success", async () => {
  await saveConnection("vercel",session()); providerStatus=401;
  const result=await handleCloudRequest(request("vercel","session"),"vercel","session",config);
  expect((await result.json()).status).toBe("reauthorization_required");
  expect((await readConnection("1","vercel")).session).toBeNull();
});
test("logs deny another user's connection and unauthorized project before reading logs", async () => {
  await saveConnection("vercel",session());
  await expect(getUserProjectLogs("2",cloudLogsInput.parse({provider:"vercel"}))).rejects.toMatchObject({code:"not_connected"});
  await expect(getUserProjectLogs("1",cloudLogsInput.parse({provider:"vercel",projectId:"project_b"}))).rejects.toMatchObject({code:"project_forbidden"});
  expect(logReads).toBe(0);
});
test("Vercel and Supabase logs use verified project scope and redact bearer tokens", async () => {
  for (const provider of ["vercel","supabase"]) {
    await saveConnection(provider,session());
    const result=await getUserProjectLogs("1",cloudLogsInput.parse({provider}));
    expect(result.project.id).toBe("project_a"); expect(result.entries).toHaveLength(1);
    expect(JSON.stringify(result.entries)).not.toContain("cloud-1");
  }
  expect(logReads).toBe(2);
});
test("forged OAuth state and cross-origin disconnect cannot change a connection", async () => {
  await saveConnection("vercel",session());
  const callback=await handleCloudRequest(request("vercel","callback?code=x&state=forged"),"vercel","callback",config);
  expect(callback.headers.get("location")).toContain("invalid_oauth_state");
  const denied=await handleCloudRequest(request("vercel","session",{method:"DELETE",headers:{origin:"https://evil.example"}}),"vercel","session",config);
  expect(denied.status).toBe(403); expect(await readConnection("1","vercel")).not.toBeNull();
});
test("OAuth callback persists credentials on the server and sets no credential cookie", async () => {
  const start=await handleCloudRequest(request("supabase","start"),"supabase","start",config);
  const name=getCloudCookieName("supabase","flow"), value=start.cookies.get(name).value;
  const flow=getSession(value,secret);
  const result=await handleCloudRequest(request("supabase",`callback?code=code&state=${flow.state}`,{headers:{cookie:`${cookie()}; ${name}=${value}`}}),"supabase","callback",config);
  expect(result.headers.get("location")).toContain("result=connected");
  expect((await readConnection("1","supabase")).session.refreshToken).toBe("rotated-refresh");
  expect(result.headers.get("set-cookie")).not.toContain("rotated-access");
});

test("explicit permission review starts OAuth without deleting the working connection", async () => {
  await saveConnection("supabase",session());
  const result=await handleCloudRequest(request("supabase","start?reauthorize=1"),"supabase","start",config);
  expect(result.headers.get("location")).toContain("https://api.supabase.com/v1/oauth/authorize");
  expect((await readConnection("1","supabase")).session.projectId).toBe("project_a");
});

test("Vercel log token is verified, encrypted, user-scoped, and independently removable", async () => {
  await saveConnection("vercel",session());
  const result=await handleCloudRequest(request("vercel","logs-token",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:JSON.stringify({token:"valid-vercel-log-token-12345"})}),"vercel","logs-token",config);
  expect(result.status).toBe(200);
  expect(JSON.stringify(rows)).not.toContain("valid-vercel-log-token");
  expect((await readConnection("1","vercel")).session.logsToken).toBe("valid-vercel-log-token-12345");
  expect(await readConnection("2","vercel")).toBeNull();
  const removed=await handleCloudRequest(request("vercel","logs-token",{method:"DELETE",headers:{origin:"http://localhost:3000"}}),"vercel","logs-token",config);
  expect(removed.status).toBe(200);
  expect((await readConnection("1","vercel")).session.logsToken).toBeUndefined();
  expect((await readConnection("1","vercel")).session.token).toBe("cloud-1");
});
test("a rejected or expired logs token never invalidates the Vercel OAuth connection", async () => {
  await saveConnection("vercel",session());
  const rejected=await handleCloudRequest(request("vercel","logs-token",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:JSON.stringify({token:"bad-vercel-log-token-12345"})}),"vercel","logs-token",config);
  expect(rejected.status).toBe(403);
  expect((await readConnection("1","vercel")).session.token).toBe("cloud-1");
  await saveConnection("vercel",session("1",{logsToken:"bad-vercel-log-token-12345"}));
  await expect(getUserProjectLogs("1",cloudLogsInput.parse({provider:"vercel"}))).rejects.toMatchObject({code:"logs_token_invalid"});
  expect((await readConnection("1","vercel")).session.token).toBe("cloud-1");
});

test("log API denial cannot be saved as verified token access", async () => {
  await saveConnection("vercel",session());
  const response=await handleCloudRequest(request("vercel","logs-token",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:JSON.stringify({token:"forbidden-vercel-log-token-12345"})}),"vercel","logs-token",config);
  expect(response.status).toBe(403);
  const stored=await readConnection("1","vercel");
  expect(stored.session.logsToken).toBeUndefined();
  expect(stored.session.token).toBe("cloud-1");
});

test("project-scoped log access reports a bounded live sample when history access is denied", async () => {
  await saveConnection("vercel",session("1",{logsToken:"live-only-vercel-log-token-12345"}));
  const result=await getUserProjectLogs("1",cloudLogsInput.parse({provider:"vercel",limit:5}));
  expect(result.coverage.mode).toBe("live_sample");
  expect(result.entries).toHaveLength(1);
  expect(result.coverage.windowLimitations).toContain("not complete historical coverage");
});

test("Hobby retention retries once and reports the excluded interval without changing the requested end", async () => {
  await saveConnection("vercel",session("1",{logsToken:"history-token-12345",refreshToken:"refresh-private"}));
  const providerFetch=globalThis.fetch;
  const windows=[];
  globalThis.fetch=async (input,init={}) => {
    if (new URL(String(input)).pathname!=="/v1/observability/events") return providerFetch(input,init);
    windows.push(JSON.parse(init.body).timeRange);
    return windows.length===1
      ? Response.json({error:{message:"The hobby plan does not retain runtime logs for the requested time range."}},{status:400})
      : Response.json({events:[{message:"refresh-private"}],pagination:{hasMore:false}});
  };
  const result=await getUserProjectLogs("1",cloudLogsInput.parse({provider:"vercel",minutes:60}));
  expect(windows).toHaveLength(2);
  expect(windows[1].end).toBe(windows[0].end);
  expect(Date.parse(windows[1].start)).toBeGreaterThan(Date.parse(windows[0].start));
  expect(result.requestedWindow).toEqual(windows[0]);
  expect(result.window).toEqual(windows[1]);
  expect(result.coverage.retentionClipped).toBe(true);
  expect(result.coverage.excludedIntervals).toEqual([{start:windows[0].start,end:windows[1].start}]);
  expect(JSON.stringify(result.entries)).not.toContain("refresh-private");
});
