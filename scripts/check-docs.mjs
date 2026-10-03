import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = [join(root, "README.md"), join(root, "THIRD-PARTY-NOTICES.md"), ...(await readdir(join(root, "docs"))).filter((name) => name.endsWith(".md")).map((name) => join(root, "docs", name))];
let links = 0;
for (const file of files) {
  const markdown = await readFile(file, "utf8");
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const destination = match[1].split("#")[0];
    if (!destination || /^(https?:|mailto:)/.test(destination)) continue;
    const target = resolve(dirname(file), decodeURIComponent(destination));
    try { await stat(target); }
    catch { throw new Error(`Broken local link in ${file}: ${match[1]}`); }
    links++;
  }
}
process.stdout.write(`Checked ${links} local links in ${files.length} Markdown files\n`);
