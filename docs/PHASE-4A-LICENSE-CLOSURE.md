# Phase 4A license and notice closure

_Engineering inventory, 2026-10-03. It records evidence and remaining decisions, not a legal determination or permission to publish. See the historical [Phase 3 audit](PHASE-3-LICENSE-AUDIT.md), [provenance record](PHASE-4A-PROVENANCE.md), and candidate [third-party notices](../THIRD-PARTY-NOTICES.md)._

## Distributed dependency-to-binary map

| Distributed bytes | Source and relevant license evidence | Included candidate notice | Closure status |
| --- | --- | --- | --- |
| `browsercc-0.1.1/index.js` | [`browsercc` 0.1.1](https://www.npmjs.com/package/browsercc/v/0.1.1) wrapper, npm MIT metadata and installed `LICENSE`. | `licenses/browsercc-MIT.txt` in `dist/`. | Verified for wrapper only. Its MIT declaration does **not** cover all embedded compiler and sysroot components. |
| `clang.wasm`, `lld.wasm`; LLVM portions of generated `clang.js`/`lld.js` | [`llvmorg-20.1.2`](https://github.com/llvm/llvm-project/tree/llvmorg-20.1.2), Apache-2.0 WITH LLVM-exception, plus any component-specific notices. [License text](https://github.com/llvm/llvm-project/blob/llvmorg-20.1.2/llvm/LICENSE.TXT). | `licenses/LLVM-20.1.2-LICENSE.txt`. | Main license located; exact binary-to-source rebuild and component-specific third-party notice scan remain open. |
| Emscripten runtime code in generated `clang.js`, `lld.js` and Wasm | The [build Dockerfile](https://github.com/BertalanD/browsercc/blob/86168bacf0fe7c662e3e65a2e3006ceb159cd0dc/Dockerfile) uses floating `emsdk latest`. [Emscripten LICENSE](https://github.com/emscripten-core/emscripten/blob/main/LICENSE) describes its licensing, but the exact generator revision is unknown. | `licenses/emscripten-LICENSE-reference.txt` is **reference only**. | **Unresolved** source revision and generated-code notice requirements. The current license text is not proven to be the text for the generating revision. |
| `sysroot.tar`: 203 C headers, `libc.a`, CRT objects and other WASI C libraries | 1,250 packed files were byte-matched to the official [wasi-sdk 25 release archive](https://github.com/WebAssembly/wasi-sdk/releases/tag/wasi-sdk-25). Its [wasi-libc submodule](https://github.com/WebAssembly/wasi-libc/tree/574b88da481569b65a237cb80daf9a2d5aeaf82d) is multi-licensed Apache-2.0 WITH LLVM-exception / Apache-2.0 / MIT; its [LICENSE](https://github.com/WebAssembly/wasi-libc/blob/574b88da481569b65a237cb80daf9a2d5aeaf82d/LICENSE) calls out imported code. | `wasi-libc-LICENSE*.txt`, `wasi-libc-musl-COPYRIGHT.txt`, `wasi-libc-cloudlibc-LICENSE.txt`, `wasi-libc-musl-fts-COPYING.txt`, and new dlmalloc/fts notice references. | Exact release bytes verified. Mapping each archive member to original source and notice is incomplete. In particular, `libc.a` contains `dlmalloc.o` and `fts.o`; the former's [CC0 source notice](https://github.com/WebAssembly/wasi-libc/blob/574b88da481569b65a237cb80daf9a2d5aeaf82d/dlmalloc/src/malloc.c) was absent from Phase 3 candidate notices and is now referenced. |
| `sysroot.tar`: 1,022 C++ headers, `libc++.a`, `libc++abi.a`, other LLVM runtime pieces | wasi-sdk 25 pins LLVM submodule [`ab4b5a2d`](https://github.com/llvm/llvm-project/commit/ab4b5a2db582958af1ee308a790cfdb42bd24720), distinct from compiler LLVM 20.1.2. Its [LLVM LICENSE.TXT](https://github.com/llvm/llvm-project/blob/ab4b5a2db582958af1ee308a790cfdb42bd24720/llvm/LICENSE.TXT) has the same byte hash as the copied 20.1.2 umbrella license. | `licenses/LLVM-20.1.2-LICENSE.txt`; provenance note explains the second revision. | Main text verified; specific upstream third-party notices and archive member linkage remain open. |
| `sysroot.tar`: `libclang_rt.builtins.a` | Byte-identical to the separate official wasi-sdk 25 builtins release archive; source is the SDK's LLVM/Compiler-RT build. | LLVM main license text. | Release byte identity verified; member-by-member notices remain open. |
| `sysroot.tar`: 264 Clang built-in headers and synthetic `bits/stdc++.h` | Browsercc's pinned [build script](https://github.com/BertalanD/browsercc/blob/86168bacf0fe7c662e3e65a2e3006ceb159cd0dc/build.sh) copies headers from the LLVM 20.1.2 build and writes the shim. | LLVM text and browsercc MIT wrapper text. | Source attributed by recipe; these 265 files were not independently byte-matched to an LLVM checkout. |
| Eight `browser-wasi-shim-0.4.2/*.js` files, including files not imported by the current execution path | [Pinned npm package](https://www.npmjs.com/package/@bjorn3/browser_wasi_shim/v/0.4.2), `MIT OR Apache-2.0` in installed metadata and both installed license files. Package gitHead `4a55f2a519d0ddfa7e4609c42e0c9769c37c9ae8`. | Both `browser-wasi-shim-MIT.txt` and `browser-wasi-shim-Apache-2.0.txt` in `dist/`. | Package identity, staged bytes and texts verified. |

`playwright-core@1.63.0` is an Apache-2.0 **development-only** dependency and is excluded from `dist/`. Host browser binaries and WSL system libraries used for testing are not packaged. The package candidate includes project-owned `src/`, docs and license files in addition to the 14 runtime assets.

The packed sysroot has **no** `LICENSE`, `COPYING` or `NOTICE` member. Its recipe deletes the upstream `share/` directory. Copying top-level texts into `dist/licenses/` improves attribution but does not prove that every member's obligations are met. The source's `emmalloc` header credits Emscripten with MIT/NCSA terms; whether any `emmalloc` object is distributed has not been established. No source-offer conclusion is made here because the exact build inputs and the project's own license status need review.

### Packed library/object inventory

All **24** `.a`/`.o` members of `sysroot.tar` are mapped below at the source-project level. This does not imply that every individual object inside each archive has been traced. The packed bytes are identical to the wasi-sdk 25 release archives as described in [provenance](PHASE-4A-PROVENANCE.md).

| Source group | Packed members | Notice basis |
| --- | --- | --- |
| wasi-libc 25 C/CRT and compatibility libraries (20) | `crt1-command.o`, `crt1-reactor.o`, `crt1.o`, `libc.a`, `libm.a`, `libpthread.a`, `libresolv.a`, `librt.a`, `libcrypt.a`, `libdl.a`, `libxnet.a`, `libsetjmp.a`, `libutil.a`, `libc-printscan-long-double.a`, `libc-printscan-no-floating-point.a`, `libwasi-emulated-pthread.a`, `libwasi-emulated-signal.a`, `libwasi-emulated-process-clocks.a`, `libwasi-emulated-getpid.a`, `libwasi-emulated-mman.a` | wasi-libc multi-license and listed third-party texts; `libc.a` specifically contains `dlmalloc.o` and `fts.o`. The count reflects the names, not a claim about original object ownership. |
| LLVM libc++ / libc++abi from SDK source revision (3) | `libc++.a`, `libc++abi.a`, `libc++experimental.a` | LLVM Apache-2.0 WITH LLVM-exception umbrella, subject to component notices. |
| Compiler-RT builtins (1) | `lib/clang/20/lib/wasm32-unknown-wasi/libclang_rt.builtins.a` | LLVM umbrella plus any relevant compiler-rt component notices. |

The three groups total 24. The headings are source attribution from the SDK build/release layout; archive-by-archive source-object mapping remains a release gate. MIT/BSD texts generally require preserving their notices, and the LLVM/Apache texts have redistribution conditions; verify exact obligations against the authoritative files and the final artifact with license counsel before release. The presence of a license file is not a substitute for that review.

## Project-owned license status

The Phase 4A brief and Phase 3 records say the owner decision is pending. The current tracked [LICENSE](../LICENSE) is the full GNU AGPL version 3 text, introduced by commit `9028ea9` on 2026-10-03 (`Update LICENSE`), after the Phase 3 review. This is evidence of a repository change, **not** an instruction in this task to choose or change the license. The existing README has an uncommitted user edit removing a pending-license sentence. We have left both files untouched. Until the owner confirms that the AGPL text is the intended license for project-owned material and its required identification/source obligations are reviewed, classify the project-license decision as **pending owner confirmation**. This audit does not override the tracked file.

## Distribution-readiness checklist

| Gate | Evidence / required action | Status |
| --- | --- | --- |
| Immutable npm inputs and staged/package asset hashes | Lockfile integrity and all 14 manifest SHA-256 values; rerun `npm ci`, `verify:assets` and `--dist`. | Verified for local bytes. |
| wasi-sdk 25 sysroot origin | 1,250 files plus separate builtins archive byte-matched to official release. | Verified for those bytes. |
| Exact LLVM browser compiler rebuild | Source tag and recipe known, no independent binary-equivalent rebuild or attestation. | **Open**. |
| Exact Emscripten revision | Floating `latest` with no producer metadata. | **Blocking open issue**. |
| Third-party license texts and archive member notices | Main texts present; dlmalloc/fts references added; full source-to-member audit incomplete. | **Blocking open issue**. |
| Project license | AGPL text in tracked root file conflicts with prior pending status; owner confirmation outstanding. | **Pending owner decision/confirmation**. |
| Firefox and WebKit reliability | See dedicated investigation records. | Open until cross-browser failures are resolved or support limits are set. |
| Security boundary and hard memory limits | Phase 4B, per existing [security model](SECURITY-MODEL.md). | Open, outside this phase. |

**Candidate remains private and is not ready for public distribution.** Before publication, obtain fixed compiler build provenance or a controlled rebuild, finish notice-to-binary review with appropriate license expertise, confirm project licensing, and rerun the package/browser gates. Do not treat the existence of notice files as a compliance certification.
