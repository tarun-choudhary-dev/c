import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const types = { ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".tar": "application/x-tar", ".json": "application/json", ".md": "text/markdown" };

export function startStaticServer(port = 0) {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/__harness") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end("<!doctype html><meta charset=utf-8><title>C engine test harness</title>");
      return;
    }
    if (pathname === "/favicon.ico") { response.writeHead(204).end(); return; }
    if (!/^\/(src|node_modules)\//.test(pathname)) { response.writeHead(404).end(); return; }
    let name;
    try { name = decodeURIComponent(pathname); } catch { response.writeHead(400).end(); return; }
    const target = resolve(root, "." + name);
    if (target !== root && !target.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    try {
      if (!(await stat(target)).isFile()) { response.writeHead(404).end(); return; }
      const extension = target.slice(target.lastIndexOf("."));
      response.writeHead(200, { "content-type": types[extension] ?? "application/octet-stream", "cache-control": "no-store" });
      response.end(await readFile(target));
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolveReady, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolveReady({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await startStaticServer(Number(process.env.C_ENGINE_PORT ?? 4173));
  process.stdout.write(`Static test server: ${url}\n`);
}
