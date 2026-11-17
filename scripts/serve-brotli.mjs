#!/usr/bin/env node
/**
 * Local static server with Brotli (and gzip fallback) for text assets.
 * Used only for Lighthouse baselines - mirrors Vercel compression.
 */
import http from "http";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const root = path.resolve(process.argv[2] || ".");
const port = Number(process.argv[3] || 8767);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

const TEXT_EXT = new Set([".html", ".css", ".js", ".json", ".xml", ".txt", ".svg", ".map"]);

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let rel = urlPath === "/" ? "/index.html" : urlPath;
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root)) {
      send(res, 403, { "Content-Type": "text/plain" }, "Forbidden");
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      send(res, 404, { "Content-Type": "text/plain" }, "Not found");
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const type = TYPES[ext] || "application/octet-stream";
    const data = fs.readFileSync(file);
    const accept = req.headers["accept-encoding"] || "";
    const headers = {
      "Content-Type": type,
      "Cache-Control": "no-cache",
      Vary: "Accept-Encoding",
    };
    if (TEXT_EXT.has(ext) && accept.includes("br")) {
      headers["Content-Encoding"] = "br";
      send(res, 200, headers, zlib.brotliCompressSync(data));
      return;
    }
    if (TEXT_EXT.has(ext) && accept.includes("gzip")) {
      headers["Content-Encoding"] = "gzip";
      send(res, 200, headers, zlib.gzipSync(data));
      return;
    }
    headers["Content-Length"] = data.length;
    send(res, 200, headers, data);
  } catch (err) {
    send(res, 500, { "Content-Type": "text/plain" }, String(err));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`brotli-static ${root} on http://127.0.0.1:${port}`);
});
