/**
 * The timecode strip.
 *
 * Production chrome: where you are, when you are, and who is in the room. All
 * monospace, all small, all quiet. It is the frame around the feeling, and
 * saying it plainly is what lets the dialogue box be the only warm surface.
 */

import { DAY_NAMES } from '../../systems/calendar.js';

export default function SceneHeader({ week, day, block, phase, locationLabel, turnsLeft, onExit, t }) {
  return (
    <header className="flex items-center gap-3 px-5 pb-2 pt-3">
      <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
        W{week + 1} {t(`dayFull.${DAY_NAMES[day]}`)}
      </span>
      <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
        {t(`block.${block}`)}
      </span>
      <span className="truncate font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
        {locationLabel}
      </span>
      <span className="h-px flex-1 bg-hairline opacity-60" />
      <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
        {t(`phase.${phase}`)}
      </span>
      {typeof turnsLeft === "number" ? (
        <span
          title="turns left in this block"
          className={`font-mono text-[0.5625rem] tabular-nums ${turnsLeft <= 2 ? "text-warn" : "text-dim"}`}
        >
          {Math.max(0, turnsLeft)}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onExit}
        className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim transition-colors hover:text-accent"
      >
        {t('vn.leave')}
      </button>
    </header>
  );
}
