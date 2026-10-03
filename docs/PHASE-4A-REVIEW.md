# Phase 4A review

_Reviewed 2026-10-03. Status: **PARTIAL — NOT COMPLETE; PRIVATE CANDIDATE ONLY**. This phase did not publish a package, replace compiler assets, change the public API, or begin Phase 4B._

## Delivered and important findings

- [Binary provenance](PHASE-4A-PROVENANCE.md) ties all 14 staged assets to locked npm inputs and immutable SHA-256 values. The recorded browsercc 0.1.1 source commit uses LLVM 20.1.2 and wasi-sdk 25. Of 1,516 packed sysroot files, 1,250 match the official wasi-sdk 25 archive byte for byte; its separate builtins archive also matches. The precise Emscripten generator revision remains unknown because the build recipe installs floating `emsdk latest` and the Wasm contains no producer metadata.
- [License closure](PHASE-4A-LICENSE-CLOSURE.md) maps wrapper, LLVM, Emscripten, wasi-libc, C++ runtime, builtins and browser WASI shim components to existing or added candidate notices. The packed `libc.a` contains `dlmalloc.o` and `fts.o`; notice references for these were added. Archive-member-level third-party notice mapping and exact Emscripten license revision remain open. The root `LICENSE` now contains AGPL-3.0 text from a tracked commit, contrary to earlier pending-license records; owner confirmation is pending. No project license was chosen or changed here.
- [Firefox investigation](PHASE-4A-FIREFOX-INVESTIGATION.md) located the 1,000 ms limit in the public engine execution call, including fresh Worker startup and runtime setup. Thirty focused Firefox executions and thirty each in Edge/Chrome all passed far below 1,000 ms. A repeated Firefox full-suite set exposed a separate intermittent compiler-driver `-###` parse error and a 120-second initialization outlier under concurrent host load. The Phase 3 execution timeout's exact cause remains unresolved. Deadlines and timeout/cancellation tests were preserved.
- [WebKit results](PHASE-4A-WEBKIT-RESULTS.md) record a suitable Debian 13.5 WSL2 host running Playwright WebKit 26.6 build 2359: **50/50** full checks and **11/11** integrity/consumer checks passed after a test-only correction for WebKit's logging of two intentional missing-asset 404s. Native Windows WebKit remained unable to launch; Safari itself was not tested.
- [Test results](PHASE-4A-TEST-RESULTS.md) record the clean install, asset/package verification, deterministic staging and serial Edge, Chrome, Firefox and Linux WebKit regressions. The public API, Worker separation, manifest hashes and runtime bytes were preserved. `src/worker/compiler.js` changed only its exceptional driver-parse error text to retain diagnostic context. `tests/browser/run.mjs` now distinguishes expected negative-test 404 console messages from unexpected errors. `tests/browser/firefox-reliability.mjs` is diagnostic only.

## Acceptance criteria

| Phase 4A criterion | Review result |
| --- | --- |
| Relevant binary provenance documented | **Partially met:** all asset hashes and package origin, SDK release file matches and source references recorded; original Clang/LLD binary build equivalence unresolved. |
| Exact Emscripten revision confirmed or evidence gap explicit | **Met as an investigation:** version remains **unresolved**; floating `latest`, missing build attestation and missing producer metadata are recorded. This is still a distribution blocker. |
| License/notice mapping complete where evidence supports it | **Partially met:** main texts and known wasi-libc subcomponents mapped; some archive member and generated runtime obligations unconfirmed. |
| Missing/uncertain redistribution obligations identified | **Met as an audit:** candidate is explicitly not declared compliant or publishable. |
| Firefox timeout diagnosed or explicitly unresolved | **Met as an investigation, not as a reliability fix:** precise deadline boundary and timing samples recorded; original cause unresolved. Separate parser/init failures are tracked. |
| WebKit tested on suitable host or blocked and untested | **Met for Playwright WebKit on Debian WSL2:** 50/50 and 11/11; native Windows blocked, Safari untested. |
| Existing suites intact and regressions recorded | **Met for observed runs:** all four browser builds passed the full 50-check suite, all four passed the 11-check integrity/consumer suite; failed investigative attempts are retained. |
| Packaging and asset verification pass | **Met:** clean install, all 14 runtime/package hashes, deterministic package bytes and isolated consumer passed. |
| Distribution-readiness assessment reflects blockers | **Met:** see [checklist](PHASE-4A-LICENSE-CLOSURE.md#distribution-readiness-checklist); candidate remains private. |

The open Emscripten provenance and notice obligations are critical, so Phase 4A is **not marked fully complete** despite successful functional browser checks. Owner licensing and intermittent Firefox failures are additional open decisions/risks. The tracked AGPL file is preserved pending clarification; it cannot be silently reconciled with the Phase 4A brief's pending-license statement.

## Remaining work and Phase 4B recommendation

Before public distribution, obtain upstream build evidence or create a controlled rebuild with a fixed emsdk revision and container digest; inspect LLVM and wasi-libc archive member notices against the exact sources; confirm how the owner intends the tracked AGPL text to apply; and characterize the intermittent Firefox failures with saved Clang `-###` transcripts and isolated host-load measurements. Re-run all package and browser gates after any binary migration.

For **Phase 4B**, follow the existing [security model](SECURITY-MODEL.md): design the separate-origin boundary and test its messaging and capability restrictions, then investigate hard memory/output controls without assuming Workers alone provide a sandbox. Keep the current engine API, manifest integrity checks and browser matrix as regression gates. This recommendation is a scope proposal, not authorization to start Phase 4B.
