import type {
  ChatRequestPayload,
  ChatResponsePayload,
  ChatStreamEvent,
  WireMessage,
} from "../types/chat";

/**
 * agentService — the SPA's single gateway to the agent.
 *
 * IMPORTANT (security): this service talks ONLY to our own BFF (Backend For
 * Frontend), never to Microsoft AI Foundry directly. The Foundry endpoint and
 * API key live exclusively on the server. The browser therefore never holds a
 * secret. See server/src/foundryClient.ts for the privileged half.
 */

const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL ?? "/api/chat";

/** Error type that preserves the HTTP status for the UI layer. */
export class AgentServiceError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AgentServiceError";
    this.status = status;
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  previousResponseId?: string;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: string | { message?: string };
    };
    if (typeof data.error === "string") {
      return data.error;
    }
    if (data.error && typeof data.error.message === "string") {
      return data.error.message;
    }
  } catch {
    /* body was not JSON — fall through to a generic message */
  }
  return `La requête a échoué (HTTP ${response.status}).`;
}

/**
 * Non-streaming request. Returns the full assistant message at once.
 */
export async function sendMessage(
  messages: WireMessage[],
  options: RequestOptions = {},
): Promise<ChatResponsePayload> {
  const payload: ChatRequestPayload = {
    messages,
    stream: false,
    previousResponseId: options.previousResponseId,
  };

  const response = await fetch(CHAT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new AgentServiceError(await extractErrorMessage(response), response.status);
  }

  return (await response.json()) as ChatResponsePayload;
}

/**
 * Streaming request. Yields normalized {@link ChatStreamEvent}s as the BFF
 * relays Server-Sent Events from the Foundry Responses API.
 */
export async function* streamMessage(
  messages: WireMessage[],
  options: RequestOptions = {},
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const payload: ChatRequestPayload = {
    messages,
    stream: true,
    previousResponseId: options.previousResponseId,
  };

  const response = await fetch(CHAT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    throw new AgentServiceError(await extractErrorMessage(response), response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line ("\n\n").
      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex !== -1) {
        const frame = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        const event = parseSseFrame(frame);
        if (event) {
          yield event;
        }
        separatorIndex = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Parse a single SSE frame ("data: {json}") into a typed event. */
function parseSseFrame(frame: string): ChatStreamEvent | null {
  const dataLines: string[] = [];
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const data = dataLines.join("\n");
  if (data === "[DONE]") {
    return null;
  }

  try {
    return JSON.parse(data) as ChatStreamEvent;
  } catch {
    return null;
  }
}
