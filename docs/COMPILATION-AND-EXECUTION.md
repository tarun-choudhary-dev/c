# Compilation and execution semantics

## Compilation

`compile(request)` validates the shape, UTF-8 byte sizes, normalized paths, one or more `.c` files, one `entry`, and an allowlisted option set before sending anything to a Worker. A shorthand `source` becomes `main.c` (or its validated `filename`). Header files are data, not translation units. The engine creates a fresh virtual project root for every compile, mounts a read-only pinned WASI sysroot separately, writes user files under `/project`, compiles each `.c` file to a distinct Wasm object, then links those objects and pinned startup/libc libraries to a `wasm32-wasip1` command module. Clang's stage model and wasm-ld's object linking support this design, but the selected browser build's multi-file invocation is a Phase 1 gate. [Clang stages](https://clang.llvm.org/docs/CommandGuide/clang.html), [wasm-ld](https://lld.llvm.org/WebAssembly.html).

System headers resolve only from the pinned sysroot; quoted includes resolve relative to the including file, then within the admitted project root. No host disk, network include, or custom include path is available. C17 and `-O0` are initial baseline settings. Diagnostics from compilation and linking are normalized with a bounded raw transcript. Compiler failure is a **program-level** result and never yields an artifact. A successful link returns an opaque handle whose private bytes are checked for size and Wasm validity before storage. Compilation does not run `_start` or any user function.

```js
// CompilationResult
{
  status: "success" | "error",
  stage: "complete" | "compile" | "link",
  diagnostics: [/* normalized records */],
  rawDiagnostics: "bounded compiler/linker transcript",
  diagnosticsTruncated: false,
  artifact: { id: "opaque", generation: 4 } | null,
  durationMs: 0
}
```

Malformed requests reject `INVALID_REQUEST` and have no result. Compiler-reported source errors use `stage: "compile"`. `durationMs` uses a monotonic clock from admission to normalized completion. It is observational, not a CPU time limit. A process-level compiler fault, missing asset, malformed response, or timeout rejects with `CEngineError`; no partial artifact is retained.

## Execution

`execute(artifact, {stdin})` checks handle origin/generation, starts a fresh execution Worker, creates a minimal WASI Preview 1 import object, supplies stdin bytes on fd 0, bounded stdout and stderr sinks on fd 1/2, and invokes `_start`. No user project files are preopened by default; future runtime file access needs a separate explicit contract. Program `exit(n)`/return from `main` produces a normalized integer exit code when the host can observe it. A Wasm trap is recorded as a program failure with a sanitized trap message and `exitCode: null`. The Worker is retired after each execution. [WASI P1](https://wasi.dev/releases/wasi-p1), [browser WASI shim example](https://github.com/bjorn3/browser_wasi_shim).

```js
// ExecutionResult
{
  status: "exited" | "trap",
  stdout: "",
  stderr: "",
  exitCode: 0,        // integer for exited, null for trap
  durationMs: 0,
  error: null,         // { kind: "trap", message: "..." } for trap
  truncated: { stdout: false, stderr: false }
}

// RunResult
{
  status: "exited" | "trap" | "compile_error",
  compilation: { /* CompilationSummary: CompilationResult fields except artifact */ },
  execution: { /* ExecutionResult */ } | null,
  durationMs: 0
}
```

`run().compilation` is a `CompilationSummary`, with the same status, stage, diagnostics, transcript, truncation flag and duration as `CompilationResult` but **no `artifact` field**. This keeps `compile()`'s successful artifact guarantee intact while avoiding an unused handle from `run()`.

Output is decoded as UTF-8 with replacement for invalid sequences. Capture counts raw bytes before decoding. Each stream has a cap; once reached the host discards further bytes and sets its truncation flag. Execution may continue until exit or timeout, so output flooding cannot grow the result unbounded. A separate combined response cap includes diagnostics and metadata. `stdin` is finite and noninteractive; EOF follows the supplied bytes. Interactive input is out of scope for v1.

## Failure classification

| Situation | Contract | Worker outcome |
| --- | --- | --- |
| Syntax/type error, missing header, duplicate symbol, unresolved symbol | Resolved compilation `status: "error"`, diagnostics; `run` returns `compile_error` | Compiler remains reusable if protocol is healthy |
| `return 7` or `exit(7)` | Resolved execution `status: "exited", exitCode: 7` | Execution Worker retired |
| `unreachable`, out-of-bounds Wasm trap, unsupported guest behavior that traps | Resolved execution `status: "trap", exitCode: null` | Execution Worker retired |
| Invalid request, invalid artifact, wrong lifecycle | Rejected `CEngineError` with stable code | No program execution |
| Initialization/asset/protocol/Worker failure | Rejected `CEngineError`, recover or enter failed | Affected Worker terminated |
| Compile or execution timeout, cancellation, reset/disposal during work | Rejected `CEngineError` (`TIMEOUT`, `CANCELLED`, `RESET`, `DISPOSED`) | Active Worker terminated; generation invalidated except final disposal |

Cancellation is Worker termination, not promise cancellation alone. A deadline is measured by the manager outside the active Worker. Browser timer throttling means wall-clock bounds are best effort, while delivered termination stops the Worker. See [limits](RESOURCE-LIMITS.md), [lifecycle](LIFECYCLE.md), and [security](SECURITY-MODEL.md).
