# Phase 1 implementation notes

_Observed in a local browser on 2026-10-03. This is a proof of concept, not the release engine._

## Plan and result

The Phase 1 sequence was: pin the Phase 0 toolchain candidate, prove Clang/LLD and WASI Preview 1 directly in Workers, test two translation units and a header, then put a small API facade around the verified path. The chosen build passed these gates; no fallback toolchain was used. [Toolchain record](PHASE-1-TOOLCHAIN.md) and [actual results](PHASE-1-TEST-RESULTS.md) hold the evidence.

The Phase 0 request's references to Python, UI, snapshots, and source mapping had no matching C-engine documents in this repository. The C-specific Phase 0 documents and [review](PHASE-0-REVIEW.md) remained the source of truth.

## Working path

```text
browser caller -> CEngine -> compiler module Worker
                         -> Clang driver -###
                         -> one Clang cc1 per .c -> object bytes
                         -> LLD + pinned sysroot -> wasm32-unknown-wasi command
browser caller -> CEngine -> new execution module Worker per run
                         -> WebAssembly.compile/instantiate
                         -> browser_wasi_shim P1 host -> stdout, stderr, exit/trap
```

The compiler Worker fetches `sysroot.tar` once and caches it. Each request uses fresh Clang and LLD instances and their in-memory filesystems. The Clang driver is invoked as C (`thisProgram: "clang"`) with `-std=c17 -O0` and optional `-Wall`. It emits actual `cc1` and `wasm-ld` argument lines under `-###`; the adapter runs each frontend and then links. `-Wl,--export=main` makes a missing `main` fail at link time. The runtime supplies only stdin and separate stdout/stderr file descriptors; no directory is preopened. The local Node server serves static test assets and never compiles or runs user C.

This lower-level path is necessary because `browsercc` 0.1.1's convenience `compile()` invokes `clang++`; our first C17 test failed with `invalid argument '-std=c17' not allowed with 'C++'`. The private adapter uses the package's `Clang`, `LLD`, and `setUpSysroot` exports instead. This depends on their current distribution layout and driver output format, so an upstream update requires revalidation.

## Repository files

| Path | Responsibility |
| --- | --- |
| `src/index.js` | Minimal framework-free facade, validation, lifecycle, opaque artifacts, Worker correlation and deadlines. |
| `src/worker/compiler.js` | Browser Clang/LLD initialization, C compilation, linking and diagnostic extraction. |
| `src/worker/execution.js` | WASI P1 module loading, stdin/stdout/stderr, exit/trap normalization. |
| `scripts/serve.mjs` | Loopback static asset server for browser tests; serves only `src/` and `node_modules/`. |
| `tests/browser/run.mjs` | Headless real-browser Worker and facade checks; creates a blank harness document, with no UI. |
| `package.json`, `package-lock.json` | Exact dependencies and reproducible npm install. Package remains private. |

No frontend, IDE integration, cloud service, package distribution build, or compiler source modification was introduced. The Phase 0 design documents remain proposals for later phases; [Phase 1 API](PHASE-1-API.md) identifies the implemented subset.

## Reproduce

Requirements: Node 24 (tested with 24.19.0), npm (tested with 11.17.0), and an installed Chromium-compatible browser. On Windows the test defaults to Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. Set `C_ENGINE_BROWSER` to a different browser executable if needed.

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run test:browser
```

The test starts and stops its own loopback static server. It prints JSON with the browser version, 26 check flags, raw results, and browser page errors; it exits nonzero if a check fails. For manual module experiments, `npm run serve` starts the static server on `127.0.0.1:4173` by default. Import `/src/index.js` from the same origin in a browser context. There is no interactive demo page or frontend.

## Status by scope

| Status | Scope |
| --- | --- |
| Implemented and tested | Single-file C17, one two-file/header case, `stdio` output/input, `-Wall` warning, syntax/link errors, nonzero exit, trap, Worker IDs, per-run execution Worker, finite output capture, timeout and a following run. |
| Implemented but not verified broadly | Path/size validation, diagnostic parser, unsupported-import gate and Worker retirement across all edge cases. |
| Investigated but not implemented | Peak memory quota, broad WASI/syscall compatibility, cross-origin iframe, CSP profile and packaging. |
| Deferred | Full reset/cancel API, hardened recovery, browser matrix, stable asset loader/manifest, release limits and optional inspection. |

See [limitations](PHASE-1-LIMITATIONS.md) before using this proof with untrusted code.
