# Test strategy before implementation

No engine tests were run in Phase 0 because no engine code exists. The following matrix is the required validation plan. Unit tests use a fake compiler/runner protocol; browser tests use pinned actual assets. Avoid tests that merely duplicate schema definitions without exercising behavior.

| Category | Automated tests | Manual browser validation |
| --- | --- | --- |
| API contract | Concurrent `initialize()` shares one promise; ready/busy/state snapshots; compile/run/execute shapes; reset invalidates artifacts; cancel rejects active work and recovers; disposal is terminal/idempotent; invalid request/state/error codes | Independent consumer imports package and calls lifecycle methods without IDE code |
| C compiler | Hello World; scalar types, casts, functions, arrays, pointers, structures, loops; `stdio.h`, `stdlib.h`, `string.h`, `math.h` where linkable; two `.c` files with local header and relative include; duplicate symbol; missing symbol/header; syntax/type errors; `-Wall` warning; C17 flag | Inspect representative diagnostic text and non-ASCII filenames/messages in target browsers |
| Runtime | stdout and stderr separation, finite stdin/EOF, `return`/`exit` codes, Wasm trap, malformed/unavailable WASI import, output truncation, repeat execute on one artifact, isolated fresh filesystem, infinite loop timeout, cancellation, post-timeout recovery | Browser timer throttling, tab backgrounding, large allocation behavior and recovery |
| Security | Path traversal and normalization fuzzing; compiler argument injection strings; malformed/oversized protocol messages; stale generation/request reply; forged artifact; Worker crash; source/diagnostic/output cap boundaries; flood and loop | Parent origin and DOM isolation; storage/network attempts; iframe/CSP behavior; actual Worker termination; browser process memory under stress |
| Distribution | Clean build, lockfile/manifest hashes, asset presence and URL resolution, package export surface, third-party notice inventory, version mismatch rejection, test from a separate consumer project | Cold/warm download, offline cache behavior if supported, CSP errors, browser matrix and isolated-origin embedding |

## Phase-gated test sets

**Phase 1 feasibility gate:** one browser-Worker C compile/link/run using `<stdio.h>`, then two translation units and one header; observe stdout, stdin, exit, diagnostics, timeout by termination, actual imports/features, and asset sizes. Gate failure changes toolchain selection before API implementation expands. Results must record browser/version, pinned asset hashes, timing, memory observations if available, and exact failing calls.

**API and lifecycle gate:** fake Workers deterministically exercise transitions, concurrent requests, cancellation timing, stale messages and recovery. Browser integration then confirms actual Worker behavior. A settled operation must never settle again; a late reply must never contaminate another request.

**Compiler/runtime gate:** compile corpus checked against expected *classes* of diagnostics and exit behavior, avoiding brittle exact Clang wording. Linker errors must remain distinct from syntax errors. Nonzero C exit and trap are resolved program results; infrastructure faults are rejected errors.

**Security/release gate:** exercise all size boundaries at exact cap and cap+1; repeat loop/flood/cancel/reset cycles; test CSP and sandbox origin on supported browsers; verify package in a clean consumer build and compare assets against manifest. Run dependency/license audit before redistribution.

Automation can run in browser test runners for deterministic normal behavior; manual checks remain for browser-specific memory, throttling, CSP, origin and developer-tools inspection. A native Node WASI test is supplementary, never proof that browser behavior works. No supported-browser matrix is declared until Phase 1 measurements identify viable versions.
