/** Shared upstream proxy for Vercel serverless routes. */

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function proxyTo(req, res, targetBase) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname.replace(/^\/api\/(oura|groq)/, "");
  const target = `${targetBase}${pathname}${url.search}`;

  const headers = {};
  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }
  if (req.headers["content-type"]) {
    headers["Content-Type"] = req.headers["content-type"];
  }

  const init = { method: req.method, headers };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await readRawBody(req);
  }

  const upstream = await fetch(target, init);
  const body = Buffer.from(await upstream.arrayBuffer());

  res.status(upstream.status);
  const contentType = upstream.headers.get("content-type");
  if (contentType) res.setHeader("Content-Type", contentType);
  res.send(body);
}
