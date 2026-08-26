/**
 * The dialogue surface. CLAUDE.md Part I.3.
 *
 * THE ONLY THING ON THE SCENE SCREEN THAT SCROLLS. Everything else - the header,
 * the portrait, the value strip, the four options - has a fixed or a flexible
 * share of one viewport, and the round's prose is the single element whose length
 * the code does not control: ~80 words of instruction comes back as 240-330
 * characters in `zh`. So the box takes what height is left and scrolls inside
 * itself, which is what keeps the options inside the player's thumb on every
 * round instead of a screen-and-a-half down the page.
 *
 * The name plate does not scroll with it, for the reason section 20 gives about
 * modal headers: the one piece of chrome that says whose line this is must not be
 * something the player has to scroll back up to find.
 *
 * THE BEAT REVEAL IS GONE. v1 revealed up to three beats a tap and that was the
 * latency strategy - the player's own pacing hid the next round trip. v2 streams
 * from the first token, so there is nothing left to hide behind and the box is no
 * longer a button (Part I.3).
 *
 * Prose is parsed for *action* and "speech" so the two read differently, which is
 * what makes a round feel like a scene instead of a chat message.
 */

const SEGMENT = /(\*[^*]+\*|"[^"]*"|“[^”]*”)/g;

/**
 * A zero-width space, written by code point so it cannot be an invisible
 * character sitting in a source file. It holds the name plate's baseline on the
 * one beat that has no speaker - see the plate itself, below.
 */
const NO_NAME = String.fromCharCode(0x200b);

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

export default function DialogueBox({ beat, speakerName, pending, placeholder }) {
  return (
    <div className="mx-5 flex min-h-0 flex-col rounded-[var(--radius)] border border-border bg-surface-warm px-4 pb-3 pt-3 shadow-[var(--shadow)]">
      {/*
        The name plate, set in the display serif against monospace chrome.

        `speakerName` is null when nobody says it - narration, or an empty room.
        The span stays and holds a zero-width space rather than being dropped,
        because the rule is baseline-aligned to it: remove the only item with a
        baseline and the hairline jumps to the top of the row, so the box would
        visibly shift between the narration and the round that follows it.
      */}
      <div className="mb-1.5 flex shrink-0 items-baseline gap-2">
        <span className="font-display text-[1rem] leading-none tracking-wide text-accent">
          {speakerName || NO_NAME}
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
          aria-live="polite"
          className="beat-in min-h-0 flex-1 overflow-y-auto overscroll-contain font-body text-[1rem] leading-[1.55]"
        >
          {beat ? renderProse(beat.text) : null}
        </p>
      )}
    </div>
  );
}
