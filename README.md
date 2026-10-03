# C Language Engine

C Language Engine is a reusable browser-based C compiler and execution engine for JavaScript applications. It is designed for integration into a separate IDE, but has no editor, terminal, UI, execution backend, routing or application persistence of its own.

**Status: Phase 2 lifecycle and validation complete in Edge 154; no distributable package or production security claim.** The provisional package name is `@tarun-choudhary/c-language-engine`; it remains private and npm availability and publishing are undecided. JavaScript is the engine implementation language, C is the program language, and the tested target is WebAssembly with WASI Preview 1.

The engine facade validates projects and owns lifecycle, Worker requests and opaque artifacts. A browser Worker hosts pinned Clang/LLD and a separate disposable Worker runs each linked C program through a WASI Preview 1 shim. `run()` compiles and executes; `compile()` returns an artifact for `execute()`. Phase 2 added [cancel/reset/disposal and concurrency rules](docs/PHASE-2-LIFECYCLE-AND-API.md), [validation and protocol checks](docs/PHASE-2-VALIDATION-AND-PROTOCOL.md), and a [review](docs/PHASE-2-REVIEW.md). The broader architecture remains in [Phase 0 research](docs/PHASE-0-COMPILER-RESEARCH.md) and [architecture](docs/ARCHITECTURE.md).

## Reproduce the browser proof

Install Node 24 and Microsoft Edge (or set `C_ENGINE_BROWSER` to a Chromium-compatible browser executable). On Windows, the test defaults to the standard Edge installation path.

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run test:browser
```

The test starts a loopback **static asset** server and a blank browser harness. Compilation and C execution happen in separate browser Workers; the server does not execute C. The test prints detailed JSON and fails on a failed check. The current [Phase 2 test results](docs/PHASE-2-TEST-RESULTS.md) record 50 passing checks in Edge, including the original 26 Phase 1 checks. Importing `src/index.js` from this repository is for local development only; packaging and independent IDE consumption are later work.

## Phase 2 documents

- [Lifecycle and implemented API](docs/PHASE-2-LIFECYCLE-AND-API.md)
- [Validation, limits and Worker protocol](docs/PHASE-2-VALIDATION-AND-PROTOCOL.md)
- [Actual test results](docs/PHASE-2-TEST-RESULTS.md)
- [Phase 2 review](docs/PHASE-2-REVIEW.md)

## Phase 1 documents

- [Implementation and reproduction](docs/PHASE-1-IMPLEMENTATION.md)
- [Pinned toolchain and runtime](docs/PHASE-1-TOOLCHAIN.md)
- [Worker protocol](docs/PHASE-1-WORKER-PROTOCOL.md)
- [Implemented API subset](docs/PHASE-1-API.md)
- [Actual test results](docs/PHASE-1-TEST-RESULTS.md)
- [Limits and security gaps](docs/PHASE-1-LIMITATIONS.md)
- [Phase 1 review](docs/PHASE-1-REVIEW.md)

## Phase 0 documents

- [Compiler and runtime research](docs/PHASE-0-COMPILER-RESEARCH.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Public API](docs/PUBLIC-API.md)
- [Compilation and execution](docs/COMPILATION-AND-EXECUTION.md)
- [Lifecycle](docs/LIFECYCLE.md)
- [Security model](docs/SECURITY-MODEL.md)
- [Resource limits](docs/RESOURCE-LIMITS.md)
- [Project filesystem](docs/PROJECT-FILESYSTEM.md)
- [Diagnostics and inspection](docs/DIAGNOSTICS-AND-INSPECTION.md)
- [Test strategy](docs/TEST-STRATEGY.md)
- [Distribution plan](docs/DISTRIBUTION-PLAN.md)
- [Project structure](docs/PROJECT-STRUCTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Phase 0 review](docs/PHASE-0-REVIEW.md)

The root [LICENSE](LICENSE) records that a project license is pending owner selection. Apache-2.0 is recommended in the distribution plan, but no grant is implied by that recommendation. Third-party licenses must be included with any future runtime assets.
