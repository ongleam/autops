import { expect, test } from "bun:test";
import { compareSnapshots, readDiagnostic } from "../lib/projects/history";

const products = [{ id: 1, title: "Product", price: 10 }];
const mode = value => ({ failures: 0, p50Ms: value, p95Ms: value * 2, samples: [{ products }] });
const snapshot = value => ({ repository: "ongleam/compiled-ex-project", conditions: { limit: 2, requestsPerMode: 3 },
  sameProducts: true, modes: { "n-plus-one": mode(value), joined: mode(value) }, deployedCommitVerified: true });

test("comparison rejects changed conditions and changed product data", () => {
  const before = snapshot(100), after = snapshot(50);
  expect(compareSnapshots(before, after).rows[0].changePercent).toBe(-50);
  const changedConditions = { ...after, conditions: { limit: 10, requestsPerMode: 3 } };
  expect(compareSnapshots(before, changedConditions).comparable).toBe(false);
  expect(compareSnapshots(before, changedConditions).rows.every(row => row.changePercent === null)).toBe(true);
  const changedProducts = { ...after, modes: { ...after.modes, "n-plus-one": { ...mode(50), samples: [{ products: [{ id: 2 }] }] } } };
  expect(compareSnapshots(before, changedProducts).comparable).toBe(false);
});

test("failed requests and zero baselines cannot become performance gains", () => {
  const before = snapshot(0), after = snapshot(10);
  expect(compareSnapshots(before, after).rows.find(row => row.metric === "p50Ms").changePercent).toBeNull();
  const failed = { ...after, modes: { ...after.modes, joined: { ...mode(1), failures: 1 } } };
  expect(compareSnapshots(snapshot(100), failed).comparable).toBe(false);
  expect(compareSnapshots(snapshot(100), failed).rows.every(row => row.changePercent === null)).toBe(true);
});

test("missing target resource telemetry stays null", () => {
  const result = compareSnapshots(snapshot(100), snapshot(50));
  expect(result.rows.filter(row => ["cpuMs", "heapUsedMiB", "rssMiB"].includes(row.metric)).every(row => row.before === null && row.after === null && row.changePercent === null)).toBe(true);
});

test("saved diagnostic reads bind both owner and selected repository", async () => {
  const originalFetch = globalThis.fetch;
  const names = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "GITHUB_SESSION_SECRET"];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.SUPABASE_URL = "https://fixture.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "fixture-server-key";
  process.env.GITHUB_SESSION_SECRET = "fixture-key-that-is-at-least-32-characters";
  const id = "74e02ec7-e01d-4cf6-8e60-1ed928d3d40a";
  const repository = { id: 10, fullName: "ongleam/compiled-ex-project" };
  globalThis.fetch = async input => {
    const url = new URL(input);
    expect(url.searchParams.get("repository_id")).toBe("eq.10");
    expect(url.searchParams.get("id")).toBe(`eq.${id}`);
    return Response.json(url.searchParams.get("github_user_id") === "eq.1" ? [{ id, stage: "before", created_at: "2026-11-09", snapshot: snapshot(100) }] : []);
  };
  try {
    expect((await readDiagnostic("1", repository, id)).id).toBe(id);
    await expect(readDiagnostic("2", repository, id)).rejects.toThrow("not found");
    await expect(readDiagnostic("1&or=(true)", repository, id)).rejects.toThrow("Invalid owner");
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) { if (original[name] === undefined) delete process.env[name]; else process.env[name] = original[name]; }
  }
});
