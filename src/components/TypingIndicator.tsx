/**
 * Three blinking dots shown while the assistant is preparing its first token.
 * Built from styled spans — deliberately no emoji.
 */
export function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-1.5 py-1"
      role="status"
      aria-label="L'assistant rédige une réponse"
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-2 w-2 rounded-full bg-brand/80 animate-blink"
          style={{ animationDelay: `${index * 0.18}s` }}
        />
      ))}
    </div>
  );
}
