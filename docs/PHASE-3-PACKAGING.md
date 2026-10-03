# Phase 3 packaging workflow

_Local candidate package; no publication is authorized. Byte-for-byte staging from pinned npm inputs is implemented. Rebuilding browsercc from source is not yet reproducible._

## Commands

Run from the repository root with Node 24 and npm 11 (the versions used for verification):

```powershell
npm ci
npm run prepare:assets
npm run verify:assets
npm run build
node scripts/verify-assets.mjs --dist
npm run test:packaging
$env:C_ENGINE_TEST_SUMMARY='1'; npm run test:browser
npm run test:assets
```

`npm ci` downloads the exact lockfile versions and checks npm tarball integrity. No compiler binary is checked into Git. `prepare:assets` stages the 14 pinned files in ignored `runtime/`, first comparing each installed source with `asset-manifest.json`; absent or changed inputs fail. `build` recreates ignored `dist/` from those pinned inputs and copies `src/`, `docs/`, the manifest, README, license status, third-party notices and collected license texts. `verify:assets --dist` checks file hashes and excludes `node_modules`, tests, scripts and the optional C++ PCH. The package has a private ES module entry at `src/index.js` and relative `runtime/` paths; it does not need repository `node_modules` or a backend after preparation.

To test an independent static consumer, `npm run test:assets` serves **only `dist/`** from a loopback HTTP origin and imports `/src/index.js`; its `distConsumer` check compiles and executes C. A host application must serve the entire `dist/` tree at one directory URL, preserve relative paths and Wasm/JS MIME types, and permit module Workers and WebAssembly in its CSP. Verification uses `crypto.subtle.digest`, so deployment needs a [secure browser context](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts) such as HTTPS or trustworthy localhost; ordinary remote HTTP is unsuitable. The `assetBaseUrl` constructor option remains available when compiler assets are hosted at another HTTP(S) directory. It does not relocate the manifest or execution shim.

The output was deterministic at the file byte level for the same checked-in source and locked npm tarballs: `test:packaging` built twice and compared all **69** relative paths and hashes successfully on 2026-10-03. There is no minification or timestamped archive step. This is a local staging result, not proof of bit-identical upstream compiler rebuilds. The upstream browsercc source build is **not** pinned end to end because its Dockerfile installs Emscripten `latest`; the npm package's exact bytes are pinned instead. The [license audit](PHASE-3-LICENSE-AUDIT.md) still blocks redistribution readiness.
