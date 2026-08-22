/**
 * Who is in the room, and who the player is turned to. Section 14, proposal 12.
 *
 * The treatment is section 14's, unchanged: "the speaker sits at full opacity
 * and scale, others dim to 0.55 and scale 0.95." What proposal 12 adds is that
 * the dimmed ones are BUTTONS - tapping one is how the player turns to her, and
 * turning to her is the act the whole group scene runs on.
 *
 * So the row is not decoration. It is the only place in the game where the
 * player's attention is a visible, continuously priced state: everybody in the
 * room can see who it points at, and moving it is witnessed.
 *
 * A single-member scene never renders this - the stage stays exactly what it
 * was, one portrait filling the frame.
 */

import Portrait from './Portrait.jsx';

export default function PortraitRow({
  cards,
  rosterIds,
  addresseeId,
  emotion = 'neutral',
  pulseKey = 0,
  onTurnTo,
  disabled = false,
  t,
}) {
  const speaking = cards.find((c) => c.id === addresseeId);
  const others = rosterIds.filter((id) => id !== addresseeId);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <Portrait card={speaking} emotion={emotion} pulseKey={pulseKey} />
      </div>

      {others.length > 0 ? (
        <ul className="flex shrink-0 items-end justify-center gap-2 pb-1">
          {others.map((id) => {
            const card = cards.find((c) => c.id === id);
            if (!card) return null;
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onTurnTo(id)}
                  aria-label={t('vn.turnTo').replace('{name}', card.name)}
                  className="flex w-[3.75rem] flex-col items-center gap-0.5 rounded-[var(--radius-sm)] border border-transparent px-1 pb-1 pt-0.5 transition-colors enabled:hover:border-accent disabled:opacity-60"
                >
                  <span className="h-14 w-full">
                    <Portrait card={card} emotion="neutral" speaking={false} size="small" />
                  </span>
                  <span className="w-full truncate text-center font-mono text-[0.5rem] uppercase tracking-[0.1em] text-faint">
                    {card.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
