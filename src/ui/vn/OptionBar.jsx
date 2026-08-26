/**
 * The player's line. CLAUDE.md Part I.3, I.10.
 *
 * Replaces `ChipBar.jsx`, and it is a third of the size because the thing it
 * replaced was doing a job the model now does. v1 asked the code which STANCES
 * were legal, weighted them, shuffled them, then spent a second model call
 * writing labels over the top - and a stance-to-payout table meant a player
 * could steer the numbers by picking verbs, which is exactly what Yuhan
 * objected to.
 *
 * There are no stances. The four options came out of the same call that wrote
 * her line, they are written from this moment, and THE CHOSEN OPTION IS THE
 * PLAYER'S LINE - shown verbatim as theirs. That is v1's third pillar for free:
 * the model never writes the player's dialogue.
 *
 * ONE GEOMETRY, ALWAYS. A stack of full-width options, whether they came from
 * the model or from the fallback. v1 learned this the expensive way: when the
 * bar changed shape as labels arrived, the target under the player's finger
 * moved, and the fix was to make a swap change only the words.
 *
 * AND IT NEVER YIELDS ITS HEIGHT. `shrink-0`, because this is the half of the
 * screen the player acts with: when the scene column runs short the portrait
 * gives way and the prose scrolls inside its own box, never this. The spacing
 * here is tight for the same reason - four options plus two rows of chrome is
 * about 215px of a 763px phone viewport, and every pixel it does not take is a
 * line of her prose that does not need scrolling to.
 *
 * SO THE PADDING DOES NOT SCALE WITH THE TYPE. Every gap on this bar is a
 * `--tap-*` token, which is a rem divided by `--font-scale` and therefore the
 * same physical size at every setting (see `index.css`). At scale 1.25 the words
 * get bigger, which is what was asked for, and the holes between them do not,
 * which was not. Ordinary rem padding grew both and pushed the prose into a
 * scroll on the exact setting chosen to make reading easier.
 *
 * The other half of that report is upstream in `config/rules.js`: the model was
 * appending a gloss to every option, which doubled them and forced a wrap. No
 * amount of padding fixes a two-line button.
 */

import { useState } from 'react';

/** Everything in this row spends the round. Everything below it does not. */
const GLYPH = { say: '✎', give: '✉', skip: '…' };

function SecondaryAction({ glyph, label, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-hairline bg-surface px-[var(--tap-gap)] py-[var(--tap-pad-y)] font-mono text-[0.625rem] uppercase tracking-[0.12em] text-dim transition-colors hover:border-accent hover:text-accent disabled:opacity-35 disabled:hover:border-hairline disabled:hover:text-dim"
    >
      <span aria-hidden="true">{glyph}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function OptionBar({
  options = [],
  onChoose,
  onGive = null,
  /** Let the round pass. Spends a round like any other move; never replaces one. */
  onSkip = null,
  onReadHer = null,
  /** What one look costs, in energy. Shown, because a price has to be visible. */
  readHerCost = 0,
  /** Whether she can be read at all right now - the engine decides, not the bar. */
  canReadHer = false,
  roundsLeft = 0,
  disabled = false,
  over = false,
  onLeave,
  t,
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const line = text.trim();
    if (!line || disabled) return;
    setText('');
    setOpen(false);
    onChoose(line);
  };

  /**
   * The block is spent, so the bar is REPLACED rather than dimmed.
   *
   * Section 6 found this in play twice: disabled controls with no explanation
   * read as a frozen screen. One live control beats six dead ones.
   */
  if (over) {
    return (
      <div className="shrink-0 px-5 pb-3 pt-1">
        <p className="mb-2 text-center font-mono text-[0.625rem] uppercase tracking-[0.16em] text-dim">
          {t('vn.outOfTurns')}
        </p>
        <button
          type="button"
          onClick={onLeave}
          className="w-full rounded-[var(--radius-sm)] border border-accent bg-accent px-3 py-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-on-accent"
        >
          {t('vn.leave')}
        </button>
      </div>
    );
  }

  /**
   * FOUR OPTIONS, BACKFILLED, NEVER AWAITED.
   *
   * A round that came back with three parseable options costs one option, not
   * the round - the same per-line tolerance the parser has. The fallbacks are
   * deliberately contentless: they are not a stance system in hiding, they are
   * four ways to keep a conversation moving when the model's own four did not
   * arrive, and the free-text box is right underneath either way.
   */
  const fallback = [t('vn.fallback.a'), t('vn.fallback.b'), t('vn.fallback.c'), t('vn.fallback.d')];
  const shown = [...options];
  for (let i = shown.length; i < 4; i += 1) shown.push(fallback[i]);

  return (
    <div className="shrink-0 px-5 py-[var(--tap-gap)]">
      <div className="flex flex-col gap-[var(--tap-gap)]">
        {shown.map((label, i) => (
          <button
            key={`${i}:${label}`}
            type="button"
            disabled={disabled}
            onClick={() => onChoose(label)}
            /**
             * A stable hook for the DOM tests, because the thing they need to
             * find is "one of the four options" and the only handle they had was
             * a Tailwind padding class. Retuning the spacing on this bar - which
             * is a layout decision - silently emptied that selector and failed
             * eleven tests in two files with a message about a count, which says
             * nothing about what actually changed.
             */
            data-round-option="true"
            className="w-full rounded-[var(--radius-sm)] border border-hairline bg-surface px-[var(--tap-pad-x)] py-[var(--tap-pad-y)] text-left transition-colors hover:border-accent hover:bg-surface-alt disabled:opacity-35 disabled:hover:border-hairline disabled:hover:bg-surface"
          >
            <span className="font-body text-[0.9375rem] leading-snug text-text">{label}</span>
          </button>
        ))}
      </div>

      {/*
        The two things the model's four cannot cover: saying something of your
        own, and handing something over. Both spend the round, so both are
        bordered controls at a real touch target rather than text links - section
        6 reported that mistake twice on the first day of play.
      */}
      <div className="mt-[var(--tap-gap)] grid auto-cols-fr grid-flow-col gap-[var(--tap-gap)]">
        <SecondaryAction
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          glyph={GLYPH.say}
          label={t('vn.sayIt')}
        />
        {onGive ? (
          <SecondaryAction
            disabled={disabled}
            onClick={onGive}
            glyph={GLYPH.give}
            label={t('vn.give')}
          />
        ) : null}

        {/*
          LET THE ROOM CARRY IT.

          Asked for twice, across two engines - once about a member continuing
          across several turns in v1, and again as "the player don't need to
          choose option each round and gives back the skip button". A round is
          one voice now, so hearing her out is a real thing to want.

          It is an ADDITION and never a replacement: the four options stay on
          screen. Section 6 found the other version twice in one day - a bar
          that becomes a lone continue button reads as a frozen screen, and a
          player who must skip to hear more is not being offered a choice.

          It sits in this row rather than the thin one below because it SPENDS
          THE ROUND, which is the rule that decides what goes where. Letting the
          room breathe costs what speaking costs; that is what makes it a move
          rather than a fast-forward, and it is section 10c's `pass` under a
          name the player will recognise.
        */}
        {onSkip ? (
          <SecondaryAction
            disabled={disabled}
            onClick={onSkip}
            glyph={GLYPH.skip}
            label={t('vn.skip')}
          />
        ) : null}
      </div>

      {/* Neither of these spends the round, so neither is shaped like a move. */}
      <div className="mt-[var(--tap-gap)] flex items-center gap-2">
        <span
          className={`font-mono text-[0.625rem] uppercase tracking-[0.14em] ${
            roundsLeft <= 1 ? 'text-warn' : 'text-dim'
          }`}
        >
          {t('vn.turnsLeft')} {Math.max(0, roundsLeft)}
        </span>

        <span className="h-px flex-1 bg-hairline opacity-50" />

        {/*
          The price, not a counter. Read her is rationed by ENERGY now - section
          10's "Read her is the energy sink, not the block" - and a per-scene
          allowance that reset at every door could never be a decision, because
          nothing about it survived the block.

          So the number beside it is what one look costs, and it is the same
          number every time. What changes is whether the player can still afford
          it, which is exactly the state a price is supposed to make visible.
        */}
        {onReadHer ? (
          <button
            type="button"
            disabled={disabled || !canReadHer}
            onClick={onReadHer}
            className="flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim transition-colors hover:text-accent disabled:opacity-25"
          >
            <span aria-hidden="true">&#128065;</span>
            {t('vn.readHer')}
            <span className="tabular-nums text-accent">-{readHerCost}</span>
          </button>
        ) : null}
      </div>

      {open ? (
        <form onSubmit={submit} className="mt-1.5 flex gap-2">
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
