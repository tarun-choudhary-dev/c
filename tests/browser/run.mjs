import { chromium, firefox, webkit } from "playwright-core";
import { startStaticServer } from "../../scripts/serve.mjs";
import { runPhase2 } from "./phase2.mjs";

const engineName = process.env.C_ENGINE_BROWSER_ENGINE ?? "chromium";
const engineType = { chromium, firefox, webkit }[engineName];
if (!engineType) throw new Error(`Unknown browser engine: ${engineName}`);
const executablePath = process.env.C_ENGINE_BROWSER ?? (engineName === "chromium" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : undefined);
const { server, url } = await startStaticServer();
let browser;
try {
  browser = await engineType.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") pageErrors.push(message.text()); });
  await page.goto(`${url}/__harness`);
  const results = await page.evaluate(async () => {
    const compiler = new Worker("/src/worker/compiler.js", { type: "module" });
    let nextId = 1;
    const request = (worker, kind, payload) => new Promise((resolve, reject) => {
      const requestId = nextId++;
      const timer = setTimeout(() => reject(new Error(`Worker timeout: ${kind}`)), 120_000);
      const onMessage = ({ data: response }) => {
        if (response.requestId !== requestId) return;
        clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
        resolve(response);
      };
      const onError = (error) => {
        clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
        reject(new Error(`Worker error: ${error.message}`));
      };
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.postMessage({ protocolVersion: 1, generation: 1, requestId, kind, payload });
    });
    const compile = async (source) => request(compiler, "compile", { filename: "main.c", source });
    const execute = async (wasm, stdin = "") => {
      const worker = new Worker("/src/worker/execution.js", { type: "module" });
      try { return await request(worker, "execute", { wasm, stdin }); }
      finally { worker.terminate(); }
    };
    const summarize = (response) => {
      if (response.kind !== "compileResult") return response;
      const { wasm, ...result } = response.result;
      return { requestId: response.requestId, kind: response.kind, result: { ...result, wasmBytes: wasm?.byteLength ?? 0, wasmMagic: wasm ? Array.from(wasm.slice(0, 4)) : null } };
    };
    const out = {};
    try {
      out.toolchain = await request(compiler, "initialize", {});
      const hello = await compile('#include <stdio.h>\nint main(void) { printf("Hello from C\\n"); return 0; }');
      out.hello = { compilation: summarize(hello), execution: hello.result?.wasm ? await execute(hello.result.wasm) : null };
      if (hello.result?.wasm) {
        const brokenImport = hello.result.wasm.slice();
        const marker = new TextEncoder().encode("fd_write");
        let at = -1;
        for (let i = 0; i <= brokenImport.length - marker.length; i++) {
          if (marker.every((byte, offset) => brokenImport[i + offset] === byte)) { at = i; break; }
        }
        if (at >= 0) brokenImport.set(new TextEncoder().encode("xx_write"), at);
        out.runtimeInitializationFailure = at >= 0 ? await execute(brokenImport) : { kind: "testSetupError" };
      }
      const emptyBody = await compile("int main(void) {}");
      out.emptyBody = { compilation: summarize(emptyBody), execution: emptyBody.result?.wasm ? await execute(emptyBody.result.wasm) : null };
      const syntax = await compile("int main(void) { this is invalid; }");
      out.syntax = summarize(syntax);
      const noMain = await compile("int helper(void) { return 1; }");
      out.noMain = { compilation: summarize(noMain), execution: noMain.result?.wasm ? await execute(noMain.result.wasm) : null };
      const multiple = await request(compiler, "compile", { files: [
        { path: "main.c", source: '#include "helper.h"\nint main(void) { return add(2, 3) == 5 ? 0 : 1; }' },
        { path: "helper.c", source: "int add(int a, int b) { return a + b; }" },
        { path: "helper.h", source: "int add(int a, int b);" },
      ] });
      out.multiple = { compilation: summarize(multiple), execution: multiple.result?.wasm ? await execute(multiple.result.wasm) : null };
      const stderr = await compile('#include <stdio.h>\nint main(void) { fputs("error line\\n", stderr); return 0; }');
      out.stderr = { compilation: summarize(stderr), execution: stderr.result?.wasm ? await execute(stderr.result.wasm) : null };
      const nonzero = await compile("int main(void) { return 7; }");
      out.nonzero = { compilation: summarize(nonzero), execution: nonzero.result?.wasm ? await execute(nonzero.result.wasm) : null };
      out.repeated = nonzero.result?.wasm ? await execute(nonzero.result.wasm) : null;
      out.invalidRuntime = await execute(new Uint8Array([0, 1, 2]));
      out.unknownMessage = await request(compiler, "unknown", {});
      const broken = new Worker("/src/worker/compiler.js", { type: "module" });
      try { out.initializationFailure = await request(broken, "initialize", { assetBaseUrl: new URL("/missing-assets/", location.href).href }); }
      finally { broken.terminate(); }
      return out;
    } finally { compiler.terminate(); }
  });
  const apiResults = await page.evaluate(async () => {
    const { CEngine } = await import("/src/index.js");
    const engine = new CEngine();
    const initialState = engine.getState();
    await engine.initialize();
    const readyState = engine.getState();
    const info = engine.getRuntimeInfo();
    const compilation = await engine.compile({ source: '#include <stdio.h>\nint main(void) { puts("API hello"); return 0; }' });
    const first = await engine.execute(compilation.artifact);
    const second = await engine.execute(compilation.artifact);
    const run = await engine.run({ source: "int main(void) { return 9; }" });
    const multiApi = await engine.run({ files: [
      { path: "main.c", source: '#include "add.h"\nint main(void) { return add(4, 5) == 9 ? 0 : 1; }' },
      { path: "add.c", source: "int add(int a, int b) { return a + b; }" },
      { path: "add.h", source: "int add(int a, int b);" },
    ], entry: "main.c" });
    const warning = await engine.compile({ source: "int main(void) { int unused; return 0; }", options: { warnings: "all" } });
    const runError = await engine.run({ source: "int main(void) { bad token; }" });
    const input = await engine.run({ source: '#include <stdio.h>\nint main(void) { putchar(getchar()); return 0; }', stdin: "Z" });
    const flood = await engine.run({ source: '#include <stdio.h>\nint main(void) { for (int i = 0; i < 140000; ++i) putchar(65); return 0; }' });
    const filesystem = await engine.run({ source: '#include <stdio.h>\nint main(void) { FILE *f = fopen("/private.txt", "r"); return f == NULL ? 0 : 1; }' });
    const syntax = await engine.compile({ source: "int main(void) { bad token; }" });
    const trap = await engine.run({ source: "int main(void) { __builtin_trap(); }" });
    let invalidCode;
    try { await engine.compile({ files: [{ path: "../escape.c", source: "int main(void) {}" }] }); }
    catch (error) { invalidCode = error.code; }
    const pending = engine.compile({ source: "int main(void) { return 0; }" });
    let busyCode;
    try { await engine.compile({ source: "int main(void) { return 0; }" }); }
    catch (error) { busyCode = error.code; }
    await pending;
    await engine.dispose();
    let disposedCode;
    try { await engine.compile({ source: "int main(void) {}" }); }
    catch (error) { disposedCode = error.code; }
    const broken = new CEngine({ assetBaseUrl: new URL("/missing-assets/", location.href) });
    let initializationCode;
    try { await broken.initialize(); }
    catch (error) { initializationCode = error.code; }
    const failedState = broken.getState();
    await broken.dispose();
    const timed = new CEngine({ limits: { executionTimeoutMs: 200 } });
    await timed.initialize();
    let timeoutCode;
    let mainThreadTicks = 0;
    const ticker = setInterval(() => { mainThreadTicks++; }, 20);
    try { await timed.run({ source: "int main(void) { for (;;) {} }" }); }
    catch (error) { timeoutCode = error.code; }
    clearInterval(ticker);
    const postTimeout = await timed.run({ source: "int main(void) { return 0; }" });
    await timed.dispose();
    return { initialState, readyState, info, compileStatus: compilation.status, first, second, run, multiApi: { status: multiApi.status, exitCode: multiApi.execution?.exitCode }, warning: { status: warning.status, diagnostics: warning.diagnostics, rawDiagnostics: warning.rawDiagnostics }, runError: { status: runError.status, compilationStatus: runError.compilation.status, execution: runError.execution }, input: input.execution, flood: { status: flood.status, stdoutLength: flood.execution?.stdout.length, truncated: flood.execution?.truncated }, filesystem: filesystem.execution, syntax: { status: syntax.status, stage: syntax.stage, diagnostics: syntax.diagnostics }, trap, invalidCode, busyCode, disposedCode, initializationCode, failedState, finalState: engine.getState(), timeoutCode, mainThreadTicks, postTimeout: postTimeout.execution };
  });
  const phase2 = await runPhase2(page);
  const checks = {
    toolchain: results.toolchain.kind === "initializeResult" && results.toolchain.result.target === "wasm32-wasip1",
    hello: results.hello.compilation.result?.status === "success" && results.hello.compilation.result?.targetTriple === "wasm32-unknown-wasi" && results.hello.compilation.result?.wasmMagic?.join(",") === "0,97,115,109" && results.hello.execution?.result?.stdout === "Hello from C\n" && results.hello.execution?.result?.exitCode === 0,
    emptyBody: results.emptyBody.compilation.result?.status === "success" && results.emptyBody.execution?.result?.exitCode === 0,
    syntax: results.syntax.result?.status === "error" && results.syntax.result?.stage === "compile" && results.syntax.result?.rawDiagnostics.includes("error:"),
    missingEntry: results.noMain.compilation.result?.status === "error" && results.noMain.compilation.result?.stage === "link" && results.noMain.compilation.result?.rawDiagnostics.includes("wasm-ld: error:"),
    multipleFiles: results.multiple.compilation.result?.status === "success" && results.multiple.execution?.result?.exitCode === 0,
    stderr: results.stderr.execution?.result?.stderr === "error line\n" && results.stderr.execution?.result?.stdout === "",
    nonzero: results.nonzero.execution?.result?.exitCode === 7,
    repeated: results.repeated?.result?.exitCode === 7 && results.repeated?.result?.stdout === "",
    invalidRuntime: results.invalidRuntime?.kind === "error" && results.invalidRuntime.error.code === "INVALID_REQUEST",
    runtimeInitializationFailure: results.runtimeInitializationFailure?.kind === "error" && results.runtimeInitializationFailure.error.code === "INITIALIZATION_FAILED" && results.runtimeInitializationFailure.error.stage === "runtime-initialization",
    requestIds: results.hello.compilation.requestId !== results.syntax.requestId && results.unknownMessage.requestId > results.noMain.compilation.requestId,
    unknownMessage: results.unknownMessage.kind === "error" && results.unknownMessage.error.code === "PROTOCOL_ERROR",
    initializationFailure: results.initializationFailure.kind === "error" && results.initializationFailure.error.code === "INITIALIZATION_FAILED",
    noPageErrors: pageErrors.length === 0,
    apiLifecycle: apiResults.initialState === "created" && apiResults.readyState === "ready" && apiResults.finalState === "disposed",
    apiCompileExecute: apiResults.compileStatus === "success" && apiResults.first.stdout === "API hello\n" && apiResults.second.stdout === "API hello\n",
    apiRun: apiResults.run.status === "exited" && apiResults.run.execution.exitCode === 9 && !("artifact" in apiResults.run.compilation),
    apiMultipleFiles: apiResults.multiApi.status === "exited" && apiResults.multiApi.exitCode === 0,
    apiWarning: apiResults.warning.status === "success" && apiResults.warning.rawDiagnostics.includes("warning:"),
    apiRunCompileError: apiResults.runError.status === "compile_error" && apiResults.runError.compilationStatus === "error" && apiResults.runError.execution === null,
    apiStdin: apiResults.input.stdout === "Z" && apiResults.input.exitCode === 0,
    apiOutputCap: apiResults.flood.stdoutLength === 131072 && apiResults.flood.truncated.stdout === true,
    apiNoFilesystem: apiResults.filesystem.exitCode === 0,
    apiTimeoutRecovery: apiResults.timeoutCode === "TIMEOUT" && apiResults.mainThreadTicks > 0 && apiResults.postTimeout.exitCode === 0,
    apiErrors: apiResults.syntax.status === "error" && apiResults.trap.status === "trap" && apiResults.invalidCode === "INVALID_REQUEST" && apiResults.busyCode === "BUSY" && apiResults.disposedCode === "DISPOSED" && apiResults.initializationCode === "INITIALIZATION_FAILED" && apiResults.failedState === "failed",
    ...phase2.checks,
  };
  const summary = { browserEngine: engineName, browserVersion: browser.version(), passed: Object.values(checks).filter(Boolean).length, total: Object.keys(checks).length, failed: Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name), skipped: 0 };
  process.stdout.write(JSON.stringify(process.env.C_ENGINE_TEST_SUMMARY === "1" ? summary : { ...summary, checks, results, apiResults, phase2: { real: phase2.real, synthetic: phase2.synthetic }, pageErrors }, null, 2) + "\n");
  if (Object.values(checks).some((passed) => !passed)) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
