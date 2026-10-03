# Phase 1 review

_Reviewed 2026-10-03. Status: **COMPLETE FOR RUNTIME PROOF OF CONCEPT**._

## Completed deliverables

- Pinned browsercc 0.1.1 and browser WASI shim 0.4.2; recorded Clang/LLD 20.1.2 build identity and required asset hashes in [toolchain record](PHASE-1-TOOLCHAIN.md).
- Built a private compiler Worker that loads the sysroot, compiles C17 `.c` files to objects and links a WASI Preview 1 command. A separate, disposable execution Worker loads the result and captures stdin/stdout/stderr/exit/traps.
- Added a minimal, framework-independent `CEngine` facade with opaque artifacts, state checks, structured errors and timeouts. [Implemented API](PHASE-1-API.md) and [Worker protocol](PHASE-1-WORKER-PROTOCOL.md) describe the actual subset.
- Added a static local test server and real-browser test runner without a frontend. Clean install and **26/26 Edge checks passed**, including Hello World, multi-file/header, compile/link failures, stderr, nonzero exit, stdin, trap, output cap, malformed runtime input and timeout followed by a working run. [Detailed results](PHASE-1-TEST-RESULTS.md).
- Recorded security controls, gaps and deferred work in [limitations](PHASE-1-LIMITATIONS.md). No backend compiler/executor was introduced.

## Decision changes and consequences

The Phase 0 browsercc recommendation was retained, but its convenience `compile()` was unsuitable for C17 because it invokes `clang++`. The private Worker uses browsercc's lower-level Clang/LLD exports and driver `-###` output. This proves the desired model while increasing sensitivity to upstream layout changes. The adapter exports `main` during linking to make missing-entry programs fail at link time; this extra Wasm export should be reviewed in a later linker policy. Multi-file linking passed a focused case, not a broad compatibility suite.

The Phase 0 roadmap placed the public facade in Phase 2, while the Phase 1 assignment explicitly requested a minimal framework-independent API boundary. That is why this proof includes `CEngine` ahead of the roadmap, without treating it as the completed API. Phase 0's proposed full API includes `reset()` and `cancel()`; those methods remain explicit Phase 2/later work. No claim is made that the complete Phase 0 lifecycle contract is implemented. Asset loading still points into repository `node_modules` and is not a package distribution.

The Phase 0 project-filesystem design calls for a distinct `/project` root and deterministic sorted source order. This proof places validated relative project paths in a fresh compiler in-memory filesystem root and compiles `.c` files in request order. The tested local header and two-file link work, but exact root isolation, include search ordering and deterministic object naming are still implementation work. No project files are exposed to the execution Worker.

## Acceptance check

| Phase 1 criterion | Result |
| --- | --- |
| Browser-compatible Clang/LLD verified | **Met** in Edge 154 with pinned browsercc 0.1.1; Clang/LLD report 20.1.2. |
| C compiles to intended WASI target | **Met** for tested C17 programs; triple `wasm32-unknown-wasi`, P1 imports and `_start` verified. |
| Browser execution Worker runs output | **Met**; Hello World output and exit 0 observed. |
| stdout, stderr and exit separate | **Met**; direct tests and facade tests. |
| Separate compiler/execution boundaries | **Met**; independent module Workers and per-run execution Worker. |
| Basic errors tested | **Met**; syntax, link, invalid binary, runtime init failure, trap, Worker initialization failure, timeout. |
| No frontend or execution backend | **Met**; blank browser test document and loopback static asset server only. |
| Accurate documentation and risks | **Met** in this Phase 1 document set. |

## Open decisions and risks

The hardened origin boundary, CSP, asset packaging/integrity, complete LLVM/sysroot license inventory, project license, cross-browser support, memory behavior, broader WASI coverage, diagnostic caps, full reset/cancel semantics and strong protocol validation remain open. These are release gates, not grounds for claiming Phase 1 did more than its proof target. A future supported-browser matrix may reveal a toolchain or shim incompatibility.

## Recommended Phase 2 starting task

Keep the verified compiler/runtime adapters, then implement and unit-test the complete Phase 0 state machine and API contract around them, beginning with `reset()`, `cancel()`, artifact invalidation, stale-response rejection and all input/result size caps. Make the asset location an explicit versioned internal manifest before independent consumer testing. Do not begin optional inspection or IDE integration until the core contract is stable.

**Status: COMPLETE FOR RUNTIME PROOF OF CONCEPT.** This does not assert production readiness or release security.
