/**
 * Stance chips. CLAUDE.md section 6.
 *
 * Verbs, not a chat box. Chips are generated client-side, cost nothing, render
 * instantly, and cover the latency of the previous stream - which is the real
 * reason they are the primary input rather than a convenience.
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
  readHerLeft,
  disabled,
  t,
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

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
      <div className="flex flex-wrap gap-1.5">
        {chips.map((stance) => {
          const isSuggested = suggested.includes(stance);
          return (
            <button
              key={stance}
              type="button"
              disabled={disabled}
              onClick={() => onStance(stance)}
              className="group relative flex-1 rounded-[var(--radius-sm)] border border-hairline bg-surface px-2.5 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-text transition-colors hover:border-accent hover:bg-surface-alt disabled:opacity-35"
            >
              {isSuggested ? (
                <span
                  aria-hidden="true"
                  className="absolute left-1.5 top-1.5 h-1 w-1 rounded-full bg-accent"
                />
              ) : null}
              {t(`stance.${stance}`)}
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
          className="flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faint transition-colors hover:text-dim disabled:opacity-35"
        >
          <span aria-hidden="true">&#9998;</span>
          {t('vn.sayIt')}
        </button>

        <span className="h-px flex-1 bg-hairline opacity-50" />

        <button
          type="button"
          disabled={disabled || readHerLeft <= 0}
          onClick={onReadHer}
          className="flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faint transition-colors hover:text-accent disabled:opacity-25"
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
