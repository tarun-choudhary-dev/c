# Phase 3 dependency and license audit

_Inspected installed npm metadata and license files, upstream source references, and the contents of `sysroot.tar` on 2026-10-03. This is an engineering inventory, not a legal-compliance opinion._

| Component | Version / evidence | Use and license evidence | Distribution action |
| --- | --- | --- | --- |
| `browsercc` wrapper | npm 0.1.1, exact package-lock integrity | Installed `package.json` says MIT; installed `LICENSE` exists. [Upstream](https://github.com/BertalanD/browsercc). | Include package MIT text, done in candidate `dist/licenses/`. |
| Clang, LLD, LLVM libraries | Reported 20.1.2, LLVM commit `58df0ef89dd64126512e4ee27b4ac3fd8ddf6247`; [build script](https://github.com/BertalanD/browsercc/blob/main/build.sh) uses `llvmorg-20.1.2` | [Tagged LLVM license](https://github.com/llvm/llvm-project/blob/llvmorg-20.1.2/llvm/LICENSE.TXT): Apache-2.0 WITH LLVM-exception, with possible component-specific third-party files. | Tagged top-level license is copied; inspect included LLVM components and any extra notices before release. |
| Emscripten-generated `clang.js` and `lld.js` | Exact Emscripten version **unconfirmed**. Browsercc [Dockerfile](https://github.com/BertalanD/browsercc/blob/main/Dockerfile) installs `emsdk latest`. | [Emscripten license](https://github.com/emscripten-core/emscripten/blob/main/LICENSE) offers MIT and University of Illinois/NCSA terms; the copied current text is reference material until the generating revision is known. | Pin or recover the build revision and confirm generated-code notice obligations. **Open.** |
| WASI sysroot C library and headers | Browsercc [build script](https://github.com/BertalanD/browsercc/blob/main/build.sh) downloads wasi-sdk 25.0 sysroot and builtins archives. wasi-sdk-25's wasi-libc submodule SHA was inspected via the official Git tree: `574b88da481569b65a237cb80daf9a2d5aeaf82d`. | [wasi-libc license at that commit](https://github.com/WebAssembly/wasi-libc/blob/574b88da481569b65a237cb80daf9a2d5aeaf82d/LICENSE) lists Apache-2.0 WITH LLVM-exception, Apache-2.0, MIT and third-party CC0, BSD-2-Clause, BSD-3-Clause and musl MIT notices. | Top-level and listed source notices copied to `licenses/`; determine which files actually reached the packed sysroot. **Open.** |
| Builtins, libc++, libc++abi in sysroot | wasi-sdk 25.0 archives and browsercc build script | LLVM project license is the expected umbrella, but the tar was not mapped entry by entry to source packages. | Audit packed archives and any additional notices. **Open.** |
| `@bjorn3/browser_wasi_shim` | npm 0.4.2 | Installed metadata says `MIT OR Apache-2.0`; both installed license files inspected. [Upstream](https://github.com/bjorn3/browser_wasi_shim). | Include both texts, done in candidate `dist/licenses/`. |
| `playwright-core` | npm 1.63.0, development only | Installed metadata says Apache-2.0; installed `LICENSE`, `NOTICE` and `ThirdPartyNotices.txt` exist. | Not copied into candidate `dist/`; retain license files if test tooling is redistributed separately. |
| Project-owned JS/docs | pre-release `0.0.0-phase3` | Root `LICENSE` explicitly records pending owner selection. | Owner must select a grant before public distribution. **Open.** |

`npm ls --all --depth=1` showed only the two runtime packages and Playwright core as direct installed packages; no separately installed transitive runtime npm package was present. That does **not** account for source bundled inside compiler Wasm, generated glue or the sysroot. The [browsercc package inventory](https://github.com/BertalanD/browsercc) confirms its C++ PCH is optional; we do not stage it.

The inspected `sysroot.tar` contained **no `LICENSE`, `COPYING`, or `NOTICE` entries**; browsercc's build script removes `share/` while repacking. This is a concrete redistribution blocker even though reference license files have now been collected. The source build was not reproduced and the Emscripten revision is not pinned, so source-to-binary correspondence cannot be claimed.

## Distribution-readiness checklist

- [x] Pin npm input versions and archive integrity in `package-lock.json`.
- [x] Record and verify exact staged asset SHA-256 hashes.
- [x] Include installed browsercc and WASI shim license texts.
- [x] Collect tagged LLVM and wasi-libc reference license texts.
- [ ] Confirm generated Emscripten revision and notice requirements.
- [ ] Map packed sysroot files and libraries to all applicable source notices.
- [ ] Confirm upstream binary provenance or perform a controlled source rebuild.
- [ ] Obtain owner choice for the root project license.
- [ ] Review the final package and third-party notices before any public release.

**Result: license inventory substantially improved; distribution approval remains blocked.**
