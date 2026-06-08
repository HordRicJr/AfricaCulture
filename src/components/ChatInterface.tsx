import { useMemo } from "react";
import { Landmark, RotateCcw, RefreshCw } from "lucide-react";
import type { AgentStatus } from "../types/chat";
import { useAgentChat } from "../hooks/useAgentChat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

const SUGGESTIONS = [
  "Présente-moi l'empire du Mali",
  "Quelles sont les langues parlées au Sénégal ?",
  "Explique la symbolique des masques Dogon",
  "Parle-moi de la musique mbalax",
];

const STATUS_META: Record<AgentStatus, { label: string; dot: string }> = {
  idle: { label: "En ligne", dot: "bg-emerald-400" },
  loading: { label: "Connexion…", dot: "bg-amber-400 animate-pulse" },
  streaming: { label: "Rédaction…", dot: "bg-brand animate-pulse" },
  error: { label: "Indisponible", dot: "bg-red-400" },
};

/**
 * ChatInterface — the only stateful UI piece. It delegates ALL conversation
 * logic to the useAgentChat hook (separation of concerns) and focuses purely on
 * layout: a sticky header, the scrollable message list, an error banner, and
 * the composer. Mobile-first, fully responsive, no emoji (icons via lucide).
 */
export function ChatInterface() {
  const { messages, status, error, isBusy, sendMessage, stop, clear, retryLast } =
    useAgentChat();

  const statusMeta = useMemo(() => STATUS_META[status], [status]);
  const hasConversation = messages.length > 0;

  return (
    <div className="flex h-[100dvh] flex-col bg-surface text-slate-100">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-raised text-brand">
              <Landmark size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-slate-100">
                AfricaCulture
              </h1>
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
                  aria-hidden="true"
                />
                {statusMeta.label}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={clear}
            disabled={!hasConversation || isBusy}
            aria-label="Nouvelle conversation"
            title="Nouvelle conversation"
            className="flex h-9 items-center gap-2 rounded-xl border border-line bg-surface-raised px-3 text-xs font-medium text-slate-300 transition hover:border-brand/50 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Nouvelle conversation</span>
          </button>
        </div>
      </header>

      <main className="scrollbar-thin flex-1 overflow-y-auto">
        <MessageList
          messages={messages}
          suggestions={SUGGESTIONS}
          onSuggestion={sendMessage}
        />
      </main>

      {error ? (
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <span className="truncate">{error.message}</span>
            <button
              type="button"
              onClick={retryLast}
              disabled={isBusy}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/40 px-2.5 py-1 text-xs font-medium text-red-100 transition hover:bg-red-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 disabled:opacity-50"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Réessayer
            </button>
          </div>
        </div>
      ) : null}

      <footer className="border-t border-line bg-surface/80 backdrop-blur">
        <ChatInput onSend={sendMessage} onStop={stop} isBusy={isBusy} />
      </footer>
    </div>
  );
}
