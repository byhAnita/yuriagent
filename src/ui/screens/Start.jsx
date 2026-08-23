/**
 * The cover. Name, identity, cast - then the run begins.
 *
 * Three sections, and only one of them currently does anything. That is
 * deliberate rather than unfinished: section 2 requires v2 features to have
 * their interface stubbed in MVP so adding them later is content and not a
 * refactor, and the cheapest honest version of that is a picker that renders
 * the real table and refuses the rows it cannot deliver. A disabled row also
 * tells the player what this game intends to become, which a hidden one does
 * not.
 *
 * `player.name` has been in the section 15 schema since M0 and there has never
 * been anywhere to type it. It reaches block 1, which is the byte-stable block,
 * so it is collected once here and never edited again - which is exactly why it
 * belongs on a screen that runs before the run exists.
 */

import { useState } from 'react';
import { IDENTITIES, IDENTITY_IDS, DEFAULT_IDENTITY } from '../../data/identities.js';
import { MAX_PLAYER_NAME, sanitizeName } from '../../store/playerName.js';

function Label({ children, note = null }) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <span className="font-mono text-[0.5625rem] uppercase tracking-[0.22em] text-faint">
        {children}
      </span>
      <hr className="rule flex-1" />
      {note ? (
        <span className="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-faint">
          {note}
        </span>
      ) : null}
    </div>
  );
}

/**
 * One picker row.
 *
 * Disabled rows stay legible rather than greying into the background: the
 * point of showing them is that the player reads them. What marks them is the
 * `soon` tag and the missing selection dot, not a drop in contrast.
 */
function Row({ selected, disabled, onSelect, lead, title, note, tag }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className={[
        'flex w-full items-baseline gap-2.5 rounded-[var(--radius-sm)] border px-3 py-2.5 text-left transition-colors',
        selected ? 'border-accent bg-accent-soft/25' : 'border-hairline',
        disabled ? 'cursor-default opacity-55' : 'hover:border-accent',
      ].join(' ')}
    >
      <span aria-hidden="true" className="w-4 shrink-0 text-center font-mono text-[0.75rem] text-accent">
        {lead ?? (selected ? '●' : '○')}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-[0.9375rem] text-text">{title}</span>
        {note ? (
          <span className="mt-0.5 block font-body text-[0.75rem] leading-snug text-dim">
            {note}
          </span>
        ) : null}
      </span>

      {tag ? (
        <span className="shrink-0 font-mono text-[0.5rem] uppercase tracking-[0.16em] text-faint">
          {tag}
        </span>
      ) : null}
    </button>
  );
}

export default function Start({
  cards,
  lineup,
  /** `{ savedAt, week, day, name }` from `store/save.js`, or null. */
  saved = null,
  onContinue,
  onBegin,
  onOpenSettings,
  t,
}) {
  const [name, setName] = useState('');
  const [identityId, setIdentityId] = useState(DEFAULT_IDENTITY);

  const clean = sanitizeName(name);
  const ready = clean.length > 0;

  const begin = () => {
    if (!ready) return;
    onBegin({ name: clean, identityId });
  };

  return (
    <div className="stage mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col gap-6 px-5 py-9">
      <header className="sheet-in flex flex-col gap-1">
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.3em] text-faint">
          {t('app.tagline')}
        </span>
        <h1 className="font-display text-[2.5rem] leading-none tracking-wide text-accent">
          {t('app.title')}
        </h1>
        <p className="mt-1 font-body text-[0.8125rem] italic leading-snug text-dim">
          {t('start.blurb')}
        </p>
      </header>

      {/*
        A run in progress outranks starting one.

        Above the name field rather than beside the Begin button, because a
        player who has a campaign going is here to resume it and should not
        have to scroll past three pickers they already answered to find that
        out. Beginning is still one tap away, and it warns that it replaces
        what is there.
      */}
      {saved ? (
        <section className="sheet-in" style={{ '--i': 1 }}>
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-[var(--radius)] border border-accent bg-accent-soft/25 px-4 py-3 text-left"
          >
            <span className="block font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-accent">
              {t('start.continue')}
            </span>
            <span className="mt-1 block font-body text-[0.8125rem] text-dim">
              {t('start.savedAt')
                .replace('{name}', saved.name || t('start.namePlaceholder'))
                .replace('{week}', String(saved.week + 1))
                .replace('{day}', String(saved.day + 1))}
            </span>
          </button>
        </section>
      ) : null}

      <section className="sheet-in" style={{ '--i': 1 }}>
        <Label>{t('start.nameLabel')}</Label>
        <input
          type="text"
          value={name}
          maxLength={MAX_PLAYER_NAME}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') begin();
          }}
          placeholder={t('start.namePlaceholder')}
          aria-label={t('start.nameLabel')}
          className="w-full rounded-[var(--radius-sm)] border border-hairline bg-surface px-3 py-2.5 font-body text-[1rem] text-text outline-none placeholder:text-faint focus:border-accent"
        />
        <p className="mt-1.5 font-body text-[0.75rem] leading-snug text-faint">
          {t('start.nameNote')}
        </p>
      </section>

      <section className="sheet-in" style={{ '--i': 2 }}>
        <Label>{t('start.identityLabel')}</Label>
        <ul className="flex flex-col gap-1.5">
          {IDENTITY_IDS.map((id) => {
            const identity = IDENTITIES[id];
            return (
              <li key={id}>
                <Row
                  selected={identityId === id}
                  disabled={!identity.available}
                  onSelect={() => setIdentityId(id)}
                  title={t(`identity.${id}`)}
                  note={identityId === id ? t(`identityNote.${id}`) : null}
                  tag={identity.available ? null : t('start.soon')}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/*
        The cast is fixed at five and the picker is a stub, so this section
        shows the lineup rather than pretending to offer a choice. It still
        earns its place: castBuilder resolves roles from birthdays and card
        preferences, and this is the only screen that ever says out loud who
        ended up leader.
      */}
      <section className="sheet-in" style={{ '--i': 3 }}>
        <Label note={t('start.castFixed')}>{t('start.castLabel')}</Label>
        <ul className="flex flex-col gap-1.5">
          {cards.map((card) => (
            <li key={card.id}>
              <Row
                selected
                disabled
                lead={card.emoji}
                title={card.name}
                note={(lineup?.[card.id] ?? []).map((r) => t(`role.${r}`)).join(' · ')}
              />
            </li>
          ))}
          <li>
            <Row disabled lead="+" title={t('start.customCast')} tag={t('start.soon')} />
          </li>
        </ul>
      </section>

      <div className="sheet-in mt-auto flex flex-col gap-3" style={{ '--i': 4 }}>
        <button
          type="button"
          onClick={begin}
          disabled={!ready}
          className="rounded-[var(--radius)] border border-accent px-4 py-3.5 font-mono text-[0.8125rem] uppercase tracking-[0.24em] text-accent disabled:border-hairline disabled:text-faint"
        >
          {saved ? t('start.beginOver') : t('start.begin')}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="self-center font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-faint hover:text-accent"
        >
          {t('map.settings')}
        </button>
      </div>
    </div>
  );
}
