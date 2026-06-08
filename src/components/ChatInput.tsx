import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { SendHorizontal, Square } from "lucide-react";
import { MAX_INPUT_LENGTH, isSubmittable } from "../utils/sanitize";

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isBusy: boolean;
}

const NEAR_LIMIT = MAX_INPUT_LENGTH - 200;

export function ChatInput({ onSend, onStop, isBusy }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea up to a sensible max height.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }, [value]);

  const canSend = isSubmittable(value) && !isBusy;

  const submit = () => {
    if (!canSend) {
      return;
    }
    onSend(value);
    setValue("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts a newline (mobile keyboards keep newline).
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-input p-2 shadow-lg shadow-black/20 transition focus-within:border-brand/50">
        <label htmlFor="chat-input" className="sr-only">
          Votre message
        </label>
        <textarea
          id="chat-input"
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value.slice(0, MAX_INPUT_LENGTH))}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Écrivez votre message…"
          maxLength={MAX_INPUT_LENGTH}
          className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />

        {isBusy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Arrêter la génération"
            title="Arrêter"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-raised text-slate-200 transition hover:border-red-500/50 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
          >
            <Square size={18} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Envoyer le message"
            title="Envoyer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-slate-950 transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:bg-line disabled:text-slate-500"
          >
            <SendHorizontal size={18} />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-2 pt-1.5 text-[11px] text-slate-500">
        <span>Entrée pour envoyer · Maj+Entrée pour un retour à la ligne</span>
        {value.length >= NEAR_LIMIT ? (
          <span className={value.length >= MAX_INPUT_LENGTH ? "text-red-400" : ""}>
            {value.length}/{MAX_INPUT_LENGTH}
          </span>
        ) : null}
      </div>
    </form>
  );
}
