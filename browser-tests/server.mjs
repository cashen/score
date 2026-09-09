// Local static test server. No credentials, KV binding or production requests.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
const root = resolve("public");
http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
      response.writeHead(404); response.end(); return;
    }
    const page = url.pathname === "/" || /^\/(share|p)\//.test(url.pathname);
    const path = resolve(root, page ? "index.html" : `.${decodeURIComponent(url.pathname)}`);
    if (!path.startsWith(root + sep)) throw new Error("invalid path");
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
    response.setHeader("Content-Type", types[extname(path)] || "application/octet-stream");
    response.end(await readFile(path));
  } catch {
    response.writeHead(404); response.end();
  }
}).listen(4173, "127.0.0.1");
