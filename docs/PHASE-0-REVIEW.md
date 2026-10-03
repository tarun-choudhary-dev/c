# Phase 0 review

_Reviewed: 2026-10-03. Status: **COMPLETE WITH OPEN DECISIONS**._

## Completed deliverables

Repository inspection found only Git metadata, so no user project files were modified. The requested thirteen design documents are present: [compiler research](PHASE-0-COMPILER-RESEARCH.md), [architecture](ARCHITECTURE.md), [public API](PUBLIC-API.md), [compilation and execution](COMPILATION-AND-EXECUTION.md), [lifecycle](LIFECYCLE.md), [security](SECURITY-MODEL.md), [limits](RESOURCE-LIMITS.md), [project filesystem](PROJECT-FILESYSTEM.md), [diagnostics](DIAGNOSTICS-AND-INSPECTION.md), [testing](TEST-STRATEGY.md), [distribution](DISTRIBUTION-PLAN.md), [structure](PROJECT-STRUCTURE.md), and [roadmap](ROADMAP.md). The root [README](../README.md), [LICENSE](../LICENSE) pending-decision notice, and [gitignore](../.gitignore) are also present. No compiler, runtime, frontend or package code was created.

## Decisions and rationale

- **Compiler/target:** Provisionally use a pinned browser-hosted Clang/LLD build from `browsercc` to produce single-threaded `wasm32-wasip1` command modules. Its own repository documents browser compilation and WASI execution, and its source exposes the compiler/linker invocation. This establishes the feasibility of the core browser model from primary project evidence; it is not a local validation of our final adapter. Stock `wasi-sdk` is useful for target sysroot and build reference but ships host compiler binaries, while TraceCC has an AGPL-3.0-only wrapper and fixed `-O0`. [browsercc](https://github.com/BertalanD/browsercc), [adapter source](https://github.com/BertalanD/browsercc/blob/main/index.ts), [wasi-sdk](https://github.com/WebAssembly/wasi-sdk), [TraceCC](https://github.com/tracecodeapp/tracecc).
- **Runtime:** A compiler Worker and a disposable per-execution Worker are separate. A private JavaScript WASI P1 host supplies only admitted imports and fds; browser Wasm alone does not supply WASI. The browser WASI shim documents the model and its incomplete call coverage, so exact compatibility must be tested. [WASI P1](https://wasi.dev/releases/wasi-p1), [browser shim](https://github.com/bjorn3/browser_wasi_shim).
- **API and lifecycle:** One active operation; `run()` compiles then executes; `compile()` returns an opaque artifact for `execute()`. Program errors resolve in typed results, engine faults reject with stable codes. Worker termination, generation IDs and stale-message checks define cancellation and recovery. [API](PUBLIC-API.md), [lifecycle](LIFECYCLE.md).
- **Security:** Worker-only local mode is explicitly weaker than hardened cross-origin iframe deployment. CPU deadlines and memory observations are not promised as strict browser quotas. [Security](SECURITY-MODEL.md), [limits](RESOURCE-LIMITS.md).
- **Multi-file:** The initial contract includes multiple `.c` sources and `.h` files; the browsercc convenience function alone does not demonstrate that flow. Phase 1 must prove use of its lower-level Clang/LLD entry points or select the fallback. [Filesystem](PROJECT-FILESYSTEM.md).

## Open technical questions and risks

1. **Exact selected distribution:** Pin version/hash, match sysroot and WASI host, inspect output imports/Wasm features, and verify runtime behavior in real target browsers. `browsercc` is a small independent project; release stability is not assumed.
2. **Multi-file implementation:** Demonstrate separate object compilation and one link using the selected browser build. This is a release gate; if it fails, use a maintained/reproducible alternative browser Clang build before implementation expands.
3. **WASI host coverage:** Test `stdio`, stdin/EOF, exit and relevant libc calls against actual generated modules. The examined shim warns that its Preview 1 implementation is incomplete.
4. **Resource behavior:** Measure asset transfer, cold/warm initialization, peak memory, timeout latency and Worker recovery. Approximate upstream asset sizes are not local benchmarks.
5. **Hardened origin:** Verify cross-origin iframe, Worker asset loading, CSP and message origin checks in supported browsers. Do not claim strong parent isolation before this gate.
6. **Distribution/legal:** Audit all embedded assets and notices; select the project license with owner approval. Apache-2.0 is a recommendation, not an existing grant. The npm scope/package name is provisional.

These are deliberate Phase 1 and pre-release gates. The **general essential feasibility** of in-browser C compilation and WASI execution is supported by existing browser toolchain projects, including an explicit C browser example in [Derle](https://github.com/senolgulgonul/derle) as well as the selected [browsercc](https://github.com/BertalanD/browsercc) model. The **exact engine integration is unverified** and must not be described as implemented or tested.

## Consistency and acceptance checklist

| Check | Phase 0 result |
| --- | --- |
| Browser compiler and generated-program execution model | Supported by primary project documentation; exact pinned build is a Phase 1 gate |
| Architecture matches selected target | Yes: browser Clang/LLD, P1 sysroot, separate WASI execution Worker |
| API, lifecycle and result contracts agree | Yes: one busy slot, `execute()` for artifacts, `run()` compilation summary, generation invalidation |
| Compilation distinct from execution | Yes: compile/link ends at opaque artifact; execution loads `_start` later |
| Cancellation and timeout feasible | Yes as Worker termination, with explicit browser scheduling limits |
| Resource-limit claims scoped to enforceability | Yes: admission/output caps hard; deadlines/memory qualified |
| Security boundary and limits stated | Yes: Worker baseline and separate-origin hardened deployment |
| Multi-file direction defined | Yes, with blocking feasibility test before release |
| Diagnostics grounded in compiler output | Yes: conservative Clang/LLD text parsing and raw transcript; SARIF not assumed stable |
| Independent IDE package strategy | Yes: ESM facade and self-hosted versioned assets, no development paths |
| Licensing decisions recorded | Yes: pending owner license and third-party audit |
| Roadmap dependencies coherent | Yes: browser proof before API integration; security before release |
| No prohibited implementation | Yes: documentation and root metadata only; no UI, backend or compiler engine code |

## Recommended Phase 1 starting task

In a disposable local browser harness, pin one `browsercc` distribution and one browser WASI host. Compile and run a C17 `stdio.h` Hello World in Workers, then compile two `.c` files with a local header and link/run the result. Record exact versions/hashes, imported functions, browser versions, output, diagnostics, exit codes, Worker termination/recovery, asset bytes, timings and license inventory. If any required proof fails, evaluate the documented browser Clang build fallback **before** building the public engine.

**Status: COMPLETE WITH OPEN DECISIONS.** Phase 0 contracts and research are complete. No Phase 1 work has begun; the listed integration and release gates remain open.
