import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = process.argv.includes("--dist") ? join(root, "dist") : root;
const manifest = JSON.parse(await readFile(join(target, "asset-manifest.json"), "utf8"));
if (manifest.schemaVersion !== 1 || manifest.toolchain?.browsercc !== "0.1.1" || manifest.toolchain?.llvm !== "20.1.2" || manifest.toolchain?.wasiSdk !== "25.0" || manifest.toolchain?.emscripten !== null || manifest.toolchain?.wasiShim !== "0.4.2" || manifest.toolchain?.target !== "wasm32-wasip1" || !Array.isArray(manifest.assets) || manifest.assets.length !== 14) throw new Error("Invalid asset manifest");
if (!process.argv.includes("--dist")) {
  const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
  for (const [name, expected] of [["browsercc", "0.1.1"], ["@bjorn3/browser_wasi_shim", "0.4.2"], ["playwright-core", "1.63.0"]]) {
    const installed = JSON.parse(await readFile(join(root, "node_modules", name, "package.json"), "utf8"));
    if (installed.version !== expected || lock.packages[`node_modules/${name}`]?.version !== expected || !lock.packages[`node_modules/${name}`]?.integrity) throw new Error(`Package version/integrity pin mismatch: ${name}`);
  }
}
const names = new Set();
for (const asset of manifest.assets) {
  if (names.has(asset.name) || !["compiler", "runtime"].includes(asset.role) || asset.required !== true || !/^[a-f0-9]{64}$/.test(asset.sha256) || !Number.isSafeInteger(asset.bytes) || !/^runtime\/(browsercc-0\.1\.1|browser-wasi-shim-0\.4\.2)\/[a-z0-9_.-]+$/.test(asset.path)) throw new Error(`Invalid manifest entry: ${asset.name}`);
  names.add(asset.name);
  const bytes = await readFile(join(target, asset.path));
  if (bytes.byteLength !== asset.bytes || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error(`Asset mismatch: ${asset.name}`);
}
const expected = new Set(manifest.assets.map((asset) => asset.path));
for (const directory of ["runtime/browsercc-0.1.1", "runtime/browser-wasi-shim-0.4.2"]) {
  for (const name of await readdir(join(target, directory))) {
    const path = `${directory}/${name}`;
    if (!expected.has(path) || !(await stat(join(target, path))).isFile()) throw new Error(`Unexpected runtime content: ${path}`);
  }
}
if (process.argv.includes("--dist")) {
  for (const path of ["src/index.js", "src/worker/compiler.js", "src/worker/execution.js", "src/worker/verify-assets.js", "README.md", "LICENSE", "THIRD-PARTY-NOTICES.md", "docs/PHASE-3-LICENSE-AUDIT.md", "docs/PHASE-4A-LICENSE-CLOSURE.md", "package.json", "licenses/browsercc-MIT.txt", "licenses/browser-wasi-shim-MIT.txt", "licenses/browser-wasi-shim-Apache-2.0.txt", "licenses/LLVM-20.1.2-LICENSE.txt", "licenses/wasi-libc-LICENSE.txt", "licenses/wasi-libc-LICENSE-APACHE.txt", "licenses/wasi-libc-LICENSE-APACHE-LLVM.txt", "licenses/wasi-libc-LICENSE-MIT.txt", "licenses/wasi-libc-musl-COPYRIGHT.txt", "licenses/wasi-libc-cloudlibc-LICENSE.txt", "licenses/wasi-libc-musl-fts-COPYING.txt", "licenses/wasi-libc-musl-fts-NOTICE.txt", "licenses/wasi-libc-dlmalloc-NOTICE.txt", "licenses/emscripten-LICENSE-reference.txt"]) await stat(join(target, path));
  for (const forbidden of ["node_modules", "tests", "scripts", "runtime/browsercc-0.1.1/stdc++.h.pch"]) {
    try { await stat(join(target, forbidden)); throw new Error(`Unexpected distribution content: ${forbidden}`); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}
process.stdout.write(`Verified ${manifest.assets.length} assets in ${process.argv.includes("--dist") ? "dist" : "runtime"}\n`);
