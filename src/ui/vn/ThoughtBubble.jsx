/**
 * Read her. CLAUDE.md section 6.
 *
 * Inner thought is NOT streamed on every line - that hands the player the
 * answer key and kills the tension the whole game is built on. It is a rationed
 * action, and the rationing is what turns hidden information into a decision.
 *
 * Rendered in the display serif at low opacity, floating over the portrait:
 * it should read as something overheard rather than something said.
 */

export default function ThoughtBubble({ text, onDismiss, label }) {
  if (!text) return null;

  return (
    <button
      type="button"
      onClick={onDismiss}
      className="thought-in absolute inset-x-5 top-6 z-10 rounded-[var(--radius)] border border-hairline bg-surface/90 px-4 py-3 text-left backdrop-blur-sm"
    >
      <span className="mb-1 block font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-dim">
        {label}
      </span>
      <p className="font-display text-[1rem] italic leading-snug text-dim">{text}</p>
    </button>
  );
}
