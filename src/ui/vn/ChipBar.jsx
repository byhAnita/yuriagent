/**
 * Stance chips. CLAUDE.md section 6.
 *
 * Verbs, not a chat box. A chip is `{ stance, label }`: the stance is what the
 * game acts on and comes from chips.js, the label is optional prose written for
 * this moment. The static set renders instantly and a written one replaces it
 * only if it arrives in time, so this component never waits for anything.
 *
 * Free text is the escape hatch, deliberately smaller and secondary.
 */

import { useState } from 'react';
import { isRiskStance } from '../../systems/chips.js';

/**
 * Written as escapes, because section 21 keeps source ASCII.
 * Pencil, envelope, midline ellipsis.
 */
const GLYPH = { say: '\u270E', give: '\u2709', pass: '\u22EF' };

/**
 * A turn-spending move that is not a stance.
 *
 * Lighter than a chip and unmistakably heavier than the meta row - it is a
 * button with a border and a real touch target, so at three across on a 390px
 * screen each one is comfortably past the 44px minimum. The glyph carries it
 * when a `zh` label at `fontScale` 1.25 has to wrap.
 */
function SecondaryAction({ disabled, onClick, glyph, label, active = false, ...rest }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-2 font-mono text-[0.625rem] uppercase leading-tight tracking-[0.1em] transition-colors disabled:opacity-30 ${
        active
          ? 'border-accent bg-surface-alt text-accent'
          : 'border-hairline bg-transparent text-dim hover:border-accent hover:text-accent'
      }`}
      {...rest}
    >
      <span aria-hidden="true">{glyph}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function ChipBar({
  chips,
  suggested = [],
  exposure = 0,
  onStance,
  onFreeText,
  onReadHer,
  onLeave,
  readHerLeft,
  turnsLeft,
  outOfTurns,
  awaitingRead = false,
  /** A second voice is still streaming and there is nothing to tap yet. */
  roomSpeaking = false,
  /**
   * Group scenes only, null otherwise.
   *
   * It used to live in the thin meta row next to Read her, on the theory that
   * both are ways of spending a turn on something other than talking. That was
   * wrong and it was reported as a bug: a 10px link in a corner does not read
   * as one of the things you may do, it reads as a footnote, so in practice the
   * player never let the room breathe and every group scene was driven turn by
   * turn off the chips. Letting the room carry it is a MOVE, so it is shaped
   * like one.
   */
  onPass = null,
  /**
   * Hand something over, or bring something up. Null disables the control.
   *
   * Same argument, arrived at from the other direction: this used to be a modal
   * before the scene opened, which made it a thing you did INSTEAD of talking
   * to her rather than a thing you do while talking to her.
   */
  onOpener = null,
  onAdvance,
  disabled,
  t,
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  /**
   * The bar is always a stack of full-width options, labelled or not.
   *
   * Written labels cannot fit three-across at 390px - "I'm not going anywhere"
   * wraps to three lines in a 110px button - but switching layout when they
   * arrive would move every button mid-turn. One geometry means a written set
   * changes only the words, never the target under a finger, which is what
   * makes it safe to swap them in while the bar is already live.
   */

  /**
   * When the block is spent the chips do not simply go dead - that reads as a
   * frozen screen. The whole bar is replaced by the one move still available,
   * and it says why.
   */
  if (outOfTurns) {
    return (
      <div className="px-5 pb-5 pt-3">
        <p className="mb-2 text-center font-mono text-[0.625rem] uppercase tracking-[0.16em] text-warn">
          {t('vn.outOfTurns')}
        </p>
        <button
          type="button"
          onClick={onLeave}
          className="w-full rounded-[var(--radius)] border border-accent bg-accent px-4 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-on-accent"
        >
          {t('vn.leave')}
        </button>
      </div>
    );
  }

  const submit = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onFreeText(value);
    setText('');
    setOpen(false);
  };

  return (
    <div className="px-5 pb-5 pt-3">
      <div className="flex flex-col gap-1.5">
        {chips.map(({ stance, label }) => {
          const isSuggested = suggested.includes(stance);
          /**
           * An overt move made where people can see is the only thing that
           * raises admissibility, and the only thing that can cost 10-20 strain
           * for failing. The player is meant to read the exposure meter and
           * take that bet knowingly - so the chip says it is one. Without the
           * marker the second axis moves for reasons the player cannot connect
           * to anything they did.
           */
          const isRisk = isRiskStance(stance, exposure);
          return (
            <button
              key={stance}
              type="button"
              disabled={disabled}
              onClick={() => onStance(stance)}
              className="group relative w-full rounded-[var(--radius-sm)] border border-hairline bg-surface px-3 py-2 text-left transition-colors hover:border-accent hover:bg-surface-alt disabled:opacity-35 disabled:hover:border-hairline disabled:hover:bg-surface"
            >
              {isSuggested ? (
                <span
                  aria-hidden="true"
                  className="absolute left-1.5 top-1.5 h-1 w-1 rounded-full bg-accent"
                />
              ) : null}

              {/*
                The stance stays visible even when a written label carries the
                line. The player is choosing a POSTURE - locking, the suggested
                dot and every rule in chips.js are stance-based - so hiding the
                verb behind prose would make the system illegible.
              */}
              <span
                className={`block font-mono uppercase tracking-[0.16em] ${
                  label
                    ? 'text-[0.5625rem] text-dim'
                    : 'text-[0.6875rem] tracking-[0.12em] text-text'
                }`}
              >
                {t(`stance.${stance}`)}
                {isRisk ? (
                  <span className="ml-1.5 text-meter-exposure">{t('vn.risk')}</span>
                ) : null}
              </span>
              {label ? (
                <span className="mt-0.5 block line-clamp-2 font-body text-[0.875rem] leading-snug text-text">
                  {label}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/*
        She has not finished speaking. The options above are already on screen
        and already dead, and section 6 learned once that a disabled control
        with no explanation reads as a frozen screen - so say what the move is
        and make it a real target, rather than leaving a caret in a corner as
        the only clue.
      */}
      {awaitingRead ? (
        <button
          type="button"
          onClick={onAdvance}
          className="mt-2 w-full rounded-[var(--radius-sm)] border border-accent/40 bg-surface-alt px-4 py-2 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-accent transition-colors hover:bg-surface"
        >
          {t('vn.continue')} &#9656;
        </button>
      ) : null}

      {/*
        Somebody else is answering, and there is nothing to tap yet.

        Not a button - there is no move here, only a wait - but it has to be
        SAID. Without it, a turn where the addressee replied in a single beat
        left the chips looking live while the second call was still running,
        and every tap vanished. Same lesson as the spent block and the unread
        beat: a control that does nothing has to explain itself.
      */}
      {roomSpeaking ? (
        <p className="mt-2 text-center font-mono text-[0.625rem] uppercase tracking-[0.18em] text-dim">
          {t('vn.roomSpeaking')}
        </p>
      ) : null}

      {/*
        Everything else the player may do WITH THEIR TURN, at the weight of the
        options above it.

        Both bugs this row fixes were the same mistake in two places: a move
        that ends the player's turn was rendered as a 10px text link, so it read
        as chrome and went unused. A stance, saying it yourself, handing
        something over and letting the room carry it are four ways to spend the
        same turn, and the bar should say so.

        Read her and the turn counter stay in the thin row below, and that is
        not an oversight - neither of them ends the turn. The split IS the
        information: everything in this row costs you the turn, nothing in the
        one below it does.
      */}
      <div className="mt-1.5 grid auto-cols-fr grid-flow-col gap-1.5">
        <SecondaryAction
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          glyph={GLYPH.say}
          label={t('vn.sayIt')}
          active={open}
        />

        {onOpener ? (
          <SecondaryAction
            disabled={disabled}
            onClick={onOpener}
            glyph={GLYPH.give}
            label={t('vn.give')}
          />
        ) : null}

        {onPass ? (
          <SecondaryAction
            disabled={disabled}
            onClick={onPass}
            glyph={GLYPH.pass}
            label={t('vn.pass')}
          />
        ) : null}
      </div>

      {/* Neither of these spends the turn, so neither is shaped like a move. */}
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`font-mono text-[0.625rem] uppercase tracking-[0.14em] ${
            turnsLeft <= 3 ? 'text-warn' : 'text-dim'
          }`}
        >
          {t('vn.turnsLeft')} {turnsLeft}
        </span>

        <span className="h-px flex-1 bg-hairline opacity-50" />

        <button
          type="button"
          disabled={disabled || readHerLeft <= 0}
          onClick={onReadHer}
          className="flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim transition-colors hover:text-accent disabled:opacity-25"
          title={t('vn.readHer')}
        >
          <span aria-hidden="true">&#128065;</span>
          {t('vn.readHer')}
          <span className="tabular-nums text-accent">{readHerLeft}</span>
        </button>
      </div>

      {open ? (
        <form onSubmit={submit} className="mt-2 flex gap-2">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('vn.freeTextPlaceholder')}
            className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-hairline bg-surface px-3 py-2 font-body text-[0.9375rem] text-text outline-none placeholder:text-faint focus:border-accent"
          />
          <button
            type="submit"
            disabled={disabled}
            className="rounded-[var(--radius-sm)] border border-accent bg-accent px-3 py-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-on-accent disabled:opacity-35"
          >
            {t('vn.send')}
          </button>
        </form>
      ) : null}
    </div>
  );
}
