import { AlertTriangle, Bot, User } from "lucide-react";
import type { ChatMessage } from "../types/chat";
import { TypingIndicator } from "./TypingIndicator";

interface MessageBubbleProps {
  message: ChatMessage;
}

/**
 * Renders one conversation turn. Message content is rendered as plain text:
 * React escapes it automatically and we never use dangerouslySetInnerHTML,
 * so untrusted model/user content can never inject markup.
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const showTyping =
    message.role === "assistant" &&
    message.status === "pending" &&
    message.content.length === 0;

  return (
    <div
      className={`flex w-full gap-3 animate-fade-in-up ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          isUser
            ? "border-brand/40 bg-brand/10 text-brand"
            : "border-line bg-surface-raised text-slate-300"
        }`}
        aria-hidden="true"
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div
        className={`flex max-w-[82%] flex-col gap-1 sm:max-w-[75%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className={[
            "whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
            isUser
              ? "rounded-tr-sm bg-brand text-slate-950"
              : "rounded-tl-sm border border-line bg-surface-raised text-slate-100",
            isError ? "border-red-500/40 bg-red-500/10 text-red-200" : "",
          ].join(" ")}
        >
          {showTyping ? (
            <TypingIndicator />
          ) : (
            <>
              {message.content}
              {message.status === "streaming" && (
                <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-blink bg-current align-middle" />
              )}
            </>
          )}
        </div>

        {isError && message.error ? (
          <span className="flex items-center gap-1 px-1 text-xs text-red-300">
            <AlertTriangle size={12} aria-hidden="true" />
            {message.error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
