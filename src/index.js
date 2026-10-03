const encoder = new TextEncoder();
const MAX_FILE_BYTES = 128 * 1024;
const MAX_TOTAL_BYTES = 512 * 1024;
const MAX_STDIN_BYTES = 128 * 1024;

export class CEngineError extends Error {
  constructor(code, stage, message) {
    super(message);
    this.name = "CEngineError";
    this.code = code;
    this.stage = stage;
  }
}

function fail(code, stage, message) { throw new CEngineError(code, stage, message); }

function normalizeProject(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) fail("INVALID_REQUEST", "validation", "Expected a project request");
  const shorthand = Object.hasOwn(request, "source");
  if (shorthand === Object.hasOwn(request, "files")) fail("INVALID_REQUEST", "validation", "Provide source or files, but not both");
  const input = shorthand ? [{ path: request.filename ?? "main.c", source: request.source }] : request.files;
  if (!Array.isArray(input) || input.length < 1 || input.length > 32) fail("INVALID_REQUEST", "validation", "Expected 1 to 32 project files");
  const seen = new Set();
  let totalBytes = 0;
  const files = input.map((file) => {
    if (!file || typeof file.path !== "string" || typeof file.source !== "string") fail("INVALID_REQUEST", "validation", "Each file needs a path and source string");
    const path = file.path.normalize("NFC");
    const parts = path.split("/");
    if (path.startsWith("/") || path.includes("\\") || path.includes(":") || /[\u0000-\u001f\u007f]/.test(path) || parts.some((part) => !part || part === "." || part === "..") || ["lib", "include", "tmp", "dev", "proc"].includes(parts[0].toLowerCase()) || !/\.(c|h)$/.test(path) || encoder.encode(path).length > 256) fail("INVALID_REQUEST", "validation", `Invalid project path: ${path}`);
    const key = path.toLowerCase();
    if (seen.has(key)) fail("INVALID_REQUEST", "validation", `Duplicate project path: ${path}`);
    seen.add(key);
    const bytes = encoder.encode(file.source).length;
    if (bytes > MAX_FILE_BYTES) fail("LIMIT_EXCEEDED", "validation", "File exceeds source limit");
    totalBytes += bytes;
    return { path, source: file.source };
  });
  if (totalBytes > MAX_TOTAL_BYTES) fail("LIMIT_EXCEEDED", "validation", "Project exceeds source limit");
  const sourcePaths = files.filter((file) => file.path.endsWith(".c")).map((file) => file.path);
  if (sourcePaths.length === 0) fail("INVALID_REQUEST", "validation", "Project needs a C source file");
  const entry = request.entry ?? (shorthand ? files[0].path : sourcePaths[0]);
  if (!sourcePaths.includes(entry)) fail("INVALID_REQUEST", "validation", "Entry must name a C source file");
  const options = request.options ?? {};
  if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some((key) => !["standard", "optimization", "warnings"].includes(key)) || (options.standard ?? "c17") !== "c17" || (options.optimization ?? "O0") !== "O0" || !["default", "all"].includes(options.warnings ?? "default")) fail("INVALID_REQUEST", "validation", "Unsupported compiler options");
  return { files, entry, options: { standard: "c17", optimization: "O0", warnings: options.warnings ?? "default" } };
}

function normalizeStdin(value) {
  if (value === undefined) return "";
  if (typeof value !== "string") fail("INVALID_REQUEST", "validation", "stdin must be a string");
  if (encoder.encode(value).length > MAX_STDIN_BYTES) fail("LIMIT_EXCEEDED", "validation", "stdin exceeds limit");
  return value;
}

export class CEngine {
  #state = "created";
  #compiler = null;
  #initialization = null;
  #active = null;
  #nextRequestId = 0;
  #generation = 0;
  #artifacts = new WeakMap();
  #runtimeInfo = null;
  #assetBaseUrl;
  #executionTimeoutMs;

  constructor(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new TypeError("Engine options must be an object");
    this.#assetBaseUrl = new URL(options.assetBaseUrl ?? new URL("../node_modules/browsercc/dist/", import.meta.url)).href;
    const executionTimeoutMs = options.limits?.executionTimeoutMs ?? 15_000;
    if (!Number.isSafeInteger(executionTimeoutMs) || executionTimeoutMs < 1 || executionTimeoutMs > 15_000) throw new TypeError("Invalid execution timeout");
    this.#executionTimeoutMs = executionTimeoutMs;
  }

  getState() { return this.#state; }
  isReady() { return this.#state === "ready"; }
  isBusy() { return this.#state === "busy"; }
  getRuntimeInfo() { return this.#state === "ready" || this.#state === "busy" ? this.#runtimeInfo : null; }

  initialize() {
    if (this.#state === "disposed") return Promise.reject(new CEngineError("DISPOSED", "lifecycle", "Engine is disposed"));
    if (this.#state === "initializing") return this.#initialization;
    if (this.#state === "ready") return Promise.resolve();
    if (this.#state === "busy") return Promise.reject(new CEngineError("BUSY", "lifecycle", "Engine is busy"));
    this.#state = "initializing";
    this.#generation++;
    try { this.#compiler = new Worker(new URL("./worker/compiler.js", import.meta.url), { type: "module" }); }
    catch (error) {
      this.#state = "failed";
      return Promise.reject(new CEngineError("INITIALIZATION_FAILED", "initialization", error.message));
    }
    this.#initialization = this.#call(this.#compiler, "initialize", { assetBaseUrl: this.#assetBaseUrl }, "initializeResult", 120_000)
      .then((result) => {
        this.#runtimeInfo = Object.freeze({ engineVersion: "0.0.0-phase1", protocolVersion: 1, ...result });
        if (this.#state !== "disposed") this.#state = "ready";
      })
      .catch((error) => {
        this.#compiler?.terminate();
        this.#compiler = null;
        if (this.#state !== "disposed") this.#state = "failed";
        throw error;
      })
      .finally(() => { this.#initialization = null; });
    return this.#initialization;
  }

  async compile(request) {
    return this.#operation(async () => {
      const project = normalizeProject(request);
      const { summary, wasm } = await this.#compile(project);
      if (!wasm) return { ...summary, artifact: null };
      const artifact = Object.freeze({ id: crypto.randomUUID(), generation: this.#generation });
      this.#artifacts.set(artifact, wasm);
      return { ...summary, artifact };
    });
  }

  async execute(artifact, options = {}) {
    return this.#operation(async () => {
      if (!options || typeof options !== "object" || Array.isArray(options)) fail("INVALID_REQUEST", "validation", "Execution options must be an object");
      const wasm = artifact && typeof artifact === "object" ? this.#artifacts.get(artifact) : null;
      if (!wasm || artifact.generation !== this.#generation) fail("INVALID_ARTIFACT", "validation", "Artifact is not valid for this engine generation");
      return this.#execute(wasm, normalizeStdin(options?.stdin));
    });
  }

  async run(request) {
    return this.#operation(async () => {
      const project = normalizeProject(request);
      const stdin = normalizeStdin(request.stdin);
      const started = performance.now();
      const { summary, wasm } = await this.#compile(project);
      if (!wasm) return { status: "compile_error", compilation: summary, execution: null, durationMs: performance.now() - started };
      const execution = await this.#execute(wasm, stdin);
      return { status: execution.status, compilation: summary, execution, durationMs: performance.now() - started };
    });
  }

  dispose() {
    if (this.#state === "disposed") return Promise.resolve();
    this.#state = "disposed";
    this.#active?.reject(new CEngineError("DISPOSED", "lifecycle", "Engine was disposed"));
    this.#active?.worker.terminate();
    this.#compiler?.terminate();
    this.#compiler = null;
    this.#generation++;
    this.#artifacts = new WeakMap();
    this.#runtimeInfo = null;
    return Promise.resolve();
  }

  async #operation(fn) {
    if (this.#state === "disposed") fail("DISPOSED", "lifecycle", "Engine is disposed");
    if (this.#state === "busy") fail("BUSY", "lifecycle", "Engine is busy");
    if (this.#state !== "ready") fail("NOT_READY", "lifecycle", "Engine is not ready");
    this.#state = "busy";
    try { return await fn(); }
    finally { if (this.#state === "busy") this.#state = "ready"; }
  }

  async #compile(project) {
    const result = await this.#call(this.#compiler, "compile", project, "compileResult", 30_000);
    const { wasm, imports, exports, linkerArgs, targetTriple, ...summary } = result;
    if (result.status === "success" && !(wasm instanceof Uint8Array)) fail("PROTOCOL_ERROR", "communication", "Compiler returned no Wasm bytes");
    return { summary, wasm };
  }

  async #execute(wasm, stdin) {
    const worker = new Worker(new URL("./worker/execution.js", import.meta.url), { type: "module" });
    try { return await this.#call(worker, "execute", { wasm, stdin }, "executionResult", this.#executionTimeoutMs); }
    finally { worker.terminate(); }
  }

  #call(worker, kind, payload, expectedKind, timeoutMs) {
    const requestId = ++this.#nextRequestId;
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
        worker.removeEventListener("messageerror", onMessageError);
        if (this.#active?.requestId === requestId) this.#active = null;
      };
      const settle = (fn, value) => { if (settled) return; settled = true; cleanup(); fn(value); };
      const retire = () => {
        worker.terminate();
        if (worker === this.#compiler) { this.#compiler = null; this.#state = "failed"; }
        this.#generation++;
        this.#artifacts = new WeakMap();
      };
      const onMessage = ({ data }) => {
        if (data?.requestId !== requestId) return;
        if (data.protocolVersion !== 1 || data.generation !== this.#generation) {
          retire();
          settle(reject, new CEngineError("PROTOCOL_ERROR", "communication", "Stale or incompatible Worker response"));
          return;
        }
        if (data.kind === "error") {
          if (["WORKER_FAILED", "PROTOCOL_ERROR"].includes(data.error?.code)) retire();
          settle(reject, new CEngineError(data.error?.code ?? "WORKER_FAILED", data.error?.stage ?? kind, data.error?.message ?? "Worker error"));
        } else if (data.kind !== expectedKind) {
          retire();
          settle(reject, new CEngineError("PROTOCOL_ERROR", "communication", "Unexpected Worker response"));
        } else settle(resolve, data.result);
      };
      const onError = (event) => { retire(); settle(reject, new CEngineError("WORKER_FAILED", kind, event.message || "Worker failed")); };
      const onMessageError = () => { retire(); settle(reject, new CEngineError("PROTOCOL_ERROR", "communication", "Uncloneable Worker response")); };
      const timer = setTimeout(() => {
        retire();
        settle(reject, new CEngineError("TIMEOUT", kind, `${kind} exceeded its deadline`));
      }, timeoutMs);
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.addEventListener("messageerror", onMessageError);
      this.#active = { requestId, worker, reject: (error) => settle(reject, error) };
      try { worker.postMessage({ protocolVersion: 1, generation: this.#generation, requestId, kind, payload }); }
      catch (error) { retire(); settle(reject, new CEngineError("PROTOCOL_ERROR", "communication", error.message)); }
    });
  }
}
