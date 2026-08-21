/**
 * M0 scaffold harness.
 *
 * This screen exists to prove the M0 exit criteria: the app boots, cards load,
 * and theme / font scale / language switch correctly through the token layer.
 * It is NOT the game UI - the real VN interface arrives in M3 with a proper
 * design pass. Expect this file to be replaced wholesale.
 */

import { useEffect, useMemo, useState } from 'react';
import { applyTheme, THEMES, FONT_SCALES } from './config/themes.js';
import { loadSettings, saveSettings } from './store/settings.js';
import { makeT, LANGS, LANG_LABELS } from './i18n/index.js';
import { getCast } from './data/cast.js';
import { LOCATIONS } from './data/locations.js';

/**
 * Class names must be written out in full - Tailwind extracts them statically,
 * so a constructed string like `bg-${id}` produces no CSS.
 */
const METERS = [
  { id: 'guard', cls: 'bg-guard' },
  { id: 'fluster', cls: 'bg-fluster' },
  { id: 'exposure', cls: 'bg-exposure' },
];

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [focusId, setFocusId] = useState('irene');

  const cast = useMemo(() => getCast(), []);
  const t = useMemo(() => makeT(settings.lang), [settings.lang]);
  const focus = cast.find((c) => c.id === focusId) ?? cast[0];

  useEffect(() => {
    applyTheme(settings, focus?.palette ?? null);
    saveSettings(settings);
  }, [settings, focus]);

  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col gap-6 px-5 py-8">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('app.title')}</h1>
          <p className="text-sm text-dim">{t('app.tagline')}</p>
        </div>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">
          {t('dev.scaffold')}
        </span>
      </header>

      <Section title={t('dev.castLoaded')}>
        <ul className="flex flex-col gap-2">
          {cast.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setFocusId(c.id)}
                aria-pressed={c.id === focusId}
                className="flex w-full items-center gap-3 rounded-[var(--radius)] border px-3 py-2 text-left transition-colors"
                style={{
                  borderColor: c.id === focusId ? c.palette.base : 'var(--border)',
                  background: c.id === focusId ? 'var(--surface-alt)' : 'var(--surface)',
                }}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
                  style={{ background: c.palette.base, color: c.palette.accent }}
                >
                  {c.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-dim">
                    {c.preferredRoles.map((r) => t(`role.${r}`)).join(' / ')}
                  </span>
                </span>
                <span className="text-xs text-dim">{c.mascot}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('settings.theme')}>
        <Row>
          {THEMES.map((th) => (
            <Chip
              key={th}
              active={settings.theme === th}
              onClick={() => set({ theme: th })}
              label={t(`theme.${th}`)}
            />
          ))}
        </Row>
        {settings.theme === 'bloom' && (
          <p className="mt-2 text-xs text-dim">{t('theme.bloomHint')}</p>
        )}
      </Section>

      <Section title={t('settings.fontSize')}>
        <Row>
          {FONT_SCALES.map((fs) => (
            <Chip
              key={fs}
              active={settings.fontScale === fs}
              onClick={() => set({ fontScale: fs })}
              label={`${Math.round(fs * 100)}%`}
            />
          ))}
        </Row>
      </Section>

      <Section title={t('settings.language')}>
        <Row>
          {LANGS.map((l) => (
            <Chip
              key={l}
              active={settings.lang === l}
              onClick={() => set({ lang: l })}
              label={LANG_LABELS[l]}
            />
          ))}
        </Row>
      </Section>

      <Section title={t('settings.reduceMotion')}>
        <Row>
          <Chip
            active={!settings.reduceMotion}
            onClick={() => set({ reduceMotion: false })}
            label="Off"
          />
          <Chip
            active={settings.reduceMotion}
            onClick={() => set({ reduceMotion: true })}
            label="On"
          />
        </Row>
      </Section>

      <Section title={t('dev.tokenCheck')}>
        <div className="grid grid-cols-3 gap-2">
          {METERS.map(({ id, cls }) => (
            <div
              key={id}
              className="rounded-[var(--radius)] border border-border bg-surface p-2"
            >
              <span className="block text-xs text-dim">{t(`meter.${id}`)}</span>
              <span className={`mt-1.5 block h-1.5 rounded-full ${cls}`} />
            </div>
          ))}
        </div>
        <ul className="mt-3 flex flex-col gap-1 text-xs text-dim">
          {Object.entries(LOCATIONS).map(([id, loc]) => (
            <li key={id} className="flex justify-between gap-3">
              <span className="truncate">{t(`location.${id}`)}</span>
              <span className="shrink-0 tabular-nums">
                {t('meter.exposure')} {loc.exposureBase} / {loc.presence}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-dim">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Chip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'border-accent bg-accent text-on-accent'
          : 'border-border bg-surface text-text hover:bg-surface-alt'
      }`}
    >
      {label}
    </button>
  );
}
