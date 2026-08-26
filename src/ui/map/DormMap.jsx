/**
 * Inside the dorm.
 *
 * A second step in the map because the dorm holds rooms that mean very
 * different things: a living room everyone can see you in, a kitchen, your own
 * room - the only place that gives anything back - and five closed doors.
 *
 * Her door opens at the same affection the `touch` stance does, so "you may go
 * into her room" and "you may reach for her hand" unlock together. A locked
 * door shows her name and the threshold: that is a goal, not a spoiler.
 */

import { LOCATIONS } from '../../data/locations.js';
import { DAY_NAMES } from '../../systems/calendar.js';

function Room({ label, note, right, disabled, onClick, tone = 'default' }) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`flex w-full items-baseline gap-2.5 rounded-[var(--radius-sm)] border px-3 py-2.5 text-left transition-colors disabled:opacity-40 ${
          tone === 'own' ? 'border-accent/60 hover:border-accent' : 'border-hairline hover:border-accent'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-body text-[0.9375rem] text-text">{label}</span>
          {note ? (
            <span className="mt-0.5 block font-mono text-[0.5rem] uppercase tracking-[0.12em] text-faint">
              {note}
            </span>
          ) : null}
        </span>
        {right}
      </button>
    </li>
  );
}

export default function DormMap({
  cards,
  relations,
  occupancy,
  /**
   * `{ [memberId]: number[] }` for the routines the player has WORKED OUT, and
   * only those. Resolved by App from `foundRoutines`, never from the calendar
   * directly - a door that showed every routine would hand the player for free
   * the one thing snooping is left to buy.
   */
  routines = {},
  onBack,
  onEnterRoom,
  onEnterSolo,
  t,
}) {
  /**
   * A lit door means she is BEHIND it, not that she is somewhere in the dorm.
   *
   * This used to read `DORM_OCCUPANCY.includes(...)`, so a member standing in
   * the kitchen lit her own door as well and the map showed her in two rooms
   * at once - reported on the second evening anybody played. The routine layer
   * answers the exact question already: `occupancyAt` puts her in `dorm_room`
   * on the evenings that are hers and in a shared room on the ones that are
   * not. Anywhere-in-the-dorm is still right for the dorm ROW on the overworld
   * (`LocationGrid`), which is why one constant served two questions for as
   * long as it did.
   */
  const homeIds = cards
    .filter((c) => occupancy[c.id]?.locationId === 'dorm_room')
    .map((c) => c.id);

  const inLiving = cards.filter((c) => occupancy[c.id]?.locationId === 'dorm_living');
  const inKitchen = cards.filter((c) => occupancy[c.id]?.locationId === 'dorm_kitchen');

  const gate = LOCATIONS.dorm_room.entryAffection;

  const faces = (list) => (
    <span className="flex shrink-0 items-center gap-1">
      {list.map((c) => (
        <span
          key={c.id}
          title={c.name}
          className="grid h-5 w-5 place-items-center rounded-full text-[0.625rem]"
          style={{ background: c.palette.base, color: c.palette.accent }}
        >
          {c.emoji}
        </span>
      ))}
    </span>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim hover:text-accent"
        >
          &#8592; {t('map.back')}
        </button>
        <span className="h-px flex-1 bg-hairline opacity-60" />
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-accent">
          {t('map.dorm')}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        <Room
          label={t('location.dorm_living')}
          note={t('map.dormNote')}
          right={inLiving.length ? faces(inLiving) : null}
          /**
           * The shared dorm rooms open the ROOM, never a scene.
           *
           * They used to walk the player straight into a 1v1 with whoever was
           * listed first, which is the worst possible default here: the dorm is
           * where the whole cast is, so it is where an unchosen 1v1 costs the
           * most in witnessed jealousy (section 5b).
           */
          onClick={() => onEnterSolo('dorm_living', inLiving.map((c) => ({ id: c.id })))}
        />

        <Room
          label={t('location.dorm_kitchen')}
          right={inKitchen.length ? faces(inKitchen) : null}
          onClick={() => onEnterSolo('dorm_kitchen', inKitchen.map((c) => ({ id: c.id })))}
        />

        <Room
          label={t('location.dorm_player_room')}
          note={t('map.yourRoomNote')}
          tone="own"
          onClick={() => onEnterSolo('dorm_player_room')}
        />

        <li className="pt-1">
          <span className="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-faint">
            {t('map.doors')}
          </span>
        </li>

        {cards.map((c) => {
          const rel = relations[c.id];
          const home = homeIds.includes(c.id);
          const open = rel.affection >= gate;

          /**
           * WHERE A LEARNED ROUTINE IS SPENT. Part I.10, section 10.
           *
           * A dark door said `notHome` and nothing else, which is a fact the
           * player could already see by standing here - so the block was spent
           * finding out. Knowing her routine turns the same door into a plan:
           * not tonight, Thursday.
           *
           * This is the one thing the map still cannot tell you. The overworld
           * says where everybody is NOW (the I.11 reversal), and the week grid
           * shows scheduled WORK slots and never idle evenings - so which
           * nights are hers has to be learned, which is what keeps section 10's
           * prize intact after the map went back to showing occupancy.
           */
          const nights = routines[c.id] ?? null;

          return (
            <Room
              key={c.id}
              label={t('map.herRoom').replace('{name}', c.name)}
              note={
                !open
                  ? t('map.doorLocked').replace('{n}', String(gate))
                  : home
                    ? null
                    : nights?.length
                      ? t('map.homeOn').replace(
                          '{nights}',
                          nights.map((d) => t(`day.${DAY_NAMES[d]}`)).join(' / '),
                        )
                      : t('map.notHome')
              }
              disabled={!open || !home}
              right={
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.625rem]"
                  style={{
                    background: c.palette.base,
                    color: c.palette.accent,
                    opacity: home ? 1 : 0.3,
                  }}
                >
                  {c.emoji}
                </span>
              }
              onClick={() => onEnterRoom('dorm_room', [{ id: c.id }])}
            />
          );
        })}
      </ul>
    </div>
  );
}
