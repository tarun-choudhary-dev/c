# Phase 3 loading and performance baseline

_One measured run each on Windows 11 Pro build 26300, Node 24.19.0, headless Microsoft Edge 154.0.4258.53 and Firefox 155.0, 2026-10-03. Local loopback HTTP server with `Cache-Control: no-store`. These observations are baselines, not controlled comparative benchmarks._

`npm run measure:browser` initializes a fresh engine; compiles the same `stdio.h` Hello World three times in one compiler Worker; and executes the final artifact twice, each in a new execution Worker. It checks stdout and exit code before recording timings. Wall times use page `performance.now()`. Worker times are returned by the compiler/execution Workers. Compiler asset verification time covers manifest fetch, six asset fetches and SHA-256 checks inside the compiler Worker; it does not measure internet download from npm or a remote CDN.

| Operation | Observed milliseconds |
| --- | ---: |
| Compiler asset fetch + verification inside Worker | 649.0 |
| Entire compiler Worker initialization | 933.0 |
| `engine.initialize()` page wall time, including Worker startup | 966.8 |
| First Hello World compilation, page wall | 961.1 |
| Repeated compilation 2, page wall | 673.3 |
| Repeated compilation 3, page wall | 640.2 |
| Execution 1, page wall / Worker | 73.6 / 45.7 |
| Execution 2, page wall / Worker | 50.6 / 38.0 |

The same procedure also completed once in Firefox 155.0: initialization wall time **1,935 ms**, compiler asset verification **1,174 ms**, first compilation **1,389 ms**, repeated compilations **1,290 / 1,281 ms**, and execution wall times **80 / 75 ms**. These samples were taken at different times and do not establish a stable browser performance ranking. A separate full-suite Firefox run later hit a 1,000 ms execution deadline in a Phase 2 fixture despite normal execution times here; see the [compatibility record](PHASE-3-BROWSER-COMPATIBILITY.md).

The compiler assets total **94,528,345 bytes** uncompressed and the staged WASI shim files **42,896 bytes**. The three largest compiler binaries (`clang.wasm`, `lld.wasm`, `sysroot.tar`) total 94,377,252 bytes. HTTP transfer compression, CDN latency, cold browser caches, process memory and peak Wasm memory were **not measured**. The run was not repeated enough for a statistical latency claim. The first suite run after editing assets took longer, so do not treat this single sample as a stable service-level target.

Repeat with `npm run measure:browser`; set `C_ENGINE_BROWSER` or `C_ENGINE_BROWSER_ENGINE` as in the [compatibility procedure](PHASE-3-BROWSER-COMPATIBILITY.md). Preserve the JSON output and record machine, browser version, cache policy and network conditions before comparing runs.
