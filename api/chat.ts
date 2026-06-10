import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Vercel Serverless Function for POST /api/chat
 *
 * This function wraps the Express chatRouter from the BFF server code.
 * Vercel file-based routing maps /api/chat → api/chat.ts.
 *
 * Key design decisions:
 * - validateConfig() is called inside the handler (not at module level)
 *   so that errors produce a 500 JSON response instead of an opaque crash.
 * - All imports from ../server/src/ are lazy to improve cold-start resilience.
 */

let app: any;
let initialized = false;
let initError: string | null = null;

function initApp() {
  if (initialized) return;
  initialized = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const express = require("express");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cors = require("cors");
    const { validateConfig } = require("../server/src/config");
    const { chatRouter } = require("../server/src/routes/chat");

    validateConfig();

    app = express();

    app.use(cors({
      origin: process.env.NODE_ENV === "production"
        ? ["https://africaculture.vercel.app"]
        : ["http://localhost:5173", "http://localhost:3000"],
      credentials: true,
    }));

    app.use(express.json({ limit: "1mb" }));
    app.use("/", chatRouter);

    // Error handler so Express errors become JSON responses
    app.use((err: any, _req: any, res: any, _next: any) => {
      console.error("[api/chat] Express error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          error: err.message || "Erreur interne du serveur.",
        });
      }
    });
  } catch (err: any) {
    console.error("[api/chat] Initialization failed:", err);
    initError = err.message || "Initialization failed";
  }
}

export default (req: VercelRequest, res: VercelResponse) => {
  // Only allow POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  // Initialize on first request (lazy)
  initApp();

  // If init failed, return a descriptive 500
  if (initError || !app) {
    console.error("[api/chat] App not initialized:", initError);
    return res.status(500).json({
      error: "Le serveur n'a pas pu s'initialiser. Vérifiez les variables d'environnement.",
      detail: process.env.NODE_ENV === "development" ? initError : undefined,
    });
  }

  return app(req, res);
};
