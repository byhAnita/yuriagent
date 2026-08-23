/**
 * How the scene opens. CLAUDE.md section 11.
 *
 * Locked knowledge gifts are SHOWN, not hidden. Seeing that there is something
 * you could give her if you knew her better is the pull that makes the dossier
 * feel like a mechanic instead of plumbing - and it tells the player, without a
 * tutorial, that paying attention during dialogue is how the strong moves open.
 */

import { giftsFor } from '../../systems/economy.js';

function Row({ gift, onPick, free = false, t }) {
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
        {t(free ? `gesture.${gift.id}` : `gift.${gift.id}`)}
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
          free ? 'text-faint' : gift.affordable ? 'text-dim' : 'text-danger'
        }`}
      >
        {free ? t('gift.free') : `${gift.cost}c`}
      </span>
    </button>
  );
}

export default function GiftModal({
  card,
  dossier,
  /**
   * Openers paid in something other than credits, e.g. `{ dishes: 1 }`.
   * A gift whose counter is empty is not offered at all, the same rule locked
   * knowledge gifts follow: an option the player cannot act on is clutter.
   */
  stock = {},
  credits,
  usedGestures = [],
  onPick,
  onGesture,
  onSkip,
  t,
}) {
  const { generic, knowledge, gesture } = giftsFor(dossier, credits, usedGestures, stock);

  // Locked gifts are not shown. Naming a gift the player cannot buy spoils the
  // fact it is waiting on, and clutters the list with things they cannot act on.
  const unlocked = knowledge.filter((g) => g.unlocked);

  /**
   * The same knowledge, spent by saying something. Free, weaker, once each -
   * and for most facts the more natural move than buying an object. Spent ones
   * drop out rather than greying: bringing it up a second time is not
   * attention, it is a script.
   */
  const sayable = gesture.filter((g) => g.unlocked && !g.used);

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

        {/*
          Not "gifts". An opening can be an object or a line, and naming the
          modal after only half of what it does is what made the knowledge
          economy read as a shop (CLAUDE.md section 11).
        */}
        <p className="mb-3 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim">
          {t('gift.title')}
        </p>

        <h3 className="mb-1.5 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-faint">
          {t('gift.generic')}
        </h3>
        <div className="flex flex-col gap-1">
          {/* A generic gift the player is not carrying is not shown at all. */}
          {generic
            .filter((g) => !g.stock || g.unlocked)
            .map((g) => (
              <Row key={g.id} gift={g} onPick={onPick} t={t} />
            ))}
        </div>

        {unlocked.length > 0 ? (
          <>
            <h3 className="mb-1.5 mt-4 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-faint">
              {t('gift.knowledge')}
            </h3>
            <div className="flex flex-col gap-1">
              {unlocked.map((g) => (
                <Row key={g.id} gift={g} onPick={onPick} t={t} />
              ))}
            </div>
          </>
        ) : null}

        {sayable.length > 0 ? (
          <>
            <h3 className="mb-1.5 mt-4 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-faint">
              {t('gift.gesture')}
            </h3>
            <div className="flex flex-col gap-1">
              {sayable.map((g) => (
                <Row key={g.id} gift={g} onPick={onGesture} free t={t} />
              ))}
            </div>
          </>
        ) : null}

        {unlocked.length === 0 && sayable.length === 0 ? (
          <p className="mt-3 font-mono text-[0.5rem] uppercase leading-relaxed tracking-[0.1em] text-faint">
            {t('gift.hint')}
          </p>
        ) : null}

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
