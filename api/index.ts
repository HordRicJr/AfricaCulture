import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { validateConfig } from "../server/src/config";
import chatRouter from "../server/src/routes/chat";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Validate configuration
validateConfig();

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === "production" 
    ? ["https://africaculture.vercel.app"] 
    : ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
}));

app.use(express.json());

// Routes
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.use("/", chatRouter);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("API Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "An error occurred",
  });
});

// Vercel serverless handler
export default (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};
