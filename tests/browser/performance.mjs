import { chromium, firefox, webkit } from "playwright-core";
import { startStaticServer } from "../../scripts/serve.mjs";

const browserEngine = process.env.C_ENGINE_BROWSER_ENGINE ?? "chromium";
const browserType = { chromium, firefox, webkit }[browserEngine];
if (!browserType) throw new Error(`Unknown browser engine: ${browserEngine}`);
const executablePath = process.env.C_ENGINE_BROWSER ?? (browserEngine === "chromium" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : undefined);
const { server, url } = await startStaticServer();
let browser;
try {
  browser = await browserType.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
  const page = await browser.newPage();
  await page.goto(`${url}/__harness`);
  const result = await page.evaluate(async () => {
    const { CEngine } = await import("/src/index.js");
    const engine = new CEngine();
    const source = '#include <stdio.h>\nint main(void) { puts("Hello from C"); return 0; }';
    try {
      const started = performance.now();
      await engine.initialize();
      const initializeWallMs = performance.now() - started;
      const runtimeInfo = engine.getRuntimeInfo();
      const compilations = [];
      let artifact;
      for (let i = 0; i < 3; i++) {
        const begin = performance.now();
        const result = await engine.compile({ source });
        if (result.status !== "success") throw new Error(`Compilation ${i + 1} failed`);
        compilations.push({ wallMs: performance.now() - begin, workerMs: result.durationMs });
        artifact = result.artifact;
      }
      const executions = [];
      for (let i = 0; i < 2; i++) {
        const begin = performance.now();
        const result = await engine.execute(artifact);
        if (result.exitCode !== 0 || result.stdout !== "Hello from C\n") throw new Error(`Execution ${i + 1} failed`);
        executions.push({ wallMs: performance.now() - begin, workerMs: result.durationMs });
      }
      return { initializeWallMs, assetVerificationMs: runtimeInfo.assetVerificationMs, workerInitializationMs: runtimeInfo.initializationMs, compilations, executions };
    } finally { await engine.dispose(); }
  });
  process.stdout.write(JSON.stringify({ browserEngine, browserVersion: browser.version(), platform: process.platform, server: "loopback HTTP, cache-control no-store", result }, null, 2) + "\n");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
