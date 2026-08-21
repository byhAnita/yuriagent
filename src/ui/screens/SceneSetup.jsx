/**
 * Who, and where.
 *
 * A stand-in for the map and calendar that arrive in M4. It exists so a scene
 * is reachable, and so the two choices that actually matter romantically -
 * which member, and how visible the room is - are already the two choices the
 * player makes here.
 */

import { LOCATIONS } from '../../data/locations.js';
import { sceneExposure } from '../../systems/exposure.js';
import { resolveStage } from '../../systems/relationship.js';
import { BLOCKS } from '../../config/constants.js';

const LOCATION_ORDER = [
  'dorm_room',
  'dorm_kitchen',
  'dorm_living',
  'wardrobe',
  'practice_room',
  'corridor',
  'cafe',
  'drama_set',
  'broadcast_studio',
];

export default function SceneSetup({ cards, relations, choice, onChange, onBegin, t }) {
  const rel = relations[choice.memberId];
  const stage = resolveStage(rel.intimacy, rel.admissibility);

  return (
    <div className="stage mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col gap-5 px-5 py-7">
      <header>
        <h1 className="font-display text-[1.75rem] leading-none tracking-wide">
          {t('app.title')}
        </h1>
        <p className="mt-1 font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
          {t('vn.whoWhere')}
        </p>
      </header>

      <section>
        <div className="grid grid-cols-5 gap-1.5">
          {cards.map((c) => {
            const active = c.id === choice.memberId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange({ ...choice, memberId: c.id })}
                aria-pressed={active}
                className="flex flex-col items-center gap-1 rounded-[var(--radius-sm)] border px-1 py-2 transition-colors"
                style={{
                  borderColor: active ? c.palette.base : 'var(--hairline)',
                  background: active ? 'var(--surface-alt)' : 'transparent',
                }}
              >
                <span
                  className="grid h-9 w-9 place-items-center rounded-full text-[1.0625rem]"
                  style={{ background: c.palette.base, color: c.palette.accent }}
                >
                  {c.emoji}
                </span>
                <span className="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-dim">
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim">
          {t(`stage.${stage}`)}
          <span className="mx-2 text-hairline">/</span>
          {t('meter.fluster')} {Math.round(rel.intimacy)}
        </p>
      </section>

      <section className="flex flex-col gap-1.5">
        {LOCATION_ORDER.map((id) => {
          const active = id === choice.locationId;
          const exposure = sceneExposure({
            locationId: id,
            block: choice.block,
            phase: choice.phase,
            secrecy: 70,
          });
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ ...choice, locationId: id })}
              aria-pressed={active}
              className={`flex items-baseline gap-3 rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors ${
                active ? 'border-accent bg-surface-alt' : 'border-hairline bg-transparent'
              }`}
            >
              <span className="flex-1 font-body text-[0.9375rem]">{t(`location.${id}`)}</span>
              <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-dim">
                {LOCATIONS[id].presence === 'all'
                  ? t('exposureBand.public')
                  : t('exposureBand.private')}
              </span>
              <span
                className="h-1 w-8 rounded-full"
                style={{
                  background: 'var(--meter-exposure)',
                  opacity: 0.25 + (exposure / 100) * 0.75,
                }}
              />
              <span className="w-6 text-right font-mono text-[0.625rem] tabular-nums text-dim">
                {exposure}
              </span>
            </button>
          );
        })}
      </section>

      <section className="flex gap-1.5">
        {BLOCKS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onChange({ ...choice, block: b })}
            aria-pressed={b === choice.block}
            className={`flex-1 rounded-[var(--radius-sm)] border px-2 py-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] transition-colors ${
              b === choice.block ? 'border-accent bg-accent text-on-accent' : 'border-hairline text-dim'
            }`}
          >
            {t(`block.${b}`)}
          </button>
        ))}
      </section>

      <button
        type="button"
        onClick={onBegin}
        className="mt-auto rounded-[var(--radius)] border border-accent bg-accent px-4 py-3 font-mono text-[0.75rem] uppercase tracking-[0.2em] text-on-accent"
      >
        {t('vn.begin')}
      </button>
    </div>
  );
}
