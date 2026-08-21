/**
 * The timecode strip.
 *
 * Production chrome: where you are, when you are, and who is in the room. All
 * monospace, all small, all quiet. It is the frame around the feeling, and
 * saying it plainly is what lets the dialogue box be the only warm surface.
 */

export default function SceneHeader({ week, day, block, phase, locationLabel, onExit, t }) {
  return (
    <header className="flex items-center gap-3 px-5 pb-2 pt-3">
      <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-faint">
        W{week + 1} D{day + 1}
      </span>
      <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
        {t(`block.${block}`)}
      </span>
      <span className="truncate font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
        {locationLabel}
      </span>
      <span className="h-px flex-1 bg-hairline opacity-60" />
      <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-faint">
        {t(`phase.${phase}`)}
      </span>
      <button
        type="button"
        onClick={onExit}
        className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-faint transition-colors hover:text-accent"
      >
        {t('vn.leave')}
      </button>
    </header>
  );
}
