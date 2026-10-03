# Phase 3 implementation plan

_2026-10-03. This is the implementation plan, not a verification claim._

1. Inventory the installed, pinned browsercc and WASI shim files and record hashes from their bytes. Exclude the unused C++ precompiled header.
2. Stage only required files in a versioned `runtime/` tree. Keep the manifest in source control, verify installed inputs against it, and make a clean `dist/` package with the same files.
3. Verify compiler assets in the compiler Worker before dynamic import or Wasm use; verify shim files in the execution Worker before import. Report asset errors distinctly. Preserve the public API and existing Worker protocol.
4. Run the existing browser suite unchanged in meaning on Edge, Chrome, Firefox and available WebKit. Add focused integrity and package tests, then collect timed baselines.
5. Audit actual license files and packaging contents, document remaining provenance and legal decisions, and complete a Phase 3 review.

The file/hash manifest is a checked-in pin, not a signature. A party that can change engine code and the manifest can change both; browser verification cannot establish origin integrity in that case.
