/**
 * Settings, including the API key. CLAUDE.md sections 3, 19, 20, 22.
 *
 * The key lives in localStorage on this device only. It is never logged, never
 * committed, and never sent anywhere but the endpoint the player chose. The
 * input is a password field and the stored value is only ever shown masked.
 *
 * With no key the game runs on the offline mock client, which is a real mode
 * rather than a degraded one - it is how the loop stays playable for free.
 */

import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { THEMES, FONT_SCALES } from '../../config/themes.js';
import { MODELS } from '../../config/modelConfigs.js';
import { LANGS, LANG_LABELS } from '../../i18n/index.js';

function Group({ label, children }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-faint">{label}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-[var(--radius-sm)] border px-2.5 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] transition-colors ${
        active ? 'border-accent bg-accent text-on-accent' : 'border-hairline text-dim hover:border-accent'
      }`}
    >
      {children}
    </button>
  );
}

export default function SettingsModal({ settings, onChange, apiKey, onKeyChange, onClose, t }) {
  const [draft, setDraft] = useState('');
  const set = (patch) => onChange({ ...settings, ...patch });
  const hasKey = Boolean(apiKey);

  return (
    <Sheet
      title={t('settings.title')}
      action={
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-dim hover:text-accent"
        >
          {t('map.close')}
        </button>
      }
    >
      <>

        <div className="flex flex-col gap-4">
          <Group label={t('settings.theme')}>
            {THEMES.map((th) => (
              <Pill key={th} active={settings.theme === th} onClick={() => set({ theme: th })}>
                {t(`theme.${th}`)}
              </Pill>
            ))}
          </Group>

          <Group label={t('settings.fontSize')}>
            {FONT_SCALES.map((fs) => (
              <Pill key={fs} active={settings.fontScale === fs} onClick={() => set({ fontScale: fs })}>
                {Math.round(fs * 100)}%
              </Pill>
            ))}
          </Group>

          <Group label={t('settings.language')}>
            {LANGS.map((l) => (
              <Pill key={l} active={settings.lang === l} onClick={() => set({ lang: l })}>
                {LANG_LABELS[l]}
              </Pill>
            ))}
          </Group>

          <Group label={t('settings.reduceMotion')}>
            <Pill active={!settings.reduceMotion} onClick={() => set({ reduceMotion: false })}>
              {t('settings.off')}
            </Pill>
            <Pill active={settings.reduceMotion} onClick={() => set({ reduceMotion: true })}>
              {t('settings.on')}
            </Pill>
          </Group>

          <Group label={t('settings.writtenChips')}>
            <Pill
              active={settings.writtenChips !== false}
              onClick={() => set({ writtenChips: true })}
            >
              {t('settings.on')}
            </Pill>
            <Pill
              active={settings.writtenChips === false}
              onClick={() => set({ writtenChips: false })}
            >
              {t('settings.off')}
            </Pill>
          </Group>

          <Group label={t('settings.model')}>
            {Object.entries(MODELS).map(([id, m]) => (
              <Pill key={id} active={settings.model === id} onClick={() => set({ model: id })}>
                {m.label}
              </Pill>
            ))}
          </Group>

          <section className="flex flex-col gap-1.5">
            <h3 className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-faint">
              {t('settings.apiKey')}
            </h3>

            {hasKey ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate font-mono text-[0.6875rem] text-dim">
                  {apiKey.slice(0, 5)}
                  {'•'.repeat(12)}
                </span>
                <button
                  type="button"
                  onClick={() => onKeyChange('')}
                  className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-danger"
                >
                  {t('settings.clearKey')}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="password"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                  spellCheck="false"
                  className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-hairline bg-bg px-3 py-2 font-mono text-[0.75rem] text-text outline-none placeholder:text-faint focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => {
                    onKeyChange(draft.trim());
                    setDraft('');
                  }}
                  disabled={!draft.trim()}
                  className="rounded-[var(--radius-sm)] border border-accent bg-accent px-3 py-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-on-accent disabled:opacity-35"
                >
                  {t('settings.saveKey')}
                </button>
              </div>
            )}

            <p className="font-mono text-[0.5rem] uppercase leading-relaxed tracking-[0.1em] text-faint">
              {hasKey ? t('settings.keyOn') : t('settings.keyOff')}
            </p>
          </section>
        </div>
      </>
    </Sheet>
  );
}
