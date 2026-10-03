# Phase 4A Firefox reliability investigation

_Windows 11 Pro build 26300, Node 24.19.0, headless Playwright Firefox 155.0, Edge 154.0.4258.53 and Chrome 154.0.8037.97; local static loopback server. Measurements from 2026-10-03. The original [Phase 3 failure](PHASE-3-BROWSER-COMPATIBILITY.md) remains part of the history._

## Where the deadline applies

The Phase 2 real-Worker fixture in `tests/browser/phase2.mjs` creates `CEngine({ limits: { executionTimeoutMs: 1000, stdoutBytes: 5, stderrBytes: 8 } })`. This is a **public API execution deadline chosen by that test**, within the allowed configurable range; it is not Playwright's evaluation timeout. `CEngine.#execute` constructs a **fresh execution Worker** for each call. `CEngine.#call` starts a `setTimeout` immediately before installing listeners and posting the `execute` message. The 1,000 ms therefore includes scheduling the new Worker, receiving and validating the message, `WebAssembly.compile`, runtime manifest and shim fetch/hash verification, WASI instantiation, program execution and response delivery. It excludes compilation and compiler Worker initialization. The direct Worker helper in `tests/browser/run.mjs` has a separate 120,000 ms harness watchdog; it did not produce the Phase 3 symptom. The explicit infinite-loop test uses `executionTimeoutMs: 200` and remains unchanged.

`tests/browser/firefox-reliability.mjs` records page wall time, Worker construction-to-post delay, post-to-response time, the execution Worker's own `durationMs`, and their difference. The difference includes Worker startup, message scheduling/transfer and response delivery; it is **not** a pure startup measurement. A timed-out Worker produces no `durationMs`, so attribution remains limited. It does not alter production engine limits.

## Focused 1,000 ms execution probe

Each browser initialized one real compiler Worker, compiled `int main(void) { return 0; }` once, then created a fresh execution Worker 30 times with the same public 1,000 ms limit. All 90 executions returned exit code zero without timeout. These are separate serial runs under varying host load, not a controlled benchmark.

| Browser | Successful / attempted | Page wall median / p95 / max | Worker internal median / p95 / max | Post-to-response outside Worker median / p95 / max |
| --- | ---: | ---: | ---: | ---: |
| Firefox 155.0 | 30/30 | 73 / 102 / 135 ms | 55 / 80 / 118 ms | 17 / 21 / 39 ms |
| Edge 154.0.4258.53 | 30/30 | 65 / 90 / 96 ms | 50 / 69 / 81 ms | 13 / 20 / 22 ms |
| Chrome 154.0.8037.97 | 30/30 | 76 / 131 / 136 ms | 59 / 93 / 118 ms | 16 / 32 / 42 ms |

In these probes the 1,000 ms fixture leaves substantial normal-case margin. It can still fail under transient browser or system stalls. This sample does **not** establish that the deadline is universally safe, that Firefox alone is slow, or that C execution was nonterminating in the Phase 3 failure.

## Full-suite attempts and distinct failures

Five additional Firefox full-suite invocations were attempted while WSL dependency installation and WebKit setup also used this Windows host. Three finished **50/50**. One aborted in the Phase 2 real fixture after reset with `WORKER_FAILED` from the compiler Worker: “Expected 1 Clang frontend commands, got 2.” This comes from parsing Clang `-###` stderr in `src/worker/compiler.js`, before C compilation; it is **not** the 1,000 ms execution timeout. A second aborted in the earlier API fixture at the **120,000 ms initialization** deadline while the host was under concurrent setup load. These outcomes should not be collapsed into the original execution deadline symptom. The compiler parser now includes up to 2,048 characters of its driver transcript in that exceptional error to make recurrence diagnosable; no compilation path or deadline was changed.

After WSL setup finished, three more serial Firefox full-suite runs passed **50/50 each** with elapsed times 64.7, 63.7 and 78.8 seconds. The earlier completed serial regression also passed 50/50. These repeats are evidence that the failures are intermittent; they do not prove which competing host activity, browser scheduling event or toolchain output caused each failure.

The Phase 3 1,000 ms execution timeout did not recur in this 30-run focused probe. Its root cause remains **investigated but unresolved**. Browser/host scheduling is plausible but unproven. The separate `-###` parser failure is also unresolved until a transcript is captured and its triggering line identified. The 120-second initialization outlier indicates that this host experienced severe load during cross-environment setup; it is not evidence of an intrinsic Firefox initialization limit.

## Decision and reproduction

**No deadline was raised and no cancellation or timeout test was weakened.** There is not enough evidence to replace the API's 1,000 ms fixture or to claim a runtime defect. The next focused check is a serial, otherwise-idle full-suite run with timing retained across cancellation/reset operations; if the parser error recurs, inspect the included Clang driver transcript and add a regression for the concrete output shape. Retain the 200 ms infinite-loop timeout test.

```powershell
npm ci
npm run prepare:assets
$env:C_ENGINE_BROWSER_ENGINE='firefox'
$env:C_ENGINE_RELIABILITY_RUNS='30'
node tests/browser/firefox-reliability.mjs
$env:C_ENGINE_TEST_SUMMARY='1'
node tests/browser/run.mjs
```

For comparison set `C_ENGINE_BROWSER_ENGINE='chromium'` and `C_ENGINE_BROWSER` to the installed Edge or Chrome executable, then rerun the diagnostic. Collect JSON from each invocation and report failed attempts; a successful rerun does not erase a prior failure. The fixture deadline begins with `#call`, so any future measurement must separate page work, Worker internal `durationMs` and post-to-response overhead before assigning a cause.
