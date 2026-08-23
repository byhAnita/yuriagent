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
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim">
          {label}
        </span>
        <span className="font-mono text-[0.5625rem] tabular-nums text-text">
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
        <span className="mt-0.5 block font-mono text-[0.5rem] uppercase tracking-[0.1em] text-dim">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/**
 * @param {string|null} ofName - whose guard and fluster these are, when that is
 *   not obvious. Null in a one-to-one scene, where there is only one of her and
 *   naming her every turn is noise.
 *
 *   In a group scene it is not obvious at all: the meters belong to the
 *   ADDRESSEE, and somebody else may have the floor, so the face on screen and
 *   the numbers under it can be two different women. Guard and fluster are
 *   per-member readings by design (`turnTo` carries them, an interjection does
 *   not move the addressee's), which makes labelling them the honest fix rather
 *   than switching them to follow the speaker.
 */
export default function MeterBar({ meters, exposure, ofName = null, standing = null, t }) {
  const exposureBand =
    exposure >= 60 ? t('exposureBand.public') : exposure >= 30 ? t('exposureBand.quiet') : t('exposureBand.private');

  const label = (key) => (ofName ? `${ofName} ${t(key)}` : t(key));

  return (
    <div className="flex flex-col gap-1 px-5 py-3">
      {/*
        Where the two of you stand, in a word.

        The three meters below are VOLATILE - they reset at every door
        (section 6) - and with nothing else on screen a player reasonably reads
        `fluster 0` at the top of a new scene as her affection having gone back
        to zero. Reported exactly that way after an anchor event that had just
        moved her.

        A word rather than a number, for section 8's reason: the sentence
        cannot be quoted back, and the number is on the day screen for anyone
        who wants it. It is macro state, so it is fixed for the whole scene.
      */}
      {standing ? (
        <span className="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-faint">
          {ofName ? `${ofName} - ` : ''}
          {standing}
        </span>
      ) : null}

      <div className="flex items-start gap-4">
        <Level label={label('meter.guard')} value={meters.guard} colorVar="--meter-guard" inverted />
        <Level label={label('meter.fluster')} value={meters.fluster} colorVar="--meter-fluster" />
        <Level
          label={t('meter.exposure')}
          value={exposure}
          colorVar="--meter-exposure"
          hint={exposureBand}
        />
      </div>
    </div>
  );
}
