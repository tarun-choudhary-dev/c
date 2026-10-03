import { Clang, LLD, setUpSysroot } from "../../node_modules/browsercc/dist/index.js";

const defaultAssetBaseUrl = new URL("../../node_modules/browsercc/dist/", import.meta.url);
let initialization;
const DIAGNOSTIC_LIMIT = 128 * 1024;
const DIAGNOSTIC_COUNT = 200;

function initializeToolchain(assetBaseUrl = defaultAssetBaseUrl) {
  if (initialization) return initialization;
  initialization = (async () => {
    const started = performance.now();
    const response = await fetch(new URL("sysroot.tar", assetBaseUrl));
    if (!response.ok) throw new Error(`Sysroot fetch failed (${response.status})`);
    const sysroot = await response.arrayBuffer();
    const versionOf = async (factory, program) => {
      let output = "";
      const capture = (line) => { output += line + "\n"; };
      const instance = await factory({ thisProgram: program, print: capture, printErr: capture });
      instance.callMain(["--version"]);
      return { version: output.trim().split("\n")[0], wasmMemoryBytes: instance.HEAPU8?.byteLength ?? null };
    };
    const clang = await versionOf(Clang, "clang");
    const lld = await versionOf(LLD, "wasm-ld");
    return { sysroot, info: { clang, lld, sysrootBytes: sysroot.byteLength, initializationMs: performance.now() - started, target: "wasm32-wasip1" } };
  })();
  return initialization;
}

function diagnosticRecords(raw, stage) {
  return raw.split(/\r?\n/).flatMap((line) => {
    const match = /^(.*?):(\d+):(\d+): (fatal error|error|warning|note): (.*)$/.exec(line);
    if (match) return [{ severity: match[4] === "fatal error" ? "fatal" : match[4], message: match[5], file: match[1], line: Number(match[2]), column: Number(match[3]), code: null, source: "compiler" }];
    if (/^wasm-ld: error:/.test(line)) return [{ severity: "error", message: line.slice(16), file: null, line: null, column: null, code: null, source: "linker" }];
    return [];
  });
}

function writeProjectFile(module, path, source) {
  const directory = path.split("/").slice(0, -1).join("/");
  if (directory) module.FS.mkdirTree(directory);
  module.FS.writeFile(path, source);
}

async function compileC(files, options = {}) {
  let transcript = "";
  let transcriptBytes = 0;
  let diagnosticsTruncated = false;
  const decoder = new TextDecoder();
  const printErr = (line) => {
    const bytes = new TextEncoder().encode(line + "\n");
    const available = Math.max(0, DIAGNOSTIC_LIMIT - transcriptBytes);
    transcript += decoder.decode(bytes.subarray(0, available));
    transcriptBytes += Math.min(available, bytes.length);
    if (bytes.length > available) diagnosticsTruncated = true;
  };
  const flags = ["-std=c17", "-O0", ...(options.warnings === "all" ? ["-Wall"] : []), "-Wl,--export=main"];
  const { sysroot } = await initializeToolchain();
  const driver = await Clang({ thisProgram: "clang", printErr });
  for (const file of files) writeProjectFile(driver, file.path, file.source);
  driver.FS.mkdirTree("/lib/wasm32-wasi");
  driver.FS.mkdirTree("/include/c++/v1");
  driver.FS.writeFile("/lib/wasm32-wasi/crt1-command.o", new Uint8Array());
  driver.FS.writeFile("/lib/wasm32-wasi/crt1-reactor.o", new Uint8Array());
  const sourcePaths = files.filter((file) => file.path.endsWith(".c")).map((file) => file.path);
  const driverCode = driver.callMain([...sourcePaths, ...flags, "-###"]);
  if (driverCode !== 0) throw new Error(`Clang driver failed: ${transcript}`);
  const parseLine = (line, key) => {
    const args = line?.match(/"([^"]*)"/g)?.map((part) => part.slice(1, -1)).slice(1);
    if (!args) throw new Error(`Clang driver did not report ${key}: ${transcript}`);
    const outputIndex = args.indexOf("-o");
    if (outputIndex < 0) throw new Error(`Clang driver did not report output for ${key}`);
    return { args, output: args[outputIndex + 1] };
  };
  const frontends = transcript.split("\n").filter((line) => line.includes("-cc1")).map((line) => parseLine(line, "-cc1"));
  const linker = parseLine(transcript.split("\n").find((line) => line.includes("wasm-ld")), "wasm-ld");
  if (frontends.length !== sourcePaths.length) throw new Error(`Expected ${sourcePaths.length} Clang frontend commands, got ${frontends.length}`);
  const tripleIndex = frontends[0].args.indexOf("-triple");
  const targetTriple = tripleIndex >= 0 ? frontends[0].args[tripleIndex + 1] : null;
  transcript = "";
  transcriptBytes = 0;
  diagnosticsTruncated = false;
  const objects = [];
  for (const frontend of frontends) {
    const clang = await Clang({ thisProgram: "clang", printErr });
    for (const file of files) writeProjectFile(clang, file.path, file.source);
    setUpSysroot(clang, sysroot);
    const compileCode = clang.callMain(frontend.args);
    if (compileCode !== 0) return { stage: "compile", transcript, diagnosticsTruncated, wasm: null, linkerArgs: linker.args, targetTriple };
    objects.push({ path: frontend.output, bytes: clang.FS.readFile(frontend.output, { encoding: "binary" }) });
  }
  const lld = await LLD({ thisProgram: "wasm-ld", printErr });
  for (const object of objects) lld.FS.writeFile(object.path, object.bytes);
  setUpSysroot(lld, sysroot);
  const linkCode = lld.callMain(linker.args);
  if (linkCode !== 0) return { stage: "link", transcript, diagnosticsTruncated, wasm: null, linkerArgs: linker.args, targetTriple };
  return { stage: "complete", transcript, diagnosticsTruncated, wasm: lld.FS.readFile(linker.output, { encoding: "binary" }), linkerArgs: linker.args, targetTriple };
}

self.onmessage = async ({ data }) => {
  const { protocolVersion, generation, requestId, kind, payload } = data ?? {};
  if (!Number.isSafeInteger(requestId)) return;
  const send = (response, transfer = []) => self.postMessage({ protocolVersion: 1, generation, requestId, ...response }, transfer);
  if (protocolVersion !== 1 || !Number.isSafeInteger(generation)) {
    send({ kind: "error", error: { code: "PROTOCOL_ERROR", stage: "communication", message: "Unsupported Worker protocol" } });
    return;
  }
  if (kind === "initialize") {
    try {
      const { info } = await initializeToolchain(payload?.assetBaseUrl ? new URL(payload.assetBaseUrl) : defaultAssetBaseUrl);
      send({ kind: "initializeResult", result: info });
    } catch (error) {
      send({ kind: "error", error: { code: "INITIALIZATION_FAILED", stage: "initialization", message: String(error?.message ?? error).slice(0, 4096) } });
    }
    return;
  }
  if (kind !== "compile") {
    send({ kind: "error", error: { code: "PROTOCOL_ERROR", stage: "communication", message: "Unknown compiler request" } });
    return;
  }
  try {
    const files = payload.files ?? [{ path: payload.filename, source: payload.source }];
    const started = performance.now();
    const { transcript, diagnosticsTruncated, wasm, stage, linkerArgs, targetTriple } = await compileC(files, payload.options);
    const module = wasm ? await WebAssembly.compile(wasm) : null;
    const diagnostics = diagnosticRecords(transcript, stage);
    const result = {
      status: module ? "success" : "error",
      stage,
      diagnostics: diagnostics.slice(0, DIAGNOSTIC_COUNT),
      rawDiagnostics: transcript,
      diagnosticsTruncated: diagnosticsTruncated || diagnostics.length > DIAGNOSTIC_COUNT,
      durationMs: performance.now() - started,
      wasm,
      imports: module ? WebAssembly.Module.imports(module) : null,
      exports: module ? WebAssembly.Module.exports(module) : null,
      linkerArgs,
      targetTriple,
    };
    send({ kind: "compileResult", result }, wasm ? [wasm.buffer] : []);
  } catch (error) {
    send({ kind: "error", error: { code: "WORKER_FAILED", stage: "compilation", message: String(error?.message ?? error).slice(0, 4096) } });
  }
};
