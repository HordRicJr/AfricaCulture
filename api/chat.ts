import type { VercelRequest, VercelResponse } from "@vercel/node";
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
  origin: true,   // Allow all origins — Vercel handles domain security
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));
app.use("/", chatRouter);

// Catch-all error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[api/chat] Error:", err);
  if (!res.headersSent) {
    res.status(500).json({
      error: err.message || "Erreur interne du serveur.",
    });
  }
});

export default (req: VercelRequest, res: VercelResponse) => {
  // Only allow POST (and OPTIONS for CORS preflight)
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
