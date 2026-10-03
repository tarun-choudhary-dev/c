# Phase 1 API: implemented subset

This repository-local proof exports `CEngine` and `CEngineError` from `src/index.js`. The [Phase 0 contract](PUBLIC-API.md) remains the target; this page records exactly what Phase 1 implements. Importing by a repository path is for local tests only. The npm package is private and has no distributable entry point yet.

```js
import { CEngine } from "/src/index.js"; // local static server only

const engine = new CEngine();
await engine.initialize();
try {
  const compilation = await engine.compile({
    source: '#include <stdio.h>\nint main(void) { puts("Hello from C"); return 0; }',
    options: { standard: "c17", optimization: "O0", warnings: "default" },
  });
  if (compilation.status === "success") {
    const execution = await engine.execute(compilation.artifact, { stdin: "" });
    console.log(execution.stdout, execution.stderr, execution.exitCode);
  } else {
    console.log(compilation.stage, compilation.diagnostics, compilation.rawDiagnostics);
  }
} finally {
  await engine.dispose();
}
```

`run({ source, filename?, stdin?, options? })` or `run({ files, entry?, stdin?, options? })` compiles and then executes on success. The tested multi-file form used two `.c` files and one `.h`. `run()` returns `{ status, compilation, execution, durationMs }`; `status` is `compile_error`, `exited`, or `trap`. On `compile_error`, `execution` is `null`. `compile()` returns `{ status: "success"|"error", stage, diagnostics, rawDiagnostics, diagnosticsTruncated, durationMs, artifact }`; failure has `artifact: null`. `execute()` returns `{ status: "exited"|"trap", stdout, stderr, exitCode, durationMs, error, truncated: { stdout, stderr } }`. A nonzero program exit is still `exited`.

| Member | Phase 1 behavior |
| --- | --- |
| `new CEngine({ assetBaseUrl?, limits?: { executionTimeoutMs? } })` | Synchronous. Default assets live in local `node_modules/browsercc/dist/`; execution deadline defaults to 15,000 ms and may only be lowered. |
| `initialize()` | Promise; loads compiler Worker and sysroot; repeated ready call resolves. Initialization failure enters `failed`. |
| `compile(request)` | Promise; compiles and links without executing. One operation at a time. |
| `execute(artifact, { stdin? })` | Promise; uses only a current-generation artifact from this instance. A new execution Worker runs `_start`. |
| `run(request)` | Promise; compile then execute; does not return an artifact. |
| `dispose()` | Promise; idempotently terminates Workers and invalidates artifacts. |
| `isReady()`, `isBusy()`, `getState()`, `getRuntimeInfo()` | Synchronous snapshots. States used: `created`, `initializing`, `ready`, `busy`, `failed`, `disposed`. |

`reset()` and `cancel()` are **not implemented** in Phase 1, despite their presence in the proposed full API. The engine internally terminates an execution Worker on timeout and can run again afterward. A compiler Worker fault enters `failed`; `initialize()` can retry, but comprehensive reset/recovery behavior is deferred. Events, inspection, capability methods, isolated-origin options and distributable asset configuration are also deferred.

Requests accept only `c17`, `O0`, and warning mode `default` or `all`. Project files must be `.c` or `.h`, paths relative with `/`, no traversal or reserved root names; one `.c` file is required. The facade caps 32 files, 128 KiB UTF-8 bytes per file, 512 KiB aggregate source, 256 bytes per path and 128 KiB stdin. Only one operation is admitted; concurrent work rejects `BUSY`. The Worker and runtime have additional Phase 1 caps and gaps listed in [limitations](PHASE-1-LIMITATIONS.md).

Engine failures reject with `CEngineError { code, stage, message }`. Codes observed or emitted include `INVALID_REQUEST`, `LIMIT_EXCEEDED`, `NOT_READY`, `BUSY`, `DISPOSED`, `INVALID_ARTIFACT`, `INITIALIZATION_FAILED`, `WORKER_FAILED`, `PROTOCOL_ERROR`, and `TIMEOUT`. Syntax and link errors instead resolve a compilation result with `status: "error"`; a WebAssembly trap resolves execution status `trap`. No compiler instance or raw Wasm is exposed by the public facade.
