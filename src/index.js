const encoder = new TextEncoder();
const MAX_FILE_BYTES = 128 * 1024;
const MAX_TOTAL_BYTES = 512 * 1024;
const MAX_STDIN_BYTES = 128 * 1024;
const MAX_WASM_BYTES = 16 * 1024 * 1024;
const MAX_DIAGNOSTIC_BYTES = 128 * 1024;
const LIMIT_MAXIMA = Object.freeze({ initializationTimeoutMs: 120_000, compilationTimeoutMs: 30_000, executionTimeoutMs: 15_000, stdoutBytes: 128 * 1024, stderrBytes: 128 * 1024 });
const WORKER_ERROR_CODES = new Set(["INVALID_REQUEST", "LIMIT_EXCEEDED", "INITIALIZATION_FAILED", "WORKER_FAILED", "PROTOCOL_ERROR"]);
const WORKER_STAGES = new Set(["initialization", "compilation", "runtime-input", "runtime-initialization", "execution", "communication"]);

export class CEngineError extends Error {
  constructor(code, stage, message, requestId = null) {
    super(message);
    this.name = "CEngineError";
    this.code = code;
    this.stage = stage;
    this.requestId = requestId;
    this.cancelled = code === "CANCELLED";
  }
}

function fail(code, stage, message) { throw new CEngineError(code, stage, message); }
function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function onlyKeys(value, allowed) { return Object.keys(value).every((key) => allowed.includes(key)); }
function terminate(worker) { try { worker?.terminate(); } catch { /* Keep the original operation outcome. */ } }

function normalizeProject(request, forRun) {
  if (!record(request)) fail("INVALID_REQUEST", "validation", "Expected a project request");
  if (!onlyKeys(request, ["source", "files", "filename", "entry", "options", ...(forRun ? ["stdin"] : [])])) fail("INVALID_REQUEST", "validation", "Unsupported project field");
  const shorthand = Object.hasOwn(request, "source");
  if (shorthand === Object.hasOwn(request, "files")) fail("INVALID_REQUEST", "validation", "Provide source or files, but not both");
  if (!shorthand && Object.hasOwn(request, "filename")) fail("INVALID_REQUEST", "validation", "filename applies only to source");
  if (shorthand && (typeof request.source !== "string" || !request.source.trim())) fail("INVALID_REQUEST", "validation", "source must be a nonempty string");
  const input = shorthand ? [{ path: request.filename === undefined ? "main.c" : request.filename, source: request.source }] : request.files;
  if (!Array.isArray(input) || input.length < 1 || input.length > 32) fail("INVALID_REQUEST", "validation", "Expected 1 to 32 project files");
  const seen = new Set();
  let totalBytes = 0;
  const files = input.map((file) => {
    if (!record(file) || !onlyKeys(file, ["path", "source"]) || typeof file.path !== "string" || typeof file.source !== "string") fail("INVALID_REQUEST", "validation", "Each file needs a path and source string");
    const path = file.path;
    const parts = path.split("/");
    if (path !== path.normalize("NFC") || path.startsWith("/") || path.includes("\\") || path.includes(":") || path.includes('"') || /[\u0000-\u001f\u007f]/.test(path) || parts.length > 16 || parts.some((part) => !part || part === "." || part === "..") || ["lib", "include", "tmp", "dev", "proc"].includes(parts[0].toLowerCase()) || !/\.(c|h)$/.test(path) || encoder.encode(path).length > 256) fail("INVALID_REQUEST", "validation", `Invalid project path: ${path}`);
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
  if (sourcePaths.length === 0 || !files.some((file) => file.path.endsWith(".c") && file.source.trim())) fail("INVALID_REQUEST", "validation", "Project needs a nonempty C source file");
  const entry = request.entry === undefined ? sourcePaths[0] : request.entry;
  if (typeof entry !== "string" || !sourcePaths.includes(entry)) fail("INVALID_REQUEST", "validation", "Entry must name a C source file");
  const options = request.options === undefined ? {} : request.options;
  if (!record(options) || !onlyKeys(options, ["standard", "optimization", "warnings"]) || (options.standard === undefined ? "c17" : options.standard) !== "c17" || (options.optimization === undefined ? "O0" : options.optimization) !== "O0" || !["default", "all"].includes(options.warnings === undefined ? "default" : options.warnings)) fail("INVALID_REQUEST", "validation", "Unsupported compiler options");
  return { files, entry, options: { standard: "c17", optimization: "O0", warnings: options.warnings === undefined ? "default" : options.warnings } };
}

function normalizeStdin(value) {
  if (value === undefined) return "";
  if (typeof value !== "string") fail("INVALID_REQUEST", "validation", "stdin must be a string");
  if (encoder.encode(value).length > MAX_STDIN_BYTES) fail("LIMIT_EXCEEDED", "validation", "stdin exceeds limit");
  return value;
}

function normalizeLimits(value) {
  if (value === undefined) return LIMIT_MAXIMA;
  if (!record(value) || !onlyKeys(value, Object.keys(LIMIT_MAXIMA))) throw new TypeError("Unsupported engine limits");
  const limits = { ...LIMIT_MAXIMA };
  for (const [key, maximum] of Object.entries(LIMIT_MAXIMA)) {
    if (Object.hasOwn(value, key)) {
      if (!Number.isSafeInteger(value[key]) || value[key] < 1 || value[key] > maximum) throw new TypeError(`Invalid ${key}`);
      limits[key] = value[key];
    }
  }
  return Object.freeze(limits);
}

function validResult(kind, result, limits) {
  if (!record(result)) return false;
  if (kind === "initializeResult") return result.target === "wasm32-wasip1" && record(result.clang) && typeof result.clang.version === "string" && record(result.lld) && typeof result.lld.version === "string" && Number.isFinite(result.sysrootBytes) && Number.isFinite(result.initializationMs);
  if (kind === "compileResult") return ["success", "error"].includes(result.status) && (result.status === "success" ? result.stage === "complete" : ["compile", "link"].includes(result.stage)) && Array.isArray(result.diagnostics) && result.diagnostics.length <= 200 && result.diagnostics.every((item) => record(item) && ["error", "warning", "note", "fatal"].includes(item.severity) && typeof item.message === "string" && (item.file === null || typeof item.file === "string") && (item.line === null || Number.isSafeInteger(item.line)) && (item.column === null || Number.isSafeInteger(item.column))) && typeof result.rawDiagnostics === "string" && encoder.encode(result.rawDiagnostics).length <= MAX_DIAGNOSTIC_BYTES + 3 && typeof result.diagnosticsTruncated === "boolean" && Number.isFinite(result.durationMs) && (result.status === "success" ? result.wasm instanceof Uint8Array : result.wasm == null);
  if (kind === "executionResult") return ["exited", "trap"].includes(result.status) && typeof result.stdout === "string" && encoder.encode(result.stdout).length <= limits.stdoutBytes + 3 && typeof result.stderr === "string" && encoder.encode(result.stderr).length <= limits.stderrBytes + 3 && Number.isFinite(result.durationMs) && record(result.truncated) && typeof result.truncated.stdout === "boolean" && typeof result.truncated.stderr === "boolean" && (result.status === "exited" ? Number.isInteger(result.exitCode) && result.error === null : result.exitCode === null && record(result.error) && result.error.kind === "trap" && typeof result.error.message === "string");
  return false;
}

export class CEngine {
  #state = "created";
  #compiler = null;
  #executionWorker = null;
  #initialization = null;
  #resetPromise = null;
  #cancelPromise = null;
  #disposePromise = null;
  #activeCall = null;
  #operation = null;
  #nextRequestId = 0;
  #generation = 0;
  #artifacts = new WeakMap();
  #runtimeInfo = null;
  #assetBaseUrl;
  #limits;

  constructor(options = {}) {
    if (!record(options) || !onlyKeys(options, ["assetBaseUrl", "limits"])) throw new TypeError("Unsupported engine options");
    const assetBaseUrl = options.assetBaseUrl === undefined ? new URL("../node_modules/browsercc/dist/", import.meta.url) : options.assetBaseUrl;
    if (!(assetBaseUrl instanceof URL) && typeof assetBaseUrl !== "string") throw new TypeError("assetBaseUrl must be a URL or string");
    const url = new URL(assetBaseUrl, import.meta.url);
    if (!["http:", "https:"].includes(url.protocol) || !url.pathname.endsWith("/")) throw new TypeError("assetBaseUrl must be an HTTP(S) directory URL ending in /");
    this.#assetBaseUrl = url.href;
    this.#limits = normalizeLimits(options.limits);
  }

  getState() { return this.#state; }
  isReady() { return this.#state === "ready"; }
  isBusy() { return this.#state === "busy" || this.#state === "recovering"; }
  getRuntimeInfo() { return ["ready", "busy"].includes(this.#state) ? this.#runtimeInfo : null; }

  initialize(...args) {
    if (args.length) return Promise.reject(new CEngineError("INVALID_REQUEST", "validation", "initialize accepts no arguments"));
    if (this.#state === "disposed") return Promise.reject(new CEngineError("DISPOSED", "lifecycle", "Engine is disposed"));
    if (this.#state === "initializing") return this.#initialization;
    if (this.#state === "ready") return Promise.resolve();
    if (["busy", "recovering"].includes(this.#state)) return Promise.reject(new CEngineError("BUSY", "lifecycle", "Engine is busy"));
    return this.#startCompiler("initializing");
  }

  compile(request) {
    return this.#perform(async (operation) => {
      const project = normalizeProject(request, false);
      this.#checkOperation(operation);
      const { summary, wasm } = await this.#compile(project);
      this.#checkOperation(operation);
      if (!wasm) return { ...summary, artifact: null };
      const artifact = Object.freeze({ id: crypto.randomUUID(), generation: this.#generation });
      this.#artifacts.set(artifact, wasm);
      return { ...summary, artifact };
    });
  }

  execute(artifact, options = {}) {
    return this.#perform(async (operation) => {
      if (!record(options) || !onlyKeys(options, ["stdin"])) fail("INVALID_REQUEST", "validation", "Unsupported execution options");
      const wasm = record(artifact) ? this.#artifacts.get(artifact) : null;
      if (!wasm || artifact.generation !== this.#generation) fail("INVALID_ARTIFACT", "validation", "Artifact is not valid for this engine generation");
      const stdin = normalizeStdin(options.stdin);
      this.#checkOperation(operation);
      return this.#execute(wasm, stdin);
    });
  }

  run(request) {
    return this.#perform(async (operation) => {
      const project = normalizeProject(request, true);
      const stdin = normalizeStdin(request.stdin);
      this.#checkOperation(operation);
      const started = performance.now();
      const { summary, wasm } = await this.#compile(project);
      this.#checkOperation(operation);
      if (!wasm) return { status: "compile_error", compilation: summary, execution: null, durationMs: performance.now() - started };
      const execution = await this.#execute(wasm, stdin);
      this.#checkOperation(operation);
      return { status: execution.status, compilation: summary, execution, durationMs: performance.now() - started };
    });
  }

  cancel(...args) {
    if (args.length) return Promise.reject(new CEngineError("INVALID_REQUEST", "validation", "cancel accepts no arguments"));
    if (this.#state === "disposed") return Promise.reject(new CEngineError("DISPOSED", "lifecycle", "Engine is disposed"));
    if (this.#cancelPromise) return this.#cancelPromise;
    if (this.#state !== "busy" || !this.#operation) return Promise.resolve(false);
    const activeCompiler = this.#activeCall?.worker === this.#compiler;
    const error = new CEngineError("CANCELLED", "cancellation", "Operation was cancelled", this.#activeCall?.requestId ?? null);
    this.#state = "recovering";
    this.#interruptOperation(error);
    let recovery;
    if (activeCompiler) {
      this.#retireAll(error);
      recovery = this.#startCompiler("recovering").then(() => true);
    } else {
      this.#abortActive(error);
      terminate(this.#executionWorker);
      this.#executionWorker = null;
      this.#invalidate();
      const generation = this.#generation;
      recovery = Promise.resolve().then(() => {
        if (this.#generation !== generation || this.#state === "disposed") throw new CEngineError(this.#state === "disposed" ? "DISPOSED" : "RESET", "lifecycle", "Cancellation recovery was superseded");
        this.#state = "ready";
        return true;
      });
    }
    const promise = recovery.finally(() => { if (this.#cancelPromise === promise) this.#cancelPromise = null; });
    this.#cancelPromise = promise;
    return promise;
  }

  reset(...args) {
    if (args.length) return Promise.reject(new CEngineError("INVALID_REQUEST", "validation", "reset accepts no arguments"));
    if (this.#state === "disposed") return Promise.reject(new CEngineError("DISPOSED", "lifecycle", "Engine is disposed"));
    if (this.#resetPromise) return this.#resetPromise;
    const wasBusy = ["busy", "recovering"].includes(this.#state);
    const error = new CEngineError("RESET", "lifecycle", "Operation was reset", this.#activeCall?.requestId ?? null);
    this.#interruptOperation(error);
    this.#retireAll(error);
    const recovery = this.#startCompiler(wasBusy ? "recovering" : "initializing");
    const promise = recovery.finally(() => { if (this.#resetPromise === promise) this.#resetPromise = null; });
    this.#resetPromise = promise;
    return promise;
  }

  dispose(...args) {
    if (args.length) return Promise.reject(new CEngineError("INVALID_REQUEST", "validation", "dispose accepts no arguments"));
    if (this.#disposePromise) return this.#disposePromise;
    this.#state = "disposed";
    const error = new CEngineError("DISPOSED", "lifecycle", "Engine was disposed", this.#activeCall?.requestId ?? null);
    this.#interruptOperation(error);
    this.#retireAll(error);
    this.#disposePromise = Promise.resolve();
    return this.#disposePromise;
  }

  #startCompiler(state) {
    this.#state = state;
    this.#generation++;
    this.#artifacts = new WeakMap();
    this.#runtimeInfo = null;
    const generation = this.#generation;
    let worker;
    try { worker = new Worker(new URL("./worker/compiler.js", import.meta.url), { type: "module" }); }
    catch (error) {
      this.#state = "failed";
      return Promise.reject(new CEngineError("INITIALIZATION_FAILED", "initialization", String(error?.message ?? error)));
    }
    this.#compiler = worker;
    const promise = this.#call(worker, "initialize", { assetBaseUrl: this.#assetBaseUrl }, "initializeResult", this.#limits.initializationTimeoutMs)
      .then((result) => {
        if (generation !== this.#generation || this.#state === "disposed") throw new CEngineError(this.#state === "disposed" ? "DISPOSED" : "RESET", "lifecycle", "Initialization was superseded");
        this.#runtimeInfo = Object.freeze({ engineVersion: "0.0.0-phase2", protocolVersion: 1, ...result, clang: Object.freeze({ ...result.clang }), lld: Object.freeze({ ...result.lld }) });
        this.#state = "ready";
      })
      .catch((error) => {
        if (this.#compiler === worker) {
          terminate(worker);
          this.#compiler = null;
          this.#state = "failed";
        }
        throw error;
      })
      .finally(() => { if (this.#initialization === promise) this.#initialization = null; });
    this.#initialization = promise;
    return promise;
  }

  #perform(fn) {
    if (this.#state === "disposed") return Promise.reject(new CEngineError("DISPOSED", "lifecycle", "Engine is disposed"));
    if (["busy", "recovering"].includes(this.#state)) return Promise.reject(new CEngineError("BUSY", "lifecycle", "Engine is busy"));
    if (this.#state !== "ready") return Promise.reject(new CEngineError("NOT_READY", "lifecycle", "Engine is not ready"));
    this.#state = "busy";
    const operation = { interrupted: false, error: null, rejectInterrupt: null };
    this.#operation = operation;
    const interruption = new Promise((_, reject) => { operation.rejectInterrupt = reject; });
    const work = Promise.resolve().then(() => { this.#checkOperation(operation); return fn(operation); });
    return Promise.race([work, interruption])
      .catch(async (error) => {
        if (this.#operation === operation && !operation.interrupted && this.#state === "failed" && ["WORKER_FAILED", "PROTOCOL_ERROR", "TIMEOUT"].includes(error?.code)) {
          try { await this.#startCompiler("recovering"); } catch { /* Preserve the original operation error. */ }
        }
        throw error;
      })
      .finally(() => {
        if (this.#operation === operation) this.#operation = null;
        if (this.#state === "busy") this.#state = "ready";
      });
  }

  #checkOperation(operation) {
    if (operation.interrupted || this.#operation !== operation) throw operation.error ?? new CEngineError("RESET", "lifecycle", "Operation was superseded");
  }

  #interruptOperation(error) {
    if (!this.#operation || this.#operation.interrupted) return;
    this.#operation.interrupted = true;
    this.#operation.error = error;
    this.#operation.rejectInterrupt(error);
  }

  async #compile(project) {
    const result = await this.#call(this.#compiler, "compile", project, "compileResult", this.#limits.compilationTimeoutMs);
    const { wasm, imports, exports, linkerArgs, targetTriple, ...summary } = result;
    if (wasm && wasm.byteLength > MAX_WASM_BYTES) fail("LIMIT_EXCEEDED", "compilation", "Compiled Wasm exceeds limit");
    return { summary, wasm };
  }

  #execute(wasm, stdin) {
    let worker;
    try { worker = new Worker(new URL("./worker/execution.js", import.meta.url), { type: "module" }); }
    catch (error) { return Promise.reject(new CEngineError("WORKER_FAILED", "execution", String(error?.message ?? error))); }
    this.#executionWorker = worker;
    return this.#call(worker, "execute", { wasm, stdin, limits: { stdoutBytes: this.#limits.stdoutBytes, stderrBytes: this.#limits.stderrBytes } }, "executionResult", this.#limits.executionTimeoutMs)
      .finally(() => {
        terminate(worker);
        if (this.#executionWorker === worker) this.#executionWorker = null;
      });
  }

  #invalidate() { this.#generation++; this.#artifacts = new WeakMap(); }
  #abortActive(error) { this.#activeCall?.abort(error); }

  #retireAll(error) {
    this.#abortActive(error);
    terminate(this.#executionWorker);
    this.#executionWorker = null;
    terminate(this.#compiler);
    this.#compiler = null;
    this.#runtimeInfo = null;
    this.#invalidate();
  }

  #fault(worker) {
    terminate(worker);
    if (worker === this.#compiler) {
      this.#compiler = null;
      this.#runtimeInfo = null;
      if (this.#state !== "disposed") this.#state = "failed";
    }
    if (worker === this.#executionWorker) this.#executionWorker = null;
    this.#invalidate();
  }

  #call(worker, kind, payload, expectedKind, timeoutMs) {
    const requestId = ++this.#nextRequestId;
    const generation = this.#generation;
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
        worker.removeEventListener("messageerror", onMessageError);
        if (this.#activeCall?.requestId === requestId) this.#activeCall = null;
      };
      const settle = (fn, value, fault = false) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (fault) this.#fault(worker);
        fn(value);
      };
      const protocolFault = (message) => settle(reject, new CEngineError("PROTOCOL_ERROR", "communication", message, requestId), true);
      const onMessage = ({ data }) => {
        if (!record(data) || !Number.isSafeInteger(data.requestId)) return protocolFault("Malformed Worker response");
        if (data.requestId !== requestId) return;
        if (data.protocolVersion !== 1 || data.generation !== generation || this.#generation !== generation) return protocolFault("Stale or incompatible Worker response");
        if (data.kind === "error") {
          if (!record(data.error) || !WORKER_ERROR_CODES.has(data.error.code) || !WORKER_STAGES.has(data.error.stage) || typeof data.error.message !== "string" || data.error.message.length > 4096) return protocolFault("Malformed Worker error");
          const error = new CEngineError(data.error.code, data.error.stage, data.error.message, requestId);
          settle(reject, error, ["WORKER_FAILED", "PROTOCOL_ERROR"].includes(error.code) || (kind === "initialize" && error.code === "INITIALIZATION_FAILED"));
        } else if (data.kind !== expectedKind || !validResult(expectedKind, data.result, payload.limits)) {
          protocolFault("Unexpected or malformed Worker result");
        } else settle(resolve, data.result);
      };
      const stage = kind === "initialize" ? "initialization" : kind === "compile" ? "compilation" : "execution";
      const onError = (event) => settle(reject, new CEngineError("WORKER_FAILED", stage, event.message || "Worker failed", requestId), true);
      const onMessageError = () => protocolFault("Uncloneable Worker response");
      const timer = setTimeout(() => settle(reject, new CEngineError("TIMEOUT", stage, `${kind} exceeded its deadline`, requestId), true), timeoutMs);
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.addEventListener("messageerror", onMessageError);
      this.#activeCall = { requestId, worker, abort: (error) => settle(reject, error) };
      try { worker.postMessage({ protocolVersion: 1, generation, requestId, kind, payload }); }
      catch (error) { protocolFault(String(error?.message ?? error)); }
    });
  }
}
