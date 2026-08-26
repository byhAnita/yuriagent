/**
 * The numbers, on screen. CLAUDE.md Part I.2.
 *
 * Replaces `MeterBar.jsx`, and the reversal is the point. v1's first pillar was
 * "the player reads hidden emotional state and bets on it", and what that
 * produced was the stance bar: it hid the numbers and handed the player a
 * labelled lever instead, which is the worst of both. `rv-simulator` shows its
 * values and has been played for months; the intensity comes from the writing,
 * not from concealment.
 *
 * So both axes are here, per member in the room, and `Read her` becomes the only
 * hidden state left - her unspoken thought, which is where the tension moves.
 *
 * TWO AXES, DRAWN DIFFERENTLY. Affection is a level and reads as one. Being
 * nameable is not a level - it is a ceiling the world imposes, it only moves
 * where somebody could see, and it is the axis three separate v1 defects made
 * unreachable. Drawing it as a second identical bar would say the two are the
 * same kind of thing, and the whole design is that they are not.
 *
 * Fill widths are the permitted inline-style exception (section 20), alongside
 * the character palette.
 */

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

function Axis({ label, value, colorVar, dotted = false }) {
  const pct = clamp(value);

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-1">
        <span className="truncate font-mono text-[0.5rem] uppercase tracking-[0.14em] text-dim">
          {label}
        </span>
        <span className="font-mono text-[0.5625rem] tabular-nums text-text">{pct}</span>
      </div>
      <div
        className={`relative mt-0.5 h-[0.1875rem] overflow-hidden rounded-full bg-surface-alt ${
          dotted ? 'opacity-90' : ''
        }`}
      >
        <div
          className="meter-fill absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: `var(${colorVar})`,
            opacity: dotted ? 0.65 : 0.9,
          }}
        />
      </div>
    </div>
  );
}

/**
 * One quiet mono figure. The player's own values are not levels either - they
 * are a readout, they move rarely, and giving them bars would put six moving
 * bars on a 390px screen above a paragraph of prose.
 */
function Stat({ label, value, warn = false }) {
  return (
    <span className="whitespace-nowrap font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-dim">
      {label}{' '}
      <span className={`tabular-nums ${warn ? 'text-warn' : 'text-text'}`}>{clamp(value)}</span>
    </span>
  );
}

export default function ValueBar({ cards = [], present = [], relations = {}, player = {}, t }) {
  const inRoom = present.map((id) => cards.find((c) => c.id === id)).filter(Boolean);

  return (
    <div className="px-5 pb-2">
      {inRoom.length > 0 ? (
        <div className="mb-2 flex flex-col gap-1.5">
          {inRoom.map((card) => {
            const rel = relations[card.id] ?? {};
            return (
              <div key={card.id} className="flex items-center gap-2">
                {/*
                  Her name is the label, so a five-member room reads as five
                  rows rather than ten anonymous bars. It takes the card palette
                  - the one place character data reaches the visual layer.
                */}
                <span
                  className="w-14 shrink-0 truncate font-display text-[0.6875rem] leading-none"
                  style={{ color: card.palette?.accent }}
                >
                  {card.name}
                </span>
                <Axis
                  label={t('relations.close')}
                  value={rel.affection}
                  colorVar="--meter-fluster"
                />
                <Axis
                  label={t('relations.nameable')}
                  value={rel.admissibility}
                  colorVar="--meter-exposure"
                  dotted
                />
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stat label={t('game.energy')} value={player.energy} warn={(player.energy ?? 100) < 20} />
        <Stat label={t('game.mood')} value={player.mood} />
        <Stat label={t('game.selfId')} value={player.selfId} />
        <Stat label={t('game.secrecy')} value={player.secrecy} />
      </div>
    </div>
  );
}
