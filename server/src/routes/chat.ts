import { Router, type Request, type Response as ExpressResponse } from "express";
import { config } from "../config";
import {
  createFoundryResponse,
  extractOutputText,
  extractResponseId,
  type ChatRole,
  type WireMessage,
} from "../foundryClient";

export const chatRouter = Router();

const ALLOWED_ROLES = new Set<ChatRole>(["user", "assistant", "system"]);

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Validate and clamp the messages coming from the SPA. */
function normalizeMessages(input: unknown): WireMessage[] {
  if (!Array.isArray(input)) {
    throw new HttpError(400, "Le champ 'messages' doit être un tableau.");
  }

  const messages: WireMessage[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const role = (raw as { role?: unknown }).role;
    const content = (raw as { content?: unknown }).content;
    if (typeof role !== "string" || !ALLOWED_ROLES.has(role as ChatRole)) {
      continue;
    }
    if (typeof content !== "string") {
      continue;
    }
    const trimmed = content.slice(0, config.maxInputLength);
    if (trimmed.trim().length === 0) {
      continue;
    }
    messages.push({ role: role as ChatRole, content: trimmed });
  }

  if (messages.length === 0) {
    throw new HttpError(400, "Aucun message valide n'a été fourni.");
  }
  return messages.slice(-config.maxMessages);
}

chatRouter.post("/", async (req: Request, res: ExpressResponse) => {
  let messages: WireMessage[];
  let stream: boolean;
  try {
    messages = normalizeMessages((req.body as { messages?: unknown })?.messages);
    stream = (req.body as { stream?: unknown })?.stream !== false; // default: true
  } catch (error) {
    const httpError = error as HttpError;
    res.status(httpError.status ?? 400).json({ error: httpError.message });
    return;
  }

  // Propagate client disconnects upstream so we stop billing tokens.
  const controller = new AbortController();
  res.on("close", () => controller.abort());

  let upstream: Response;
  try {
    upstream = await createFoundryResponse(messages, stream, controller.signal);
  } catch (error) {
    res.status(502).json({
      error: `Connexion à Microsoft AI Foundry impossible: ${(error as Error).message}`,
    });
    return;
  }

  if (!upstream.ok) {
    const detail = await safeReadText(upstream);
    res
      .status(upstream.status)
      .json({ error: foundryErrorMessage(upstream.status, detail) });
    return;
  }

  if (!stream) {
    const data = await upstream.json().catch(() => null);
    const content = extractOutputText(data);
    if (!content) {
      res.status(502).json({ error: "Réponse vide reçue de l'agent." });
      return;
    }
    res.json({ id: extractResponseId(data), content });
    return;
  }

  // ---- Streaming (Server-Sent Events) ----
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const upstreamContentType = upstream.headers.get("content-type") ?? "";

  try {
    if (upstreamContentType.includes("text/event-stream") && upstream.body) {
      await pipeUpstreamSse(upstream, res);
    } else {
      // Fallback: upstream answered with JSON despite the stream request.
      const data = await upstream.json().catch(() => null);
      writeSse(res, { type: "delta", text: extractOutputText(data) });
      writeSse(res, { type: "done", id: extractResponseId(data) });
      res.write("data: [DONE]\n\n");
    }
  } catch (error) {
    writeSse(res, {
      type: "error",
      message: (error as Error).message || "Erreur durant le streaming.",
    });
  } finally {
    res.end();
  }
});

/* ------------------------------------------------------------------ */
/* SSE helpers                                                          */
/* ------------------------------------------------------------------ */

/** Read Foundry's SSE stream, normalize events, and relay them to the client. */
async function pipeUpstreamSse(
  upstream: Response,
  res: ExpressResponse,
): Promise<void> {
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let responseId = "";

  const handleFrame = (frame: string) => {
    const dataLines: string[] = [];
    for (const rawLine of frame.split("\n")) {
      const line = rawLine.replace(/\r$/, "");
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).replace(/^ /, ""));
      }
    }
    if (dataLines.length === 0) {
      return;
    }
    const data = dataLines.join("\n");
    if (data === "[DONE]") {
      return;
    }

    let event: {
      type?: string;
      delta?: unknown;
      id?: unknown;
      message?: unknown;
      response?: { id?: unknown; error?: { message?: unknown } };
      error?: { message?: unknown };
    };
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }

    switch (event.type) {
      case "response.output_text.delta": {
        if (typeof event.delta === "string") {
          writeSse(res, { type: "delta", text: event.delta });
        }
        break;
      }
      case "response.created":
      case "response.in_progress":
      case "response.completed": {
        const id = event.response?.id ?? event.id;
        if (typeof id === "string") {
          responseId = id;
        }
        break;
      }
      case "response.failed":
      case "error": {
        const message =
          (typeof event.response?.error?.message === "string" &&
            event.response.error.message) ||
          (typeof event.error?.message === "string" && event.error.message) ||
          (typeof event.message === "string" && event.message) ||
          "Erreur renvoyée par l'agent.";
        writeSse(res, { type: "error", message });
        break;
      }
      default:
        break;
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        handleFrame(frame);
        separator = buffer.indexOf("\n\n");
      }
    }
    if (buffer.trim().length > 0) {
      handleFrame(buffer);
    }
  } finally {
    reader.releaseLock();
  }

  writeSse(res, { type: "done", id: responseId });
  res.write("data: [DONE]\n\n");
}

function writeSse(res: ExpressResponse, event: unknown): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/** Turn an upstream error body into a concise, user-safe message. */
function foundryErrorMessage(status: number, detail: string): string {
  if (status === 401 || status === 403) {
    return "Authentification refusée par Foundry. Vérifiez la clé API ou les droits d'accès.";
  }
  if (status === 429) {
    return "Limite de débit atteinte sur Foundry. Réessayez dans un instant.";
  }

  let parsed = "";
  try {
    const json = JSON.parse(detail) as { error?: { message?: string }; message?: string };
    parsed = json.error?.message ?? json.message ?? "";
  } catch {
    parsed = detail;
  }

  const base = parsed || "Erreur renvoyée par l'agent Foundry.";
  return `Foundry a renvoyé une erreur (${status}): ${base}`.slice(0, 400);
}
