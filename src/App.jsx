/**
 * M3 shell.
 *
 * Setup -> scene -> aftermath, wired to the real engine. The map, calendar and
 * task layer arrive in M4; until then SceneSetup stands in for them so a scene
 * is reachable and the two romantically meaningful choices - who, and how
 * visible - are already the choices the player makes.
 *
 * Runs against the offline mock client by default so the whole loop is playable
 * with no API key.
 */

import { useEffect, useMemo, useState } from 'react';
import { applyTheme, THEMES, FONT_SCALES } from './config/themes.js';
import { loadSettings, saveSettings } from './store/settings.js';
import { makeT, LANGS, LANG_LABELS } from './i18n/index.js';
import { getCast } from './data/cast.js';
import { buildLineup } from './systems/castBuilder.js';
import { newRelation, resolveStage } from './systems/relationship.js';
import { newMemory } from './agent/memory.js';
import { createMockClient } from './tools/mockClient.js';
import VNStage from './ui/vn/VNStage.jsx';
import SceneSetup from './ui/screens/SceneSetup.jsx';

const IDENTITY = {
  id: 'assistant',
  promptRole: 'an artist assistant at the agency',
  exposureModifier: { wardrobe: -10, cafe: 10 },
};

export default function App() {
  const cards = useMemo(() => getCast(), []);
  const lineup = useMemo(() => buildLineup(cards), [cards]);
  const castIds = useMemo(() => cards.map((c) => c.id), [cards]);

  const [settings, setSettings] = useState(loadSettings);
  const [screen, setScreen] = useState('setup');
  const [sceneNo, setSceneNo] = useState(0);
  const [outcome, setOutcome] = useState(null);

  const [player] = useState({ name: 'You', energy: 80, secrecy: 70, credits: 6, competence: 20 });
  const [relations, setRelations] = useState(() =>
    Object.fromEntries(cards.map((c) => [c.id, newRelation(c.startIntimacy ?? 5)])),
  );
  const [memory, setMemory] = useState(() => newMemory(castIds));

  const [choice, setChoice] = useState({
    memberId: 'irene',
    locationId: 'practice_room',
    block: 'evening',
    phase: 'prep',
  });

  const t = useMemo(() => makeT(settings.lang), [settings.lang]);
  const client = useMemo(() => createMockClient({ seed: 7 + sceneNo }), [sceneNo]);

  const focusCard = cards.find((c) => c.id === choice.memberId);

  useEffect(() => {
    applyTheme(settings, focusCard?.palette ?? null);
    saveSettings(settings);
  }, [settings, focusCard]);

  const scene = useMemo(
    () => ({
      id: `s${sceneNo}`,
      seed: 1000 + sceneNo,
      rosterIds: [choice.memberId],
      focusId: choice.memberId,
      week: 0,
      day: 1,
      block: choice.block,
      phase: choice.phase,
      locationId: choice.locationId,
      locationLabel: t(`location.${choice.locationId}`),
    }),
    [choice, sceneNo, t],
  );

  const setup = useMemo(
    () => ({ cards, lineup, identity: IDENTITY, player, lang: settings.lang, memory, relations, scene }),
    [cards, lineup, player, settings.lang, memory, relations, scene],
  );

  const onSceneEnd = (result) => {
    setMemory(result.memory);
    setRelations(result.relations);
    setOutcome(result);
    setScreen('after');
    setSceneNo((n) => n + 1);
  };

  if (screen === 'scene') {
    return (
      <VNStage
        key={sceneNo}
        setup={setup}
        client={client}
        onSceneEnd={onSceneEnd}
        t={t}
      />
    );
  }

  if (screen === 'after') {
    return (
      <Aftermath
        outcome={outcome}
        cards={cards}
        relations={relations}
        memory={memory}
        onAgain={() => setScreen('setup')}
        t={t}
      />
    );
  }

  return (
    <>
      <SceneSetup
        cards={cards}
        relations={relations}
        choice={choice}
        onChange={setChoice}
        onBegin={() => setScreen('scene')}
        t={t}
      />
      <SettingsStrip settings={settings} onChange={setSettings} t={t} />
    </>
  );
}

function Aftermath({ outcome, cards, relations, memory, onAgain, t }) {
  const { delta, rumors } = outcome;

  return (
    <div className="stage mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col gap-5 px-5 py-8">
      <h2 className="font-display text-[1.5rem] tracking-wide">{t('vn.sceneOver')}</h2>

      <ul className="flex flex-col gap-1 font-mono text-[0.6875rem] uppercase tracking-[0.12em]">
        {['intimacy', 'admissibility', 'strain'].map((k) => (
          <li key={k} className="flex justify-between border-b border-hairline pb-1 text-dim">
            <span>{k}</span>
            <span className={delta[k] > 0 ? 'text-accent' : 'text-faint'}>
              {delta[k] > 0 ? '+' : ''}
              {delta[k]}
            </span>
          </li>
        ))}
      </ul>

      {rumors.length > 0 ? (
        <section>
          <h3 className="mb-1 font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-warn">
            {t('exposureBand.public')}
          </h3>
          <ul className="flex flex-col gap-1">
            {rumors.map((r, i) => (
              <li key={i} className="font-body text-[0.875rem] italic text-dim">
                {cards.find((c) => c.id === r.memberId)?.name}: {r.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="mb-1 font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-faint">
          {t('dev.castLoaded')}
        </h3>
        <ul className="flex flex-col gap-1">
          {cards.map((c) => {
            const rel = relations[c.id];
            return (
              <li key={c.id} className="flex items-baseline gap-2 font-mono text-[0.625rem]">
                <span className="w-14 text-dim">{c.name}</span>
                <span className="flex-1 text-faint">
                  {t(`stage.${resolveStage(rel.intimacy, rel.admissibility)}`)}
                </span>
                <span className="tabular-nums text-dim">{Math.round(rel.intimacy)}</span>
                <span className="tabular-nums text-warn">{Math.round(rel.jealousy)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {memory.ledger.length > 0 ? (
        <p className="font-body text-[0.875rem] italic text-dim">
          {memory.ledger.at(-1).text}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onAgain}
        className="mt-auto rounded-[var(--radius)] border border-accent px-4 py-3 font-mono text-[0.75rem] uppercase tracking-[0.2em] text-accent"
      >
        {t('vn.again')}
      </button>
    </div>
  );
}

function SettingsStrip({ settings, onChange, t }) {
  const set = (patch) => onChange({ ...settings, ...patch });

  return (
    <div className="mx-auto w-full max-w-[26rem] px-5 pb-6">
      <hr className="rule mb-3" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[0.5625rem] uppercase tracking-[0.14em]">
        <span className="text-faint">{t('settings.theme')}</span>
        {THEMES.map((th) => (
          <button
            key={th}
            type="button"
            onClick={() => set({ theme: th })}
            className={settings.theme === th ? 'text-accent' : 'text-faint hover:text-dim'}
          >
            {t(`theme.${th}`)}
          </button>
        ))}

        <span className="ml-2 text-faint">{t('settings.fontSize')}</span>
        {FONT_SCALES.map((fs) => (
          <button
            key={fs}
            type="button"
            onClick={() => set({ fontScale: fs })}
            className={settings.fontScale === fs ? 'text-accent' : 'text-faint hover:text-dim'}
          >
            {Math.round(fs * 100)}
          </button>
        ))}

        <span className="ml-2 text-faint">{t('settings.language')}</span>
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => set({ lang: l })}
            className={settings.lang === l ? 'text-accent' : 'text-faint hover:text-dim'}
          >
            {LANG_LABELS[l]}
          </button>
        ))}

        <button
          type="button"
          onClick={() => set({ reduceMotion: !settings.reduceMotion })}
          className={settings.reduceMotion ? 'ml-2 text-accent' : 'ml-2 text-faint hover:text-dim'}
        >
          {t('settings.reduceMotion')}
        </button>
      </div>
      <p className="mt-2 font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-faint">
        {t('vn.offline')} &middot; {t('vn.offlineNote')}
      </p>
    </div>
  );
}
