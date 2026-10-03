# Project files and virtual filesystem

## Initial release direction

Multi-file C and user headers belong in the initial public contract, because normal C projects link multiple translation units and use headers. The browsercc convenience wrapper supports one source plus extra files, so implementing the planned compile-each-`.c` and link workflow is a **Phase 1 feasibility gate**. If it fails, release is delayed or the toolchain adapter changes; the public input model should not be silently weakened.

```js
{
  files: [
    { path: "main.c", source: '#include "math_utils.h"\nint main(void) { return add(1, 2) == 3 ? 0 : 1; }' },
    { path: "math_utils.c", source: "int add(int a, int b) { return a + b; }" },
    { path: "math_utils.h", source: "int add(int a, int b);" }
  ],
  entry: "main.c"
}
```

## Canonical path rules

Paths use `/` separators, relative to a private `/project` root. Reject absolute paths, backslashes, drive/UNC prefixes, empty segments, `.` and `..` segments, NUL/control characters, URL syntax, trailing slash and reserved internal prefixes. Normalize Unicode to NFC **before** duplicate checks, then reject paths that differ only by case for cross-platform predictability, even though the virtual FS may be case-sensitive. Do not silently rewrite a path. Limit path bytes, segments, count and aggregate source bytes as in [resource limits](RESOURCE-LIMITS.md). `entry` must exactly match a `.c` file after validation. One `main` must link; `entry` selects the primary source for presentation and deterministic ordering, not a linker symbol override.

The validator accepts only `.c` source and `.h` header files in v1. It does not accept prebuilt `.o`, `.a`, symlinks, device nodes or nested package metadata. Compile all `.c` files in canonical sorted order with unique engine-generated object paths under a separate internal directory. Link once with the pinned startup and C libraries. Duplicate definitions and missing symbols are linker diagnostics. File order must not be used as a substitute for C linkage semantics.

## Resolution and isolation

For `#include "x.h"`, Clang first searches relative to the including file according to its normal rules, then the project include root; `#include <stdio.h>` searches only the pinned system sysroot. The adapter passes fixed `-I`/`-isystem` paths it owns; users cannot inject paths or flags. The compiler's in-memory FS contains a read-only verified sysroot and an ephemeral per-request project tree. It is cleared before the next request (or the compiler Worker is restarted if cleanup cannot be trusted). No OS filesystem, browser storage, or network-backed include is mounted. The execution Worker receives only the linked Wasm bytes and stdin in v1, with no project files preopened.

Filesystem operations by a running C program are limited to the chosen WASI host's explicitly preopened directories. The initial contract provides no project file access at runtime. Standard C file calls may return WASI errors if no directory is preopened; tests must establish exact behavior. This is compatible with Hello World, stdin/stdout/stderr, and memory/algorithm examples without introducing application persistence. [WASI P1 preopens](https://wasi.dev/releases/wasi-p1), [wasi-libc scope](https://github.com/WebAssembly/wasi-libc).

## Out of scope

No package manager, build scripts, Makefiles, user-provided compiler flags, external libraries, binary assets, persistent files, or IDE project model. These would need separate security and API contracts.
