import { chromium, firefox } from "playwright-core";
import { startStaticServer } from "../../scripts/serve.mjs";

// Diagnostic only: the production limit and existing Phase 2 fixture are untouched.
const name = process.env.C_ENGINE_BROWSER_ENGINE ?? "firefox";
const browserType = { chromium, firefox }[name];
if (!browserType) throw new Error(`Unsupported diagnostic browser: ${name}`);
const executablePath = process.env.C_ENGINE_BROWSER;
const repetitions = Number(process.env.C_ENGINE_RELIABILITY_RUNS ?? 30);
if (!Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 100) throw new Error("Expected 1 to 100 runs");
const { server, url } = await startStaticServer();
let browser;
try {
  browser = await browserType.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
  const page = await browser.newPage();
  await page.goto(`${url}/__harness`);
  const runs = await page.evaluate(async ({ repetitions }) => {
    const NativeWorker = globalThis.Worker;
    const timeline = [];
    class MeasuredWorker extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        if (String(url).includes("/execution.js")) {
          const record = { createdAt: performance.now(), postedAt: null, responseAt: null, workerDurationMs: null, responseKind: null };
          timeline.push(record);
          this.record = record;
          this.addEventListener("message", ({ data }) => {
            record.responseAt = performance.now();
            record.responseKind = data?.kind ?? null;
            record.workerDurationMs = data?.result?.durationMs ?? null;
          });
        }
      }
      postMessage(value, options) {
        if (this.record) this.record.postedAt = performance.now();
        return super.postMessage(value, options);
      }
    }
    globalThis.Worker = MeasuredWorker;
    try {
      const { CEngine } = await import("/src/index.js");
      const engine = new CEngine({ limits: { executionTimeoutMs: 1000 } });
      const measurements = [];
      try {
        await engine.initialize();
        const compiled = await engine.compile({ source: 'int main(void) { return 0; }' });
        for (let i = 0; i < repetitions; i++) {
          const startedAt = performance.now();
          let code = null;
          let exitCode = null;
          try { exitCode = (await engine.execute(compiled.artifact)).exitCode; }
          catch (error) { code = error.code ?? error.name; }
          const settledAt = performance.now();
          const worker = timeline.at(-1);
          measurements.push({ index: i + 1, code, exitCode, wallMs: settledAt - startedAt,
            dispatchDelayMs: worker?.postedAt == null ? null : worker.postedAt - worker.createdAt,
            workerRoundTripMs: worker?.responseAt == null ? null : worker.responseAt - worker.postedAt,
            workerDurationMs: worker?.workerDurationMs ?? null,
            outsideWorkerMs: worker?.responseAt == null || worker.workerDurationMs == null ? null : worker.responseAt - worker.postedAt - worker.workerDurationMs,
            responseKind: worker?.responseKind ?? null });
          if (code) break;
        }
      } finally { await engine.dispose(); }
      return measurements;
    } finally { globalThis.Worker = NativeWorker; }
  }, { repetitions });
  const successful = runs.filter((run) => run.code === null);
  const values = (key) => successful.map((run) => run[key]).filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = (key, p) => { const a = values(key); return a.length ? a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))] : null; };
  process.stdout.write(JSON.stringify({ browser: name, browserVersion: browser.version(), requested: repetitions, attempted: runs.length,
    failures: runs.filter((run) => run.code), successful: successful.length,
    timingMs: Object.fromEntries(["wallMs", "dispatchDelayMs", "workerRoundTripMs", "workerDurationMs", "outsideWorkerMs"].map((key) => [key, { min: percentile(key, 0), median: percentile(key, 0.5), p95: percentile(key, 0.95), max: percentile(key, 1) }])),
    runs }, null, 2) + "\n");
  if (runs.some((run) => run.code || run.exitCode !== 0)) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
