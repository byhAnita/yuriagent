/**
 * The dialogue surface. CLAUDE.md sections 1 and 9.
 *
 * Beats are revealed ONE TAP AT A TIME. That is not a flourish - it is the
 * latency strategy from section 8. The model returns up to three beats in one
 * call, and the player's own pacing hides the round trip for the next one.
 *
 * Prose is parsed for *action* and "speech" so the two read differently, which
 * is what makes a 40-word beat feel like a scene instead of a chat message.
 */

const SEGMENT = /(\*[^*]+\*|"[^"]*"|“[^”]*”)/g;

function renderProse(text) {
  return String(text)
    .split(SEGMENT)
    .filter(Boolean)
    .map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={i} className="text-dim not-italic opacity-80">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (/^["“]/.test(part)) {
        return (
          <span key={i} className="text-text">
            {part}
          </span>
        );
      }
      return (
        <span key={i} className="text-dim">
          {part}
        </span>
      );
    });
}

export default function DialogueBox({
  beat,
  speakerName,
  hasMore,
  onAdvance,
  pending,
  placeholder,
}) {
  const interactive = Boolean(beat) && !pending;

  return (
    <button
      type="button"
      onClick={interactive && hasMore ? onAdvance : undefined}
      disabled={!interactive || !hasMore}
      aria-live="polite"
      className="group relative block w-full cursor-default rounded-[var(--radius)] border border-border bg-surface-warm px-5 pb-5 pt-4 text-left shadow-[var(--shadow)] disabled:cursor-default"
    >
      {/* the name plate, set in the display serif against monospace chrome */}
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-display text-[1.0625rem] leading-none tracking-wide text-accent">
          {speakerName}
        </span>
        <span className="h-px flex-1 bg-hairline opacity-60" />
      </div>

      {pending && !beat ? (
        <p className="font-mono text-[0.75rem] uppercase tracking-[0.18em] text-dim">
          {placeholder}
        </p>
      ) : (
        <p
          key={beat?.text}
          className="beat-in font-body text-[1.0625rem] leading-[1.6]"
        >
          {beat ? renderProse(beat.text) : null}
        </p>
      )}

      {hasMore && interactive ? (
        <span className="caret-pulse absolute bottom-3 right-4 font-mono text-[0.75rem] text-accent">
          &#9656;
        </span>
      ) : null}
    </button>
  );
}
