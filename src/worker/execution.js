import { AssetVerificationError, fetchVerifiedAssets, loadManifest } from "./verify-assets.js";

const OUTPUT_LIMIT = 128 * 1024;
const INPUT_LIMIT = 128 * 1024;
const WASM_LIMIT = 16 * 1024 * 1024;

function outputSink(limit) {
  const chunks = [];
  let length = 0;
  let truncated = false;
  return {
    write(data) {
      const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      const retained = bytes.subarray(0, Math.max(0, limit - length));
      if (retained.length) { chunks.push(retained.slice()); length += retained.length; }
      if (retained.length < bytes.length) truncated = true;
    },
    text() {
      const joined = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
      return new TextDecoder().decode(joined);
    },
    get truncated() { return truncated; },
  };
}

self.onmessage = async ({ data }) => {
  const { protocolVersion, generation, requestId, kind, payload } = data ?? {};
  if (!Number.isSafeInteger(requestId)) return;
  const send = (response) => self.postMessage({ protocolVersion: 1, generation, requestId, ...response });
  if (protocolVersion !== 1 || !Number.isSafeInteger(generation)) {
    send({ kind: "error", error: { code: "PROTOCOL_ERROR", stage: "communication", message: "Unsupported Worker protocol" } });
    return;
  }
  if (kind !== "execute") {
    send({ kind: "error", error: { code: "PROTOCOL_ERROR", stage: "communication", message: "Unknown execution request" } });
    return;
  }
  const started = performance.now();
  let stage = "runtime-input";
  try {
    if (!(payload?.wasm instanceof Uint8Array)) throw new TypeError("Expected Wasm bytes");
    if (payload.wasm.byteLength > WASM_LIMIT) throw new TypeError("Wasm artifact exceeds Phase 1 limit");
    if (typeof (payload.stdin ?? "") !== "string" || new TextEncoder().encode(payload.stdin ?? "").length > INPUT_LIMIT) throw new TypeError("Invalid stdin");
    const limits = payload.limits ?? { stdoutBytes: OUTPUT_LIMIT, stderrBytes: OUTPUT_LIMIT };
    if (!limits || !Number.isSafeInteger(limits.stdoutBytes) || limits.stdoutBytes < 1 || limits.stdoutBytes > OUTPUT_LIMIT || !Number.isSafeInteger(limits.stderrBytes) || limits.stderrBytes < 1 || limits.stderrBytes > OUTPUT_LIMIT) throw new TypeError("Invalid output limits");
    const module = await WebAssembly.compile(payload.wasm);
    const imports = WebAssembly.Module.imports(module);
    if (imports.some((entry) => entry.module !== "wasi_snapshot_preview1" || entry.name.startsWith("sock_"))) throw new TypeError("Unsupported Wasm import");
    if (!WebAssembly.Module.exports(module).some((entry) => entry.name === "_start" && entry.kind === "function")) throw new TypeError("WASI command has no _start export");
    stage = "runtime-initialization";
    const manifest = await loadManifest();
    await fetchVerifiedAssets(manifest, "runtime");
    const { WASI, File, OpenFile, ConsoleStdout } = await import(new URL("../../runtime/browser-wasi-shim-0.4.2/index.js", import.meta.url).href);
    const stdout = outputSink(limits.stdoutBytes);
    const stderr = outputSink(limits.stderrBytes);
    const wasi = new WASI(["program"], [], [
      new OpenFile(new File(new TextEncoder().encode(payload.stdin ?? ""), { readonly: true })),
      new ConsoleStdout((bytes) => stdout.write(bytes)),
      new ConsoleStdout((bytes) => stderr.write(bytes)),
    ]);
    const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi.wasiImport });
    stage = "execution";
    let exitCode;
    try { exitCode = wasi.start(instance); }
    catch (error) {
      if (error instanceof WebAssembly.RuntimeError) {
        send({ kind: "executionResult", result: { status: "trap", stdout: stdout.text(), stderr: stderr.text(), exitCode: null, durationMs: performance.now() - started, error: { kind: "trap", message: error.message }, truncated: { stdout: stdout.truncated, stderr: stderr.truncated } } });
        return;
      }
      throw error;
    }
    send({ kind: "executionResult", result: { status: "exited", stdout: stdout.text(), stderr: stderr.text(), exitCode, durationMs: performance.now() - started, error: null, truncated: { stdout: stdout.truncated, stderr: stderr.truncated } } });
  } catch (error) {
    const code = error instanceof AssetVerificationError ? (error.kind === "integrity" ? "ASSET_ERROR" : "INITIALIZATION_FAILED") : stage === "runtime-input" ? "INVALID_REQUEST" : stage === "runtime-initialization" ? "INITIALIZATION_FAILED" : "WORKER_FAILED";
    send({ kind: "error", error: { code, stage, message: String(error?.message ?? error).slice(0, 4096) } });
  }
};
