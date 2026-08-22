/**
 * Asking somebody to spend the day with you. CLAUDE.md section 10.
 *
 * Only on a weekend, and it costs the whole day - so this is the single most
 * expensive decision the player makes in a week, and it has to be legible
 * before they commit to it.
 *
 * What is shown, and why:
 *
 * - An unaffordable date IS listed, with its price. That is deliberately unlike
 *   section 11's locked gifts, which stay hidden because naming one spoils the
 *   fact it waits on. A price is not a spoiler - it is something the player can
 *   go and do something about.
 * - A date she is not ready for is listed too, greyed, saying which of the two
 *   axes is short. Pillar 1 is that the player reads hidden state and bets on
 *   it, and "not yet" is the most useful reading the game can offer.
 * - No percentage anywhere. Section 20 keeps numbers out, and a number would
 *   turn a bet into arithmetic.
 */

import { DATE_KIND_IDS, REFUSAL } from '../../systems/dating.js';

/** How likely she is, as a word. Never a number (section 20). */
function chanceWord(chance) {
  if (chance >= 0.85) return 'sure';
  if (chance >= 0.5) return 'likely';
  if (chance > 0) return 'maybe';
  return 'no';
}

function Offer({ offer, card, onAsk, t }) {
  const { kind, available, reason, cost, chance } = offer;

  return (
    <li>
      <button
        type="button"
        disabled={!available}
        onClick={() => onAsk(offer)}
        className={`flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border px-3 py-3 text-left transition-colors disabled:opacity-40 ${
          available ? 'border-hairline hover:border-accent' : 'border-hairline'
        }`}
      >
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.875rem]"
          style={{ background: card.palette.base, color: card.palette.accent }}
        >
          {card.emoji}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-body text-[0.9375rem] text-text">
            {t(`date.${kind}`).replace('{name}', card.name)}
          </span>
          <span className="mt-0.5 block font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-dim">
            {available ? t(`date.chance.${chanceWord(chance)}`) : t(`date.no.${reason}`)}
          </span>
        </span>

        {cost > 0 ? (
          <span
            className={`shrink-0 font-mono text-[0.625rem] tabular-nums ${
              reason === REFUSAL.CREDITS ? 'text-danger' : 'text-accent'
            }`}
          >
            {cost}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export default function DateModal({ offers, cards, refusal, onAsk, onClose, t }) {
  const byKind = DATE_KIND_IDS.map((kind) => ({
    kind,
    rows: offers.filter((o) => o.kind === kind),
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-4">
      <div className="w-full max-w-[26rem] rounded-[var(--radius)] border border-hairline bg-surface p-5">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[1.25rem] tracking-wide">{t('date.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-dim"
          >
            {t('date.skip')}
          </button>
        </header>

        <p className="mt-1 font-body text-[0.75rem] leading-relaxed text-dim">
          {t('date.note')}
        </p>

        {/* She said no. Not a failure - the first time a hidden number becomes
            a visible yes or no, which is what pillar 1 asks the player to read. */}
        {refusal ? (
          <p className="mt-3 rounded-[var(--radius-sm)] border border-hairline px-3 py-2 font-body text-[0.8125rem] text-text">
            {t(`date.refused.${refusal.reason}`).replace('{name}', refusal.name)}
          </p>
        ) : null}

        {byKind.map(({ kind, rows }) =>
          rows.length === 0 ? null : (
            <section key={kind} className="mt-4">
              <p className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-faint">
                {t(`date.heading.${kind}`)}
              </p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {rows.map((offer) => (
                  <Offer
                    key={`${offer.memberId}:${offer.kind}`}
                    offer={offer}
                    card={cards.find((c) => c.id === offer.memberId)}
                    onAsk={onAsk}
                    t={t}
                  />
                ))}
              </ul>
            </section>
          ),
        )}
      </div>
    </div>
  );
}
