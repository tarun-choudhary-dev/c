# Proposed project structure

Only `docs/`, `README.md`, `LICENSE`, and `.gitignore` (plus local decision records) exist at the end of Phase 0. The following is a **future layout**, not a request to create empty files now.

```text
c-language-engine/
  src/
    index.js                 # public exports
    engine/                  # CEngine manager, lifecycle, artifact ownership
    validation/              # request and path checks, central limits
    compiler/                # private browser-Clang/LLD adapter
    runtime/                 # WASI execution adapter
    diagnostics/             # diagnostic and error normalization
    protocol/                # versioned Worker envelopes/schema guards
    worker/                  # compiler and execution Worker entries
  assets/                    # pinned build manifest and copied runtime assets (later)
  tests/
    unit/                    # manager, validator, normalizer with fake Workers
    integration/             # pinned compiler/WASI integration
    browser/                 # real browser API and consumer tests
    security/                # limits, hostile input, origin/CSP tests
  scripts/                   # reproducible build/asset copy and audit tooling
  docs/                      # architecture, contracts, research and review
  examples/                  # minimal programmatic consumer, no IDE frontend
  package.json               # later package/build metadata
  README.md
  LICENSE
  .gitignore
```

The `engine/` directory keeps state transitions, timers, cancellation and recovery together rather than splitting each into tiny modules. `validation/` owns both the project filesystem mapper and limits. `compiler/` and `runtime/` are separate because their Workers and failure modes differ. `protocol/` is private despite having its own version, since the application consumes only the public API. `assets/` is empty until a pinned toolchain passes Phase 1; it must not become a dump of untracked binaries. `examples/` will contain only a small JS integration sample, not an editor or UI.

Directories can be consolidated if implementation remains small. No `internal/` catch-all is proposed; every private unit should have a clear owner. See [architecture](ARCHITECTURE.md) and [distribution](DISTRIBUTION-PLAN.md).
