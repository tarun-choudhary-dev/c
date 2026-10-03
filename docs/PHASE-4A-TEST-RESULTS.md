# Phase 4A test results

_Executed 2026-10-03. This records actual commands and outcomes, including failed investigative runs. The private candidate was not published. Windows host: Windows 11 Pro build 26300, Node 24.19.0, npm 11.17.0. Linux WebKit host: Debian 13.5 under WSL2, Node 20.19.2, `playwright-core@1.63.0`._

## Package, provenance and documentation gates

| Command | Actual result |
| --- | --- |
| `npm ci` | Passed; three locked npm packages installed. |
| `npm run prepare:assets` | Passed; 14 installed assets verified and staged with unchanged manifest hashes. |
| `npm run build` | Passed; 14 verified assets copied into private `dist/`. |
| `npm run verify:assets` | Passed; all 14 staged assets match the checked-in sizes and SHA-256 hashes. |
| `node scripts/verify-assets.mjs --dist` | Passed; all 14 package assets match, required notice files are present and forbidden development directories are absent. |
| `npm run test:packaging` | Passed twice-built byte comparison across **78** relative paths and SHA-256 values after all Phase 4A reports were included. |
| `node scripts/inspect-provenance.mjs` | Passed; inspected both Wasm custom-section lists (empty), sysroot groups and missing in-tar notices. |
| `python scripts/compare-sysroot.py <official-sysroot> <official-builtins>` | Passed; 1,250 packed files and the separate builtins archive match official wasi-sdk 25 release bytes; 265 LLVM-header/shim files remain outside that comparison. Official archive hashes are in [provenance](PHASE-4A-PROVENANCE.md). |
| `npm run test:docs` | Final rerun passed: **155** local links in **43** Markdown files. An earlier intermediate run failed because this report had not yet been written. |

`npm ci` is a package install, not a source rebuild of browsercc. `test:packaging` proves repeatability of local staging from the same pinned package bytes, not reproducibility of LLVM/Emscripten compilation.

## Browser regression matrix

| Browser / exact version | Environment | Full existing suite | Integrity and isolated `dist/` suite | Notes |
| --- | --- | ---: | ---: | --- |
| Microsoft Edge 154.0.4258.53 | Windows 11 | **50/50**, 0 skipped | **11/11**, 0 skipped | Passed after clean install and Phase 4A test harness change. |
| Google Chrome 154.0.8037.97 | Windows 11 | **50/50**, 0 skipped | **11/11**, 0 skipped | Explicit executable path. |
| Mozilla Firefox 155.0, Playwright build | Windows 11 | **50/50**, 0 skipped on final regression | **11/11**, 0 skipped | Additional intermittent investigative failures are recorded below. |
| Playwright WebKit 26.6, build 2359 | Debian 13.5 WSL2 native filesystem | **50/50**, 0 skipped | **11/11**, 0 skipped | Earlier WebKit 49/50 was caused by expected missing-asset 404 console logging; see [WebKit record](PHASE-4A-WEBKIT-RESULTS.md). |
| Playwright WebKit build 2359 | Windows 11 | **0 executed** | **0 executed** | Native DLL dependency check and browser launch failed; Linux run above provides WebKit coverage. |

The full suite uses real separate compilation/execution Workers for the Phase 1 and real Phase 2 cases, plus synthetic Workers for the Phase 2 communication/race cases. The focused suite uses real Workers for asset corruption/missing-asset cases and a static server rooted solely in `dist/` for the consumer check. No UI or backend C execution service was used.

Run on Windows PowerShell after the package gates:

```powershell
$env:C_ENGINE_TEST_SUMMARY='1'
npm run test:browser
npm run test:assets
$env:C_ENGINE_BROWSER='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:browser
npm run test:assets
Remove-Item Env:C_ENGINE_BROWSER
$env:C_ENGINE_BROWSER_ENGINE='firefox'
npm run test:browser
npm run test:assets
```

For the Debian WebKit setup and commands see [WebKit results](PHASE-4A-WEBKIT-RESULTS.md). The native WSL copy was created from the same project bytes; rebuilt `dist/` files were copied into that native workspace before its 11-check run.

## Reliability probes and failed runs

`tests/browser/firefox-reliability.mjs` ran 30 serial executions each in Firefox, Edge and Chrome, all with the unchanged public `executionTimeoutMs: 1000` and a fresh execution Worker per run. All **90/90** returned exit code zero. Firefox page wall median/p95/max was **73/102/135 ms**; Edge **65/90/96 ms**; Chrome **76/131/136 ms**. The [Firefox investigation](PHASE-4A-FIREFOX-INVESTIGATION.md) records Worker-internal and outside-Worker timings and the limits of attribution.

Before the final serial regression, five Firefox full-suite attempts were made while the host also installed WSL WebKit dependencies. Three passed 50/50. One aborted after engine reset with a `WORKER_FAILED` compiler-driver parse error (“Expected 1 Clang frontend commands, got 2”); one aborted at the 120,000 ms **initialization** deadline. Neither is the Phase 3 1,000 ms execution failure. The original Phase 3 execution timeout remains a distinct unresolved observation. A diagnostic transcript was added to the exceptional compiler-driver error for future recurrence without changing normal compilation behavior. No result from these aborted runs is represented as a passed check.

Three further serial Firefox full-suite runs after WSL setup passed **50/50 each** in 64.7, 63.7 and 78.8 seconds. They add repeated passing evidence but do not erase the earlier aborted attempts.

The first WebKit run from the mounted Windows filesystem aborted at the Phase 2 1,000 ms execution deadline. The first completed run from WSL native storage scored 49/50 because WebKit logged the two deliberate `/missing-assets/index.js` 404 responses as console errors. Captured HTTP responses confirmed the exact two expected URLs. The harness now rejects any unexpected page error, console error or HTTP error while allowing only those expected missing-asset messages; the next native-storage WebKit run passed 50/50. The separate 11-check WebKit integrity/package suite passed. See [WebKit results](PHASE-4A-WEBKIT-RESULTS.md) for host restrictions.

## Final gate status

The existing public API and 1,000 ms Phase 2 test deadline remain unchanged. All four available browser engines passed a full suite in their tested host setup, and all four passed the integrity/package suite. These results do **not** settle intermittent Firefox reliability, exact Emscripten provenance, complete notices, owner project licensing, Safari support or release security. [Phase 4A review](PHASE-4A-REVIEW.md) tracks those blockers.
