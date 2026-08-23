/**
 * The one bottom sheet. CLAUDE.md section 20.
 *
 * Every modal in the game is this shape - a panel that rises from the bottom
 * edge, over a dimmed backdrop, capped in height and scrolling inside itself.
 * It exists as a component because four hand-rolled copies drifted, and one of
 * them drifted into a dead end.
 *
 * `DateModal` was the copy with no height cap and no scroll, and the date sheet
 * is the longest list in the game: five members times two kinds of date. Being
 * bottom-anchored, it did not overflow downward where a scrollbar would have
 * rescued it - it grew UPWARD, off the top of the screen, taking the close
 * button with it. A modal with no visible way out and no reachable option ends
 * the run, and it did.
 *
 * Three rules live here so that no fifth modal has to remember them:
 *
 *   1. a cap and a scroll, always
 *   2. the header sits ABOVE the scroll, so the way out never leaves the screen
 *   3. the safe-area inset is the sheet's own job - a `fixed` overlay is laid
 *      out against the viewport, not against the padded body, so section 20's
 *      `--safe-bottom` rule does not reach it
 */

export default function Sheet({
  /** Shown at the top, in the pinned header. */
  title,
  /**
   * The control at the right of the header - usually a close button.
   *
   * A node rather than an `onClose` callback because the sheets disagree about
   * what the way out is called and what it costs: `date.skip` gives up the
   * whole weekend, `save.close` gives up nothing.
   */
  action = null,
  /** Fixed content under the header, above the scroll. Used sparingly. */
  lede = null,
  children,
  /** Sheets that open over a scene sit under it in the stack; see GiftModal. */
  z = 'z-20',
}) {
  return (
    <div className={`fixed inset-0 ${z} flex items-end justify-center bg-bg/80 backdrop-blur-sm`}>
      <div
        className="thought-in flex max-h-[88dvh] w-full max-w-[26rem] flex-col rounded-t-[var(--radius)] border-t border-hairline bg-surface"
        // The inset, in an inline style because it is a runtime value from the
        // device rather than a design token choice (section 20's exception).
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="flex shrink-0 items-baseline gap-2 px-5 pb-1 pt-4">
          <span className="truncate font-display text-[1.25rem] tracking-wide">{title}</span>
          <span className="h-px flex-1 bg-hairline opacity-60" />
          {action}
        </div>

        {lede ? <div className="shrink-0 px-5">{lede}</div> : null}

        {/*
          `min-h-0` is what actually makes this scroll. A flex child defaults to
          `min-height: auto`, which refuses to shrink below its content - so the
          cap above would be silently ignored and the sheet would grow off the
          screen exactly as before, with the scrollbar never appearing.
        */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-2">{children}</div>
      </div>
    </div>
  );
}
