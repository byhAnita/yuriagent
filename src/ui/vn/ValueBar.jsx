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
 * So both axes are here, and `Read her` becomes the only hidden state left - her
 * unspoken thought, which is where the tension moves.
 *
 * ONE LINE BY DEFAULT, AND THAT IS A HEIGHT RULE BEFORE IT IS A DENSITY ONE.
 * This drew every member in the room on two lines each, plus four player stats -
 * up to eleven rows of chrome above a paragraph of Chinese prose, on a screen
 * that has to end with four options inside the player's thumb. Reported from
 * play: the scene ran about 1.5 screens tall at font scale 1, so every round
 * needed a scroll before it could be answered.
 *
 * Collapsed, it is the woman whose portrait is on screen and nobody else. The
 * rest is one tap away rather than deleted, because Part I.2 is a rule about the
 * numbers being AVAILABLE, and four absent members' values are not what the
 * player is reading while she is talking.
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

import { useState } from 'react';

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

/**
 * Label, rail and figure on ONE baseline.
 *
 * It used to stack the label above the rail, which is the right shape for a
 * panel and the wrong one for a strip: two axes x two lines x five members is
 * the whole of the height problem above.
 */
function Axis({ label, value, colorVar, dotted = false }) {
  const pct = clamp(value);

  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className="shrink-0 font-mono text-[0.5rem] uppercase tracking-[0.1em] text-faint">
        {label}
      </span>
      <span className="relative h-[0.1875rem] min-w-0 flex-1 overflow-hidden rounded-full bg-surface-alt">
        <span
          className="meter-fill absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: `var(${colorVar})`,
            opacity: dotted ? 0.6 : 0.9,
          }}
        />
      </span>
      <span className="w-[1.375rem] shrink-0 text-right font-mono text-[0.5625rem] tabular-nums text-text">
        {pct}
      </span>
    </span>
  );
}

/**
 * One quiet mono figure. The player's own values are not levels either - they
 * are a readout and they move rarely, so they sit in the expanded panel with
 * the rest of the room rather than costing a row of every round.
 */
function Stat({ label, value, warn = false }) {
  return (
    <span className="whitespace-nowrap font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-dim">
      {label}{' '}
      <span className={`tabular-nums ${warn ? 'text-warn' : 'text-text'}`}>{clamp(value)}</span>
    </span>
  );
}

function MemberLine({ card, rel = {}, t }) {
  return (
    <div className="flex items-center gap-2">
      {/*
        Her name is the label, so an expanded five-member room reads as five
        rows rather than ten anonymous bars. It takes the card palette - the one
        place character data reaches the visual layer.
      */}
      <span
        className="w-11 shrink-0 truncate font-display text-[0.6875rem] leading-none"
        style={{ color: card.palette?.accent }}
      >
        {card.name}
      </span>
      <Axis label={t('relations.closeShort')} value={rel.affection} colorVar="--meter-fluster" />
      <Axis
        label={t('relations.nameableShort')}
        value={rel.admissibility}
        colorVar="--meter-exposure"
        dotted
      />
    </div>
  );
}

export default function ValueBar({
  cards = [],
  present = [],
  /** Whose portrait is on screen. Hers are the numbers the collapsed strip shows. */
  focusId = null,
  relations = {},
  player = {},
  t,
}) {
  const [open, setOpen] = useState(false);
  const inRoom = present.map((id) => cards.find((c) => c.id === id)).filter(Boolean);
  const focus = inRoom.find((c) => c.id === focusId) ?? inRoom[0] ?? null;
  const others = inRoom.filter((c) => c.id !== focus?.id);

  return (
    <div className="shrink-0 px-5 py-1">
      {focus ? (
        <>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <MemberLine card={focus} rel={relations[focus.id]} t={t} />
            </div>
            {/*
              The affordance is the whole of what makes collapsing this legal.
              Section 7 twice: a thing the player has to discover is a thing that
              does not exist, so the way to the rest of the numbers is visible on
              the row those numbers belong to - and it carries the count, because
              "there are two other people in here" is itself scene state.
            */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={t('relations.open')}
              className="flex shrink-0 items-center gap-1 font-mono text-[0.5625rem] tabular-nums text-faint transition-colors hover:text-accent"
            >
              {others.length > 0 ? <span>+{others.length}</span> : null}
              <span aria-hidden="true">{open ? '▴' : '▾'}</span>
            </button>
          </div>

          {open ? (
            <div className="mt-1.5 flex flex-col gap-1.5 border-t border-hairline pt-1.5">
              {others.map((card) => (
                <MemberLine key={card.id} card={card} rel={relations[card.id]} t={t} />
              ))}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stat
                  label={t('game.energy')}
                  value={player.energy}
                  warn={(player.energy ?? 100) < 20}
                />
                <Stat label={t('game.mood')} value={player.mood} />
                <Stat label={t('game.selfId')} value={player.selfId} />
                <Stat label={t('game.secrecy')} value={player.secrecy} />
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stat label={t('game.energy')} value={player.energy} warn={(player.energy ?? 100) < 20} />
          <Stat label={t('game.mood')} value={player.mood} />
          <Stat label={t('game.selfId')} value={player.selfId} />
          <Stat label={t('game.secrecy')} value={player.secrecy} />
        </div>
      )}
    </div>
  );
}
