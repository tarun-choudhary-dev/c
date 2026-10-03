# Phase 3 integrity model

_Implemented and tested in headless Edge 154.0.4258.53 on Windows, 2026-10-03._

The manifest is a **checked-in byte pin**. The preparation script refuses to overwrite an existing manifest and rejects a source file whose size or SHA-256 differs. `verify:assets` checks staged bytes and exact runtime file membership; `--dist` checks the candidate package. Browser Workers fetch the manifest and validate its schema, names, paths, versions, required flags, byte lengths and SHA-256 values. The compiler Worker then fetches and verifies six compiler files before importing browsercc or instantiating Clang/LLD. It supplies the verified Wasm bytes through Emscripten's `wasmBinary` option and uses the verified sysroot bytes. The execution Worker verifies eight shim JS files before importing the shim and instantiating the program.

`assetBaseUrl` remains the public override for the compiler directory; the runtime shim and manifest resolve relative to the engine package. A required file or manifest that cannot be fetched yields `INITIALIZATION_FAILED` with `initialization` or `runtime-initialization` stage. An invalid manifest, length mismatch, or SHA-256 mismatch yields `ASSET_ERROR` at that stage. Neither is a user C compilation diagnostic. Compiler initialization failures leave the engine `failed`; `reset()` or a later `initialize()` can retry after the server is repaired. Execution shim failures reject the run and leave an otherwise healthy compiler ready; the artifact can be executed again after repair.

The [focused browser test](../tests/browser/assets.mjs) covers valid hashes, missing compiler assets, corrupted compiler and shim files, wrong expected hash, malformed manifest, same-engine reset after corruption, retry after a missing file, and an isolated package consumer. The [Node verifier](../scripts/verify-assets.mjs) checks the staged and packaged bytes.

## Trust limits

- A party able to replace **both** the asset and manifest can make a changed asset pass. This is accidental corruption and deployment mismatch detection, not an authenticated signature or hostile CDN defense. Serve the engine code and manifest from a trusted, versioned origin.
- JavaScript modules are fetched once for verification and again by `import()`. A server that changes bytes between these operations can bypass this check. Immutable deployment, CSP and eventually content-addressed module URLs or a verified bundling scheme are needed for a stronger boundary.
- The Worker code, browser, WebCrypto implementation and initial HTML origin are trusted. WebAssembly validation and Worker separation do not provide a complete application sandbox.
- Hashing costs time and memory, including a full 94 MB compiler asset set. No hard browser memory limit was added.
- `crypto.subtle.digest` needs a [secure context](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest). The tested `127.0.0.1` origin qualifies; remote HTTP deployment has not been tested and is not a supported integrity setup.
