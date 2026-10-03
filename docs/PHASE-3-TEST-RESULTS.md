# Phase 3 test results

_Windows 11 Pro build 26300, Node 24.19.0, npm 11.17.0, 2026-10-03. Results below were actually executed; counts are browser checks, not inferred feature support. The original 26 Phase 1 checks and all 24 Phase 2 additions remain in `tests/browser/run.mjs`._

| Command / check | Actual result |
| --- | --- |
| `npm ci` | Passed; 3 packages installed, 4 audited, 0 npm audit findings. |
| `npm ls --all --depth=1` | `browsercc@0.1.1`, `@bjorn3/browser_wasi_shim@0.4.2`, `playwright-core@1.63.0`; no separately installed transitive package listed. |
| `npm run prepare:assets` | Passed; 14 installed files matched the checked-in manifest and were staged. |
| `npm run verify:assets` | Passed; 14 staged files matched expected SHA-256 and sizes. |
| `npm run build` and `node scripts/verify-assets.mjs --dist` | Passed; candidate package built, 14 asset hashes and required files verified, optional PCH and development trees excluded. |
| `npm run test:packaging` | Passed; two builds produced equal relative file sets and SHA-256 digests. See [packaging](PHASE-3-PACKAGING.md) for the final file count. |
| `npm run test:docs` | Passed; 126 local links in 36 Markdown files resolved. |
| Edge 154.0.4258.53, full suite | **50/50 passed, 0 failed, 0 skipped**; repeated after clean `npm ci`. |
| Chrome 154.0.8037.97, full suite | **50/50 passed, 0 failed, 0 skipped**. |
| Firefox 155.0, full suite | **50/50 passed, 0 failed, 0 skipped on the successful rerun**. One separate run aborted with `execute exceeded its deadline` in the Phase 2 real-Worker fixture using a 1,000 ms limit; that run did not produce a complete check count. |
| WebKit, full suite | **0 executed**; launcher failed before a page opened due to missing Windows DLLs: `icutu77.dll`, `brotlienc.dll`, `libxslt.dll`. |
| Edge Phase 3 integrity/package suite | **11/11 passed, 0 failed, 0 skipped**. |
| Edge performance procedure | Completed with valid Hello World stdout and exit code on both executions; exact timings in [performance baseline](PHASE-3-PERFORMANCE.md). |
| Firefox performance procedure | Completed with two valid Hello World executions; 80 ms and 75 ms page wall time. See [performance baseline](PHASE-3-PERFORMANCE.md). |

The 11 focused checks include verified initialization, a corrupted compiler JS file, same-engine `reset()` recovery, a missing sysroot, an incorrect expected hash, an invalid manifest, retry after missing asset, a corrupted runtime shim file, successful re-execution after repair, independent `dist/` consumer execution, and no page errors. Those failures were injected by the local static test server; the browser used real module Workers. The packaged consumer loaded only `dist/`, with no `node_modules` route available.

The full browser suite covers timeout, cancellation, reset, repeated execution, output capture, nonzero exit and Worker communication. Its controlled Worker stand-ins test precise races/faults; see [Phase 2 results](PHASE-2-TEST-RESULTS.md). No production memory quota, hostile-origin isolation, or source-to-binary rebuild equivalence was tested.

## Reproduction

Use the [packaging commands](PHASE-3-PACKAGING.md) and [browser matrix commands](PHASE-3-BROWSER-COMPATIBILITY.md). `C_ENGINE_TEST_SUMMARY=1` gives counts while the default emits the individual check records. The focused integrity command is `npm run test:assets`; the asset verifier and determinism test are separate Node commands. No backend compilation/execution service is involved.
