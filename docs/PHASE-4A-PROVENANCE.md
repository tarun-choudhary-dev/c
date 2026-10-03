# Phase 4A binary provenance

_Investigated 2026-10-03. The existing 14 asset bytes and manifest hashes were not changed. “Pinned package” means the npm tarball is identified; it does not prove how its embedded compiler binaries were built._

## Chain of custody and build references

| Link | Evidence | Status |
| --- | --- | --- |
| npm inputs to local assets | `package-lock.json` pins `browsercc@0.1.1` with registry SHA-512 integrity `sha512-zKSm2b10XjqRBPkY67rS5FK+YgcXd5CH2GRVwyK2+f7EOQRmHR0IN2lQCvJZQfTytSFbwFmlIpZaxSMFcE+jxw==` and `@bjorn3/browser_wasi_shim@0.4.2` with integrity `sha512-/iHkCVUG3VbcbmEHn5iIUpIrh7a7WPiwZ3sHy4HZKZzBdSadwdddYDZAII2zBvQYV0Lfi8naZngPCN7WPHI/hA==`. `prepare:assets` verifies each installed source against the checked-in SHA-256 before staging. | Verified package identity and local bytes. |
| browsercc source reference | The npm metadata records `gitHead` [`86168bac`](https://github.com/BertalanD/browsercc/commit/86168bacf0fe7c662e3e65a2e3006ceb159cd0dc), dated 2025-04-19, for 0.1.1. Its [build.sh](https://github.com/BertalanD/browsercc/blob/86168bacf0fe7c662e3e65a2e3006ceb159cd0dc/build.sh) clones `llvmorg-20.1.2`, builds Clang and LLD with `emcmake`/Ninja, uses `-msimd128 -mbulk-memory`, and packages wasi-sdk 25.0 release files. | Build recipe identified. The package does not contain a signed build attestation connecting these exact Wasm bytes to that recipe. |
| LLVM compiler source | `llvmorg-20.1.2` is annotated tag target [`58df0ef8`](https://github.com/llvm/llvm-project/commit/58df0ef89dd64126512e4ee27b4ac3fd8ddf6247). Build options include `LLVM_TARGETS_TO_BUILD=WebAssembly`, `LLVM_ENABLE_PROJECTS=clang;lld`, no LLVM threads, `MinSizeRel`, Emscripten modular ES6 output, 4 MiB stack, 128 MiB initial heap and memory growth. | Source revision and claimed configuration identified from the package's recorded recipe; binary equivalence not independently established. |
| Emscripten compiler/SDK | The exact [Dockerfile at the npm source commit](https://github.com/BertalanD/browsercc/blob/86168bacf0fe7c662e3e65a2e3006ceb159cd0dc/Dockerfile) shallow-clones `emsdk` and executes `emsdk install latest` / `activate latest`; it does not record a commit, release, image digest or lock. Both shipped compiler Wasm files have **no custom sections** that reveal a producer revision. Generated JS contains Emscripten runtime symbols but no reliable version. | **Unresolved.** npm publication Node 23.11.0 is not the compiler-build SDK version. Do not infer a revision from publication date. |
| WASI sysroot source | The browsercc recipe downloads [wasi-sdk 25 release archives](https://github.com/WebAssembly/wasi-sdk/releases/tag/wasi-sdk-25). The annotated tag resolves to [`ccdf52e1`](https://github.com/WebAssembly/wasi-sdk/commit/ccdf52e17eec09577e7e25acef96c4d630bfb8d7). Its Git tree pins `src/wasi-libc` to [`574b88da`](https://github.com/WebAssembly/wasi-libc/commit/574b88da481569b65a237cb80daf9a2d5aeaf82d) and `src/llvm-project` to [`ab4b5a2d`](https://github.com/llvm/llvm-project/commit/ab4b5a2db582958af1ee308a790cfdb42bd24720). | Source revisions and release artifacts identified. LLVM in the SDK sysroot is a distinct revision from browsercc's LLVM 20.1.2 compiler. |
| WASI runtime shim | npm metadata for `@bjorn3/browser_wasi_shim@0.4.2` records `gitHead` [`4a55f2a5`](https://github.com/bjorn3/browser_wasi_shim/commit/4a55f2a519d0ddfa7e4609c42e0c9769c37c9ae8). Its eight shipped JS files are pinned by SHA-256 below. | Package and staged bytes verified; independently rebuilding its JS from source was not attempted. |

The release archive `wasi-sysroot-25.0.tar.gz` downloaded from the official tag was 64,740,827 bytes, SHA-256 `d09c62c18efcddffe4b2fdd8c5830109cc8e36130cdbc9acdc0bd1b204c942bb`. `scripts/compare-sysroot.py` compared every packaged `include/wasm32-wasi`, relocated `include/c++`, and `lib/wasm32-wasi` regular file against that archive: **1,250 identical, 0 missing, 0 different**. The separate official builtins archive had SHA-256 `13aca55665321200b9659b292615adf5110ace9e891ab94511badd970553ca18`; its `libclang_rt.builtins-wasm32.a` exactly matches the packed archive (442,508 bytes, SHA-256 `e58ec303724c3d9a5b1ef101ed1d5ea7c3879c45e6218e68d4239237c23620c6`). The remaining 265 files are 264 Clang built-in headers attributed by the browsercc recipe to its LLVM build plus the generated `bits/stdc++.h` shim. These were **not** independently compared against an LLVM source checkout.

The packed tar has 1,594 members, including 1,516 regular files: 203 WASI C headers, 1,022 relocated C++ headers, 25 WASI library/object files, 265 Clang-header/builtins files and one shim header. It contains no member named `LICENSE`, `COPYING` or `NOTICE`. The SDK recipe removes `share/` and `VERSION` before packing. This explains missing notice files but does not itself settle redistribution obligations.

## Actual distributed asset hashes

All paths below are relative to the package root. The authoritative machine-readable list is [asset-manifest.json](../asset-manifest.json). The browsercc six files are compiled/staged from npm 0.1.1; the eight shim files are staged from npm 0.4.2. `dist/` is a byte copy of these staged files.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `runtime/browsercc-0.1.1/index.js` | 5,296 | `0265e7fccbf29facb65db6cc59045bec746fc184fe5f0fdf05aa0150d9699570` |
| `runtime/browsercc-0.1.1/clang.js` | 74,193 | `27aeadfcdb71f37fdeb6f1ca339de913ef9e2fdd1fd53c238a5decf635d9b129` |
| `runtime/browsercc-0.1.1/clang.wasm` | 42,553,880 | `d574339640a9764544f405d4b5ae79ef7d05e49725b416fba74f5b15c00f8ee5` |
| `runtime/browsercc-0.1.1/lld.js` | 71,604 | `b5054c24942687c744adbadcd549073ce3ecaf69b9fed5fa85a20c046751c1bf` |
| `runtime/browsercc-0.1.1/lld.wasm` | 23,202,572 | `810bb3be4eec8ad6bae60ceb7355c07bf7de8a54b5c8acb4d7a80613bd43c4bf` |
| `runtime/browsercc-0.1.1/sysroot.tar` | 28,620,800 | `dbed83f93f0fa695f36041b82a95a8cd78f106a3f49d9cd860e57ae1ac823318` |
| `runtime/browser-wasi-shim-0.4.2/index.js` | 316 | `7e2fd52ee3f728bb0b1d6e449724e0f13e3d586bb25bde6e02a66366175b5605` |
| `runtime/browser-wasi-shim-0.4.2/wasi.js` | 16,429 | `168eb977a826f75ab0c39f9322f78cc58dbd5b233019ad1d6a7e940af8a7c4aa` |
| `runtime/browser-wasi-shim-0.4.2/fd.js` | 1,906 | `9e82e1fc1bfd3e3573f64349dc42b4b624ed61d24e5c553f2bb4d041444f166c` |
| `runtime/browser-wasi-shim-0.4.2/fs_mem.js` | 12,206 | `85dbc9e0ee784d9ff8b55452644e00bf7058e32355aab974f8b71d7d85772324` |
| `runtime/browser-wasi-shim-0.4.2/fs_opfs.js` | 2,280 | `4b96aaeb5ac5986cf802cbf22b975c656682d22a38248160c96fc2ded5644869` |
| `runtime/browser-wasi-shim-0.4.2/strace.js` | 318 | `ece435d3784d928d02bff4d015b7cb686f8c06de8536ff9f8ebc38a8f403a3be` |
| `runtime/browser-wasi-shim-0.4.2/wasi_defs.js` | 9,027 | `0db0f42ba330749a7b05095ea1fd0ff63fd2b30e84cead30fe4c28359d15f194` |
| `runtime/browser-wasi-shim-0.4.2/debug.js` | 414 | `a91848ee180529e2a60c05dfb9584cad19cd4e1c6f391fdb76a938bcae4c0328` |

## Rebuild decision

**No rebuild or asset substitution was performed.** A release-grade rebuild needs a fixed emsdk commit/version and container base digest, the LLVM and wasi-sdk source commits above, exact build flags and a build log. Compare every rebuilt asset's size/hash, imports/exports, C diagnostics, full browser suites and packaged consumer behavior before considering migration. A different hash is expected from a new Emscripten revision and requires a new manifest plus review; it is not evidence that the old hash was wrong. Until that work or an upstream build attestation exists, `clang.wasm`, `lld.wasm` and their generated JS have **partially confirmed** source provenance and **unresolved** exact build environment provenance.

Reproduce the read-only inspection after `npm ci` and `npm run prepare:assets`:

```powershell
node scripts/inspect-provenance.mjs
curl.exe -L -o $env:TEMP\wasi-sysroot-25.0.tar.gz https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-25/wasi-sysroot-25.0.tar.gz
curl.exe -L -o $env:TEMP\libclang_rt.builtins-wasm32-wasi-25.0.tar.gz https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-25/libclang_rt.builtins-wasm32-wasi-25.0.tar.gz
python scripts/compare-sysroot.py $env:TEMP\wasi-sysroot-25.0.tar.gz $env:TEMP\libclang_rt.builtins-wasm32-wasi-25.0.tar.gz
```
