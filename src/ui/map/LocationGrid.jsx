/**
 * The map. CLAUDE.md section 10.
 *
 * A search, not a menu. Occupancy is derived from the deterministic calendar,
 * so she is at the radio station on Wednesday afternoon whether you go looking
 * or not - and the only way to reliably find someone alone is to have learned
 * her routine.
 *
 * Each row shows the two numbers the player is actually trading between:
 * outside exposure, and how many other people can see.
 */

import { DORM_OCCUPANCY } from '../../data/locations.js';
import { sceneExposure, presenceCount } from '../../systems/exposure.js';

/** The dorm is one row here; it opens into its own map (DormMap). */
const ORDER = ['wardrobe', 'practice_room', 'corridor', 'broadcast_studio', 'cafe', 'drama_set'];

export default function LocationGrid({
  occupancy,
  cards,
  run,
  player,
  identity,
  taskLocation,
  onPick,
  onOpenDorm,
  t,
}) {
  const homeCards = cards.filter((c) => DORM_OCCUPANCY.includes(occupancy[c.id]?.locationId));
  const byLocation = {};
  for (const [id, where] of Object.entries(occupancy)) {
    (byLocation[where.locationId] ??= []).push({ id, ...where });
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {ORDER.map((locId) => {
        const here = byLocation[locId] ?? [];
        const exposure = sceneExposure({
          locationId: locId,
          block: run.block,
          phase: run.phase,
          secrecy: player.secrecy,
          identity,
        });
        const witnesses = presenceCount(locId, run.phase, cards.length);
        const isTask = taskLocation === locId;

        // With more than one person in the room the row stops being a single
        // button: you choose who you walk up to, rather than the map choosing
        // the first one for you.
        if (here.length > 1) {
          return (
            <li
              key={locId}
              className="rounded-[var(--radius-sm)] border border-hairline px-3 py-2.5"
            >
              <span className="flex items-baseline gap-2">
                <span className="flex-1 truncate font-body text-[0.9375rem] text-text">
                  {t(`location.${locId}`)}
                </span>
                {isTask ? (
                  <span className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-warn">
                    {t('map.task')}
                  </span>
                ) : null}
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
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {here.map((m) => {
                  const card = cards.find((c) => c.id === m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onPick(locId, [m])}
                      className="flex items-center gap-1.5 rounded-full border border-hairline px-2 py-1 transition-colors hover:border-accent"
                    >
                      <span
                        className="grid h-4 w-4 place-items-center rounded-full text-[0.5rem]"
                        style={{ background: card.palette.base, color: card.palette.accent }}
                      >
                        {card.emoji}
                      </span>
                      <span className="font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-dim">
                        {card.name}
                      </span>
                    </button>
                  );
                })}
              </span>
            </li>
          );
        }

        return (
          <li key={locId}>
            <button
              type="button"
              onClick={() => onPick(locId, here)}
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

                <span className="mt-0.5 flex items-center gap-1">
                  {here.length > 0 ? (
                    here.map((m) => {
                      const card = cards.find((c) => c.id === m.id);
                      return (
                        <span
                          key={m.id}
                          title={card.name}
                          className="grid h-5 w-5 place-items-center rounded-full text-[0.625rem]"
                          style={{ background: card.palette.base, color: card.palette.accent }}
                        >
                          {card.emoji}
                        </span>
                      );
                    })
                  ) : (
                    <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-dim">
                      {t('solo.alone')}
                    </span>
                  )}
                </span>
              </span>

              {/* the two independent risks, side by side */}
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

      {/* the dorm is a place, not a room - it opens into its own map */}
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
          <span className="flex shrink-0 items-center gap-1">
            {homeCards.map((c) => (
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
          <span className="font-mono text-[0.75rem] text-accent">&#9656;</span>
        </button>
      </li>
    </ul>
  );
}
