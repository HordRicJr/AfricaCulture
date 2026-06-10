import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import cors from "cors";
import { validateConfig } from "../server/src/config";
import { chatRouter } from "../server/src/routes/chat";

// Validate configuration at cold-start
validateConfig();

// Mini Express app just for the /api/chat route.
// Vercel file-based routing maps /api/chat → api/chat.ts,
// so the chatRouter (mounted on "/") handles POST "/" here,
// which corresponds to POST /api/chat from the browser.
const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? ["https://africaculture.vercel.app"]
    : ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));
app.use("/", chatRouter);

// Vercel serverless handler
export default (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};
