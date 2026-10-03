import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");
async function snapshot(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await snapshot(path));
    else if (entry.isFile()) files.push([relative(dist, path).replaceAll("\\", "/"), createHash("sha256").update(await readFile(path)).digest("hex")]);
    else throw new Error(`Unexpected package entry: ${path}`);
  }
  return files;
}
const build = () => execFileSync(process.execPath, [join(root, "scripts/prepare-assets.mjs"), "--build"], { cwd: root, stdio: "pipe" });
build();
const first = (await snapshot(dist)).sort(([a], [b]) => a.localeCompare(b));
build();
const second = (await snapshot(dist)).sort(([a], [b]) => a.localeCompare(b));
if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error("Two builds produced different package bytes or file sets");
process.stdout.write(`Deterministic bytes and file set across two builds: ${first.length} files\n`);
