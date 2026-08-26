/**
 * Handing something over. CLAUDE.md Part I.10.
 *
 * This used to be a screen that stood between the map and the scene, and it was
 * wrong in three ways at once:
 *
 * 1. It fired at the door of EVERY scene, including group scenes, so the player
 *    was asked "what are you giving her" before they had been given any reason
 *    to want to give anybody anything.
 * 2. In a group scene it asked WHO before showing who was in the room.
 * 3. Whatever it produced became the first thing that happened, so the scene
 *    could never be about anything before it was about the gift.
 *
 * It is a round action now. The player talks to her, and at some point in that
 * conversation hands her the thing - which is when a person would actually do
 * it, and which makes the topic TURN rather than start there.
 *
 * ONE LIST, NOTHING LOCKED. The knowledge half is gone: no `locked` row, no
 * `+effect` badge, no gesture section, no hint about what opens when. Part I.10
 * moves the gestures into the four written options, where the model offers one
 * when the moment is apt, and leaves this sheet doing the one job four options
 * cannot - choosing among things you are carrying, and paying for one.
 *
 * So a row carries what a shelf carries: what it is, and what it costs.
 */

import Sheet from './Sheet.jsx';
import { giftsFor } from '../../systems/economy.js';

function Row({ gift, onPick, t }) {
  return (
    <button
      type="button"
      disabled={!gift.affordable}
      onClick={() => onPick(gift.id)}
      className={`flex w-full items-baseline gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors ${
        gift.affordable ? 'border-hairline hover:border-accent' : 'border-transparent bg-surface/40'
      }`}
    >
      <span
        className={`flex-1 font-body text-[0.9375rem] ${gift.affordable ? 'text-text' : 'text-faint'}`}
      >
        {t(`gift.${gift.id}`)}
      </span>

      <span
        className={`w-8 text-right font-mono text-[0.625rem] tabular-nums ${
          gift.cost === 0 ? 'text-faint' : gift.affordable ? 'text-dim' : 'text-danger'
        }`}
      >
        {gift.cost === 0 ? t('gift.free') : `${gift.cost}c`}
      </span>
    </button>
  );
}

export default function GiftModal({
  card,
  /**
   * Openers paid in something other than credits, e.g. `{ dishes: 1 }`.
   * A gift whose counter is empty is not offered at all - it is not expensive,
   * it does not exist right now.
   */
  stock = {},
  credits,
  /**
   * Everyone in the room who may be handed something, and how to change who.
   *
   * Empty in a 1v1, which is the common case. In a group scene the strip is the
   * answer to "choose character first" - and it defaults to the current
   * addressee, so the sticky choice the player already made carries over and
   * most of the time there is nothing to pick.
   *
   * Handing something to somebody else also MOVES the addressee, because a gift
   * is a way of addressing someone: one verb, two surfaces.
   */
  roster = [],
  onChoose = () => {},
  onPick,
  onSkip,
  t,
}) {
  const gifts = giftsFor(credits, stock);

  return (
    <Sheet
      title={<span className="text-accent">{card.name}</span>}
      action={<span className="shrink-0 font-mono text-[0.625rem] tabular-nums text-dim">{credits}c</span>}
    >
      <>
        <p className="mb-3 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim">
          {t('gift.title')}
        </p>

        {roster.length > 1 ? (
          <>
            <h3 className="mb-1.5 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-faint">
              {t('gift.who')}
            </h3>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {roster.map((m) => {
                const active = m.id === card.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChoose(m.id)}
                    aria-pressed={active}
                    className="flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 py-1.5 transition-colors"
                    style={{
                      borderColor: active ? m.palette.base : 'var(--hairline)',
                      background: active ? 'var(--surface-alt)' : 'transparent',
                    }}
                  >
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full text-[0.8125rem]"
                      style={{ background: m.palette.base, color: m.palette.accent }}
                    >
                      {m.emoji}
                    </span>
                    <span
                      className={`font-mono text-[0.5625rem] uppercase tracking-[0.1em] ${
                        active ? 'text-text' : 'text-dim'
                      }`}
                    >
                      {m.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        <div className="flex flex-col gap-1">
          {gifts.map((g) => (
            <Row key={g.id} gift={g} onPick={onPick} t={t} />
          ))}
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="mt-4 w-full rounded-[var(--radius)] border border-accent px-4 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-accent"
        >
          {t('gift.skip')}
        </button>
      </>
    </Sheet>
  );
}
