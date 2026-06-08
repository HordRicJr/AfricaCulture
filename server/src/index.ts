import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import { config, validateConfig } from "./config";
import { chatRouter } from "./routes/chat";

validateConfig();

const app = express();

app.use(
  cors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", mode: config.mode, authMode: config.authMode });
});

app.use("/api/chat", chatRouter);

// Centralized error handler (must keep the 4-arg signature for Express).
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[BFF] Erreur non gérée:", error);
  if (!res.headersSent) {
    res.status(500).json({ error: "Erreur interne du serveur." });
  }
});

app.listen(config.port, () => {
  console.log(
    `[BFF] Proxy AfricaCulture en écoute sur http://localhost:${config.port}`,
  );
  console.log(`[BFF] Mode=${config.mode} · Auth=${config.authMode}`);
});
