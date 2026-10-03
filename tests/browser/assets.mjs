import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright-core";
import { startStaticServer } from "../../scripts/serve.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const browserEngine = process.env.C_ENGINE_BROWSER_ENGINE ?? "chromium";
const browserType = { chromium, firefox, webkit }[browserEngine];
if (!browserType) throw new Error(`Unknown browser engine: ${browserEngine}`);
const executablePath = process.env.C_ENGINE_BROWSER ?? (browserEngine === "chromium" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : undefined);
const overrides = new Map();
const { server, url } = await startStaticServer(0, root, overrides);
const dist = await startStaticServer(0, fileURLToPath(new URL("../../dist/", import.meta.url)));
let browser;
try {
  browser = await browserType.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${url}/__harness`);
  const probe = async (expression) => page.evaluate(expression);
  const init = async () => probe(async () => {
    const { CEngine } = await import("/src/index.js");
    const engine = new CEngine();
    try { await engine.initialize(); return { code: null, state: engine.getState() }; }
    catch (error) { return { code: error.code, stage: error.stage, message: error.message, state: engine.getState() }; }
    finally { await engine.dispose(); }
  });
  const checks = {};
  checks.verifiedInitialization = (await init()).state === "ready";
  const compilerPath = "/runtime/browsercc-0.1.1/clang.js";
  overrides.set(compilerPath, "corrupt");
  const corrupt = await init();
  checks.corruptedCompiler = corrupt.code === "ASSET_ERROR" && corrupt.stage === "initialization" && corrupt.state === "failed" && /Asset size mismatch/.test(corrupt.message);
  await page.evaluate(async () => { const { CEngine } = await import("/src/index.js"); globalThis.phase3FailedEngine = new CEngine(); try { await globalThis.phase3FailedEngine.initialize(); } catch { /* Expected integrity failure. */ } });
  overrides.delete(compilerPath);
  checks.recoveryAfterCorruption = await page.evaluate(async () => { await globalThis.phase3FailedEngine.reset(); const ready = globalThis.phase3FailedEngine.getState() === "ready"; await globalThis.phase3FailedEngine.dispose(); return ready; });
  const sysrootPath = "/runtime/browsercc-0.1.1/sysroot.tar";
  overrides.set(sysrootPath, null);
  const missing = await init();
  checks.missingCompiler = missing.code === "INITIALIZATION_FAILED" && missing.stage === "initialization" && missing.state === "failed" && /Required asset is unavailable/.test(missing.message);
  overrides.delete(sysrootPath);
  const manifest = JSON.parse(await readFile(new URL("../../asset-manifest.json", import.meta.url), "utf8"));
  manifest.assets.find((entry) => entry.name === "browsercc/clang.js").sha256 = "0".repeat(64);
  overrides.set("/asset-manifest.json", JSON.stringify(manifest));
  const wrongHash = await init();
  checks.incorrectHash = wrongHash.code === "ASSET_ERROR" && /Asset hash mismatch/.test(wrongHash.message);
  manifest.assets[0] = null;
  overrides.set("/asset-manifest.json", JSON.stringify(manifest));
  const invalidManifest = await init();
  checks.invalidManifest = invalidManifest.code === "ASSET_ERROR" && /manifest/.test(invalidManifest.message);
  overrides.delete("/asset-manifest.json");
  checks.recoveryAfterMissing = (await init()).state === "ready";
  await page.evaluate(async () => {
    const { CEngine } = await import("/src/index.js");
    globalThis.phase3Engine = new CEngine();
    await globalThis.phase3Engine.initialize();
    globalThis.phase3Artifact = (await globalThis.phase3Engine.compile({ source: "int main(void) { return 3; }" })).artifact;
  });
  overrides.set("/runtime/browser-wasi-shim-0.4.2/wasi.js", "corrupt");
  const badShim = await probe(async () => {
    try { await globalThis.phase3Engine.execute(globalThis.phase3Artifact); return null; }
    catch (error) { return { code: error.code, stage: error.stage, state: globalThis.phase3Engine.getState() }; }
  });
  checks.corruptedRuntime = badShim?.code === "ASSET_ERROR" && badShim.stage === "runtime-initialization" && badShim.state === "ready";
  overrides.delete("/runtime/browser-wasi-shim-0.4.2/wasi.js");
  checks.runtimeRecovery = (await probe(async () => (await globalThis.phase3Engine.execute(globalThis.phase3Artifact)).exitCode)) === 3;
  await page.evaluate(() => globalThis.phase3Engine.dispose());
  const packaged = await browser.newPage();
  await packaged.goto(`${dist.url}/__harness`);
  const isolated = await packaged.evaluate(async () => {
    const { CEngine } = await import("/src/index.js");
    const engine = new CEngine();
    try { await engine.initialize(); return (await engine.run({ source: "int main(void) { return 4; }" })).execution?.exitCode; }
    finally { await engine.dispose(); }
  });
  checks.distConsumer = isolated === 4;
  checks.noPageErrors = pageErrors.length === 0;
  const passed = Object.values(checks).filter(Boolean).length;
  process.stdout.write(JSON.stringify({ browserEngine, browserVersion: browser.version(), checks, passed, total: Object.keys(checks).length, pageErrors }, null, 2) + "\n");
  if (passed !== Object.keys(checks).length) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => dist.server.close(resolve));
}
