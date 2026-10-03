import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const browsercc = join(root, "runtime/browsercc-0.1.1");
const decoder = new TextDecoder();

function readVar(bytes, position) {
  let value = 0;
  let shift = 0;
  for (let i = 0; i < 5; i++) {
    const byte = bytes[position++];
    if (byte === undefined) throw new Error("Truncated Wasm variable integer");
    value |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) return [value >>> 0, position];
    shift += 7;
  }
  throw new Error("Oversized Wasm variable integer");
}

function wasmSections(bytes) {
  if (bytes.subarray(0, 8).toString("hex") !== "0061736d01000000") throw new Error("Invalid Wasm header");
  const sections = [];
  let position = 8;
  while (position < bytes.length) {
    const id = bytes[position++];
    const [size, bodyStart] = readVar(bytes, position);
    const end = bodyStart + size;
    if (end > bytes.length) throw new Error("Truncated Wasm section");
    if (id === 0) {
      const [nameLength, nameStart] = readVar(bytes, bodyStart);
      const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
      sections.push({ name, bytes: size });
    }
    position = end;
  }
  return sections;
}

function tarMembers(bytes) {
  const members = [];
  for (let position = 0; position + 512 <= bytes.length;) {
    const header = bytes.subarray(position, position + 512);
    if (header.every((byte) => byte === 0)) break;
    const nul = (range) => decoder.decode(range.subarray(0, range.indexOf(0) < 0 ? range.length : range.indexOf(0)));
    const name = nul(header.subarray(0, 100));
    const prefix = nul(header.subarray(345, 500));
    const fullName = prefix ? `${prefix}/${name}` : name;
    const size = Number.parseInt(nul(header.subarray(124, 136)).trim() || "0", 8);
    if (!Number.isSafeInteger(size)) throw new Error("Invalid tar member size");
    const type = String.fromCharCode(header[156]);
    members.push({ path: fullName, bytes: size, type });
    position += 512 + Math.ceil(size / 512) * 512;
  }
  return members;
}

const wasm = {};
for (const name of ["clang.wasm", "lld.wasm"]) {
  const bytes = await readFile(join(browsercc, name));
  wasm[name] = { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), customSections: wasmSections(bytes) };
}
const sysrootBytes = await readFile(join(browsercc, "sysroot.tar"));
const members = tarMembers(sysrootBytes);
const files = members.filter((member) => member.type === "0" || member.type === "\0");
const pathCounts = {};
for (const file of files) {
  const key = file.path.startsWith("include/c++/") ? "include/c++" : file.path.startsWith("include/wasm32-wasi/") ? "include/wasm32-wasi" : file.path.startsWith("include/") ? "include/other" : file.path.startsWith("lib/clang/20/") ? "lib/clang/20" : file.path.startsWith("lib/wasm32-wasi/") ? "lib/wasm32-wasi" : "other";
  pathCounts[key] = (pathCounts[key] ?? 0) + 1;
}
const licenseNames = files.filter((file) => /(?:^|\/)(?:LICENSE|COPYING|NOTICE)(?:\.|$)/i.test(file.path)).map((file) => file.path);
const archives = files.filter((file) => /\.(?:a|o|so)$/.test(file.path)).map((file) => file.path);
const output = { wasm, sysroot: { bytes: sysrootBytes.length, sha256: createHash("sha256").update(sysrootBytes).digest("hex"), members: members.length, files: files.length, pathCounts, licenseNames, archives } };
process.stdout.write(JSON.stringify(output, null, 2) + "\n");
