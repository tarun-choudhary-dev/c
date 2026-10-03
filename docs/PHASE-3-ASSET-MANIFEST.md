# Phase 3 asset inventory

_Measured 2026-10-03 from `npm ci` output and the staged distribution. See the [machine-readable manifest](../asset-manifest.json) for every filename, size and SHA-256 digest._

The checked-in manifest records **14 required files**: six compiler files from `browsercc@0.1.1` (94,528,345 bytes) and eight JavaScript files from `@bjorn3/browser_wasi_shim@0.4.2` (42,896 bytes). Total retained runtime bytes are **94,571,241** before HTTP transfer compression. The browsercc `stdc++.h.pch` (C++ only) and TypeScript declarations are excluded. Project-owned `src/` files and notices are outside this third-party asset manifest.

`version` on each entry means the npm package version from which the exact bytes were copied. It does not assert that all embedded components share that version. The manifest's `toolchain` block records Clang/LLD 20.1.2 and wasi-sdk 25.0; `emscripten: null` explicitly means its exact version is unknown. The loaded compiler reports Clang/LLD 20.1.2; [browsercc's build script](https://github.com/BertalanD/browsercc/blob/main/build.sh) specifies LLVM `llvmorg-20.1.2` and wasi-sdk `25.0` sysroot archives. The Emscripten version used for its generated JS/Wasm is **unconfirmed**: its [Dockerfile](https://github.com/BertalanD/browsercc/blob/main/Dockerfile) installs `latest`. The npm tarball byte hashes are the reproducible identity for this phase. The underlying source build has not been reproduced.

| Role | Staged directory | Contents |
| --- | --- | --- |
| Compiler | `runtime/browsercc-0.1.1/` | `index.js`, `clang.js`, `clang.wasm`, `lld.js`, `lld.wasm`, `sysroot.tar` |
| Runtime | `runtime/browser-wasi-shim-0.4.2/` | `index.js`, `wasi.js`, `fd.js`, `fs_mem.js`, `fs_opfs.js`, `strace.js`, `wasi_defs.js`, `debug.js` |

`npm ci` verifies package-lock integrity at download. `npm run prepare:assets` checks every installed source byte against the checked-in manifest before copying. `npm run verify:assets` checks the staged files. Browser Workers fetch and hash required files before use. See [integrity model](PHASE-3-INTEGRITY.md) for the trust limits and loading paths.
