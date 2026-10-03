# Phase 4A investigation plan

_2026-10-03. Investigation plan; statements here are work items, not results._

1. Preserve the existing private package and asset hashes. Inventory the staged compiler Wasm, generated JavaScript and sysroot members against the exact npm tarball and upstream build references. Inspect embedded metadata for an Emscripten revision before considering any rebuild.
2. Map each distributed runtime file and the packed sysroot groups to source components and applicable notice texts. Record where the package bytes cannot be traced to a precise source revision or notice obligation. Leave the project license for the owner.
3. Instrument browser test timing without changing engine deadlines. Repeat the existing 50-check suite in Edge, Chrome and Firefox; isolate the Firefox 1,000 ms fixture and compare execution Worker startup, asset checks and program time. Keep explicit timeout and cancellation coverage.
4. Check whether the local WebKit build can be launched with supported dependencies. Run the existing suite and integrity checks if it can; otherwise preserve the exact failure and a suitable-host procedure.
5. Re-run clean staging, package verification, determinism and browser regressions. Update the distribution-readiness checklist and review with verified, partial, unresolved and environment-blocked items.

The current `README.md` has an existing user edit. Phase 4A will not restore or overwrite that removed line without a task-specific reason.
