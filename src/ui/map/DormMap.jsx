/**
 * Inside the dorm.
 *
 * A second step in the map because the dorm holds rooms that mean very
 * different things: a living room everyone can see you in, a kitchen, your own
 * room - the only place that gives anything back - and five closed doors.
 *
 * Her door opens at the same intimacy the `touch` stance does, so "you may go
 * into her room" and "you may reach for her hand" unlock together. A locked
 * door shows her name and the threshold: that is a goal, not a spoiler.
 */

import { LOCATIONS, DORM_OCCUPANCY } from '../../data/locations.js';

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

export default function DormMap({ cards, relations, occupancy, onBack, onEnterRoom, onEnterSolo, t }) {
  const homeIds = cards
    .filter((c) => DORM_OCCUPANCY.includes(occupancy[c.id]?.locationId))
    .map((c) => c.id);

  const inLiving = cards.filter((c) => occupancy[c.id]?.locationId === 'dorm_living');
  const inKitchen = cards.filter((c) => occupancy[c.id]?.locationId === 'dorm_kitchen');

  const gate = LOCATIONS.dorm_room.entryIntimacy;

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
          const open = rel.intimacy >= gate;

          return (
            <Room
              key={c.id}
              label={t('map.herRoom').replace('{name}', c.name)}
              note={
                !open
                  ? t('map.doorLocked').replace('{n}', String(gate))
                  : home
                    ? null
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
