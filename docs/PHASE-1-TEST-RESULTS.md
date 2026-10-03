# Phase 1 test results

_Executed 2026-10-03 on Windows with Node 24.19.0, npm 11.17.0 and headless Microsoft Edge 154.0.4258.53. No browser sandbox-disabling launch flag was used._

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run test:browser
```

The clean install succeeded. The final browser run exited **0**, with **26/26 named checks true** and no page errors. `node --check` also succeeded for `src/index.js`, both Workers, the static server and the browser test runner. This is one browser/environment result, not a compatibility matrix. The JSON test output is the reproducible detailed record; results below summarize assertions actually executed.

| Test | Observed result |
| --- | --- |
| Toolchain initialization | Compiler Worker reported Clang/LLD 20.1.2, target `wasm32-wasip1`, sysroot 28,620,800 bytes. One measured in-Worker initialization was 449.9 ms. |
| Basic Hello World | C17 `stdio.h` compiled and linked to 98,566-byte Wasm, triple `wasm32-unknown-wasi`; execution Worker returned `Hello from C\n`, empty stderr, exit 0. |
| Empty program body | `int main(void) {}` compiled and exited 0. A zero-byte translation unit with no `main` is covered by the missing-entry test, not considered executable. |
| Syntax error | Clang returned `main.c:1:18: error: use of undeclared identifier 'this'`; compilation result `status: error`, `stage: compile`, no execution. |
| Missing entry point | `int helper(void) { return 1; }` failed at link: `wasm-ld: error: symbol exported via --export not found: main`. |
| Multiple files/header | Separate `main.c` and `helper.c` with local `helper.h` compiled, linked and exited 0; a second variant passed through the facade. |
| stderr | `fputs(..., stderr)` returned `error line\n` on stderr, empty stdout, exit 0. |
| Nonzero exit | `return 7` returned status `exited`, exit code 7; `run()` with `return 9` returned exit code 9. |
| Repeated execution | Same artifact executed twice with fresh stdout each time; direct Worker replay of a nonzero artifact also returned 7 with empty stdout. |
| Warnings | `-Wall` generated a warning retained in `rawDiagnostics`; successful artifact remained executable. |
| stdin | `getchar()`/`putchar()` with `stdin: "Z"` produced `Z`, exit 0. |
| Runtime trap | `__builtin_trap()` resolved execution status `trap`, separate from a nonzero exit. |
| Invalid runtime input | Three invalid Wasm bytes produced structured `INVALID_REQUEST` at `runtime-input`. A valid module with a deliberately changed import name produced `INITIALIZATION_FAILED` at `runtime-initialization`. |
| Worker correlation/failure | Distinct request IDs matched responses; unknown compiler message returned `PROTOCOL_ERROR`; missing sysroot URL returned `INITIALIZATION_FAILED` without hanging. |
| Output flood | 140,000 `putchar` calls retained exactly 131,072 stdout characters and set `truncated.stdout: true`. |
| Infinite loop and recovery | A configured 200 ms deadline rejected with `TIMEOUT`; main-thread timer advanced 50 ticks during the run; a subsequent C program exited 0. Wall-clock precision was not asserted. |
| No runtime file preopen | A C `fopen("/private.txt", "r")` check observed `NULL` and exited 0. This is one path, not proof of all filesystem behavior. |
| API lifecycle/validation | Observed `created -> ready -> disposed`, `failed` on missing assets, `BUSY` for concurrent compilation, `INVALID_REQUEST` for `../escape.c`, `DISPOSED` after cleanup, and `compile_error` with no execution on syntax failure. |

The test creates a blank browser document solely to start module Workers. `scripts/serve.mjs` serves static JavaScript/Wasm/sysroot bytes on `127.0.0.1`; Clang, LLD, and C execution all run in browser Workers. No backend compilation or execution service was used.

Not tested: other browser engines or operating systems; C standards beyond the selected C17 flag; substantial third-party C libraries; WASI calls beyond imports reached by these fixtures; memory peaks; cross-origin iframe/CSP; stale-message injection; complete boundary-value testing; full compile timeout recovery; and security against a compromised compiler/runtime Worker. See [Phase 1 limitations](PHASE-1-LIMITATIONS.md).
