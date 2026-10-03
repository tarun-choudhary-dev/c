# Phase 1 toolchain and runtime record

_Verified in Microsoft Edge 154.0.4258.53, headless, Windows, on 2026-10-03._

| Component | Exact version or observation | Role |
| --- | --- | --- |
| `browsercc` | npm 0.1.1, pinned by `package-lock.json` | Browser Clang/LLD glue and WASI sysroot |
| Clang Wasm build | 20.1.2, LLVM commit `58df0ef89dd64126512e4ee27b4ac3fd8ddf6247` | C frontend and driver |
| LLD Wasm build | 20.1.2, same commit | WASI linker |
| `@bjorn3/browser_wasi_shim` | npm 0.4.2 | JavaScript WASI Preview 1 host |
| `playwright-core` | npm 1.63.0, development only | Browser automation; does not provide a browser binary |
| Node / npm | 24.19.0 / 11.17.0 | Local install, static serving, test runner only |

The [browsercc repository](https://github.com/BertalanD/browsercc) and [WASI shim repository](https://github.com/bjorn3/browser_wasi_shim) are the upstream sources. The installed npm package metadata labels browsercc MIT and the shim MIT OR Apache-2.0. Those package-level declarations do **not** complete the license audit for embedded LLVM, LLD, libc, startup objects, and sysroot files. Preserve upstream notices and inspect the binary build provenance before redistribution. The root project [LICENSE](../LICENSE) still awaits owner selection; package publication is disabled.

## Browser-verified target and link

Clang's emitted frontend triple was `wasm32-unknown-wasi` under browsercc's default WASI setup, corresponding to the intended `wasm32-wasip1` command ABI. The linked Hello World had Wasm magic `00 61 73 6d`, was 98,566 bytes in the recorded run, imported `fd_close`, `fd_fdstat_get`, `fd_seek`, `fd_write`, and `proc_exit` from `wasi_snapshot_preview1`, and exported `memory`, `_start`, and the explicitly requested `main`. It compiled from `#include <stdio.h>` and ran with stdout `Hello from C\n`, empty stderr, exit code 0. Clang/LLD used the bundled `sysroot.tar` for headers, startup code and C library. One `main.c` plus `helper.c` and `helper.h` compiled, linked and ran with exit code 0. These observations verify only the tested subset; they do not establish all of C17 or wasi-libc.

The driver without `-Wl,--export=main` linked a no-main command that later trapped. The adapter adds that flag so the missing-entry fixture gets a clear `wasm-ld` link error. It also means `main` is exported from successful modules; only `_start` is invoked for execution. This is a Phase 1 workaround to revisit when a stable driver/link policy is designed.

## Asset inventory

| npm-installed asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `browsercc/dist/clang.wasm` | 42,553,880 | `D574339640A9764544F405D4B5AE79EF7D05E49725B416FBA74F5B15C00F8EE5` |
| `browsercc/dist/lld.wasm` | 23,202,572 | `810BB3BE4EEC8AD6BAE60CEB7355C07BF7DE8A54B5C8ACB4D7A80613BD43C4BF` |
| `browsercc/dist/sysroot.tar` | 28,620,800 | `DBED83F93F0FA695F36041B82A95A8CD78F106A3F49D9CD860E57AE1AC823318` |

The three required binaries total 94,377,252 bytes before transfer compression. They remain in ignored `node_modules/`; no binary was copied into this repository. The complete installed browsercc package is larger because it contains C++ assets not used by this C proof. The npm lock pins package integrity, but the runtime does not yet verify HTTP asset hashes. URLs and module imports currently reference `node_modules`, so this is a repository-local proof, not a consumable distribution.

## Measurements and unknowns

One clean-install browser run reported 449.9 ms for compiler Worker initialization measured *inside* the Worker after its module loaded. This excludes Worker startup, browsercc JS fetch/parse, and outer wall time. The example Hello World linked artifact was 98,566 bytes. `Clang` and `LLD` wrappers did not expose a `HEAPU8` size through the checked interface; peak Worker/Wasm memory was **not measured**. Browser caching and machine load affect timing. No WebAssembly feature audit beyond successful compilation/instantiation and the observed imports/exports was performed. Cross-browser support remains unverified.
