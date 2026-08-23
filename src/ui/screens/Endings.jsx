/**
 * How it ended, with each of them. CLAUDE.md section 5.
 *
 * Endings resolve PER CHARACTER, so this screen is a list and not a verdict. A
 * run can finish with one at `ours`, one at `nameless_end` and three at
 * `drift_end`, and saying so plainly is more honest than picking a headline out
 * of five different outcomes.
 *
 * The one exception is the balance ending - all five at `nameless` or above
 * with jealousy held under 50 and nothing collapsed. That is the hardest thing
 * the game asks for, and it gets said first.
 *
 * The lines are AUTHORED, not generated. Three reasons: it is the last text the
 * player reads and has to be exactly right; a model call can fail, and a
 * campaign ending in silence is the worst possible failure; and an ending is
 * the one place where the game should speak in its own voice rather than in
 * hers.
 */

import { resolveEnding, resolveStage, GOOD_ENDINGS, isBalanceEnding } from '../../systems/relationship.js';

/** Which of the three groups an ending belongs to, for how the row reads. */
const BAD_ENDINGS = new Set(['nameless_end', 'exposure_end', 'severance_end']);

function kindOf(endingId) {
  if (GOOD_ENDINGS.has(endingId)) return 'good';
  if (BAD_ENDINGS.has(endingId)) return 'bad';
  return 'neutral';
}

const TONE = {
  good: { border: 'border-accent', text: 'text-accent' },
  neutral: { border: 'border-hairline', text: 'text-dim' },
  bad: { border: 'border-danger', text: 'text-danger' },
};

function Row({ card, rel, t }) {
  const endingId = resolveEnding(rel);
  const tone = TONE[kindOf(endingId)];

  return (
    <li className={`rounded-[var(--radius-sm)] border ${tone.border} px-3 py-3`}>
      <span className="flex items-baseline gap-2">
        <span
          aria-hidden="true"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.75rem]"
          style={{ background: card.palette.base, color: card.palette.accent }}
        >
          {card.emoji}
        </span>
        <span className="font-display text-[1rem] tracking-wide text-text">{card.name}</span>
        <span className="h-px flex-1 bg-hairline opacity-50" />
        <span className={`font-mono text-[0.625rem] uppercase tracking-[0.16em] ${tone.text}`}>
          {t(`ending.${endingId}`)}
        </span>
      </span>

      <p className="mt-1.5 font-body text-[0.875rem] leading-snug text-dim">
        {t(`ending.${endingId}Line`)}
      </p>

      {/*
        The two numbers, last and small. The map in section 5 is what the whole
        game has been about, and seeing where she finished on it is the reason
        to look at a stat at all - but the sentence above is the ending, not
        this.
      */}
      <span className="mt-2 flex items-baseline gap-3 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-faint">
        <span>{t(`stage.${resolveStage(rel.intimacy, rel.admissibility)}`)}</span>
        <span className="tabular-nums">I {Math.round(rel.intimacy)}</span>
        <span className="tabular-nums">A {Math.round(rel.admissibility)}</span>
      </span>
    </li>
  );
}

export default function Endings({ cards, relations, onRestart, t }) {
  const balance = isBalanceEnding(relations);

  /**
   * Best first, so the run leads with whatever it actually achieved. A screen
   * that opens on three `drift_end` rows reads as a failure even when one of
   * the other two is `ours`.
   */
  const order = { good: 0, neutral: 1, bad: 2 };
  const rows = [...cards].sort(
    (a, b) =>
      order[kindOf(resolveEnding(relations[a.id]))] -
        order[kindOf(resolveEnding(relations[b.id]))] ||
      relations[b.id].intimacy - relations[a.id].intimacy,
  );

  return (
    <div className="stage mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col gap-5 px-5 py-9">
      <header className="sheet-in flex flex-col gap-1">
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.3em] text-faint">
          {t('app.tagline')}
        </span>
        <h1 className="font-display text-[2rem] leading-none tracking-wide text-accent">
          {t('endings.title')}
        </h1>
        <p className="mt-1 font-body text-[0.8125rem] italic text-dim">{t('endings.subtitle')}</p>
      </header>

      {balance ? (
        <section
          className="sheet-in rounded-[var(--radius)] border border-accent bg-accent-soft/25 px-4 py-3"
          style={{ '--i': 1 }}
        >
          <p className="font-display text-[1.125rem] leading-snug tracking-wide text-accent">
            {t('endings.balance')}
          </p>
          <p className="mt-1 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim">
            {t('endings.balanceNote')}
          </p>
        </section>
      ) : null}

      <ul className="sheet-in flex flex-col gap-2" style={{ '--i': 2 }}>
        {rows.map((card) => (
          <Row key={card.id} card={card} rel={relations[card.id]} t={t} />
        ))}
      </ul>

      <button
        type="button"
        onClick={onRestart}
        className="sheet-in mt-auto rounded-[var(--radius)] border border-accent px-4 py-3.5 font-mono text-[0.8125rem] uppercase tracking-[0.24em] text-accent"
        style={{ '--i': 3 }}
      >
        {t('endings.again')}
      </button>
    </div>
  );
}
