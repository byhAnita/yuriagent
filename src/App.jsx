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
import {
  saveTo,
  loadFrom,
  listSlots,
  deleteSlot,
  clearAuto,
  hasAnySave,
  AUTO_SLOT,
} from './store/save.js';
import { makeT } from './i18n/index.js';
import { BLOCKS } from './config/constants.js';
import { getCast } from './data/cast.js';
import { getIdentity, DEFAULT_IDENTITY } from './data/identities.js';
import { buildLineup } from './systems/castBuilder.js';
import { dialogueShape } from './systems/dialogue.js';
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
import {
  advanceBlock,
  newRun,
  spendBlockEnergy,
  restOvernight,
  cycleForWeek,
} from './systems/clock.js';
import { purchase, spendGesture } from './systems/economy.js';
import { resolveSoloAction, soloLedgerText, applySoloPlayerDelta, goodwillTargets } from './systems/soloWork.js';
import { appendLedger, addDossierEntry } from './agent/memory.js';
import { addDecisions, canonForCycle, canonForEvent } from './systems/canon.js';
import { makeRng, deriveSeed } from './systems/rng.js';
import { createClient } from './tools/client.js';
import VNStage from './ui/vn/VNStage.jsx';
import Start from './ui/screens/Start.jsx';
import Day from './ui/screens/Day.jsx';
import Endings from './ui/screens/Endings.jsx';
import SoloAction, { TASK_ACTION } from './ui/screens/SoloAction.jsx';
import SettingsModal from './ui/modals/SettingsModal.jsx';
import SaveModal from './ui/modals/SaveModal.jsx';
import HandbookModal from './ui/modals/HandbookModal.jsx';
import RelationsModal from './ui/modals/RelationsModal.jsx';
import DateModal from './ui/modals/DateModal.jsx';
import { dateOffers, askOut, dateCost, dateLocation } from './systems/dating.js';
import { isWeekend } from './systems/calendar.js';
import { dateFrame, REGISTERS } from './data/sceneFrames.js';
import { eventFor, eventFrame, eventKey } from './data/events/index.js';
import { sharedFrame } from './data/sharedActivities.js';

const SEED = 20260821;

export default function App() {
  const cards = useMemo(() => getCast(), []);
  const lineup = useMemo(() => buildLineup(cards), [cards]);
  const castIds = useMemo(() => cards.map((c) => c.id), [cards]);

  const [settings, setSettings] = useState(loadSettings);
  const [apiKey, setApiKey] = useState(loadApiKey);
  const [showSettings, setShowSettings] = useState(false);

  /**
   * The slot list, held in state rather than read at render.
   *
   * `listSlots` touches localStorage, and a render that reads storage every
   * pass is both wasteful and a lie - the list only changes when somebody
   * writes, deletes, or a day rolls over, and each of those refreshes it.
   */
  const [showSaves, setShowSaves] = useState(false);
  const [slots, setSlots] = useState(() => listSlots());

  const [run, setRun] = useState(() => newRun({ seed: SEED }));

  /**
   * Section 13 ships one identity and stubs the rest, so this is effectively a
   * constant today. It is state rather than a constant because the start screen
   * sets it, and because everything downstream already takes an identity object
   * - which is what makes adding the second one content instead of a refactor.
   */
  const [identityId, setIdentityId] = useState(DEFAULT_IDENTITY);
  const identity = useMemo(() => getIdentity(identityId), [identityId]);

  /**
   * Stats start from the identity, not from a literal. A producer walks in with
   * standing and credits an assistant does not have.
   */
  const [player, setPlayer] = useState(() => ({
    name: '',
    /**
     * What the player is carrying that was not bought. Section 15 has credits;
     * this is the counter behind `gift.stock` (PROPOSALS 15) - cooking alone in
     * the dorm kitchen makes one, and handing it over spends it.
     */
    dishes: 0,
    ...getIdentity(DEFAULT_IDENTITY).startStats,
  }));
  const [relations, setRelations] = useState(() =>
    Object.fromEntries(cards.map((c) => [c.id, newRelation(c.startIntimacy ?? 5)])),
  );
  const [memory, setMemory] = useState(() => newMemory(castIds));
  const [taskState, setTaskState] = useState(newTaskState);

  const [screen, setScreen] = useState('start');
  const [pendingScene, setPendingScene] = useState(null);

  /**
   * Which knowledge gestures have been spent, for the whole run rather than the
   * scene. Asking after her ankle is only new once; after that it is a script
   * (CLAUDE.md section 11).
   */
  const [usedGestures, setUsedGestures] = useState([]);

  /**
   * Rumors the player has already dug up, so a snoop never turns up the same
   * one twice. Not a dossier write - finding out that Yeri has heard something
   * changes what the PLAYER knows, not what Yeri knows.
   */
  const [foundRumors, setFoundRumors] = useState([]);
  const [outcome, setOutcome] = useState(null);
  const [sceneNo, setSceneNo] = useState(0);
  const [solo, setSolo] = useState(null);

  /**
   * Set when a live call failed and the offline writer answered instead.
   *
   * The player is otherwise reading a canned line in the model's place with no
   * way to know - which is exactly what made the language bug so hard to pin
   * down. Cleared by the next call that succeeds.
   */
  const [offline, setOffline] = useState(false);

  /**
   * The weekend invitation.
   *
   * `askedToday` is keyed by week and day rather than being a boolean, so it
   * clears itself on rollover and cannot leak into next Saturday. `refusal`
   * holds her answer so the modal can show it: a refusal is not a failure, it
   * is the first time a hidden number becomes a visible yes or no.
   */
  /**
   * Which anchor events have already happened, as `phase:slot` keys.
   *
   * Section 15 puts this on `flags.firedEvents`, and it persists across the
   * whole campaign rather than resetting with the cycle: there are six events
   * in the game, not five per cycle. `generateWeek` filters on it, so a fired
   * event stops being scheduled and its site leaves the map at the same moment.
   */
  const [firedEvents, setFiredEvents] = useState([]);

  /**
   * What the campaign has decided. CLAUDE.md section 7.
   *
   * Run-level, not per member and not chronology - everybody in X knows what
   * the group chose, and "the title track is X" stays true from the moment it
   * is settled until the campaign ends. The ledger compacts and drops; this
   * must not.
   */
  const [canon, setCanon] = useState([]);

  const [showDates, setShowDates] = useState(false);
  const [showHandbook, setShowHandbook] = useState(false);
  const [showRelations, setShowRelations] = useState(false);
  const [askedToday, setAskedToday] = useState(null);
  const [refusal, setRefusal] = useState(null);

  const t = useMemo(() => makeT(settings.lang), [settings.lang]);

  const weekPlan = useMemo(
    () => generateWeek({ phase: run.phase, cards, seed: SEED, week: run.week, fired: firedEvents }),
    [run.phase, run.week, cards, firedEvents],
  );

  /**
   * The anchor event on today, if there is one, with its authored content
   * attached.
   *
   * The calendar has always placed the day and named the site; what it could
   * not do is say what the day IS. Without this the whole cast stood at a
   * location `overworldFor` hides, so an event day looked like a day when
   * everybody had simply vanished.
   *
   * `content` may be null - a phase map is allowed to carry a slot nobody has
   * written for yet - and the day then plays as an ordinary one.
   */
  const todayEvent = useMemo(() => {
    const placed = (weekPlan.events ?? []).find((e) => e.day === run.day);
    if (!placed) return null;
    return { ...placed, content: eventFor(placed.phase, placed.slot) };
  }, [weekPlan, run.day]);

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
        identity,
        day: run.day,
        week: run.week,
        phase: run.phase,
        seed: SEED,
        // An event takes the whole day, so the agency asks for nothing on it.
        eventDay: Boolean(todayEvent?.content),
      }),
    [run.day, run.week, run.phase, identity, todayEvent],
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
    () =>
      createClient({
        apiKey,
        modelId: settings.model,
        seed: SEED + sceneNo,
        onFallback: (error) => setOffline(Boolean(error)),
      }),
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
    ({ extraEnergy = 0, playerDelta = null, taskDone = null, blocks = 1 } = {}) => {
      /**
       * `blocks` is looped HERE and not by the caller.
       *
       * This closure captures `run`, so calling advance() three times in a row
       * would compute the same next block three times and the day would move
       * once. A whole-day scene needs the rest of the day gone, so the loop has
       * to live where the running value does.
       */
      let cursor = run;
      let rolledDay = false;
      let over = false;
      for (let i = 0; i < Math.max(1, blocks); i++) {
        const step = advanceBlock(cursor);
        cursor = step.run;
        rolledDay = rolledDay || step.rolledDay;
        over = over || step.campaignOver;
      }
      const next = cursor;
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
        nextPlayer = restOvernight(nextPlayer, { secrecyBaseline: identity.startStats.secrecy });
        setTaskState(newTaskState());
      }

      setPlayer(nextPlayer);
      setRun(next);

      /**
       * Nine weeks, and then it is over.
       *
       * `advanceBlock` has returned `campaignOver` since M1 and nothing ever
       * read it, so the clock rolled past the end of the campaign and the game
       * simply kept going - the third thing found this milestone that was
       * implemented, tested, and never called.
       */
      setScreen(over ? 'endings' : 'day');
    },
    [run, player, task, taskState, castIds, identity],
  );

  /**
   * A block spent in an empty room. Not dead space: this is where the assistant
   * does the job, and where you learn something about a member who is not in
   * the room - the second path into known_facts and therefore into the gifts.
   */
  const onEnterSolo = (locationId, present = []) => {
    setSolo({ locationId, present: present.map((m) => m.id ?? m), result: null });
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
      foundRumors,
      rng,
    });
    if (!result) return;
    if (result.heard) setFoundRumors((f) => [...f, result.heard.text]);

    setPlayer((p) => {
      const next = applySoloPlayerDelta(p, result.playerDelta);
      return result.dish ? { ...next, dishes: (next.dishes ?? 0) + 1 } : next;
    });

    setMemory((m) => {
      let dossier = m.dossier;
      for (const add of result.dossierAdd) {
        const { memberId, category, ...entry } = add;
        dossier = addDossierEntry(dossier, memberId, category, entry);
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

  const dayKey = `${run.week}:${run.day}`;
  const canAskOut = isWeekend(run.day) && askedToday !== dayKey;

  const offers = useMemo(
    () => (canAskOut ? dateOffers({ phase: run.phase, cast: cards, relations, player }) : []),
    [canAskOut, run.phase, cards, relations, player],
  );

  /**
   * Put the question, and spend the day on the answer.
   *
   * One ask per day: `askOut` is seeded on the moment, so without this the
   * player could close the modal and reopen it forever and it would say the
   * same thing - which is not a bet, it is a locked door with a visible key.
   * Asking is what costs the attempt, not being told yes.
   */
  const onAskOut = (offer) => {
    const answer = askOut({
      rel: relations[offer.memberId],
      kind: offer.kind,
      player,
      seed: SEED,
      week: run.week,
      day: run.day,
      memberId: offer.memberId,
    });

    setAskedToday(dayKey);

    if (!answer.accepted) {
      const card = cards.find((c) => c.id === offer.memberId);
      setRefusal({ reason: answer.reason, name: card.name });
      return;
    }

    // She said yes. The bill lands on acceptance and never on the asking -
    // she turned you down, you did not buy her dinner.
    const cost = dateCost(offer.kind);
    if (cost > 0) setPlayer((p) => ({ ...p, credits: Math.max(0, p.credits - cost) }));

    setShowDates(false);
    setRefusal(null);
    setPendingScene({
      locationId: dateLocation(run.phase, offer.kind),
      rosterIds: [offer.memberId],
      presentIds: [offer.memberId],
      date: offer.kind,
    });
    setScreen('scene');
  };

  const onEnter = (locationId, present, addresseeId = null, { group = false } = {}) => {
    if (present.length === 0) return;

    /**
     * One member SPEAKS, or all of them may.
     *
     * `rosterIds` is who the parser will accept and whose dossiers block 3
     * carries; `presentIds` is who is in the room. In a 1v1 the roster is one
     * and everybody else is a witness - standing there requires no lines, and
     * turning to one member in front of the others is itself the gesture.
     *
     * A group scene widens the roster to the room. Section 9's two-member cap
     * is a constraint on ONE CALL writing several people, and proposal 12's
     * client-side addressee retires it: the client picks who answers and asks
     * for one member's beat per call, so the roster rule still holds at one
     * speaker per call and member bleed stays structurally impossible.
     */
    const speaker = addresseeId ?? present[0].id;
    const ids = present.map((m) => m.id);

    /**
     * Walking into the event site on the event day IS the event.
     *
     * No separate entry point and no banner: section 10 makes the same
     * argument about tasks, that privileging a thing visually turns a choice
     * back into an errand. The day is on the map, the cast is standing in it,
     * and going there is how it happens.
     */
    const here = todayEvent?.content && todayEvent.location === locationId ? todayEvent : null;

    setPendingScene({
      locationId,
      rosterIds: group ? ids : [speaker],
      presentIds: ids,
      event: here?.content ?? null,
      // Keyed by cycle, so the second concept meeting is a different event
      // from the first. `eventKey` throws without one rather than defaulting.
      eventKey: here ? eventKey(here.phase, here.slot, cycleForWeek(run.week)) : null,
    });
    setScreen('scene');
  };

  /**
   * Cooking together, or a film. PROPOSALS 15.
   *
   * A group scene with a frame and, crucially, `shared` - which is what stops
   * it generating four witnessed jealousy events for an evening in which
   * nothing happened to anyone in particular, and what pays everyone present a
   * little intimacy instead. The dorm needed one thing that is unambiguously
   * restorative.
   */
  const onShared = (activity) => {
    const ids = (solo?.present ?? []).slice();
    if (ids.length === 0) return;
    setSolo(null);
    setPendingScene({
      locationId: activity.locationId,
      rosterIds: ids,
      presentIds: ids,
      shared: activity.id,
      // Seeded on the evening, so the film does not change if the player backs
      // out of the gift modal and walks in again.
      sceneFrame: sharedFrame(
        activity,
        makeRng(deriveSeed(SEED, `shared:${run.week}:${run.day}:${activity.id}`)),
      ),
    });
    setScreen('scene');
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
      presentIds: pendingScene.presentIds ?? pendingScene.rosterIds,
      focusId: pendingScene.rosterIds[0],
      week: run.week,
      day: run.day,
      block: run.block,
      phase: run.phase,
      locationId: pendingScene.locationId,
      locationLabel: t(`location.${pendingScene.locationId}`),
      // The summarizer needs it too: memory stays English, display does not.
      lang: settings.lang,
      dormWitnessIds,

      /**
       * A date is a whole day, so it gets the longer register and a spine.
       *
       * The spine is what stops sixteen turns becoming drift: two to four
       * situations the day MAY pass through, offered and never ordered. Keeping
       * the ordinary scene terse is the other half of it - the contrast is what
       * makes a date feel like one (proposal 13).
       */
      date: pendingScene.date ?? null,

      /**
       * An anchor event borrows the whole mechanism a date already uses: a
       * frame, a register and sixteen turns. It differs in who is there - a
       * date is the two of you, an event is the two of you in front of the
       * other three - and that difference needs no code, because
       * `presentIds` already drives witnessed jealousy and `riskExposure`.
       */
      event: pendingScene.event ?? null,

      /**
       * A shared dorm evening. Nobody is singled out, so `rumor.js` skips the
       * witnessed branch entirely and `endScene` pays everyone present instead.
       */
      shared: pendingScene.shared ?? null,

      /**
       * An event's frame is built for THIS cycle rather than read off the
       * table - `eventFrame` adds the per-cycle stakes clause and, for the
       * concept meeting, this run's style pressure (PROPOSALS 24). Handing the
       * static object over is what let cycle 2 reproduce cycle 1.
       */
      sceneFrame:
        pendingScene.sceneFrame ??
        (pendingScene.date
          ? dateFrame(pendingScene.date, pendingScene.locationId)
          : eventFrame(pendingScene.event, {
              cycle: cycleForWeek(run.week),
              seed: SEED,
            })),
      register:
        pendingScene.date || pendingScene.shared
          ? REGISTERS.date
          : pendingScene.event
            ? REGISTERS.event
            : REGISTERS.ordinary,

      /**
       * What she is here for, and what the player still owes today.
       *
       * Both already existed and neither reached the model: block 4 said only
       * where the scene was, so every visit to the practice room opened the
       * same way and she could never mention the choreography she is actually
       * struggling with. `openScene` spreads the scene object into the header,
       * so adding them here is all the wiring there is.
       */
      occupancy,
      task: task ? { ...task, done: taskState.done } : null,

      /**
       * What the cycle has settled so far, for block 4.
       *
       * FILTERED HERE, not in the prompt builder: storage is complete and
       * permanent (it is what the handbook shows) and injection is a handful of
       * lines. Ordinary scenes get it too, which is where most of the value is -
       * Irene mentioning the title track in a wardrobe on a Tuesday is memory
       * that shows in the scene rather than in plumbing.
       */
      /**
       * An anchor event additionally gets the topics it was authored to build
       * on, looked up across every cycle - that is what makes the four
       * recurring events a chain instead of four separate days.
       */
      canon: pendingScene.event
        ? canonForEvent(canon, {
            cycle: cycleForWeek(run.week),
            reads: pendingScene.event.reads ?? [],
          })
        : canonForCycle(canon, cycleForWeek(run.week)),
    };
  }, [pendingScene, occupancy, run, sceneNo, t, task, taskState.done, settings.lang, canon]);

  const setup = useMemo(
    () =>
      scene
        ? {
            cards,
            lineup,
            identity,
            player,
            lang: settings.lang,
            memory,
            relations,
            scene,
          }
        : null,
    [scene, cards, lineup, identity, player, settings.lang, memory, relations],
  );

  const onSceneEnd = (result) => {
    setMemory(result.memory);
    setRelations(result.relations);
    /**
     * An event fires once, and it is marked on the way OUT rather than on the
     * way in. Marking it on entry would delete the day out from under a player
     * who backed out of the gift modal.
     */
    if (pendingScene?.eventKey) {
      setFiredEvents((f) => (f.includes(pendingScene.eventKey) ? f : [...f, pendingScene.eventKey]));
    }
    /**
     * What the room settled, appended with the cycle it happened in.
     *
     * Already validated against the event's agenda by `endScene` - a topic
     * that was not on it never gets here. Appended rather than merged: cycle
     * 2's title track does not delete cycle 1's, because the handbook should be
     * able to show a campaign that changed its mind. Superseding happens at
     * injection time (`canonForCycle`).
     */
    if (result.decisions?.length && pendingScene?.event) {
      setCanon((c) =>
        addDecisions(c, result.decisions, {
          cycle: cycleForWeek(run.week),
          phase: run.phase,
          slot: pendingScene.event.slot,
        }),
      );
    }
    setOutcome({ ...result, date: scene?.date ?? null, event: scene?.event ?? null });
    setSceneNo((n) => n + 1);
    setPendingScene(null);
    setScreen('after');
  };

  /**
   * The knowledge economy, handed to the scene rather than gating entry to it.
   *
   * App still owns every number - credits, the dish counter, which gestures
   * have been spent, the intimacy the opener is worth - and `VNStage` owns only
   * when the player reaches for one. Both spend functions return the scene note
   * on success and `null` on refusal, so the scene never has to know why an
   * opener did not go through; it simply does not spend the turn.
   *
   * The intimacy lands here and not at scene exit on purpose. `computeDeltas`
   * pays for what the SCENE did to her, and an opener is paid for by what the
   * player knew and spent - two different currencies, and adding the gift to
   * the scene's own delta would make a bought reaction indistinguishable from
   * an earned one.
   */
  const openers = useMemo(() => {
    const pay = (memberId, delta) =>
      setRelations((rs) => ({
        ...rs,
        [memberId]: applySceneOutcome(rs[memberId], { intimacy: delta, good: true }),
      }));

    return {
      credits: player.credits,
      stock: { dishes: player.dishes ?? 0 },
      usedGestures,
      dossierFor: (id) => memory.dossier[id],

      give: (giftId, card) => {
        const bought = purchase(giftId, memory.dossier[card.id], player.credits, card.name, {
          dishes: player.dishes ?? 0,
        });
        if (!bought) return null;

        setPlayer((p) => ({
          ...p,
          credits: bought.credits,
          ...(bought.spentStock
            ? { [bought.spentStock]: Math.max(0, (p[bought.spentStock] ?? 0) - 1) }
            : {}),
        }));
        pay(card.id, bought.intimacyDelta);
        return bought.sceneNote;
      },

      say: (giftId, card) => {
        const said = spendGesture(giftId, memory.dossier[card.id], usedGestures, card.name);
        if (!said) return null;

        setUsedGestures(said.usedGestures);
        pay(card.id, said.intimacyDelta);
        return said.sceneNote;
      },
    };
  }, [player.credits, player.dishes, usedGestures, memory.dossier]);

  /**
   * The one moment the run's fixed inputs are set.
   *
   * `player.name` goes into block 1, which is byte-stable for the whole run, so
   * it cannot be edited afterwards without invalidating the prefix for every
   * remaining scene. Collecting it here and nowhere else is what keeps that
   * true (section 8, invariant 1).
   */
  /**
   * The run, exactly as `save.js` wants it.
   *
   * An explicit projection on both sides, so that adding UI state to this
   * component cannot start persisting it by accident and reading either
   * function tells you what a save is.
   */
  const snapshot = () => ({
    run,
    player,
    cast: castIds,
    relations,
    memory,
    canon,
    calendar: { taskState },
    flags: { firedEvents, usedGestures, foundRumors },
    lang: settings.lang,
    model: settings.model,
  });

  /**
   * The game saves itself at day rollover, and nowhere else.
   *
   * Not a button, because there is nothing for the player to decide: one slot,
   * one run, and a save screen would be a decision about bookkeeping in a game
   * that has no other bookkeeping. Not every block either - the day boundary is
   * the natural unit and it is also, not coincidentally, the only moment
   * section 15 permits: a scene is ephemeral, so a save taken mid-scene would
   * be a save taken at the room door.
   *
   * Keyed on the day, deliberately, rather than on everything it writes. The
   * point is one save per day, not one per state change.
   */
  useEffect(() => {
    if (screen !== 'day' || !player.name) return;
    saveTo(AUTO_SLOT, snapshot());
    setSlots(listSlots());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.day, run.week, screen]);

  /**
   * Pick a run back up.
   *
   * Straight to the day screen, never to a scene: section 15 excludes `scene`
   * from a save because a scene is ephemeral, so the only place a run can be
   * resumed is at the top of a block.
   */
  const onContinue = (slotId = AUTO_SLOT) => {
    const loaded = loadFrom(slotId, {
      run: newRun({ seed: SEED }),
      player: { name: '', dishes: 0, ...identity.startStats },
      cast: castIds,
      relations: Object.fromEntries(cards.map((c) => [c.id, newRelation(c.startIntimacy ?? 5)])),
      memory: newMemory(castIds),
    });
    if (!loaded) return;

    setRun(loaded.run);
    setPlayer(loaded.player);
    setRelations(loaded.relations);
    setMemory(loaded.memory);
    setTaskState(loaded.calendar.taskState ?? newTaskState());
    setCanon(loaded.canon ?? []);
    setFiredEvents(loaded.flags.firedEvents);
    setUsedGestures(loaded.flags.usedGestures);
    setFoundRumors(loaded.flags.foundRumors);
    setShowSaves(false);
    setScreen('day');
  };

  /**
   * Write the current day into a slot the player picked.
   *
   * Only reachable from the day screen, which is the only moment the schema
   * permits: section 15 excludes `scene` from a save, so a save taken mid-scene
   * would be a save taken at the room door.
   */
  const onSaveTo = (slotId) => {
    const ok = saveTo(slotId, snapshot());
    setSlots(listSlots());
    if (ok) setShowSaves(false);
    return ok;
  };

  const onDeleteSlot = (slotId) => {
    const ok = deleteSlot(slotId);
    setSlots(listSlots());
    return ok;
  };

  const openSaves = () => {
    setSlots(listSlots());
    setShowSaves(true);
  };

  /**
   * Wipe the run and go back to the cover.
   *
   * Everything derived - the week plan, occupancy, the day's task - recomputes
   * from `run`, so only the state that is genuinely held needs clearing. The
   * settings and the API key are device-level and deliberately survive.
   */
  const restart = () => {
    setRun(newRun({ seed: SEED }));
    setRelations(Object.fromEntries(cards.map((c) => [c.id, newRelation(c.startIntimacy ?? 5)])));
    setMemory(newMemory(castIds));
    setTaskState(newTaskState());
    setFiredEvents([]);
    setCanon([]);
    setUsedGestures([]);
    setFoundRumors([]);
    setPendingScene(null);
    setOutcome(null);
    setSolo(null);
    setAskedToday(null);
    setRefusal(null);
    setPlayer({ name: '', dishes: 0, ...identity.startStats });
    /**
     * The autosave belongs to the run that wrote it; the player's five slots do
     * not. Wiping everything - which is what the single-slot build did, because
     * there was nothing else to wipe - would mean starting a new run silently
     * destroys five campaigns somebody deliberately kept.
     */
    clearAuto();
    setSlots(listSlots());
    setScreen('start');
  };

  const onBegin = ({ name, identityId: chosen }) => {
    const picked = getIdentity(chosen);
    setIdentityId(picked.id);
    setPlayer({ name, dishes: 0, ...picked.startStats });
    setScreen('day');
  };

  return (
    <>
      {screen === 'start' ? (
        <Start
          cards={cards}
          lineup={lineup}
          saved={slots.find((s) => s.id === AUTO_SLOT && !s.empty) ?? null}
          hasSaves={hasAnySave()}
          onContinue={() => onContinue(AUTO_SLOT)}
          onOpenSaves={openSaves}
          onBegin={onBegin}
          onOpenSettings={() => setShowSettings(true)}
          t={t}
        />
      ) : null}

      {screen === 'endings' ? (
        <Endings
          cards={cards}
          relations={relations}
          /**
           * Back to the cover, not to a fresh run.
           *
           * A new campaign needs a name and an identity, and both are set once
           * and never edited because `player.name` reaches the byte-stable
           * block. Restarting into the day screen would carry the old ones
           * silently.
           */
          onRestart={restart}
          t={t}
        />
      ) : null}

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
          identity={identity}
          event={todayEvent}
          onEnter={onEnter}
          onEnterSolo={onEnterSolo}
          onSkipBlock={() => advance()}
          onOpenSettings={() => setShowSettings(true)}
          onOpenSaves={openSaves}
          onOpenHandbook={() => setShowHandbook(true)}
          onOpenRelations={() => setShowRelations(true)}
          canAskOut={canAskOut}
          onAskOut={() => {
            setRefusal(null);
            setShowDates(true);
          }}
          t={t}
        />
      ) : null}

      {showDates ? (
        <DateModal
          offers={offers}
          cards={cards}
          refusal={refusal}
          onAsk={onAskOut}
          onClose={() => {
            setShowDates(false);
            setRefusal(null);
          }}
          t={t}
        />
      ) : null}

      {solo ? (
        <SoloAction
          locationId={solo.locationId}
          task={task && !taskState.done && task.location === solo.locationId ? task : null}
          result={solo.result}
          present={solo.present ?? []}
          cards={cards}
          dossier={memory.dossier}
          foundRumors={foundRumors}
          onTalk={(memberId) => {
            const room = (solo.present ?? []).map((id) => ({ id }));
            setSolo(null);
            onEnter(solo.locationId, room, memberId);
          }}
          onJoin={() => {
            const room = (solo.present ?? []).map((id) => ({ id }));
            setSolo(null);
            onEnter(solo.locationId, room, null, { group: true });
          }}
          onShared={onShared}
          onChoose={onChooseSolo}
          // Back to the map. Nothing has been spent yet, so it costs nothing.
          onLeave={() => setSolo(null)}
          onDone={() => {
            setSolo(null);
            advance();
          }}
          lang={settings.lang}
          t={t}
        />
      ) : null}

      {screen === 'scene' && setup ? (
        <VNStage
          key={sceneNo}
          setup={setup}
          client={client}
          openers={openers}
          onSceneEnd={onSceneEnd}
          writtenChips={settings.writtenChips}
          /**
           * One place decides the shape of every conversation in the game -
           * ordinary block, date, shared dorm evening, anchor event. Both of
           * its answers come from the same number, so they belong together
           * rather than being decided here and in `sceneEngine` separately.
           */
          turnLimit={
            dialogueShape({
              rosterIds: scene?.rosterIds ?? [],
              kind: scene?.date ? 'date' : scene?.event ? 'event' : 'ordinary',
            }).turnLimit
          }
          offline={offline}
          t={t}
        />
      ) : null}

      {screen === 'after' && outcome ? (
        <Aftermath
          outcome={outcome}
          cards={cards}
          relations={relations}
          memory={memory}
          /**
           * A date, and an anchor event, eat the day.
           *
           * That is what makes it depth and a free weekend breadth - the
           * multi-route tension of section 5b expressed as a decision the
           * player makes every week. Advancing block by block is how the rest
           * of the day gets consumed, so nothing else has to know about dates.
           */
          onContinue={() =>
            advance({
              extraEnergy: 1,
              blocks:
                outcome?.date || outcome?.event
                  ? BLOCKS.length - BLOCKS.indexOf(run.block)
                  : 1,
            })
          }
          t={t}
        />
      ) : null}

      {showHandbook ? (
        <HandbookModal canon={canon} onClose={() => setShowHandbook(false)} t={t} />
      ) : null}

      {/*
        Where you stand, explained. Free, like the handbook, and for the same
        reason: a room action reads as costing a block, and reading what you
        already half-know must not (PROPOSALS 25).
      */}
      {showRelations ? (
        <RelationsModal
          cards={cards}
          relations={relations}
          onClose={() => setShowRelations(false)}
          t={t}
        />
      ) : null}

      {showSaves ? (
        <SaveModal
          slots={slots}
          cards={cards}
          /**
           * No `onSave` on the cover: there is no run to write yet, so the list
           * is read-only there and offers only load and delete.
           */
          onSave={screen === 'day' ? onSaveTo : null}
          onLoad={onContinue}
          onDelete={onDeleteSlot}
          onClose={() => setShowSaves(false)}
          lang={settings.lang}
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
  const { delta, rumors, noticed = [] } = outcome;

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

      {/*
        Who was standing there. Section 5b: presence writes NO dossier entry,
        so it produces no rumor - and the aftermath rendered only rumors, which
        meant a 1v1 in an occupied room ended completely silent while three
        people's jealousy moved. What she knows and what the player is told are
        different questions.
      */}
      {noticed.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {noticed.map((n, i) => (
            <li key={i} className="font-body text-[0.8125rem] italic text-faint">
              {t('rumorLine.present')
                .replace('{name}', cards.find((c) => c.id === n.memberId)?.name ?? '')
                .replace('{subject}', n.subjectName ?? '')}
            </li>
          ))}
        </ul>
      ) : null}

      {rumors.length > 0 ? (
        <section>
          <h3 className="mb-1 font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-warn">
            {t('exposureBand.public')}
          </h3>
          <ul className="flex flex-col gap-1">
            {/*
              Rendered from the rumor's SHAPE, never from `r.text`.

              `r.text` is the dossier line and it is English on purpose -
              section 19 keeps memory language-agnostic so the player can switch
              language mid-run without corrupting history. Printing it put
              English sentences into a Chinese run.
            */}
            {rumors.map((r, i) => (
              <li key={i} className="font-body text-[0.875rem] italic text-dim">
                {t(`rumorLine.${r.kind ?? 'heard'}`)
                  .replace('{name}', cards.find((c) => c.id === r.memberId)?.name ?? '')
                  .replace('{subject}', r.subjectName ?? '')
                  .replace('{where}', r.locationId ? t(`location.${r.locationId}`) : '')}
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

      {/*
        The player reads `display`, never the ledger line.

        The ledger is memory, and section 19 rule 2 keeps memory in English so
        the player can switch language mid-run without corrupting history. The
        summarizer now returns both: `summary` for the ledger and `display` in
        the language of the run. Falling back to the ledger shows the wrong
        language rather than nothing, which is the right way round.
      */}
      {outcome.summary?.display || memory.ledger.length > 0 ? (
        <p className="font-body text-[0.875rem] italic text-dim">
          {outcome.summary?.display || memory.ledger.at(-1)?.text}
        </p>
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
