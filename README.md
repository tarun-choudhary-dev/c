# C Language Engine

C Language Engine is a reusable browser-based C compiler and execution engine for JavaScript applications. It is designed for integration into a separate IDE, but has no editor, terminal, UI, execution backend, routing or application persistence of its own.

**Status: Phase 3 verified local distribution candidate; no public release or production security claim.** The provisional package name is `@tarun-choudhary/c-language-engine`; it remains private and npm availability and publishing are undecided. JavaScript is the engine implementation language, C is the program language, and the tested target is WebAssembly with WASI Preview 1.

The engine facade validates projects and owns lifecycle, Worker requests and opaque artifacts. A browser Worker hosts pinned Clang/LLD and a separate disposable Worker runs each linked C program through a WASI Preview 1 shim. `run()` compiles and executes; `compile()` returns an artifact for `execute()`. Phase 3 stages and hashes [versioned compiler/runtime assets](docs/PHASE-3-ASSET-MANIFEST.md). The existing [cancel/reset/disposal contract](docs/PHASE-2-LIFECYCLE-AND-API.md) and [validation/protocol contract](docs/PHASE-2-VALIDATION-AND-PROTOCOL.md) remain in force. The broader architecture remains in [Phase 0 research](docs/PHASE-0-COMPILER-RESEARCH.md) and [architecture](docs/ARCHITECTURE.md).

## Reproduce the browser proof

Install Node 24 and Microsoft Edge (or set `C_ENGINE_BROWSER` to a Chromium-compatible browser executable). On Windows, the test defaults to the standard Edge installation path.

```powershell
npm ci
npm run prepare:assets
npm run verify:assets
npm run test:browser
npm run build
node scripts/verify-assets.mjs --dist
npm run test:assets
npm run test:packaging
```

The tests start a loopback **static asset** server and a blank browser harness. Compilation and C execution happen in separate browser Workers; the server does not execute C. `test:browser` prints detailed JSON and fails on a failed check; set `C_ENGINE_TEST_SUMMARY=1` for compact output. The [Phase 3 test results](docs/PHASE-3-TEST-RESULTS.md) record 50 passing regression checks in Edge and Chrome, and a passing Firefox rerun after one intermittent 1,000 ms timeout. Focused integrity and isolated `dist/` consumer checks also passed. The package is still private because the [license audit](docs/PHASE-3-LICENSE-AUDIT.md) has open distribution blockers.

## Phase 3 documents

- [Asset manifest and versions](docs/PHASE-3-ASSET-MANIFEST.md)
- [Integrity checks and trust limits](docs/PHASE-3-INTEGRITY.md)
- [Packaging workflow](docs/PHASE-3-PACKAGING.md)
- [Dependency and license audit](docs/PHASE-3-LICENSE-AUDIT.md)
- [Browser compatibility](docs/PHASE-3-BROWSER-COMPATIBILITY.md)
- [Performance baseline](docs/PHASE-3-PERFORMANCE.md)
- [Actual test results](docs/PHASE-3-TEST-RESULTS.md)
- [Phase 3 review](docs/PHASE-3-REVIEW.md)

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
