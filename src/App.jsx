/**
 * M4 shell.
 *
 * day -> gift -> scene -> aftermath -> day, on a real clock. The map is driven
 * by the deterministic calendar, blocks advance, tasks come due at day rollover
 * and energy only comes back from sleeping.
 *
 * Runs on the offline writer with no API key; a key in settings switches the
 * same loop onto a real model.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyTheme } from './config/themes.js';
import { loadSettings, saveSettings } from './store/settings.js';
import { loadApiKey, saveApiKey } from './store/apiKey.js';
import { makeT } from './i18n/index.js';
import { getCast } from './data/cast.js';
import { buildLineup } from './systems/castBuilder.js';
import { newRelation, applySceneOutcome, resolveStage } from './systems/relationship.js';
import { newMemory } from './agent/memory.js';
import { generateWeek, occupancyAt } from './systems/calendar.js';
import {
  generateDayTask,
  completeTask,
  failTask,
  newTaskState,
  applyPlayerDeltas,
} from './systems/tasks.js';
import { advanceBlock, newRun, spendBlockEnergy, restOvernight } from './systems/clock.js';
import { purchase } from './systems/economy.js';
import { resolveSoloAction, soloLedgerText, applySoloPlayerDelta, goodwillTargets } from './systems/soloWork.js';
import { appendLedger, addDossierEntry } from './agent/memory.js';
import { makeRng, deriveSeed } from './systems/rng.js';
import { createClient } from './tools/client.js';
import VNStage from './ui/vn/VNStage.jsx';
import Day from './ui/screens/Day.jsx';
import GiftModal from './ui/modals/GiftModal.jsx';
import SoloAction, { TASK_ACTION } from './ui/screens/SoloAction.jsx';
import SettingsModal from './ui/modals/SettingsModal.jsx';

const IDENTITY = {
  id: 'assistant',
  promptRole: 'an artist assistant at the agency',
  taskPool: ['prep_outfits', 'run_schedule', 'handle_press_kit', 'stage_check', 'restock_wardrobe'],
  exposureModifier: { wardrobe: -10, cafe: 10 },
};

const SEED = 20260821;

export default function App() {
  const cards = useMemo(() => getCast(), []);
  const lineup = useMemo(() => buildLineup(cards), [cards]);
  const castIds = useMemo(() => cards.map((c) => c.id), [cards]);

  const [settings, setSettings] = useState(loadSettings);
  const [apiKey, setApiKey] = useState(loadApiKey);
  const [showSettings, setShowSettings] = useState(false);

  const [run, setRun] = useState(() => newRun({ seed: SEED }));
  const [player, setPlayer] = useState({
    name: 'You',
    energy: 90,
    secrecy: 70,
    credits: 6,
    competence: 20,
  });
  const [relations, setRelations] = useState(() =>
    Object.fromEntries(cards.map((c) => [c.id, newRelation(c.startIntimacy ?? 5)])),
  );
  const [memory, setMemory] = useState(() => newMemory(castIds));
  const [taskState, setTaskState] = useState(newTaskState);

  const [screen, setScreen] = useState('day');
  const [pendingScene, setPendingScene] = useState(null);
  const [giftNote, setGiftNote] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [sceneNo, setSceneNo] = useState(0);
  const [solo, setSolo] = useState(null);

  const t = useMemo(() => makeT(settings.lang), [settings.lang]);

  const weekPlan = useMemo(
    () => generateWeek({ phase: run.phase, cards, seed: SEED, week: run.week }),
    [run.phase, run.week, cards],
  );

  const occupancy = useMemo(
    () =>
      occupancyAt(weekPlan, {
        day: run.day,
        block: run.block,
        cards,
        seed: SEED,
        week: run.week,
      }),
    [weekPlan, run.day, run.block, run.week, cards],
  );

  const task = useMemo(
    () =>
      generateDayTask({
        identity: IDENTITY,
        day: run.day,
        week: run.week,
        phase: run.phase,
        seed: SEED,
      }),
    [run.day, run.week, run.phase],
  );

  const focusId = useMemo(
    () =>
      castIds.reduce(
        (best, id) => (relations[id].intimacy > relations[best].intimacy ? id : best),
        castIds[0],
      ),
    [relations, castIds],
  );
  const focusCard = cards.find((c) => c.id === focusId);

  const client = useMemo(
    () => createClient({ apiKey, modelId: settings.model, seed: SEED + sceneNo }),
    [apiKey, settings.model, sceneNo],
  );

  useEffect(() => {
    applyTheme(settings, focusCard?.palette ?? null);
    saveSettings(settings);
  }, [settings, focusCard]);

  const onKeyChange = (value) => {
    setApiKey(value);
    saveApiKey(value);
  };

  /**
   * Advance one block, rolling the day and charging an unfinished task.
   *
   * Takes the task result and any stat change as arguments rather than reading
   * them back from state: a caller that just completed the task would otherwise
   * be seen by this closure as still owing it, and would be charged for a
   * failure it had just avoided.
   */
  const advance = useCallback(
    ({ extraEnergy = 0, playerDelta = null, taskDone = null } = {}) => {
      const { run: next, rolledDay } = advanceBlock(run);
      const finished = taskDone ?? taskState.done;

      let nextPlayer = playerDelta ? applyPlayerDeltas(player, playerDelta) : player;
      nextPlayer = spendBlockEnergy(nextPlayer, extraEnergy);

      if (rolledDay) {
        if (task && !finished) {
          const fail = failTask(task, castIds);
          nextPlayer = applyPlayerDeltas(nextPlayer, fail);
          if (Object.keys(fail.strain).length > 0) {
            setRelations((rs) => {
              const out = { ...rs };
              for (const [id, strain] of Object.entries(fail.strain)) {
                out[id] = applySceneOutcome(out[id], { strain });
              }
              return out;
            });
          }
        }
        nextPlayer = restOvernight(nextPlayer);
        setTaskState(newTaskState());
      }

      setPlayer(nextPlayer);
      setRun(next);
      setScreen('day');
    },
    [run, player, task, taskState, castIds],
  );

  /**
   * A block spent in an empty room. Not dead space: this is where the assistant
   * does the job, and where you learn something about a member who is not in
   * the room - the second path into known_facts and therefore into the gifts.
   */
  const onEnterSolo = (locationId) => {
    setSolo({ locationId, result: null });
  };

  const onChooseSolo = (actionId) => {
    // The daily objective is discharged at its own location, in place of a
    // solo action - so it costs the block like everything else does.
    if (actionId === TASK_ACTION) {
      setTaskState({ taskId: task.taskId, done: true, day: run.day });
      setSolo(null);
      advance({ playerDelta: completeTask(task), taskDone: true });
      return;
    }

    const rng = makeRng(deriveSeed(SEED, `solo:${run.week}:${run.day}:${run.block}`));
    const present = Object.entries(occupancy)
      .filter(([, w]) => w.locationId === solo.locationId)
      .map(([id]) => id);

    const result = resolveSoloAction({
      locationId: solo.locationId,
      actionId,
      cards,
      dossier: memory.dossier,
      present,
      rng,
    });
    if (!result) return;

    setPlayer((p) => applySoloPlayerDelta(p, result.playerDelta));

    setMemory((m) => {
      let dossier = m.dossier;
      for (const add of result.dossierAdd) {
        dossier = addDossierEntry(dossier, add.memberId, add.category, add.text);
      }
      const text = soloLedgerText(result, {
        locationLabel: t(`location.${solo.locationId}`),
      });
      return {
        ledger: appendLedger(m.ledger, {
          id: `w${run.week}d${run.day}${run.block}`,
          week: run.week,
          day: run.day,
          block: run.block,
          text,
          summary: text,
        }),
        dossier,
      };
    });

    if (result.goodwill) {
      const ids = goodwillTargets(cards, occupancy, solo.locationId);
      if (ids.length > 0) {
        setRelations((rs) => {
          const out = { ...rs };
          for (const id of ids) out[id] = applySceneOutcome(out[id], { intimacy: 1, good: true });
          return out;
        });
      }
    }

    setSolo((s) => ({ ...s, result }));
  };

  const onEnter = (locationId, present) => {
    if (present.length === 0) return;
    // One member per scene for now. The prompt and parser already handle two
    // (MAX_INTERACTIVE_MEMBERS), but VNStage renders a single portrait, so a
    // second rostered speaker would talk with nobody on screen. Group scenes
    // land with the two-portrait stage.
    setPendingScene({ locationId, rosterIds: [present[0].id] });
    setScreen('gift');
  };

  const scene = useMemo(() => {
    if (!pendingScene) return null;
    const dormWitnessIds = Object.entries(occupancy)
      .filter(([id, w]) => w.locationId === 'dorm_living' && !pendingScene.rosterIds.includes(id))
      .map(([id]) => id);

    return {
      id: `s${sceneNo}`,
      seed: SEED + sceneNo,
      rosterIds: pendingScene.rosterIds,
      focusId: pendingScene.rosterIds[0],
      week: run.week,
      day: run.day,
      block: run.block,
      phase: run.phase,
      locationId: pendingScene.locationId,
      locationLabel: t(`location.${pendingScene.locationId}`),
      dormWitnessIds,
    };
  }, [pendingScene, occupancy, run, sceneNo, t]);

  const setup = useMemo(
    () =>
      scene
        ? {
            cards,
            lineup,
            identity: IDENTITY,
            player,
            lang: settings.lang,
            memory,
            relations,
            scene,
          }
        : null,
    [scene, cards, lineup, player, settings.lang, memory, relations],
  );

  const onSceneEnd = (result) => {
    setMemory(result.memory);
    setRelations(result.relations);
    setOutcome(result);
    setSceneNo((n) => n + 1);
    setPendingScene(null);
    setGiftNote(null);
    setScreen('after');
  };

  const giftTarget = pendingScene ? cards.find((c) => c.id === pendingScene.rosterIds[0]) : null;

  return (
    <>
      {screen === 'day' && !solo ? (
        <Day
          run={run}
          player={player}
          cards={cards}
          relations={relations}
          occupancy={occupancy}
          weekPlan={weekPlan}
          task={task}
          taskState={taskState}
          identity={IDENTITY}
          onEnter={onEnter}
          onEnterSolo={onEnterSolo}
          onSkipBlock={() => advance()}
          onOpenSettings={() => setShowSettings(true)}
          t={t}
        />
      ) : null}

      {solo ? (
        <SoloAction
          locationId={solo.locationId}
          task={task && !taskState.done && task.location === solo.locationId ? task : null}
          result={solo.result}
          onChoose={onChooseSolo}
          onDone={() => {
            setSolo(null);
            advance();
          }}
          t={t}
        />
      ) : null}

      {screen === 'gift' && giftTarget ? (
        <GiftModal
          card={giftTarget}
          dossier={memory.dossier[giftTarget.id]}
          credits={player.credits}
          onPick={(giftId) => {
            const bought = purchase(
              giftId,
              memory.dossier[giftTarget.id],
              player.credits,
              giftTarget.name,
            );
            if (bought) {
              setPlayer((p) => ({ ...p, credits: bought.credits }));
              setGiftNote(bought.sceneNote);
              setRelations((rs) => ({
                ...rs,
                [giftTarget.id]: applySceneOutcome(rs[giftTarget.id], {
                  intimacy: bought.intimacyDelta,
                  good: true,
                }),
              }));
            }
            setScreen('scene');
          }}
          onSkip={() => setScreen('scene')}
          t={t}
        />
      ) : null}

      {screen === 'scene' && setup ? (
        <VNStage
          key={sceneNo}
          setup={setup}
          client={client}
          giftNote={giftNote}
          onSceneEnd={onSceneEnd}
          writtenChips={settings.writtenChips}
          t={t}
        />
      ) : null}

      {screen === 'after' && outcome ? (
        <Aftermath
          outcome={outcome}
          cards={cards}
          relations={relations}
          memory={memory}
          onContinue={() => advance({ extraEnergy: 1 })}
          t={t}
        />
      ) : null}

      {showSettings ? (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          apiKey={apiKey}
          onKeyChange={onKeyChange}
          onClose={() => setShowSettings(false)}
          t={t}
        />
      ) : null}
    </>
  );
}

function Aftermath({ outcome, cards, relations, memory, onContinue, t }) {
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
        <ul className="flex flex-col gap-1">
          {cards.map((c) => {
            const rel = relations[c.id];
            return (
              <li key={c.id} className="flex items-baseline gap-2 font-mono text-[0.625rem]">
                <span className="w-14 text-dim">{c.name}</span>
                <span className="flex-1 text-dim">
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
        <p className="font-body text-[0.875rem] italic text-dim">{memory.ledger.at(-1).text}</p>
      ) : null}

      <button
        type="button"
        onClick={onContinue}
        className="mt-auto rounded-[var(--radius)] border border-accent px-4 py-3 font-mono text-[0.75rem] uppercase tracking-[0.2em] text-accent"
      >
        {t('game.nextBlock')}
      </button>
    </div>
  );
}
