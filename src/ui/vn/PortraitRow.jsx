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
  /**
   * Who has the floor right now - the beat's own speaker, which in a group
   * scene is often NOT the addressee. Drawing the addressee here regardless
   * put somebody else's line under her face with her name on it.
   */
  speakingId,
  /** Where the player's attention is pointed. Marked, so it stays visible. */
  addresseeId,
  emotion = 'neutral',
  pulseKey = 0,
  onTurnTo,
  disabled = false,
  t,
}) {
  const front = speakingId ?? addresseeId;
  const speaking = cards.find((c) => c.id === front) ?? cards.find((c) => c.id === addresseeId);
  const others = rosterIds.filter((id) => id !== front);

  /**
   * Somebody who is not the addressee has the floor - she joined in.
   *
   * Then she is the big portrait and therefore not in the row, so without this
   * she is the one member in the room the player cannot turn to. Which is
   * backwards: answering the person who just spoke to you is the most natural
   * thing there is, and it is what a second voice is FOR.
   */
  const canTurnToSpeaker = Boolean(front && addresseeId && front !== addresseeId);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        {canTurnToSpeaker ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onTurnTo(front)}
            aria-label={t('vn.turnTo').replace('{name}', speaking.name)}
            className="h-full w-full"
          >
            <Portrait card={speaking} emotion={emotion} pulseKey={pulseKey} />
          </button>
        ) : (
          <Portrait card={speaking} emotion={emotion} pulseKey={pulseKey} />
        )}
      </div>

      {others.length > 0 ? (
        <ul className="flex shrink-0 items-end justify-center gap-2 pb-1">
          {others.map((id) => {
            const card = cards.find((c) => c.id === id);
            if (!card) return null;
            /**
             * The addressee, while somebody else is talking.
             *
             * She has to stay marked or the player loses track of where their
             * own attention is pointed - which is the state the whole group
             * scene is played on, and the state a chip, a gift and free text
             * all silently target.
             */
            const pointedAt = id === addresseeId;
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onTurnTo(id)}
                  aria-label={t('vn.turnTo').replace('{name}', card.name)}
                  aria-current={pointedAt ? 'true' : undefined}
                  className={`flex w-[3.75rem] flex-col items-center gap-0.5 rounded-[var(--radius-sm)] border px-1 pb-1 pt-0.5 transition-colors enabled:hover:border-accent disabled:opacity-60 ${
                    pointedAt ? 'border-accent bg-surface-alt' : 'border-transparent'
                  }`}
                >
                  <span className="h-14 w-full">
                    <Portrait card={card} emotion="neutral" speaking={false} size="small" />
                  </span>
                  <span
                    className={`w-full truncate text-center font-mono text-[0.5rem] uppercase tracking-[0.1em] ${
                      pointedAt ? 'text-accent' : 'text-faint'
                    }`}
                  >
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
