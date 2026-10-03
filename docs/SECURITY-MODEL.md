# Browser security model

## Threats and trust boundaries

User C source is untrusted. It may contain infinite loops, output floods, large allocations, hostile filenames/includes, malformed input to compiler/linker, and deliberate attempts to trigger compiler, WASI host, or browser flaws. Compiler and linker are complex native code compiled to Wasm and also process attacker-controlled content. The JavaScript WASI host and protocol parser are trusted code and must be kept small. An external IDE may have sensitive application state and credentials, so it is a separate trust boundary.

```text
parent IDE (trusted application state)
  -> public engine API / message validator
  -> optional separate-origin sandboxed frame (required for hardened deployment)
  -> compiler Worker (Clang/LLD; untrusted source input)
  -> execution Worker (guest Wasm + curated WASI P1 imports)
```

The guest Wasm module can access only its linear memory and host functions explicitly imported by the execution adapter; it has no direct DOM or `fetch` import. The Worker itself has no DOM/window access, but **Worker JavaScript does have `fetch`** and may have origin-scoped browser capabilities. Wasm memory isolation does not protect against a vulnerability in trusted JavaScript glue, the compiler, the browser Wasm implementation, or over-broad WASI imports. [WASI security model](https://wasi.dev/), [Workers and DOM/network](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [Fetch in Workers](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

## Deployment levels and iframe decision

**Local development / baseline:** Workers created by the package on the host origin. This prevents direct C-to-DOM access and allows termination, but a compromised Worker script shares the application's origin; do not describe it as strong isolation from application storage or same-origin network services.

**Hardened integration for arbitrary adversarial submissions:** Host the engine assets on a **separate, dedicated origin** with no application cookies or private storage, inside an iframe with `sandbox="allow-scripts allow-same-origin"`. The public constructor requires a `sandboxFrameUrl` on that origin, and `assetBaseUrl` must share the frame origin. The frame is a protocol bootstrap without a visible interface. The parent and frame exchange only versioned, validated `postMessage` payloads with exact allowed `origin` and `source` checks; the frame starts its own Workers. Apply a restrictive CSP on the frame and Worker responses. This iframe is required when the threat model includes a compiler/runtime compromise impacting a sensitive IDE origin. It is not required to make ordinary Wasm execution function. The frame should be cross-origin from the IDE: combining `allow-scripts` and `allow-same-origin` on a **same-origin** frame defeats the sandbox protection. The dedicated origin must serve pinned static assets and have no credentials worth protecting. [iframe warning](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe), [CSP sandbox](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox).

The package must not silently claim an isolated origin when one was not configured. `getRuntimeInfo()` should report the effective deployment mode. Cross-origin iframe bootstrapping, asset fetching and Worker creation need a Phase 1 browser proof. If hardened mode cannot be made to work, deployment to a sensitive host remains blocked; baseline local development can still proceed.

## Controls

| Threat | Control and honest limit |
| --- | --- |
| Parent/window/DOM access | Wasm has no such imports; Workers lack DOM. Separate-origin frame protects the parent if Worker JavaScript is compromised. Parent validates message origin, `source`, schema, generation and size. |
| Storage and network | Do not expose WASI sockets or host file APIs. Dedicated origin has no IDE storage; CSP `connect-src` limits Worker fetch. A same-origin Worker can still fetch through JavaScript, and CSP/browser policy cannot be described as a universal network firewall. |
| Filesystem escape | User project paths are canonical relative paths in a new in-memory root. Only pinned sysroot is mounted for compile. No host filesystem or persistent browser storage is mounted. Execution has no project directory preopen in v1. |
| Infinite loops and excessive CPU | Main-thread manager deadline plus Worker termination; browser scheduling may delay enforcement. No CPU instruction quota is promised. |
| Memory exhaustion | Source, asset, output and artifact budgets; optional Wasm maximum where supported; Worker retirement. Browser process/Worker memory cannot be reliably capped from ordinary JavaScript. A compiler can exhaust memory before manager responds. |
| Output flooding | Byte counters at fd 1/2 stop buffering at configured caps; output remains bounded even if the program continues. Timeout eventually terminates it, subject to scheduling. |
| Malformed protocol or stale replies | Typed envelope, maximum payload, expected state/request/generation, reject unexpected data and retire offending Worker. Never trust a Worker response merely because it arrived over `postMessage`. |
| Unexpected Worker death | Reject active operation with `WORKER_FAILED`; advance generation; retire and recreate affected runtime. Do not replay source automatically. |
| Supply chain / asset substitution | Pin versions and hashes, self-host assets, verify manifest/content, document third-party licenses, test fresh installs. HTTPS/static hosting in integration. |

Configure `worker-src`, `script-src 'wasm-unsafe-eval'` where supported, and `connect-src` for the exact static asset origin(s). Avoid broad `unsafe-eval` unless the pinned compiler glue proves it necessary. CSP for a Worker must be delivered on the Worker script response; a parent page policy alone is insufficient. `connect-src 'none'` is possible only if assets are not fetched through that interface, which is unlikely for this toolchain. The exact policy requires browser testing. [Wasm CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src), [connect-src](https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src), [Worker CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy).

## Security tests required before release

Automate path traversal, duplicate paths, request/protocol fuzz cases, huge sources, output flooding, infinite loops, stale reply injection, Worker failure, reset-after-failure and artifact forgery. In real browsers, manually verify no guest DOM access, no guest network/socket import, no guest persistent storage, parent cannot be read from isolated origin, CSP behavior, Worker termination and recovery, and browser memory behavior. Repeat on supported browsers. These are tests to perform, not claims of tests already passed.

## Known limits

No client-only design can promise strict CPU or process memory quotas, defense against browser engine vulnerabilities, perfect execution deadlines under tab throttling, or full POSIX behavior. A separate origin limits damage to the parent application but does not make arbitrary compiler/runtime code harmless. The host application must avoid passing secrets into source, stdin, diagnostics, or the sandbox origin.
