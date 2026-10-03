# Phase 2 test results

_Run on 2026-10-03, Windows, Node 24.19.0, npm 11.17.0, headless Microsoft Edge 154.0.4258.53. One browser/environment only._

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run test:browser
```

The clean install succeeded. The full browser command exited 0 with **50/50 named checks true** and no page errors: the unchanged **26 Phase 1 checks** plus **24 Phase 2 checks**. `node --check` succeeded for the facade, both Workers, static server and both browser test modules. Tests use a blank browser document and a loopback static asset server. The server does not compile or execute C.

| Evidence type | Executed checks and actual result |
| --- | --- |
| Real browser Workers | Concurrent/repeated initialization returned one shared pending promise; compile/run/execute before initialization rejected `NOT_READY`. A 5-byte stdout cap retained `abcde` and marked truncation. A running infinite-loop C artifact was cancelled: operation rejected `CANCELLED`, engine returned `ready`, old artifact rejected `INVALID_ARTIFACT`, and a later C program exited 0. Reset after a successful run returned `ready`; reset during another infinite-loop execution rejected its pending operation `RESET`, then a later program exited 0. Repeated disposal was safe and post-disposal reset rejected `DISPOSED`. |
| Controlled Worker stand-ins in the browser | Initialization created one Worker despite two concurrent calls and no new Worker on repeated ready initialization. Missing/empty source, duplicate/path/option/runtime input, invalid artifact, unknown runtime option and constructor limit values produced the expected errors. Exact 128 KiB source was admitted; one byte over, aggregate size over, 33 files, 17 path segments, non-NFC path and oversized stdin were rejected. |
| Controlled Worker races | Overlapping compile/execute/run/initialize and rapid two-execution attempts rejected `BUSY`. Compiler cancellation terminated its Worker, shared the in-flight cancellation promise, rejected `CANCELLED`, ignored a late response, reinitialized and compiled again. Immediate cancellation before dispatch also settled and left the engine usable. Reset during execution/compilation/initialization rejected old work `RESET`; disposal during compilation/initialization rejected `DISPOSED`. New work passed after supported recovery. |
| Controlled Worker faults | Startup constructor failure produced `INITIALIZATION_FAILED` and `failed`, then `initialize()` recovered. Compiler `error` event produced `WORKER_FAILED`; malformed result, wrong current-request generation and `messageerror` produced `PROTOCOL_ERROR`; each compiler case recovered and compiled later. An execution Worker fault rejected `WORKER_FAILED` and later execution passed. A late response with an old request ID was ignored. |
| Controlled cleanup fault | A stand-in execution Worker whose `terminate()` threw still left the original operation rejected as `CANCELLED`, `cancel()` resolved, and a later compilation passed. Native browser `terminate()` was also exercised in the real cancellation tests, but a native cleanup exception was not induced. |

The controlled stand-ins run inside Edge but simulate Worker messages and failures; they prove the engine manager's transition/protocol logic, **not** that a real browsercc Worker can be forced into every synthetic fault. Real Worker cancellation and reset were separately exercised with a looping C program. The Phase 1 real compiler/runtime checks still verify Hello World, multi-file/header linking, syntax and link diagnostics, stdin, stdout/stderr, nonzero exit, trap, timeout and output flooding. The test runner prints JSON with the individual check names and observations; it exits nonzero if any check is false.

Not tested: Chrome/Firefox/Safari; real compiler Worker mid-compile forced termination; browser process crash; background-tab timer throttling; hard memory behavior; a diagnostic flood at the 128 KiB/200-record limits; a genuine >16 MiB compiled artifact; exhaustive malformed nested Worker messages; and hardened cross-origin hosting. These are not claimed as passing.
