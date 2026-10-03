# Preliminary resource limits

These are **proposed engine maxima**, not measured safe values. Phase 1 must benchmark the selected compiler and browser WASI host and adjust them before release. Count UTF-8 **bytes**, not JavaScript UTF-16 code units. Caller options may lower but not raise maxima. Structural validation happens before Worker transfer; the receiver independently enforces message/output budgets.

| Limit, proposed default/max | Purpose and enforcement | Failure | Guarantee and test |
| --- | --- | --- | --- |
| 128 KiB per source/header file; 512 KiB aggregate user files | Prevent oversized compile requests; manager and compiler Worker check encoded bytes | `LIMIT_EXCEEDED` before compile | Hard admission cap; boundary tests for multibyte UTF-8 |
| 32 files, at least one `.c` | Bound virtual FS nodes and object count; validator | `INVALID_REQUEST`/`LIMIT_EXCEEDED` | Hard; 0/1/32/33 file tests |
| 256 UTF-8 bytes per path, 16 path segments, aggregate path bytes within message cap | Bound path parsing and diagnostics; validator | `INVALID_REQUEST` | Hard; nested/path traversal tests |
| 128 KiB stdin | Bound per-run message and fd buffer; manager and execution Worker | `LIMIT_EXCEEDED` | Hard; exact cap and cap+1 tests |
| 128 KiB stdout and 128 KiB stderr | Bound collected output at WASI fd sink | Stream truncated flag; execution continues | Hard buffer cap, best-effort execution completion; flood test |
| 128 KiB compiler/linker transcript, 200 normalized diagnostics | Bound diagnostics and parsing | `diagnosticsTruncated: true`; preserve first diagnostics and terminal failure marker | Hard retained-data cap; flood and malformed diagnostic tests |
| 512 KiB combined public result/message payload | Bound postMessage/result memory; both message endpoints | `PROTOCOL_ERROR` for oversized inbound message; truncation for expected text | Hard retained/accepted cap; synthetic large-message test |
| 16 MiB linked Wasm artifact; 32 MiB total retained artifacts per engine | Bound in-memory output/cache | `LIMIT_EXCEEDED` for output; oldest artifact eviction then `INVALID_ARTIFACT` if used | Hard store cap; size and eviction tests |
| 30 s compilation deadline | Stop pathological compiler input; manager timer terminates compiler Worker | `TIMEOUT`, recovery | Best-effort wall time; infinite/slow compile test |
| 15 s execution deadline | Stop runaway C; manager timer terminates execution Worker | `TIMEOUT`, recovery | Best-effort wall time; infinite loop test |
| 120 s initialization deadline | Bound asset fetch/decode/Worker startup | `INITIALIZATION_FAILED` or `TIMEOUT`, state `failed` | Best-effort wall time; stalled asset test |
| 128 MiB single asset response (provisional) | Reject unexpected asset size before full decode where length is known; loader/manifest | `ASSET_ERROR` | Header check is best effort; stream counter is hard if loader supports streaming; oversized fixture test |
| 512 MiB observed runtime-memory budget (noncontractual) | Telemetry and warning only, if available | Browser may terminate Worker/tab | **Not a hard cap**. Measure peak compiler and execution memory in browsers; no ordinary JS per-Worker heap quota |

The 512 KiB message cap applies to untrusted protocol text/records, not the separately validated compiler asset or transferred Wasm artifact bytes. Binary transfers have their own 16 MiB artifact cap. Source and artifact sizes are checked at both boundaries; structured clone and intermediate compiler copies can temporarily consume substantially more memory than these values.

Timeouts are manager deadlines measured outside the busy Worker. `Worker.terminate()` stops a Worker when the browser processes the call, but tab suspension/throttling and main-thread contention can delay a timer. It is incorrect to promise a real-time 15-second guarantee. A Wasm module's memory maximum is enforceable only if its declaration/imports and host setup support a suitable cap; the chosen binary must be inspected. Compiler Wasm memory growth is likewise not assumed to be configurable. [Worker termination](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate).

Limits are centralized in one immutable internal configuration, surfaced as effective values via `getRuntimeInfo()` only after verification. Phase 1 should measure cold and warm compiler load, sysroot expansion, Wasm memory, object sizes, and browser behavior before these numbers become release defaults. Tests should verify both accepted boundary and one byte beyond it, plus recovery after each limit fault.
