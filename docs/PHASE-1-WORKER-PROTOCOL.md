# Phase 1 Worker message protocol

Version 1 is an internal structured-clone protocol between `src/index.js` and the two module Workers. It is not a public package contract.

```js
// Parent -> compiler Worker
{ protocolVersion: 1, generation: 1, requestId: 42, kind: "initialize", payload: { assetBaseUrl } }
{ protocolVersion: 1, generation: 1, requestId: 43, kind: "compile", payload: { files, entry, options } }

// Parent -> new execution Worker
{ protocolVersion: 1, generation: 1, requestId: 44, kind: "execute", payload: { wasm: Uint8Array, stdin: "" } }

// Worker -> parent
{ protocolVersion: 1, generation: 1, requestId: 44, kind: "executionResult", result: { /* see API */ } }
{ protocolVersion: 1, generation: 1, requestId: 44, kind: "error",
  error: { code: "INVALID_REQUEST", stage: "runtime-input", message: "..." } }
```

`initializeResult` reports target, Clang/LLD version strings, sysroot byte size and initialization timing. `compileResult` has `status`, `stage`, normalized diagnostics, `rawDiagnostics`, `durationMs`, target triple, import/export descriptions, linker arguments and, on success, transferable `Uint8Array` Wasm bytes. The facade retains the bytes privately and returns an opaque artifact. `executionResult` has status `exited` or `trap`, stdout/stderr, exit code, duration, optional trap error and separate output truncation flags. Infrastructure errors use the `error` envelope and reject the facade promise.

The parent matches `requestId`, expects the response kind for the active operation, checks protocol version and runtime generation, and retires a Worker on a communication fault. Responses to other request IDs are ignored. The direct Worker test verifies distinct IDs, unknown-kind rejection and an initialization failure; malformed/stale response injection and size fuzzing are deferred. Compilation uses one active facade operation; no Worker pool or queue exists. Each execution starts a fresh Worker, which is terminated after its response or deadline.

Known Phase 1 protocol limitations: Worker code echoes a supplied generation rather than owning a cryptographically trustworthy generation; the parent is the authoritative gate. Worker input schemas are minimal because the public facade validates normal calls. A direct message to the Worker is internal and must not be treated as a safe public API. Compiler transcript and transferred binary size are not yet capped in both directions. A future protocol must bound all payloads and reject malformed nested records before using them.
