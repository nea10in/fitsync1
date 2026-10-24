/**
 * Production server: static files + Oura/Groq API proxies.
 * Use on Railway, Render, Fly.io, or any Node host: npm run build && npm start
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "dist");
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function proxyRequest(req, res, targetBase, stripPrefix) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const proxyPath = url.pathname.replace(stripPrefix, "") + url.search;
  const target = `${targetBase}${proxyPath}`;

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (["host", "connection", "content-length"].includes(lower)) continue;
    if (value) headers[key] = value;
  }

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await readBody(req);
  }

  const upstream = await fetch(target, { method: req.method, headers, body });
  res.writeHead(upstream.status, {
    "Content-Type":
      upstream.headers.get("content-type") || "application/json",
  });
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = path.join(DIST, url.pathname === "/" ? "index.html" : url.pathname);

  if (!filePath.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, "index.html");
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/api/oura")) {
      await proxyRequest(req, res, "https://api.ouraring.com", "/api/oura");
      return;
    }
    if (req.url?.startsWith("/api/groq")) {
      await proxyRequest(req, res, "https://api.groq.com", "/api/groq");
      return;
    }
    if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res);
      return;
    }
    res.writeHead(405).end("Method not allowed");
  } catch (err) {
    res.writeHead(502).end(err instanceof Error ? err.message : "Server error");
  }
});

server.listen(PORT, () => {
  console.log(`FitSync running on http://localhost:${PORT}`);
});
