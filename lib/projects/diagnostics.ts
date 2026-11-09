import { z } from "zod/v4";
import { getRepositoryFile } from "../github/repository";

const productSchema = z.object({ id: z.number().int(), title: z.string(), price: z.number(), seller_id: z.number().int(), seller: z.object({ id: z.number().int(), name: z.string() }) });
const telemetrySchema = z.object({ cpuMs: z.number().finite().nonnegative(), heapUsedMiB: z.number().finite().nonnegative(), rssMiB: z.number().finite().nonnegative(), definition: z.string().max(512) });
const deploymentSchema = z.object({ commit: z.string().regex(/^[a-f0-9]{40}$/).nullable(), id: z.string().max(256).nullable() });
const responseSchema = z.object({ products: z.array(productSchema).max(2), databaseRequests: z.number().int().positive(), elapsedMs: z.number().nonnegative(), requestId: z.string(), telemetry: telemetrySchema.optional(), deployment: deploymentSchema.optional() });
type Mode = "n-plus-one" | "joined";
type Sample = { status: number | null; ok: boolean; httpMs: number; backendMs: number | null; databaseRequests: number | null; requestId: string | null; products: z.infer<typeof productSchema>[] | null; telemetry: z.infer<typeof telemetrySchema> | null; deployment: z.infer<typeof deploymentSchema> | null };
type Source = Pick<Awaited<ReturnType<typeof getRepositoryFile>>, "commit" | "fileSha" | "path" | "content">;

export async function diagnoseProject(request: typeof fetch = fetch, readSource: () => Promise<Source> = () => getRepositoryFile("lib/products.ts")) {
  const source = await readSource();
  const startedAt = new Date().toISOString();
  const modes: Mode[] = ["n-plus-one", "joined"];
  let samples: Record<Mode, Sample[]> = { "n-plus-one": [], joined: [] };
  for (let round = 0; round < 3; round += 1) {
    for (const mode of modes) {
      const started = performance.now();
      try {
        const response = await request(`https://compiled-ex-project.vercel.app/api/products?mode=${mode}&limit=2`, {
          cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
        });
        const parsed = response.ok ? responseSchema.safeParse(await response.json()) : null;
        const data = parsed?.success ? parsed.data : null;
        samples = { ...samples, [mode]: [...samples[mode], { status: response.status, ok: response.ok && data !== null, httpMs: Math.round((performance.now() - started) * 10) / 10,
          backendMs: data?.elapsedMs ?? null, databaseRequests: data?.databaseRequests ?? null, requestId: data?.requestId ?? null, products: data?.products ?? null, telemetry: data?.telemetry ?? null, deployment: data?.deployment ?? null }] };
      } catch {
        samples = { ...samples, [mode]: [...samples[mode], { status: null, ok: false, httpMs: Math.round((performance.now() - started) * 10) / 10, backendMs: null, databaseRequests: null, requestId: null, products: null, telemetry: null, deployment: null }] };
      }
    }
  }
  function summarize(mode: Mode) {
    const measured = samples[mode].filter((sample) => sample.ok).map((sample) => sample.httpMs).sort((a, b) => a - b);
    const percentile = (value: number) => measured.length ? measured[Math.ceil(value * measured.length) - 1] : null;
    return { samples: samples[mode], failures: samples[mode].filter((sample) => !sample.ok).length, p50Ms: percentile(0.5), p95Ms: percentile(0.95) };
  }
  const all = [...samples["n-plus-one"], ...samples.joined];
  const first = samples["n-plus-one"][0].products;
  const sameProducts = Boolean(first?.length && all.every((sample) => sample.ok && JSON.stringify(sample.products) === JSON.stringify(first)));
  const telemetryAvailable = all.every(sample => sample.ok && sample.telemetry);
  const average = (mode: Mode, metric: "cpuMs" | "heapUsedMiB" | "rssMiB") => {
    const values = samples[mode].flatMap(sample => sample.ok && sample.telemetry ? [sample.telemetry[metric]] : []);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 1000) / 1000 : null;
  };
  const resources = Object.fromEntries(modes.map(mode => [mode, { cpuMs: average(mode, "cpuMs"), heapUsedMiB: average(mode, "heapUsedMiB"), rssMiB: average(mode, "rssMiB") }]));
  let pageTtfb: { status: string; ms: number | null; reason?: string; definition: string };
  const pageDefinition = "Elapsed time to the first response body chunk for GET /, measured from the autops server; includes network and is not a browser render measurement.";
  const pageStarted = performance.now();
  try {
    const page = await request("https://compiled-ex-project.vercel.app/", { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
    const reader = page.body?.getReader();
    try {
      const chunk = await reader?.read();
      pageTtfb = page.ok && chunk?.value?.length ? { status: "measured", ms: Math.round((performance.now() - pageStarted) * 10) / 10, definition: pageDefinition }
        : { status: "unavailable", ms: null, reason: "No successful page response body was received.", definition: pageDefinition };
    } finally { await reader?.cancel().catch(() => {}); reader?.releaseLock(); }
  } catch { pageTtfb = { status: "unavailable", ms: null, reason: "The page probe failed or timed out.", definition: pageDefinition }; }
  const deployedCommitVerified = all.every(sample => sample.ok && sample.deployment?.commit === source.commit && Boolean(sample.deployment?.id)) &&
    all.every(sample => sample.deployment?.id === all[0].deployment?.id);
  return {
    repository: "ongleam/compiled-ex-project", serviceUrl: "https://compiled-ex-project.vercel.app", startedAt, completedAt: new Date().toISOString(),
    source: { commit: source.commit, path: source.path, fileSha: source.fileSha },
    conditions: { limit: 2, requestsPerMode: 3, concurrency: 1, order: "alternating n-plus-one and joined", warmup: "none; cold starts are not excluded", measurementLocation: "autops server runtime", latencyDefinition: "HTTP request through complete JSON response, including network", percentileMethod: "nearest rank", databaseRequestsDefinition: "Backend-reported Supabase HTTP calls, not PostgreSQL SQL executions", backendMsDefinition: "Backend-reported query processing time" },
    modes: { "n-plus-one": summarize("n-plus-one"), joined: summarize("joined") }, sameProducts,
    cpu: { status: telemetryAvailable ? "measured" : "unavailable", modes: resources,
      definition: "Target process CPU delta during each product request, not autops CPU. Concurrent work in the same process can contribute." },
    memory: { status: telemetryAvailable ? "measured" : "unavailable", modes: resources,
      definition: "Target process heapUsed and RSS sampled before its response, not allocated limits or isolated request memory." },
    pageTtfb, deployedCommitVerified,
    targetDeployment: deployedCommitVerified ? all[0].deployment : null,
    limitations: ["Only three requests per mode; this is a smoke diagnosis, not a stable performance benchmark.",
      "The two modes are existing query implementations, not a code-change before/after comparison. Compare separately saved runs for before/after evidence.",
      "CPU and memory are process measurements that may include concurrent requests; instances, caches and cold starts can differ.",
      ...(telemetryAvailable ? [] : ["Target resource telemetry is missing from at least one successful response; CPU/memory comparison is unavailable."]),
      ...(deployedCommitVerified ? [] : ["The API deployment commit was not consistently verified against the source commit."])],
  };
}
