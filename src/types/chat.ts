/**
 * Domain types shared across the chat application.
 *
 * Strong typing of every request/response that crosses the network boundary
 * (SPA <-> BFF) keeps the integration with Microsoft AI Foundry predictable
 * and refactor-safe.
 */

/** Conversation roles understood by the Foundry Responses API. */
export type ChatRole = "user" | "assistant" | "system";

/**
 * Granular lifecycle of the agent, surfaced to the UI.
 * - idle:      no request in flight
 * - loading:   request sent, waiting for the first token
 * - streaming: tokens are arriving
 * - error:     the last request failed
 */
export type AgentStatus = "idle" | "loading" | "streaming" | "error";

/** Per-message lifecycle (used to render spinners / partial bubbles). */
export type MessageStatus = "complete" | "pending" | "streaming" | "error";

/** A single message kept in the local conversation history. */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Epoch milliseconds when the message was created. */
  createdAt: number;
  status: MessageStatus;
  /** Optional human-readable error attached to a failed assistant turn. */
  error?: string;
}

/** Minimal message shape sent over the wire to the BFF. */
export interface WireMessage {
  role: ChatRole;
  content: string;
}

/** Body the SPA POSTs to the BFF. */
export interface ChatRequestPayload {
  messages: WireMessage[];
  /** When true, the BFF streams Server-Sent Events back to the client. */
  stream?: boolean;
  /** Optional Foundry response id to chain context server-side. */
  previousResponseId?: string;
}

/** Non-streaming JSON answer returned by the BFF. */
export interface ChatResponsePayload {
  /** Foundry response identifier (useful for chaining / telemetry). */
  id: string;
  content: string;
}

/** Normalized Server-Sent Events emitted by the BFF to the SPA. */
export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; id: string }
  | { type: "error"; message: string };

/** Error surfaced to the UI layer. */
export interface ChatError {
  message: string;
  status?: number;
}
