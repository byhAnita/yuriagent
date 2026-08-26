/**
 * The slot list. CLAUDE.md section 15.
 *
 * One component for both jobs, because they are the same list read two ways:
 * on the cover it offers `load` and `delete`, and during a run it also offers
 * `save here`. Splitting them would mean maintaining two renderings of a slot
 * and letting them drift.
 *
 * A slot has to be legible before it is loaded, or six saves of one campaign
 * are indistinguishable and the whole feature is a lottery - so a row carries
 * the player name, the week and day, and whoever currently holds the highest
 * affection (derived at read time; section 15 never stores `focusId`).
 *
 * Overwrite and delete are the only destructive actions in the game, so both
 * arm on the first tap and act on the second. A confirmation dialog would be
 * the more conventional answer and it is worse here: this is a 390px screen
 * and the game has no other modal-on-modal anywhere.
 */

import { useState } from 'react';
import Sheet from './Sheet.jsx';

function Action({ tone = 'dim', onClick, children }) {
  const colour =
    tone === 'danger'
      ? 'border-danger text-danger'
      : tone === 'accent'
        ? 'border-accent text-accent'
        : 'border-hairline text-dim hover:border-accent hover:text-accent';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[var(--radius-sm)] border px-2.5 py-1.5 font-mono text-[0.5625rem] uppercase tracking-[0.12em] transition-colors ${colour}`}
    >
      {children}
    </button>
  );
}

/**
 * `savedAt` is a wall clock and the run has its own calendar, so the row shows
 * both: which day of the campaign it is, and when the player left it there.
 */
function when(savedAt, lang) {
  if (!savedAt) return '';
  try {
    return new Date(savedAt).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function SaveModal({
  slots,
  cards = [],
  /** Absent on the cover screen: there is no run to write yet. */
  onSave = null,
  onLoad,
  onDelete,
  onClose,
  lang = 'en',
  t,
}) {
  /** `{ id, action }` - the one row that is armed, if any. Only ever one. */
  const [armed, setArmed] = useState(null);
  const [failed, setFailed] = useState(false);

  const nameOf = (id) => cards.find((c) => c.id === id)?.name ?? id;
  const isArmed = (id, action) => armed?.id === id && armed?.action === action;

  const act = (run) => {
    setArmed(null);
    if (run() === false) setFailed(true);
  };

  /** Arm on the first tap, act on the second. Only for a slot with a run in it. */
  const confirm = (id, action, run) => {
    if (isArmed(id, action)) act(run);
    else setArmed({ id, action });
  };

  /** Writing into an empty slot destroys nothing, so it needs no confirmation. */
  const writeTo = (slot) => {
    if (slot.empty) act(() => onSave(slot.id));
    else confirm(slot.id, 'save', () => onSave(slot.id));
  };

  return (
    <Sheet
      title={t('save.title')}
      action={
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-dim hover:text-accent"
        >
          {t('save.close')}
        </button>
      }
    >
      <>

        {onSave ? (
          <p className="mb-3 font-body text-[0.75rem] leading-snug text-faint">{t('save.pick')}</p>
        ) : null}

        {failed ? (
          <p role="alert" className="mb-3 font-body text-[0.75rem] leading-snug text-danger">
            {t('save.failed')}
          </p>
        ) : null}

        <ul className="flex flex-col gap-2">
          {slots.map((slot) => {
            const label = slot.auto
              ? t('save.auto')
              : t('save.slot').replace('{n}', slot.id);

            return (
              <li
                key={slot.id}
                className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-hairline px-3 py-2.5"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-accent">
                    {label}
                  </span>
                  <span className="h-px flex-1 bg-hairline opacity-40" />
                  <span className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-faint">
                    {slot.empty ? t('save.empty') : when(slot.savedAt, lang)}
                  </span>
                </div>

                {slot.empty ? (
                  <p className="font-body text-[0.75rem] leading-snug text-faint">
                    {slot.auto ? t('save.autoNote') : '—'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-body text-[0.8125rem] leading-snug text-text">
                      {t('start.savedAt')
                        .replace('{name}', slot.name || t('start.namePlaceholder'))
                        .replace('{week}', String(slot.week + 1))
                        .replace('{day}', String(slot.day + 1))}
                    </span>
                    {slot.focusId ? (
                      <span className="font-body text-[0.75rem] leading-snug text-dim">
                        {t('save.focus').replace('{member}', nameOf(slot.focusId))}
                      </span>
                    ) : null}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {onSave ? (
                    <Action
                      tone={isArmed(slot.id, 'save') ? 'danger' : 'accent'}
                      onClick={() => writeTo(slot)}
                    >
                      {isArmed(slot.id, 'save') ? t('save.confirmOverwrite') : t('save.saveHere')}
                    </Action>
                  ) : null}

                  {slot.empty ? null : (
                    <>
                      <Action onClick={() => onLoad(slot.id)}>{t('save.load')}</Action>
                      <Action
                        tone={isArmed(slot.id, 'delete') ? 'danger' : 'dim'}
                        onClick={() => confirm(slot.id, 'delete', () => onDelete(slot.id))}
                      >
                        {isArmed(slot.id, 'delete') ? t('save.confirmDelete') : t('save.delete')}
                      </Action>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </>
    </Sheet>
  );
}
