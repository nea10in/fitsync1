import { config, proxyTo } from "../_proxy.js";

export { config };

export default async function handler(req, res) {
  try {
    await proxyTo(req, res, "https://api.ouraring.com");
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : "Oura proxy failed",
    });
  }
}
