/**
 * Handing something over, or bringing something up. CLAUDE.md section 11.
 *
 * This used to be a screen that stood between the map and the scene, and it was
 * wrong in three ways at once:
 *
 * 1. It fired at the door of EVERY scene, including group scenes, so the player
 *    was asked "what are you giving her" before they had been given any reason
 *    to want to give anybody anything.
 * 2. In a group scene it asked WHO before showing who was in the room.
 * 3. Whatever it produced became the first thing that happened, so the scene
 *    could never be about anything before it was about the gift. Every knowledge
 *    opener landed on a cold open.
 *
 * It is a turn now. The player talks to her, and at some point in that
 * conversation brings up the thing she once let slip - which is when a person
 * would actually do it, and which makes the topic TURN rather than start there.
 */

import Sheet from './Sheet.jsx';
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
  /**
   * Everyone in the room who may be handed something, and how to change who.
   *
   * Empty in a 1v1, which is the common case and renders exactly what it always
   * did. In a group scene the strip is the answer to "choose character first" -
   * and it defaults to the current addressee, so the sticky choice the player
   * already made carries over and most of the time there is nothing to pick.
   *
   * Handing something to somebody else also MOVES the addressee (VNStage does
   * it), because a gift is a way of addressing someone - proposal 12's one verb,
   * two surfaces. Choosing here and then talking to somebody else would be two
   * different notions of who the player is with.
   */
  roster = [],
  onChoose = () => {},
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
    <Sheet
      title={<span className="text-accent">{card.name}</span>}
      action={<span className="shrink-0 font-mono text-[0.625rem] tabular-nums text-dim">{credits}c</span>}
    >
      <>

        {/*
          Not "gifts". An opening can be an object or a line, and naming the
          modal after only half of what it does is what made the knowledge
          economy read as a shop (CLAUDE.md section 11).
        */}
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
      </>
    </Sheet>
  );
}
