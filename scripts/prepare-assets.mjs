import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = join(root, "asset-manifest.json");
const entries = [
  ...["index.js", "clang.js", "clang.wasm", "lld.js", "lld.wasm", "sysroot.tar"].map((name) => ({
    name: `browsercc/${name}`, version: "0.1.1", upstream: "https://github.com/BertalanD/browsercc", source: `node_modules/browsercc/dist/${name}`, path: `runtime/browsercc-0.1.1/${name}`, license: name === "index.js" ? "MIT" : "See PHASE-3-LICENSE-AUDIT.md", required: true, role: "compiler",
  })),
  ...["index.js", "wasi.js", "fd.js", "fs_mem.js", "fs_opfs.js", "strace.js", "wasi_defs.js", "debug.js"].map((name) => ({
    name: `wasi-shim/${name}`, version: "0.4.2", upstream: "https://github.com/bjorn3/browser_wasi_shim", source: `node_modules/@bjorn3/browser_wasi_shim/dist/${name}`, path: `runtime/browser-wasi-shim-0.4.2/${name}`, license: "MIT OR Apache-2.0", required: true, role: "runtime",
  })),
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (message) => { throw new Error(message); };

export async function verifySourceAssets(manifest) {
  if (manifest.schemaVersion !== 1 || manifest.toolchain?.browsercc !== "0.1.1" || manifest.toolchain?.llvm !== "20.1.2" || manifest.toolchain?.wasiSdk !== "25.0" || manifest.toolchain?.emscripten !== null || manifest.toolchain?.wasiShim !== "0.4.2" || manifest.toolchain?.target !== "wasm32-wasip1" || !Array.isArray(manifest.assets) || manifest.assets.length !== entries.length) fail("Invalid or incompatible asset manifest");
  for (const expected of entries) {
    const asset = manifest.assets.find((item) => item.name === expected.name);
    if (!asset || Object.entries(expected).some(([key, value]) => asset[key] !== value) || !/^[a-f0-9]{64}$/.test(asset.sha256) || !Number.isSafeInteger(asset.bytes) || asset.bytes < 1) fail(`Invalid manifest entry: ${expected.name}`);
    let bytes;
    try { bytes = await readFile(join(root, expected.source)); }
    catch { fail(`Missing required source asset: ${expected.source}`); }
    if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) fail(`Asset mismatch: ${expected.source}`);
  }
  return true;
}

async function main() {
  const record = process.argv.includes("--initial-manifest");
  const build = process.argv.includes("--build");
  if (record) {
    let existing;
    try { existing = await readFile(manifestPath); } catch { /* Initial recording only. */ }
    if (existing) fail("Refusing to replace an existing manifest");
    const assets = [];
    for (const entry of entries) {
      const bytes = await readFile(join(root, entry.source));
      assets.push({ ...entry, bytes: bytes.length, sha256: sha256(bytes) });
    }
    await writeFile(manifestPath, JSON.stringify({ schemaVersion: 1, toolchain: { browsercc: "0.1.1", llvm: "20.1.2", wasiSdk: "25.0", emscripten: null, wasiShim: "0.4.2", target: "wasm32-wasip1" }, assets }, null, 2) + "\n");
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  await verifySourceAssets(manifest);
  const targetRoot = resolve(root, build ? "dist" : ".");
  if (build) {
    if (targetRoot === resolve(root) || !targetRoot.startsWith(resolve(root) + sep)) fail("Distribution target escapes project root");
    try { if ((await lstat(targetRoot)).isSymbolicLink()) fail("Refusing to replace a linked distribution directory"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    await rm(targetRoot, { recursive: true, force: true });
    await mkdir(targetRoot, { recursive: true });
  }
  for (const entry of entries) {
    const destination = join(targetRoot, entry.path);
    await mkdir(dirname(destination), { recursive: true });
    await cp(join(root, entry.source), destination);
  }
  if (build) {
    await cp(join(root, "src"), join(targetRoot, "src"), { recursive: true });
    await cp(join(root, "docs"), join(targetRoot, "docs"), { recursive: true });
    await cp(manifestPath, join(targetRoot, "asset-manifest.json"));
    for (const file of ["README.md", "LICENSE", "THIRD-PARTY-NOTICES.md"]) await cp(join(root, file), join(targetRoot, file));
    await mkdir(join(targetRoot, "licenses"), { recursive: true });
    await cp(join(root, "node_modules/browsercc/LICENSE"), join(targetRoot, "licenses/browsercc-MIT.txt"));
    await cp(join(root, "node_modules/@bjorn3/browser_wasi_shim/LICENSE-MIT"), join(targetRoot, "licenses/browser-wasi-shim-MIT.txt"));
    await cp(join(root, "node_modules/@bjorn3/browser_wasi_shim/LICENSE-APACHE"), join(targetRoot, "licenses/browser-wasi-shim-Apache-2.0.txt"));
    await cp(join(root, "licenses"), join(targetRoot, "licenses"), { recursive: true });
    await writeFile(join(targetRoot, "package.json"), JSON.stringify({ name: "@tarun-choudhary/c-language-engine", version: "0.0.0-phase3", private: true, type: "module", exports: { ".": "./src/index.js" } }, null, 2) + "\n");
  }
  for (const entry of entries) {
    const bytes = await readFile(join(targetRoot, entry.path));
    const asset = manifest.assets.find((item) => item.name === entry.name);
    if (sha256(bytes) !== asset.sha256) fail(`Staged asset mismatch: ${entry.path}`);
  }
  process.stdout.write(`${build ? "Built dist" : "Prepared runtime"}: ${entries.length} verified assets\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
