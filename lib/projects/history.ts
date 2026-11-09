import { z } from "zod/v4";
import { database } from "../cloud/store";
import { RepositoryError } from "../github/selected-repository";
import type { Repository } from "../github/session";

export const diagnosticId = z.uuid();
export const diagnosticStage = z.enum(["before", "after", "inspection"]);
const snapshotSchema = z.object({
  repository: z.string(), conditions: z.record(z.string(), z.unknown()), sameProducts: z.boolean(),
  modes: z.record(z.string(), z.object({ failures: z.number(), p50Ms: z.number().nullable(), p95Ms: z.number().nullable(), samples: z.array(z.unknown()) }).passthrough()),
}).passthrough();
const rowSchema = z.object({ id: diagnosticId, stage: diagnosticStage, created_at: z.string(), snapshot: snapshotSchema });

function scope(owner: string, repository: Repository) {
  if (!/^[1-9][0-9]*$/.test(owner)) throw new RepositoryError("Invalid owner.");
  return `github_user_id=eq.${owner}&repository_id=eq.${repository.id}`;
}

export async function saveDiagnostic(owner: string, repository: Repository, stage: z.infer<typeof diagnosticStage>, snapshot: unknown) {
  scope(owner, repository);
  const data = snapshotSchema.parse(snapshot);
  if (data.repository !== repository.fullName) throw new RepositoryError("Diagnostic repository mismatch.");
  const rows = z.array(rowSchema).length(1).parse(await database("autops_diagnostics", "POST", {
    github_user_id: owner, repository_id: repository.id, repository: repository.fullName, stage, snapshot: data,
  }));
  return { ...data, diagnosticId: rows[0].id, stage, savedAt: rows[0].created_at };
}

export async function listDiagnostics(owner: string, repository: Repository) {
  return z.array(z.object({ id: diagnosticId, stage: diagnosticStage, created_at: z.string() })).parse(await database(`autops_diagnostics?${scope(owner, repository)}&select=id,stage,created_at&order=created_at.desc&limit=20`));
}

export async function readDiagnostic(owner: string, repository: Repository, id: string) {
  const rows = z.array(rowSchema).parse(await database(`autops_diagnostics?${scope(owner, repository)}&id=eq.${diagnosticId.parse(id)}&select=id,stage,created_at,snapshot&limit=1`));
  if (!rows[0] || rows[0].snapshot.repository !== repository.fullName) throw new RepositoryError("Diagnostic not found for this account and selected repository.");
  return rows[0];
}

const modes = ["n-plus-one", "joined"] as const;
export function compareSnapshots(beforeInput: unknown, afterInput: unknown) {
  const before = snapshotSchema.parse(beforeInput), after = snapshotSchema.parse(afterInput);
  const compatible = before.repository === after.repository && JSON.stringify(before.conditions) === JSON.stringify(after.conditions);
  const productSample = z.object({ products: z.array(z.unknown()).nullable() });
  const firstProducts = (data: z.infer<typeof snapshotSchema>) => productSample.safeParse(data.modes["n-plus-one"]?.samples[0]).data?.products;
  const sameData = Boolean(firstProducts(before)?.length) && JSON.stringify(firstProducts(before)) === JSON.stringify(firstProducts(after));
  const correct = sameData && before.sameProducts && after.sameProducts && modes.every(mode => before.modes[mode]?.failures === 0 && after.modes[mode]?.failures === 0);
  const latencyRows = modes.flatMap(mode => (["p50Ms", "p95Ms"] as const).map(metric => {
    const a = before.modes[mode]?.[metric] ?? null, b = after.modes[mode]?.[metric] ?? null;
    return { mode, metric, before: a, after: b, changePercent: compatible && correct && a !== null && a > 0 && b !== null ? Math.round((b - a) / a * 10000) / 100 : null };
  }));
  const resources = z.object({ status: z.literal("measured"), modes: z.record(z.string(), z.record(z.string(), z.number().nullable())) });
  const resourceValue = (data: z.infer<typeof snapshotSchema>, kind: "cpu" | "memory", mode: string, metric: string) => resources.safeParse(data[kind]).data?.modes[mode]?.[metric] ?? null;
  const percent = (a: number | null, b: number | null) => compatible && correct && a !== null && a > 0 && b !== null ? Math.round((b - a) / a * 10000) / 100 : null;
  const resourceRows = modes.flatMap(mode => ([{ kind: "cpu", metric: "cpuMs" }, { kind: "memory", metric: "heapUsedMiB" }, { kind: "memory", metric: "rssMiB" }] as const).map(({kind,metric}) => {
    const a = resourceValue(before, kind, mode, metric), b = resourceValue(after, kind, mode, metric);
    return { mode, metric, before: a, after: b, changePercent: percent(a, b) };
  }));
  const page = z.object({ status: z.literal("measured"), ms: z.number() });
  const a = page.safeParse(before.pageTtfb).data?.ms ?? null, b = page.safeParse(after.pageTtfb).data?.ms ?? null;
  const deploymentVerified = before.deployedCommitVerified === true && after.deployedCommitVerified === true;
  return { comparable: compatible && correct, correctnessPassed: correct, deploymentVerified,
    rows: [...latencyRows, ...resourceRows, { mode: "page", metric: "ttfbMs", before: a, after: b, changePercent: percent(a, b) }],
    verdict: !compatible ? "incomparable_conditions" : !correct ? "failed_correctness_or_requests" : "small_sample_observation",
    limitations: ["Three API requests per mode are insufficient to establish a stable performance improvement.", "Cold starts, instances, caches and concurrent work are uncontrolled. A lower response time is not proof of improvement.",
      ...(deploymentVerified ? [] : ["At least one target deployment commit was not verified; code-change attribution is unverified."])] };
}
