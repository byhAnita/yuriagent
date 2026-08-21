/**
 * Scene meters. CLAUDE.md section 6.
 *
 * Read as studio level meters, because that is what they are: guard and fluster
 * are levels being watched during a take. Exposure is different in kind - it is
 * fixed for the whole scene and derived from the map, never from the model - so
 * it is drawn as a hazard read rather than a moving level.
 *
 * Meter fill widths are the second permitted inline-style exception in
 * section 20, alongside the character palette.
 */

const TICKS = [0, 25, 50, 75, 100];

function Ticks() {
  return (
    <div className="pointer-events-none absolute inset-0 flex justify-between">
      {TICKS.map((t) => (
        <span key={t} className="w-px bg-hairline opacity-40" />
      ))}
    </div>
  );
}

function Level({ label, value, colorVar, inverted = false, hint }) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="flex-1">
      <div className="mb-1 flex items-baseline justify-between gap-1">
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-faint">
          {label}
        </span>
        <span className="font-mono text-[0.5625rem] tabular-nums text-dim">
          {Math.round(pct)}
        </span>
      </div>

      <div className="relative h-[0.3125rem] overflow-hidden rounded-full bg-surface-alt">
        <Ticks />
        <div
          className="meter-fill absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: `var(${colorVar})`,
            opacity: inverted ? 0.55 : 0.9,
          }}
        />
      </div>

      {hint ? (
        <span className="mt-0.5 block font-mono text-[0.5rem] uppercase tracking-[0.1em] text-faint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export default function MeterBar({ meters, exposure, t }) {
  const exposureBand =
    exposure >= 60 ? t('exposureBand.public') : exposure >= 30 ? t('exposureBand.quiet') : t('exposureBand.private');

  return (
    <div className="flex items-start gap-4 px-5 py-3">
      <Level label={t('meter.guard')} value={meters.guard} colorVar="--meter-guard" inverted />
      <Level label={t('meter.fluster')} value={meters.fluster} colorVar="--meter-fluster" />
      <Level
        label={t('meter.exposure')}
        value={exposure}
        colorVar="--meter-exposure"
        hint={exposureBand}
      />
    </div>
  );
}
