/**
 * The map. CLAUDE.md section 10, Part I.11.
 *
 * THE MAP SAYS WHERE EVERYONE IS. That is a reversal of Part I.11, taken on
 * played evidence after one phone session:
 *
 *   > Now the click to come in and find character doesn't give good play
 *   > experience.
 *
 * Part I.11's argument was good and it was about the wrong thing. Hiding
 * occupancy does make the map a search rather than a menu - but what the player
 * actually does with a hidden map is tap into rooms one at a time to see who is
 * in them, and there is no decision anywhere in that. It is the same block spent
 * either way; the only variable is how many taps it took to find her. **A guess
 * with no information is not a bet, it is a lottery**, and section 10's own
 * standard for the map is that opportunity cost has to be VISIBLE before it
 * bites - which is exactly why the week calendar has always been shown in full.
 *
 * So the map is a menu again, and the cost sits where section 10 always put it:
 * three blocks, five members, and one of them gets this one.
 *
 * WHAT THIS DOES NOT GIVE BACK. Section 10 wants snooping's best prize to be
 * ACCESS - "a fact that tells you where she will be is more interesting than one
 * that tells you what to purchase" - and Part I.11 claimed the hidden map was
 * what made that possible. It is not, and the distinction survives this change
 * intact: **this row says where she is NOW; a routine says where she will be on
 * an evening the player has not reached yet.** The week calendar shows scheduled
 * work slots, never idle evenings, so "she practises alone on Wednesday nights"
 * is still something that has to be learned rather than read.
 *
 * Each row therefore carries three things: the room, who is standing in it, and
 * how visible it is. The abstract witness COUNT is gone - it was the room's
 * capacity for witnesses, which is a worse answer to the same question now that
 * the faces are the real one.
 */

import { overworldFor } from '../../data/phaseMaps.js';
import { sceneExposure } from '../../systems/exposure.js';

/**
 * How many faces fit on a 390px row beside a truncated room name.
 *
 * Five, because the cast is five and the row that most needs all of them is the
 * one where they are all in it: an anchor event, which is also the only day the
 * map has a single row. Four collapsed the fifth member into `+1` on exactly
 * that day. The overflow path stays for a custom cast (section 12's v2 library),
 * where it becomes the real answer rather than an off-by-one.
 */
const FACE_LIMIT = 5;

function Faces({ list }) {
  if (list.length === 0) return null;
  const shown = list.slice(0, FACE_LIMIT);
  const rest = list.length - shown.length;

  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {shown.map((c) => (
        <span
          key={c.id}
          title={c.name}
          className="grid h-5 w-5 place-items-center rounded-full text-[0.625rem]"
          style={{ background: c.palette.base, color: c.palette.accent }}
        >
          {c.emoji}
        </span>
      ))}
      {rest > 0 ? (
        <span className="font-mono text-[0.5625rem] tabular-nums text-faint">+{rest}</span>
      ) : null}
    </span>
  );
}

export default function LocationGrid({
  cards,
  run,
  player,
  identity,
  /**
   * `{ [memberId]: { locationId, activity } }` for this block, derived from the
   * deterministic calendar. Passed rather than recomputed so the map and the
   * room screen can never disagree about who is where.
   */
  occupancy = {},
  taskLocation,
  eventSlot = null,
  /**
   * Today is an anchor event, so the map is the site and nothing else.
   *
   * The dorm goes with the rest: an event takes the whole day (section 10),
   * and a day the player can spend three blocks avoiding is not one.
   */
  eventOnly = false,
  onPick,
  onOpenDorm,
  t,
}) {
  /**
   * The rows come from the phase map, never from a list in here.
   *
   * They used to be a hardcoded six, which is how the map stayed identical for
   * all nine weeks while the calendar underneath it changed every three. The
   * dorm is not among them: it is a second step, because it holds four rooms
   * with very different meanings plus five closed doors.
   */
  const rows = overworldFor(run.phase, { eventSlot, eventOnly });
  const at = (locId) => cards.filter((c) => occupancy[c.id]?.locationId === locId);

  /**
   * The dorm row answers "is anybody home", not "who is in which dorm room" -
   * that is `DormMap`'s question, one step in. One constant served both for a
   * while and lit a member's bedroom door because she was in the kitchen.
   */
  const inDorm = cards.filter((c) => occupancy[c.id]?.locationId?.startsWith('dorm_'));

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((locId) => {
        const exposure = sceneExposure({
          locationId: locId,
          block: run.block,
          phase: run.phase,
          secrecy: player.secrecy,
          identity,
        });
        const here = at(locId);
        const isTask = taskLocation === locId;

        /**
         * ONE SHAPE FOR EVERY ROOM, occupied or not.
         *
         * v1 had two: a plain row, and a two-layer row for a crowded room whose
         * second layer walked the player straight up to one of the people in it.
         * The faces come back; that second layer does not. Choosing one member
         * in front of the others happens INSIDE the room, where it costs what it
         * should - and v1's crowded row offered ONLY per-member buttons, so the
         * task, the snoop and the solo work were all locked out by company.
         */
        return (
          <li key={locId}>
            <button
              type="button"
              onClick={() => onPick(locId)}
              className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2.5 text-left transition-colors disabled:opacity-40 ${
                isTask ? 'border-warn bg-surface-alt' : 'border-hairline hover:border-accent'
              }`}
            >
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate font-body text-[0.9375rem] text-text">
                  {t(`location.${locId}`)}
                </span>
                {isTask ? (
                  <span className="shrink-0 font-mono text-[0.5rem] uppercase tracking-[0.14em] text-warn">
                    {t('map.task')}
                  </span>
                ) : null}
              </span>

              <Faces list={here} />

              {/* How visible this room is at this hour - a property of the room
                  and the clock, and the one thing on the row that is not a fact
                  about who is standing in it. */}
              <span className="flex shrink-0 items-center gap-1">
                <span className="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-faint">
                  {t('map.seen')}
                </span>
                <span
                  className="h-1 w-7 rounded-full"
                  style={{
                    background: 'var(--meter-exposure)',
                    opacity: 0.2 + (exposure / 100) * 0.8,
                  }}
                />
              </span>
            </button>
          </li>
        );
      })}

      {/* the dorm is a place, not a room - it opens into its own map, and on
          an event day it is not on the map at all */}
      {eventOnly ? null : (
        <li>
          <button
            type="button"
            onClick={onOpenDorm}
            className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] border border-accent/60 px-3 py-2.5 text-left transition-colors hover:border-accent"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-body text-[0.9375rem] text-text">{t('map.dorm')}</span>
              <span className="mt-0.5 block font-mono text-[0.5rem] uppercase tracking-[0.12em] text-faint">
                {t('map.dormNote')}
              </span>
            </span>
            <Faces list={inDorm} />
            <span className="font-mono text-[0.75rem] text-accent">&#9656;</span>
          </button>
        </li>
      )}
    </ul>
  );
}
