import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgentStatus,
  ChatError,
  ChatMessage,
  WireMessage,
} from "../types/chat";
import { sanitizeUserInput } from "../utils/sanitize";
import { AgentServiceError, streamMessage } from "../services/agentService";

/**
 * useAgentChat — isolates ALL conversation state and Foundry communication from
 * the UI. Components stay declarative: they render `messages`/`status` and call
 * `sendMessage` / `stop` / `clear` / `retryLast`.
 */

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Map local history to the minimal wire shape, dropping system/failed turns. */
function toWireMessages(history: ChatMessage[]): WireMessage[] {
  return history
    .filter((message) => message.role !== "system" && message.status !== "error")
    .map(({ role, content }) => ({ role, content }));
}

export interface UseAgentChat {
  messages: ChatMessage[];
  status: AgentStatus;
  error: ChatError | null;
  /** True while a request is loading or streaming. */
  isBusy: boolean;
  /** Sanitize, append the user turn, and stream the assistant reply. */
  sendMessage: (text: string) => Promise<void>;
  /** Abort the in-flight request, keeping any partial reply. */
  stop: () => void;
  /** Reset the whole conversation. */
  clear: () => void;
  /** Re-run the last user turn (useful after an error). */
  retryLast: () => Promise<void>;
}

export function useAgentChat(): UseAgentChat {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [error, setError] = useState<ChatError | null>(null);

  // A ref mirror of `messages` lets callbacks read the latest history without
  // being re-created on every keystroke/state change.
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const abortRef = useRef<AbortController | null>(null);
  const lastResponseId = useRef<string | undefined>(undefined);

  // Abort any in-flight request when the component unmounts.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const isBusy = status === "loading" || status === "streaming";

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runTurn = useCallback(async (history: ChatMessage[]) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setStatus("loading");

    const assistantId = createId();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        status: "pending",
      },
    ]);

    const patchAssistant = (patch: Partial<ChatMessage>) =>
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, ...patch } : message,
        ),
      );

    try {
      let receivedToken = false;

      for await (const event of streamMessage(toWireMessages(history), {
        signal: controller.signal,
      })) {
        if (event.type === "delta") {
          if (!receivedToken) {
            receivedToken = true;
            setStatus("streaming");
          }
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + event.text, status: "streaming" }
                : message,
            ),
          );
        } else if (event.type === "done") {
          lastResponseId.current = event.id;
        } else if (event.type === "error") {
          throw new AgentServiceError(event.message);
        }
      }

      patchAssistant({ status: "complete" });
      setStatus("idle");
    } catch (caught) {
      // User-initiated abort: keep any partial answer, do not show an error.
      if (controller.signal.aborted) {
        setMessages((prev) =>
          prev.map((message) => {
            if (message.id !== assistantId) {
              return message;
            }
            return message.content
              ? { ...message, status: "complete" }
              : { ...message, status: "error", error: "Génération interrompue." };
          }),
        );
        setStatus("idle");
        return;
      }

      const message =
        caught instanceof Error
          ? caught.message
          : "Une erreur inattendue est survenue.";
      const httpStatus =
        caught instanceof AgentServiceError ? caught.status : undefined;

      patchAssistant({ status: "error", error: message });
      setError({ message, status: httpStatus });
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const clean = sanitizeUserInput(text);
      if (clean.trim().length === 0 || abortRef.current) {
        return;
      }

      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content: clean,
        createdAt: Date.now(),
        status: "complete",
      };

      const history = [...messagesRef.current, userMessage];
      setMessages(history);
      await runTurn(history);
    },
    [runTurn],
  );

  const retryLast = useCallback(async () => {
    if (abortRef.current) {
      return;
    }
    const history = messagesRef.current;
    let lastUserIndex = -1;
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i].role === "user") {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex === -1) {
      return;
    }
    const trimmed = history.slice(0, lastUserIndex + 1);
    setMessages(trimmed);
    await runTurn(trimmed);
  }, [runTurn]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    lastResponseId.current = undefined;
    setMessages([]);
    setError(null);
    setStatus("idle");
  }, []);

  return { messages, status, error, isBusy, sendMessage, stop, clear, retryLast };
}
