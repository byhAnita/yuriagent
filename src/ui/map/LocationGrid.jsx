/**
 * The map. CLAUDE.md section 10, Part I.11.
 *
 * A search, not a menu - and from v2 on, genuinely one. Occupancy is derived
 * from the deterministic calendar, so she is at the radio station on Wednesday
 * afternoon whether you go looking or not, and THE MAP NO LONGER SAYS SO.
 *
 * That is the change. In v1 the player could see who was where and CHOOSE an
 * empty room to work in, which made solo work a strategy and made the "search"
 * a menu with the answers printed on it. Now they guess. Walking into a room is
 * free (section 10b), the room screen is where you find out who is standing in
 * it, and solo work becomes the consolation for having guessed wrong rather than
 * the optimal play.
 *
 * It also finally pays off something section 10 has wanted since M1 and never
 * delivered: a fact that tells you where she will be is more interesting than
 * one that tells you what to purchase. It never delivered because the map
 * already told you. Snooping's best prize stops being an object and becomes
 * ACCESS.
 *
 * What each row still shows is what the player could work out from where they
 * are standing and what time it is: outside exposure, and how many people a room
 * like this one can hold. Both are properties of the ROOM, not of who is in it.
 */

import { overworldFor } from '../../data/phaseMaps.js';
import { sceneExposure, presenceCount } from '../../systems/exposure.js';

export default function LocationGrid({
  cards,
  run,
  player,
  identity,
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
        const witnesses = presenceCount(locId, run.phase, cards.length);
        const isTask = taskLocation === locId;

        /**
         * ONE SHAPE FOR EVERY ROOM, because the map cannot know which rooms are
         * different from each other any more.
         *
         * v1 had two: a plain row, and a two-layer row for a room with several
         * people in it, whose second layer walked the player straight up to one
         * of them. Both layers required knowing who was there, and the second
         * one let the player pick a member before opening the door - which is
         * precisely the bet Part I.11 wants them to make blind.
         *
         * Choosing one member in front of the others still exists. It happens
         * INSIDE the room, where it costs what it should.
         */
        return (
          <li key={locId}>
            <button
              type="button"
              onClick={() => onPick(locId)}
              className={`flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border px-3 py-2.5 text-left transition-colors disabled:opacity-40 ${
                isTask ? 'border-warn bg-surface-alt' : 'border-hairline hover:border-accent'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate font-body text-[0.9375rem] text-text">
                    {t(`location.${locId}`)}
                  </span>
                  {isTask ? (
                    <span className="shrink-0 font-mono text-[0.5rem] uppercase tracking-[0.14em] text-warn">
                      {t('map.task')}
                    </span>
                  ) : null}
                </span>
              </span>

              {/* the two independent risks, side by side - both properties of
                  the room and the hour, neither of them a fact about who is
                  standing in it */}
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="flex items-center gap-1">
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
                <span className="flex items-center gap-1">
                  <span className="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-faint">
                    {t('map.witnesses')}
                  </span>
                  <span className="w-7 text-right font-mono text-[0.625rem] tabular-nums text-dim">
                    {witnesses}
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}

      {/* the dorm is a place, not a room - it opens into its own map, and on
          an event day it is not on the map at all. It shows no faces either:
          who is home tonight is exactly the kind of thing the player is meant
          to have to walk in and find out. */}
      {eventOnly ? null : (
      <li>
        <button
          type="button"
          onClick={onOpenDorm}
          className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border border-accent/60 px-3 py-2.5 text-left transition-colors hover:border-accent"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-body text-[0.9375rem] text-text">{t('map.dorm')}</span>
            <span className="mt-0.5 block font-mono text-[0.5rem] uppercase tracking-[0.12em] text-faint">
              {t('map.dormNote')}
            </span>
          </span>
          <span className="font-mono text-[0.75rem] text-accent">&#9656;</span>
        </button>
      </li>
      )}
    </ul>
  );
}
