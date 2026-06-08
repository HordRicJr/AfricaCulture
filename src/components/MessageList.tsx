import { useEffect, useRef } from "react";
import { Landmark } from "lucide-react";
import type { ChatMessage } from "../types/chat";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
  suggestions: string[];
  onSuggestion: (text: string) => void;
}

export function MessageList({
  messages,
  suggestions,
  onSuggestion,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastContent = messages[messages.length - 1]?.content ?? "";

  // Keep the latest turn in view as messages arrive / stream.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastContent]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-raised text-brand">
          <Landmark size={26} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-slate-100">
          Bienvenue sur AfricaCulture
        </h2>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          Posez une question sur les cultures, l&apos;histoire, les langues ou les
          traditions du continent africain.
        </p>

        <div className="mt-6 grid w-full max-w-md gap-2 sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestion(suggestion)}
              className="rounded-xl border border-line bg-surface-raised px-4 py-3 text-left text-sm text-slate-300 transition hover:border-brand/50 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
