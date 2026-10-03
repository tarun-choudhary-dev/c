# Proposed public JavaScript API, version 1

_Contract proposal only; no methods are implemented in Phase 0. The package name `@tarun-choudhary/c-language-engine` is provisional and npm availability is unchecked._

## Basic use

```js
import { CEngine, CEngineError } from "@tarun-choudhary/c-language-engine";

const engine = new CEngine({
  assetBaseUrl: new URL("./c-engine-assets/", import.meta.url),
});
await engine.initialize();
try {
  const result = await engine.run({
    source: '#include <stdio.h>\nint main(void) { puts("Hello from C"); return 0; }',
    stdin: "",
  });
  if (result.status === "compile_error") console.log(result.compilation.diagnostics);
  else console.log(result.execution.stdout, result.execution.exitCode);
} finally {
  await engine.dispose();
}
```

For multiple files, `files` and `source` are mutually exclusive. `entry` names the file containing the intended `main` for validation and display; the linker still locates the actual symbol.

```js
const compilation = await engine.compile({
  files: [
    { path: "main.c", source: '#include "math_utils.h"\nint main(void) { return add(1, 2) == 3 ? 0 : 1; }' },
    { path: "math_utils.c", source: "int add(int a, int b) { return a + b; }" },
    { path: "math_utils.h", source: "int add(int a, int b);" },
  ],
  entry: "main.c",
  options: { standard: "c17", optimization: "O0", warnings: "default" },
});
if (compilation.status === "success") {
  const execution = await engine.execute(compilation.artifact, { stdin: "" });
  console.log(execution.status, execution.exitCode);
}
```

## Constructor and method contracts

`new CEngine(options = {})` is synchronous and performs only option shape validation. `assetBaseUrl` is a URL or URL string resolved once; it must identify self-hosted, version-matched assets, never an arbitrary per-request URL. Other optional settings are `limits` (only reductions from package maxima), `sandbox` deployment mode (`"worker"` baseline or `"isolated-origin"` host integration), and an optional pinned asset manifest URL. `isolated-origin` requires a `sandboxFrameUrl` on a different origin from the parent; `assetBaseUrl` must be on that frame's origin. The frame is a protocol bootstrap, not an interface. This mode requires a `Window`/document context. Exact loader settings are a Phase 1 gate. Constructor errors use `TypeError` for invalid static options; no assets load until `initialize()`.

| Method | Return | Allowed states and behavior |
| --- | --- | --- |
| `initialize()` | `Promise<void>` | In `created` or `failed`, load runtime. Concurrent calls during `initializing` receive the same promise. In `ready`, resolve immediately. Reject in `busy`, `recovering`, or `disposed`. Failure enters `failed`. |
| `dispose()` | `Promise<void>` | Idempotent from every state. Terminate Workers, reject active operation with `DISPOSED`, clear artifacts and listeners, enter terminal `disposed`. Concurrent calls share one promise. |
| `reset()` | `Promise<void>` | In `created`, equivalent to initialize. In `initializing`, `ready`, `busy`, `recovering`, or `failed`, retire Workers, invalidate artifacts, create a fresh compiler runtime. Active work or superseded initialization rejects with `RESET`. Concurrent resets share a promise. Reject if `disposed`. |
| `cancel()` | `Promise<boolean>` | If `busy`, terminate the active Worker, reject that operation with `CANCELLED`, recover, then resolve `true`. During that recovery, another cancel shares the promise. If idle/created/initializing/failed, resolve `false`. Reject if `disposed`. |
| `isReady()` | `boolean` | Synchronous; true exactly in `ready`. |
| `isBusy()` | `boolean` | Synchronous; true during an admitted `compile`, `execute`, or `run` operation, including its cancellation/recovery until ready/failed. |
| `getState()` | lifecycle string | Synchronous snapshot: `created`, `initializing`, `ready`, `busy`, `recovering`, `failed`, or `disposed`. |
| `getRuntimeInfo()` | frozen object or `null` | Synchronous; `null` unless state is `ready` or `busy`. Otherwise a snapshot of engine version, protocol version, compiler build, `wasm32-wasip1`, asset manifest identity, and feature support actually verified at initialization. No internal instances. |
| `compile(request)` | `Promise<CompilationResult>` | `ready` only; validates project and compiles/links without running C. Owns the sole busy slot. |
| `execute(artifact, options?)` | `Promise<ExecutionResult>` | `ready` only. Added to make `compile()`'s artifact useful. Accepts only an opaque artifact from this engine's current generation. Never recompiles. |
| `run(request)` | `Promise<RunResult>` | `ready` only. Validates, compiles/links, then executes on success. `stdin` is accepted here, not by `compile()`. No artifact is returned from `run()`. |

`getCapabilities()`, `getVersion()`, `getDiagnostics()` and `on(event, callback)` are **deferred**. Results already carry diagnostics; `getRuntimeInfo()` covers version/capabilities after initialization. No event semantics are promised in v1. Adding optional methods in a minor version is possible; changing existing return shapes or error codes requires a major version.

## Request schemas

```js
// compile(): exactly one of source or files
{ source: "...", filename: "main.c", options: { standard: "c17", optimization: "O0", warnings: "default" } }
{ files: [{ path: "main.c", source: "..." }], entry: "main.c", options: { standard: "c17", optimization: "O0", warnings: "default" } }

// run(): compile request plus stdin
{ source: "...", stdin: "text" }

// execute(): second argument
{ stdin: "text" }
```

`filename` defaults to `main.c`. The initial option allowlist is `standard: "c17"`, `optimization: "O0"`, `warnings: "default" | "all"`; unsupported values reject with `INVALID_REQUEST`. Future builds may add values only when validated. Raw compiler or linker flags, host filesystem paths, imported binaries, network URLs, environment variables, and arbitrary arguments are excluded. All strings are UTF-8 encoded before byte-limit checks. Paths follow [filesystem rules](PROJECT-FILESYSTEM.md).

## Results and errors

The exact portable result shapes are in [compilation and execution](COMPILATION-AND-EXECUTION.md). Compilation syntax/type/link failures resolve with `CompilationResult.status === "error"`. A normal program exit, including nonzero code, resolves with `ExecutionResult.status === "exited"`. A Wasm trap resolves with `"trap"`. `RunResult.status` is `"compile_error"`, `"exited"`, or `"trap"` and contains `compilation` plus `execution` (`null` on compile error).

Infrastructure and misuse failures reject with `CEngineError`, a stable `code` (`INVALID_REQUEST`, `NOT_READY`, `BUSY`, `CANCELLED`, `TIMEOUT`, `RESET`, `DISPOSED`, `INITIALIZATION_FAILED`, `WORKER_FAILED`, `PROTOCOL_ERROR`, `ASSET_ERROR`, `LIMIT_EXCEEDED`, `INVALID_ARTIFACT`). `message` is safe for display; `details` is bounded and contains no source by default. Worker exceptions and underlying browser exceptions are retained privately, not exposed as compiler objects. Cancellation and timeout **reject** the affected operation; they never masquerade as C exit codes. `run().compilation` is a summary without the `artifact` field. After a failed recovery, the engine is `failed` until `reset()`/`initialize()`.

Artifacts are frozen opaque descriptors `{ id, generation }` with no bytes. They are valid only for the originating engine and generation, can be executed repeatedly while valid, and are invalidated on reset, cancellation, timeout recovery, compiler crash recovery, and disposal. `compile()` returns `artifact: null` on failure. The manager may apply a total artifact-byte budget and evict oldest handles; an evicted handle rejects `INVALID_ARTIFACT`. This is a lifetime contract, not a serializable cache format.

## Compatibility

The package exposes only `CEngine` and `CEngineError` from its public entry. Workers, adapters, protocol, and Wasm binaries are private. The result and protocol schemas carry their own versions. Package SemVer covers the JS API; the toolchain/asset manifest is pinned and independently reported. A consumer supplies static asset hosting and browser CSP compatible with Wasm and Workers, as documented in [distribution](DISTRIBUTION-PLAN.md).
