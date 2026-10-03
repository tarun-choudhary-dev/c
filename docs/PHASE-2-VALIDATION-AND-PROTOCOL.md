# Phase 2 validation, limits, and Worker protocol

## Public input validation

Validation runs in `CEngine` before compilation or execution. Constructor mistakes throw `TypeError`; asynchronous method misuse rejects `CEngineError`. Missing fields are not silently converted to strings. `source` and `files` are mutually exclusive. A shorthand `source` must contain non-whitespace text; a multi-file project may have an empty auxiliary file but needs at least one nonempty `.c` source. There must be 1–32 `.c`/`.h` files, at most 128 KiB UTF-8 bytes each and 512 KiB aggregate. `filename` defaults to `main.c` only for shorthand source. `entry` defaults to the first `.c` file and, when supplied, must exactly name a `.c` file. It does not move or synthesize `main`.

Project paths must be NFC already, relative with `/`, at most 16 segments and 256 UTF-8 bytes, and free of empty, `.` or `..` segments, control characters, backslashes, colons and double quotes. The root prefixes `lib`, `include`, `tmp`, `dev`, `proc` are reserved for the compiler environment. Case-insensitive duplicate paths reject. Double quotes are rejected because the pinned Clang driver arguments are parsed from its quoted `-###` output; allowing a quote in a path could misparse that private protocol. This is a toolchain-specific Phase 2 validation rule, not a claim that Clang cannot process such filenames in general.

Compiler options are exactly `standard: "c17"`, `optimization: "O0"`, and `warnings: "default" | "all"`, with those values as defaults. Arbitrary flags are not accepted. `compile()` does not accept `stdin`; `run()` does. `execute()` accepts only `{stdin?}` as its second argument. Stdin must be a string of at most 128 KiB UTF-8 bytes, default `""`. Unknown request and runtime option keys reject `INVALID_REQUEST`; invalid or old artifacts reject `INVALID_ARTIFACT`.

Constructor `limits` may lower, but never raise, the following defaults/maxima. All values must be positive safe integers; unknown limit names, zero, fractional, nonnumeric and above-maximum values throw `TypeError`.

`initialize()`, `cancel()`, `reset()` and `dispose()` take no arguments. Passing any argument rejects `INVALID_REQUEST` before changing lifecycle state. This applies even when a call would otherwise be idle or idempotent.

| Limit key | Default/max | Enforcement |
| --- | ---: | --- |
| `initializationTimeoutMs` | 120,000 | Main-thread deadline; terminate compiler Worker on timeout |
| `compilationTimeoutMs` | 30,000 | Main-thread deadline; terminate compiler Worker and attempt recovery |
| `executionTimeoutMs` | 15,000 | Main-thread deadline; terminate execution Worker |
| `stdoutBytes` | 131,072 | Execution Worker fd 1 retained-byte cap; excess sets truncation flag |
| `stderrBytes` | 131,072 | Execution Worker fd 2 retained-byte cap; excess sets truncation flag |

The compiler Worker retains at most 128 KiB of diagnostic transcript and at most 200 normalized records; it sets `diagnosticsTruncated` if either bound is exceeded. This is implemented, but a diagnostic-flood boundary test has not been run. A compiled Wasm artifact over 16 MiB rejects `LIMIT_EXCEEDED` before storage; the Worker may have already created/transferred it. There is no total retained-artifact budget, combined message cap, hard Worker memory limit or hard real-time CPU bound yet. The older [Phase 0 limits](RESOURCE-LIMITS.md) are design proposals where they exceed this implemented subset.

## Internal Worker message contract

Protocol version remains 1. The parent sends `{protocolVersion:1, generation, requestId, kind, payload}`. The compiler Worker accepts `initialize` and `compile`; a fresh execution Worker accepts `execute` with `{wasm, stdin, limits:{stdoutBytes,stderrBytes}}`. The two output keys were added to the Phase 1 execution payload without changing the envelope. Workers answer `initializeResult`, `compileResult`, `executionResult`, or `error` with the same version, generation and request ID. The parent checks the expected kind, response shape, diagnostic/output byte bounds, and an allowlist of Worker error codes/stages. A malformed active response, `messageerror`, failed `postMessage`, or Worker `error` event rejects a structured error. A different request ID is treated as a stale response and ignored.

```js
// An execution request after Phase 2 validation
{ protocolVersion: 1, generation: 4, requestId: 17, kind: "execute",
  payload: { wasm: Uint8Array, stdin: "", limits: { stdoutBytes: 131072, stderrBytes: 131072 } } }
```

The parent assigns a new request ID to every initialization, compilation and execution stage. The Worker echoes the generation; the parent owns its authoritative value. On cancellation, reset, timeout or Worker fault, the parent removes active listeners/timer, terminates the affected Worker, advances generation and invalidates artifact handles. Direct messages to a Worker are private integration details, not a supported public API. Full nested-protocol fuzzing, a combined message cap, and a hostile Worker threat model remain later work.

## Public error classification

`CEngineError` exposes `{name:"CEngineError", code, stage, message, requestId, cancelled}`. `requestId` is `null` when an error occurred before a Worker request; `cancelled` is true only for `CANCELLED`. These fields are stable enough for callers to branch on `code` and `stage`; message wording and internal Worker stack traces are not compatibility guarantees.

| Code | Meaning |
| --- | --- |
| `INVALID_REQUEST`, `LIMIT_EXCEEDED`, `INVALID_ARTIFACT` | Validation or admitted byte-limit failure |
| `NOT_READY`, `BUSY`, `DISPOSED`, `RESET` | Lifecycle/replacement condition |
| `CANCELLED`, `TIMEOUT` | Interrupted operation; never a program exit code |
| `INITIALIZATION_FAILED` | Toolchain or runtime initialization failure |
| `WORKER_FAILED` | Worker startup/uncaught error or internal Worker failure |
| `PROTOCOL_ERROR` | Malformed, incompatible or uncloneable Worker communication |

_Phase 3 addendum:_ Verified asset size/hash or manifest-schema failures now use `ASSET_ERROR` at `initialization` or `runtime-initialization`; missing asset fetches retain `INITIALIZATION_FAILED` with an asset-specific message. See [integrity contract](PHASE-3-INTEGRITY.md). The Phase 2 table above records the codes present at that phase.

Clang syntax/type errors and LLD link errors remain resolved compilation results with `stage: "compile"` or `"link"` and preserved bounded `rawDiagnostics`; nonzero C exits remain resolved execution results; WebAssembly traps remain resolved `status: "trap"`. Disposal is synchronous resource termination exposed through a resolved promise; ordinary `Worker.terminate()` does not return a cleanup error. A browser process crash may bypass JavaScript cleanup entirely and is outside this contract.
