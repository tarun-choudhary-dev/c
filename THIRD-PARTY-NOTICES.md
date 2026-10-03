# Third-party notices for the local distribution candidate

This file is an audit aid, not a declaration that redistribution is approved. See the [Phase 4A license inventory](docs/PHASE-4A-LICENSE-CLOSURE.md) for the source-to-binary map and open obligations; the [Phase 3 audit](docs/PHASE-3-LICENSE-AUDIT.md) remains the historical baseline.

- `browsercc` 0.1.1 wrapper: MIT; the package's `LICENSE` is copied to `dist/licenses/browsercc-MIT.txt`.
- `@bjorn3/browser_wasi_shim` 0.4.2: MIT OR Apache-2.0; both package license files are copied to `dist/licenses/`.
- The Clang/LLD 20.1.2 toolchain uses LLVM code under Apache-2.0 WITH LLVM-exception; the tagged LLVM license text is copied to `dist/licenses/LLVM-20.1.2-LICENSE.txt`.
- The browsercc sysroot is derived from wasi-sdk 25.0 and includes wasi-libc and LLVM runtime pieces. Main license texts from wasi-libc's wasi-sdk-25 submodule commit, including musl, cloudlibc and musl-fts texts, are copied to `dist/licenses/`. Phase 4A added `wasi-libc-dlmalloc-NOTICE.txt` and `wasi-libc-musl-fts-NOTICE.txt` references: the packed `libc.a` contains `dlmalloc.o` and `fts.o`. The exact archive-member notice inventory remains open.
- Clang/LLD JavaScript is Emscripten-generated. Its exact Emscripten build version is unconfirmed because browsercc used `emsdk install latest`. A current upstream Emscripten license text is copied as a **reference only**, pending build provenance confirmation.

Do not treat this candidate package as release-ready. The tracked root `LICENSE` now contains GNU AGPL version 3 text, while earlier records and the Phase 4A brief describe the project license as pending. Owner confirmation of its intended application to project-owned material is still required; this notice does not choose or change it.

`playwright-core` is a development dependency and is not copied into `dist/`.
