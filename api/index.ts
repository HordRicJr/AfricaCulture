import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateConfig } from "../server/dist/config.js";

/**
 * Vercel Serverless Function for GET /api (health check)
 *
 * Lightweight endpoint to verify the function is alive.
 * Does not validate Foundry config — that's the chat function's concern.
 */
export default (req: VercelRequest, res: VercelResponse) => {
  if (req.method === "GET") {
    return res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "production",
    });
  }

  res.setHeader("Allow", "GET");
  return res.status(405).json({ error: "Method not allowed" });
};
