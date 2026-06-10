import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateConfig } from "../server/src/config";

// Validate configuration at cold-start
validateConfig();

// /api → health check endpoint
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
