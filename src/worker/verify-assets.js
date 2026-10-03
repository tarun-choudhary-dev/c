export class AssetVerificationError extends Error {
  constructor(message, kind = "integrity") { super(message); this.name = "AssetVerificationError"; this.kind = kind; }
}

const REQUIRED = Object.freeze({
  compiler: ["index.js", "clang.js", "clang.wasm", "lld.js", "lld.wasm", "sysroot.tar"],
  runtime: ["index.js", "wasi.js", "fd.js", "fs_mem.js", "fs_opfs.js", "strace.js", "wasi_defs.js", "debug.js"],
});

function invalid(message, kind) { throw new AssetVerificationError(message, kind); }

export async function loadManifest() {
  let response;
  try { response = await fetch(new URL("../../asset-manifest.json", import.meta.url), { cache: "no-store" }); }
  catch { invalid("Asset manifest could not be loaded", "missing"); }
  if (!response.ok) invalid(`Asset manifest is unavailable (${response.status})`, "missing");
  let manifest;
  try { manifest = await response.json(); }
  catch { invalid("Asset manifest is not valid JSON"); }
  if (manifest?.schemaVersion !== 1 || manifest.toolchain?.browsercc !== "0.1.1" || manifest.toolchain?.llvm !== "20.1.2" || manifest.toolchain?.wasiSdk !== "25.0" || manifest.toolchain?.emscripten !== null || manifest.toolchain?.wasiShim !== "0.4.2" || manifest.toolchain?.target !== "wasm32-wasip1" || !Array.isArray(manifest.assets) || manifest.assets.length !== 14) invalid("Asset manifest has an incompatible schema");
  const names = new Set();
  for (const entry of manifest.assets) {
    if (!entry || typeof entry !== "object" || typeof entry.name !== "string" || typeof entry.source !== "string" || !entry.source || typeof entry.upstream !== "string" || !entry.upstream || typeof entry.license !== "string" || !entry.license || typeof entry.sha256 !== "string") invalid("Asset manifest has an invalid entry");
    const prefix = entry.role === "compiler" ? "browsercc" : entry.role === "runtime" ? "wasi-shim" : null;
    const version = entry.role === "compiler" ? "0.1.1" : "0.4.2";
    const dir = entry.role === "compiler" ? "browsercc-0.1.1" : "browser-wasi-shim-0.4.2";
    const name = entry.name.slice(prefix?.length + 1);
    if (!prefix || !REQUIRED[entry.role].includes(name) || entry.name !== `${prefix}/${name}` || entry.path !== `runtime/${dir}/${name}` || entry.version !== version || entry.required !== true || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || !/^[a-f0-9]{64}$/.test(entry.sha256) || names.has(entry.name)) invalid("Asset manifest has an invalid entry");
    names.add(entry.name);
  }
  for (const [role, files] of Object.entries(REQUIRED)) for (const file of files) if (!names.has(`${role === "compiler" ? "browsercc" : "wasi-shim"}/${file}`)) invalid("Asset manifest is missing a required entry");
  return manifest;
}

export async function fetchVerifiedAssets(manifest, role, baseUrl) {
  if (!globalThis.crypto?.subtle) invalid("Asset verification requires a secure browser context", "missing");
  const prefix = role === "compiler" ? "browsercc" : "wasi-shim";
  const verified = new Map();
  for (const file of REQUIRED[role]) {
    const entry = manifest.assets.find((asset) => asset.name === `${prefix}/${file}`);
    const url = role === "compiler" ? new URL(file, baseUrl) : new URL(`../../${entry.path}`, import.meta.url);
    let response;
    try { response = await fetch(url, { cache: "no-store" }); }
    catch { invalid(`Required asset could not be loaded: ${entry.name}`, "missing"); }
    if (!response.ok) invalid(`Required asset is unavailable: ${entry.name} (${response.status})`, "missing");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== entry.bytes) invalid(`Asset size mismatch: ${entry.name}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (actual !== entry.sha256) invalid(`Asset hash mismatch: ${entry.name}`);
    verified.set(file, bytes);
  }
  return verified;
}
