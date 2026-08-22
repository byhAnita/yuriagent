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

export default function ChipBar({
  chips,
  suggested = [],
  onStance,
  onFreeText,
  onReadHer,
  onLeave,
  readHerLeft,
  turnsLeft,
  outOfTurns,
  disabled,
  t,
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  /**
   * Written labels do not fit three-across at 390px - "I'm not going anywhere"
   * wraps to three lines in a 110px button. When any chip carries one the bar
   * becomes a stack of full-width options, which is also how a VN presents a
   * choice. With no labels it stays the compact row.
   */
  const written = chips.some((c) => c.label);

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
      <div className={written ? 'flex flex-col gap-1.5' : 'flex flex-wrap gap-1.5'}>
        {chips.map(({ stance, label }) => {
          const isSuggested = suggested.includes(stance);
          return (
            <button
              key={stance}
              type="button"
              disabled={disabled}
              onClick={() => onStance(stance)}
              className={`group relative rounded-[var(--radius-sm)] border border-hairline bg-surface transition-colors hover:border-accent hover:bg-surface-alt disabled:opacity-35 ${
                written
                  ? 'w-full px-3 py-2 text-left'
                  : 'flex-1 px-2.5 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-text'
              }`}
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
              {written ? (
                <>
                  <span className="block font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim">
                    {t(`stance.${stance}`)}
                  </span>
                  {label ? (
                    <span className="mt-0.5 block line-clamp-2 font-body text-[0.875rem] leading-snug text-text">
                      {label}
                    </span>
                  ) : null}
                </>
              ) : (
                t(`stance.${stance}`)
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim transition-colors hover:text-accent disabled:opacity-35"
        >
          <span aria-hidden="true">&#9998;</span>
          {t('vn.sayIt')}
        </button>

        <span className="h-px flex-1 bg-hairline opacity-50" />

        {/* how much of the block is left, said plainly rather than as a bare number */}
        <span
          className={`font-mono text-[0.625rem] uppercase tracking-[0.14em] ${
            turnsLeft <= 3 ? 'text-warn' : 'text-dim'
          }`}
        >
          {t('vn.turnsLeft')} {turnsLeft}
        </span>

        <span className="h-px w-3 bg-hairline opacity-50" />

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
