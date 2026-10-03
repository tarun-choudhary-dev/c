# Diagnostics and optional inspection

## Portable diagnostic record

```js
{
  severity: "error" | "warning" | "note" | "remark" | "fatal",
  message: "expected ';' after expression",
  file: "main.c",       // null for linker/global messages
  line: 5,              // 1-based integer or null
  column: 1,            // 1-based integer or null
  code: null,           // e.g. "-Wunused-variable" when emitted
  source: "compiler" | "linker",
  related: []           // bounded include-stack/notes where reliably parsed
}
```

Clang documents error, warning, note, remark and fatal classes; its default text contains `file:line:column: severity: message` and can show warning option names. LLD emits text diagnostics, often without a source location. Disable color/caret output for parsing where the pinned build supports it; keep a bounded `rawDiagnostics` transcript so information is not lost when a line cannot be parsed. Normalize virtual `/project` paths to request paths and strip internal sysroot paths when safe. Never invent locations or codes. If an include stack is reliably recognized, attach related locations; otherwise preserve it in raw text. [Clang diagnostics](https://clang.llvm.org/docs/UsersManual.html), [wasm-ld](https://lld.llvm.org/WebAssembly.html).

Clang's documented SARIF output exists but is labeled unstable, and the selected browser build may not include it. Start with conservative text parsing and test actual output for syntax errors, type errors, warnings, missing headers, duplicate/unresolved symbols and fatal driver errors. A line that cannot be parsed becomes a bounded diagnostic with null location only if it clearly represents an issue; incidental chatter stays in raw text. `diagnosticsTruncated` signals caps. Diagnostics must not be interpreted as Worker protocol messages or used for success detection; exit status and artifact validation determine success.

## Inspection later

Keep analysis outside normal `compile()`/`run()` semantics. Clang documents preprocessing (`-E`), syntax-only analysis, assembly (`-S`), and LLVM IR (`-emit-llvm`), and supports AST-related flags. Whether the pinned browser build exposes each safely is **unverified**. A future explicit `inspect(request, kind)` may offer `preprocessed`, `tokens`, `ast`, `llvm-ir`, `wasm-text`, or optimization remarks one at a time, with separate output caps and deadlines. Do not promise token/AST schemas or optimization output until a proof of concept establishes format stability. [Clang stages](https://clang.llvm.org/docs/CommandGuide/clang.html), [toolchain stages](https://clang.llvm.org/docs/Toolchain.html), [diagnostic/optimization options](https://clang.llvm.org/docs/UsersManual.html).
