# Phase 3 browser compatibility

_Measured on Windows 11 Pro build 26300 (`win32`), Node 24.19.0 and npm 11.17.0, in headless browsers on 2026-10-03. These are exact tested builds, not minimum supported versions._

| Browser | Exact version | Full Phase 1+2 suite | Focused Phase 3 integrity/package suite | Status |
| --- | --- | ---: | ---: | --- |
| Microsoft Edge | 154.0.4258.53 | 50/50 passed, 0 skipped | 11/11 passed, 0 skipped | Tested and passing |
| Google Chrome | 154.0.8037.97 | 50/50 passed, 0 skipped | Not run | Tested and passing for full regression suite |
| Mozilla Firefox | 155.0 (Playwright browser build) | 50/50 on a successful rerun; one run aborted at a 1,000 ms execution deadline | Not run | Tested, with an intermittent deadline failure |
| Playwright WebKit | Browser binary present but could not launch | 0 executed | 0 executed | **Not tested**: host lacks `icutu77.dll`, `brotlienc.dll`, `libxslt.dll` |

The unchanged-in-meaning 50-check baseline exercises Worker startup, Clang/LLD loading, Wasm compilation/linking, WASI program execution, stdout/stderr, exit codes, timeout, cancellation, reset, repeated runs, controlled Worker faults and stale-response handling. The 11-check Phase 3 suite uses real Workers for missing/corrupted assets and a `dist/`-only static consumer. Synthetic Worker stand-ins remain limited to the Phase 2 race/fault cases documented in [Phase 2 results](PHASE-2-TEST-RESULTS.md).

One Firefox run on the final code aborted inside the Phase 2 real-Worker fixture with `CEngineError: execute exceeded its deadline`; that fixture sets `executionTimeoutMs: 1000` for the whole sequence. Earlier Firefox runs and an immediate rerun passed 50/50. A separate Firefox timing run completed two ordinary executions in 80 ms and 75 ms wall time. The precise cause of the intermittent delay was not established; browser scheduling/Worker startup is a hypothesis, not a finding. Keep the 1,000 ms fixture unchanged and treat repeated-run stability as an open compatibility risk.

## Reproduce

First run `npm ci`, `npm run prepare:assets`, and `npm run build`. On Windows PowerShell:

```powershell
$env:C_ENGINE_TEST_SUMMARY='1'; npm run test:browser
$env:C_ENGINE_BROWSER='C:\Program Files\Google\Chrome\Application\chrome.exe'; npm run test:browser
Remove-Item Env:C_ENGINE_BROWSER
$env:C_ENGINE_BROWSER_ENGINE='firefox'; npm run test:browser
$env:C_ENGINE_BROWSER_ENGINE='webkit'; npm run test:browser
```

The default Chromium launcher uses the standard Edge path. `C_ENGINE_BROWSER_ENGINE` chooses Playwright's `chromium`, `firefox`, or `webkit` launcher; `C_ENGINE_BROWSER` supplies a concrete executable path. Firefox and WebKit require locally installed Playwright browser builds. To test WebKit on a suitable macOS or Linux host, install Playwright's WebKit browser and native prerequisites for that host, then use the same `C_ENGINE_BROWSER_ENGINE=webkit` command and report the exact engine/browser/OS versions and all 50 checks. The Windows launch failure above is an environment dependency gap, not a demonstrated engine incompatibility.

The matrix does not imply support for older browser versions, Safari itself, mobile browsers, hardened CSP deployments, or memory-bound workloads. A Worker is not a cross-origin security boundary. See [security model](SECURITY-MODEL.md) and [integrity limits](PHASE-3-INTEGRITY.md).
