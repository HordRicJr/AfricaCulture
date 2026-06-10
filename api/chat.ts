import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import express from "express";
import cors from "cors";
import { chatRouter } from "../server/src/routes/chat";

/**
 * Vercel Serverless Function for POST /api/chat
 *
 * Vercel file-based routing: /api/chat → api/chat.ts
 * The chatRouter handles POST "/" which maps to POST /api/chat.
 *
 * We do NOT call validateConfig() here — it reads config at module level
 * and would crash the cold-start. Instead, we let Express + chatRouter
 * handle the request normally. If env vars are missing, the Foundry call
 * will fail with a descriptive 502 error from the route handler.
 */

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));

// chatRouter comes from server/src which has its own Express types.
// The cast avoids a type mismatch between the two Express installations.
app.use("/", chatRouter as unknown as express.RequestHandler);

// Catch-all error handler (Express requires the 4-arg signature)
const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error("[api/chat] Error:", err);
  if (!res.headersSent) {
    res.status(500).json({
      error: err.message || "Erreur interne du serveur.",
    });
  }
};
app.use(errorHandler);

export default (req: VercelRequest, res: VercelResponse) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  return app(req, res);
};
