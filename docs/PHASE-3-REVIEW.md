# Phase 3 review

_Reviewed 2026-10-03. Status: **COMPLETE FOR VERIFIED LOCAL ASSETS AND MEASURED BROWSER BASELINES; NOT DISTRIBUTION-READY**._

## Decisions and delivered work

The existing browsercc 0.1.1 / Clang-LLD 20.1.2 / WASI Preview 1 architecture and Phase 2 public API remain intact. The engine now loads a versioned local `runtime/` tree instead of importing npm paths. A checked-in [asset manifest](../asset-manifest.json) records 14 required asset sizes and SHA-256 hashes. Installed npm inputs, staged files, packaged files and browser-fetched files are checked before use. The compiled Wasm compiler binaries are supplied as verified bytes. `ASSET_ERROR` reports changed bytes or invalid manifest data separately from C diagnostics; missing assets retain `INITIALIZATION_FAILED` with an asset-specific message. The runtime shim is checked before execution.

The local [packaging process](PHASE-3-PACKAGING.md) builds an isolated `dist/` consumer candidate and produces deterministic file bytes from the pinned npm inputs. Edge and Chrome passed the complete 50-check browser suite; Firefox passed on a rerun after one intermittent 1,000 ms execution deadline abort. The focused Edge integrity/package suite passed 11 checks. WebKit was attempted but could not launch on the available Windows host. The [performance baseline](PHASE-3-PERFORMANCE.md) includes one Edge and one Firefox local run, with no memory measurement.

## Completion checklist

| Criterion | Result |
| --- | --- |
| Compiler/runtime inventory and exact asset hashes | Met: 14 required assets in checked-in manifest, installed/staged/package verification passed. |
| Integrity process and failure/recovery checks | Met for measured mismatch, missing, bad manifest, reset and execution retry cases; [trust limits](PHASE-3-INTEGRITY.md) remain. |
| Clean installation and repeatable candidate package | Met for `npm ci`, staging, package verification, two-build byte comparison and dist-only consumer. Source rebuild equivalence is unresolved. |
| Dependency/license audit | Met as an [inventory with explicit blockers](PHASE-3-LICENSE-AUDIT.md); **not** release compliance. |
| Available browser measurements and support matrix | Met for Edge and Chrome; Firefox measured with an intermittent timeout; WebKit not measured because host dependencies are missing. |
| Performance baseline | Met for one reproducible loopback Edge procedure; no cross-browser or memory baseline. |
| Existing Phase 1/2 tests preserved | Met: 50/50 passed in Edge after clean install and in Chrome; Firefox passed 50/50 on rerun but one run aborted at the fixture's 1,000 ms execution deadline. |
| Phase 3 focused tests | Met: 11/11 Edge checks and package/hash checks passed. |
| No IDE/frontend/backend or publication | Met. |

## Open risks and release blockers

The manifest and assets are replaceable together; there is no signature or trusted CDN boundary. Browser JS `fetch` verification and subsequent `import()` have a change window. Worker-only execution shares origin-level capabilities and has no hard memory bound. Real forced termination in the middle of Clang compilation remains unverified. Firefox showed one intermittent 1,000 ms execution deadline abort in the full suite; its cause and frequency are unresolved. Browsercc's source build uses unpinned Emscripten `latest`, so these npm bytes are pinned but not independently rebuilt from source. The sysroot tar omits license notices and the packed contents have not been mapped completely to source notice obligations. The project's own [license decision](../LICENSE) remains with the owner. **Do not publish this candidate package until provenance, notices and owner licensing are resolved.**

## Recommended Phase 4 starting task

Establish a release-grade provenance and notice inventory for the exact compiler and sysroot bytes, then design the separate-origin integration boundary and assess hard memory/output limits. Keep the existing API and three-browser regression suite as gates. Validate WebKit on a host with its native dependencies before claiming Safari/WebKit support.

**Phase 3 status: COMPLETE.** The candidate package remains private and is **not distribution-ready**.
