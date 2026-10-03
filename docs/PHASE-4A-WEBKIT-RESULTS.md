# Phase 4A WebKit results

_Tested 2026-10-03 on Debian GNU/Linux 13.5 (trixie) under WSL2, Linux kernel 6.18.33.2, x86-64, Node 20.19.2, `playwright-core@1.63.0`, headless Playwright WebKit **26.6**, browser build **2359**. The project was copied from the mounted Windows workspace to the WSL native filesystem before the successful run._

| Attempt | Full 50-check suite | Finding |
| --- | --- | --- |
| Windows 11 Pro build 26300, installed WebKit build 2359 | 0 executed | Playwright's host check reported `brotlienc.dll` missing even though a copy exists in the browser directory. With `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`, `Playwright.exe` immediately exited with code `3236495362`. Windows WebKit is **environment-blocked**, not validated. |
| Debian WSL2, first completed run | 49/50, 0 skipped | Functional compilation, execution and lifecycle checks passed. `noPageErrors` failed because WebKit logged two generic 404 console errors from deliberate `/missing-assets/index.js` requests. Network response capture confirmed exactly two 404s at that expected URL. |
| Debian WSL2, test harness corrected | **50/50 passed, 0 failed, 0 skipped** | The `noPageErrors` check now accepts only those expected 404 console messages when the HTTP responses are exactly for `/missing-assets/index.js`; unexpected page errors, console errors or HTTP errors still fail. No engine API, deadline or asset hash changed. |

The separate Phase 3 integrity and isolated `dist/` consumer suite also passed **11/11, 0 skipped** on this Debian WebKit build after copying the rebuilt `dist/` into the native WSL workspace. Its checks include corrupt/missing compiler and runtime assets, bad manifest/hash, recovery and an independent static consumer. No page errors were reported.

The 50 checks cover the existing Phase 1 and Phase 2 direct-Worker, public API, compilation, stdout/stderr, exit, trap, timeout, cancellation, reset, malformed-message and lifecycle scenarios. See [Phase 4A test results](PHASE-4A-TEST-RESULTS.md) for the cross-browser matrix. A Playwright WebKit run is evidence for this WebKit build on this Linux host; it is **not** a Safari release test, an iOS test, or proof of Windows WebKit compatibility. The first WSL run directly from the mounted Windows filesystem aborted at the Phase 2 fixture's 1,000 ms execution deadline. Moving the same workspace bytes to native WSL storage removed that particular environmental factor for the completed runs, but one passing run does not establish a stable cross-host latency guarantee.

## Reproduce on Debian 13 / WSL2

Prepare the repository on Windows (`npm ci`, `npm run prepare:assets`, `npm run build`), then use a Debian WSL2 installation with Linux Node 20 or newer. The following commands assume the repository is visible at `/mnt/a/Github/c` and a **new** `/home/debian/c-phase4a` path; adapt both paths to the host. They do not change project source.

```powershell
wsl -u root -e sh -lc 'apt-get update && apt-get install -y nodejs'
wsl -u root -e sh -lc 'cd /mnt/a/Github/c && /usr/bin/node node_modules/playwright-core/cli.js install-deps webkit'
wsl -e sh -lc 'cd /mnt/a/Github/c && /usr/bin/node node_modules/playwright-core/cli.js install webkit'
wsl -e sh -lc 'test ! -e /home/debian/c-phase4a && cp -a /mnt/a/Github/c /home/debian/c-phase4a'
wsl -e sh -lc 'cd /home/debian/c-phase4a && C_ENGINE_BROWSER_ENGINE=webkit C_ENGINE_TEST_SUMMARY=1 /usr/bin/node tests/browser/run.mjs'
```

On a normal Linux checkout, use `npm ci`, `npm run prepare:assets`, `npm run build`, `node node_modules/playwright-core/cli.js install --with-deps webkit` (native package manager privileges may be needed), and `C_ENGINE_BROWSER_ENGINE=webkit C_ENGINE_TEST_SUMMARY=1 npm run test:browser`. Keep the static loopback server provided by the test runner; no backend C execution service is used. `tests/browser/run.mjs` itself now records HTTP error URLs in detailed JSON so an unexpected 404 remains visible.
