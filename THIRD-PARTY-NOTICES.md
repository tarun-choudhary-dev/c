# Third-party notices for the local distribution candidate

This file is an audit aid, not a declaration that redistribution is approved. See [the Phase 3 license audit](docs/PHASE-3-LICENSE-AUDIT.md) for open obligations and source URLs.

- `browsercc` 0.1.1 wrapper: MIT; the package's `LICENSE` is copied to `dist/licenses/browsercc-MIT.txt`.
- `@bjorn3/browser_wasi_shim` 0.4.2: MIT OR Apache-2.0; both package license files are copied to `dist/licenses/`.
- The Clang/LLD 20.1.2 toolchain uses LLVM code under Apache-2.0 WITH LLVM-exception; the tagged LLVM license text is copied to `dist/licenses/LLVM-20.1.2-LICENSE.txt`.
- The browsercc sysroot is derived from wasi-sdk 25.0 and includes wasi-libc and LLVM runtime pieces. License texts from wasi-libc's wasi-sdk-25 submodule commit, including listed musl, cloudlibc and musl-fts notices, are copied to `dist/licenses/`. An exact file-to-license inventory of the packed sysroot remains open.
- Clang/LLD JavaScript is Emscripten-generated. Its exact Emscripten build version is unconfirmed because browsercc used `emsdk install latest`. A current upstream Emscripten license text is copied as a **reference only**, pending build provenance confirmation.

Do not treat this candidate package as release-ready. The project-owned code also has a pending owner license decision.

`playwright-core` is a development dependency and is not copied into `dist/`.
