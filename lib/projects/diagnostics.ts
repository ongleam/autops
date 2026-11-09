import { z } from "zod/v4";
import { getRepositoryFile } from "../github/repository";

const productSchema = z.object({ id: z.number().int(), title: z.string(), price: z.number(), seller_id: z.number().int(), seller: z.object({ id: z.number().int(), name: z.string() }) });
const responseSchema = z.object({ products: z.array(productSchema).max(2), databaseRequests: z.number().int().positive(), elapsedMs: z.number().nonnegative(), requestId: z.string() });
type Mode = "n-plus-one" | "joined";
type Sample = { status: number | null; ok: boolean; httpMs: number; backendMs: number | null; databaseRequests: number | null; requestId: string | null; products: z.infer<typeof productSchema>[] | null };
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
          backendMs: data?.elapsedMs ?? null, databaseRequests: data?.databaseRequests ?? null, requestId: data?.requestId ?? null, products: data?.products ?? null }] };
      } catch {
        samples = { ...samples, [mode]: [...samples[mode], { status: null, ok: false, httpMs: Math.round((performance.now() - started) * 10) / 10, backendMs: null, databaseRequests: null, requestId: null, products: null }] };
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
  return {
    repository: "ongleam/compiled-ex-project", serviceUrl: "https://compiled-ex-project.vercel.app", startedAt, completedAt: new Date().toISOString(),
    source: { commit: source.commit, path: source.path, fileSha: source.fileSha },
    conditions: { limit: 2, requestsPerMode: 3, concurrency: 1, order: "alternating n-plus-one and joined", warmup: "none; cold starts are not excluded", measurementLocation: "autops server runtime", latencyDefinition: "HTTP request through complete JSON response, including network", percentileMethod: "nearest rank", databaseRequestsDefinition: "Backend-reported Supabase HTTP calls, not PostgreSQL SQL executions", backendMsDefinition: "Backend-reported query processing time" },
    modes: { "n-plus-one": summarize("n-plus-one"), joined: summarize("joined") }, sameProducts,
    cpu: { status: "unavailable", reason: "No target process CPU telemetry is connected." },
    memory: { status: "unavailable", reason: "No target process memory telemetry is connected." },
    pageTtfb: { status: "unavailable", reason: "This tool measures the products API, not page TTFB." },
    deployedCommitVerified: false,
    limitations: ["Only three requests per mode; this is a smoke diagnosis, not a stable performance benchmark.", "Compares two existing query modes on the same public service; no code was modified or deployed by this tool.", "Source commit is verified through GitHub; the service deployment commit is not verified by this tool.", "No persistent diagnostic store or before/after comparison IDs are created.", "Do not infer CPU, memory, or before/after improvement from these results."],
  };
}
