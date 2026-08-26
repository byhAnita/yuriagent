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
  /** Who cut in this round, if anybody. Marked more lightly than the addressee. */
  secondId = null,
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

  /**
   * THE OTHERS SIT BESIDE THE SPEAKER, NOT ON TOP OF HER.
   *
   * Three layouts have been tried here and the first two both hid the face the
   * scene is about. It began as a flex COLUMN - portrait `min-h-0 flex-1`, row
   * `shrink-0` - and on a 390x844 phone `flex-1` had almost nothing left to
   * divide once the header, the values, a Chinese dialogue box and the option
   * bar had taken their fixed share. The portrait collapsed to nothing.
   *
   * Overlaying the row along the bottom fixed the collapse and produced the
   * report this rewrite answers:
   *
   *   > In a group chat, now other members' cards presented on top, the
   *   > speaker's portrait is hidden.
   *
   * Correct, and arithmetic rather than opinion: the portrait area floors at
   * 5.5rem and the overlaid cards were a 2.5rem face plus a name plus padding,
   * so four of them covered most of the frame. A strip that costs no HEIGHT
   * still costs the whole picture if it lands on the picture.
   *
   * So it is a COLUMN DOWN THE SIDE. Horizontal space is the one thing this
   * screen has spare - a mascot SVG is drawn `object-contain` and does not fill
   * a 390px width - and the speaker keeps her full height at every font scale.
   * Faces only: the name is already over the dialogue box for whoever is
   * speaking, and repeating four more is what forced the cards tall enough to
   * be a problem.
   */
  return (
    <div className="flex h-full gap-1.5">
      <div className="min-w-0 flex-1">
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
        /**
         * Its own scroll, because the column is as tall as the portrait area and
         * that area is the one thing on this screen that yields. A six-member
         * cast on a short round must not push a face off the frame - section 20:
         * nothing on this screen may become unreachable.
         */
        <ul className="flex shrink-0 flex-col items-center justify-center gap-1 overflow-y-auto py-0.5">
          {others.map((id) => {
            const card = cards.find((c) => c.id === id);
            if (!card) return null;
            /**
             * The addressee, while somebody else is talking.
             *
             * She has to stay marked or the player loses track of where their
             * own attention is pointed - which is the state the whole group
             * scene is played on, and the state an option, a gift and free text
             * all silently target.
             */
            const pointedAt = id === addresseeId;
            /** She cut in this round. Lighter than the addressee, on purpose:
                borrowing the floor is not the same as holding it. */
            const spoke = id === secondId;
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onTurnTo(id)}
                  aria-label={t('vn.turnTo').replace('{name}', card.name)}
                  aria-current={pointedAt ? 'true' : undefined}
                  title={card.name}
                  className={`grid h-9 w-9 place-items-center rounded-full border bg-bg/70 transition-colors enabled:hover:border-accent disabled:opacity-60 ${
                    pointedAt
                      ? 'border-accent bg-surface-alt'
                      : spoke
                        ? 'border-dim'
                        : 'border-hairline/60'
                  }`}
                >
                  <span className="h-7 w-7">
                    <Portrait card={card} emotion="neutral" speaking={false} />
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
