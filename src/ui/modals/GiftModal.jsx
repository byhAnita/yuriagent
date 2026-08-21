/**
 * Pre-scene gift. CLAUDE.md section 11.
 *
 * Locked knowledge gifts are SHOWN, not hidden. Seeing that there is something
 * you could give her if you knew her better is the pull that makes the dossier
 * feel like a mechanic instead of plumbing - and it tells the player, without a
 * tutorial, that paying attention during dialogue is how the strong moves open.
 */

import { giftsFor } from '../../systems/economy.js';

function Row({ gift, onPick, t }) {
  const locked = !gift.unlocked;

  return (
    <button
      type="button"
      disabled={!gift.purchasable}
      onClick={() => onPick(gift.id)}
      className={`flex w-full items-baseline gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors ${
        gift.purchasable
          ? 'border-hairline hover:border-accent'
          : 'border-transparent bg-surface/40'
      }`}
    >
      <span
        className={`flex-1 font-body text-[0.9375rem] ${locked ? 'text-faint line-through' : 'text-text'}`}
      >
        {t(`gift.${gift.id}`)}
      </span>

      {locked ? (
        <span className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-faint">
          {t('gift.locked')}
        </span>
      ) : (
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-accent">
          +{gift.effect}
        </span>
      )}

      <span
        className={`w-8 text-right font-mono text-[0.625rem] tabular-nums ${
          gift.affordable ? 'text-dim' : 'text-danger'
        }`}
      >
        {gift.cost}c
      </span>
    </button>
  );
}

export default function GiftModal({ card, dossier, credits, onPick, onSkip, t }) {
  const { generic, knowledge } = giftsFor(dossier, credits);

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-bg/80 backdrop-blur-sm">
      <div className="thought-in max-h-[85dvh] w-full max-w-[26rem] overflow-y-auto rounded-t-[var(--radius)] border-t border-hairline bg-surface px-5 pb-6 pt-4">
        <div className="mb-3 flex items-baseline gap-2">
          <span className="font-display text-[1.25rem] tracking-wide text-accent">
            {card.name}
          </span>
          <span className="h-px flex-1 bg-hairline opacity-60" />
          <span className="font-mono text-[0.625rem] tabular-nums text-dim">{credits}c</span>
        </div>

        <h3 className="mb-1.5 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-faint">
          {t('gift.generic')}
        </h3>
        <div className="flex flex-col gap-1">
          {generic.map((g) => (
            <Row key={g.id} gift={g} onPick={onPick} t={t} />
          ))}
        </div>

        <h3 className="mb-1.5 mt-4 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-faint">
          {t('gift.knowledge')}
        </h3>
        <div className="flex flex-col gap-1">
          {knowledge.map((g) => (
            <Row key={g.id} gift={g} onPick={onPick} t={t} />
          ))}
        </div>

        <p className="mt-3 font-mono text-[0.5rem] uppercase leading-relaxed tracking-[0.1em] text-faint">
          {t('gift.hint')}
        </p>

        <button
          type="button"
          onClick={onSkip}
          className="mt-4 w-full rounded-[var(--radius)] border border-accent px-4 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-accent"
        >
          {t('gift.skip')}
        </button>
      </div>
    </div>
  );
}
