/**
 * A whole campaign, through the real engine, with no UI and no network.
 *
 * This is NOT balanceSim. `systems/balanceSim.js` models a scene as a number
 * and knows nothing about openers, snooping, the calendar, energy or the
 * prompt pipeline - which is why its numbers went stale the moment the opener
 * economy grew. This harness plays the actual loop: occupancy from the
 * calendar, a block spent either on her or on solo work, `beginScene` ->
 * `runTurn` -> `endScene` against the offline writer, rumors, jealousy, day
 * rollover, the lot.
 *
 * It exists to catch the class of bug that only appears over 189 blocks:
 * a resource that can never run out, a fact pool that empties, an opener that
 * is never reachable, a dossier slot that thrashes. Those are invisible in a
 * unit test and expensive to find by playing.
 *
 * Set HARNESS_REPORT=1 to print the run.
 */

import { describe, it, expect } from 'vitest';
import { beginScene, runTurn, endScene, openingDirective, openWithGift } from './sceneEngine.js';
import { newMemory, addDossierEntry, appendLedger } from './memory.js';
import { createMockClient } from '../tools/mockClient.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import {
  newRelation,
  applySceneOutcome,
  resolveEnding,
  isBalanceEnding,
  GOOD_ENDINGS,
} from '../systems/relationship.js';
import { generateWeek, occupancyAt } from '../systems/calendar.js';
import { advanceBlock, newRun, spendBlockEnergy, restOvernight } from '../systems/clock.js';
import { generateDayTask, completeTask, failTask, newTaskState, applyPlayerDeltas } from '../systems/tasks.js';
import { resolveSoloAction, soloLedgerText, applySoloPlayerDelta } from '../systems/soloWork.js';
import { actionsFor } from '../data/soloActions.js';
import { LOCATIONS } from '../data/locations.js';
import { giftsFor, purchase, spendGesture } from '../systems/economy.js';
import { availableStances, isRiskStance } from '../systems/chips.js';
import { makeRng, deriveSeed, pick } from '../systems/rng.js';
import { BLOCKS, DAYS_PER_WEEK } from '../config/constants.js';
import { WEEKS_PER_CAMPAIGN } from '../systems/clock.js';

const IDENTITY = {
  id: 'assistant',
  promptRole: 'an artist assistant at the agency',
  taskPool: ['prep_outfits', 'run_schedule', 'handle_press_kit', 'stage_check', 'restock_wardrobe'],
  exposureModifier: { wardrobe: -10, cafe: 10 },
};

const REPORT = Boolean(process.env.HARNESS_REPORT);
// Straight to stdout rather than console.log: vitest buffers console output
// from a passing test, which is exactly the run whose numbers we want to read.
const log = (...a) => REPORT && process.stdout.write(a.join(' ') + '\n');

/**
 * Policies stand in for player skill, the same way balanceSim's do - but these
 * ones have to choose a LOCATION, which is the decision the pure simulator
 * never had to make.
 */
const weakest = (present, relations) =>
  [...present].sort((a, b) => relations[a].intimacy - relations[b].intimacy)[0];

const POLICIES = {
  /** Whoever is least intimate of the people actually reachable. */
  spread: { choose: weakest },

  /** One route, and skip the block if she is not there. */
  devoted: { choose: (present) => (present.includes('irene') ? 'irene' : null) },

  /** Convert jealousy first, otherwise build the weakest. */
  balanced: {
    choose: (present, relations) => {
      const piqued = present.filter((id) => relations[id].jealousy >= 25);
      if (piqued.length > 0) {
        return piqued.sort((a, b) => relations[b].jealousy - relations[a].jealousy)[0];
      }
      return weakest(present, relations);
    },
  },

  /**
   * The player who has understood the map.
   *
   * Goes where she can be SEEN, and makes the overt move when she gets there.
   * This is the policy that answers the question the `markRisk` fix raises:
   * is the second axis merely alive again, or actually climbable? A player who
   * only ever meets in the practice room should plateau at `confidante`; one
   * who spends the whole campaign betting in public should not.
   */
  bold: {
    choose: (present, relations) => {
      const piqued = present.filter((id) => relations[id].jealousy >= 25);
      if (piqued.length > 0) return piqued[0];
      return weakest(present, relations);
    },
    preferExposure: true,
    preferRisk: true,
  },

  /**
   * The player who has understood BOTH axes.
   *
   * Goes to whoever has stalled and spends the block making her nameable,
   * converts `piqued` jealousy before it hardens, and otherwise builds the
   * weakest route. This is the policy the balance ending is written for - if
   * even this one cannot get all five to `nameless` with jealousy under 50,
   * the balance ending is not hard, it is unreachable.
   */
  expert: {
    choose: (present, relations) => {
      const stalled = present.filter((id) => relations[id].stage === 'confidante');
      if (stalled.length > 0) {
        return stalled.sort((a, b) => relations[b].intimacy - relations[a].intimacy)[0];
      }
      const piqued = present.filter((id) => relations[id].jealousy >= 25);
      if (piqued.length > 0) {
        return piqued.sort((a, b) => relations[b].jealousy - relations[a].jealousy)[0];
      }
      return weakest(present, relations);
    },
    preferExposure: true,
    preferRisk: true,
  },
};

async function playCampaign({
  seed = 7,
  policy = 'balanced',
  turnsPerScene = 4,
  snoopRate = 0.25,
  weeks = WEEKS_PER_CAMPAIGN,
} = {}) {
  const cards = getCast();
  const castIds = cards.map((c) => c.id);
  const lineup = buildLineup(cards);
  const { choose, preferExposure = false, preferRisk = false } = POLICIES[policy];

  let run = newRun({ seed });
  let player = { name: 'You', energy: 90, secrecy: 70, credits: 6, competence: 20 };
  let relations = Object.fromEntries(cards.map((c) => [c.id, newRelation(c.startIntimacy ?? 5)]));
  let memory = newMemory(castIds);
  let taskState = newTaskState();
  let usedGestures = [];
  let foundRumors = [];
  let sceneNo = 0;

  const stats = {
    blocks: 0,
    scenes: 0,
    soloBlocks: 0,
    snoops: 0,
    snoopsThatTaughtNothing: 0,
    rumorsFound: 0,
    factsLearned: 0,
    factsBySubject: Object.fromEntries(castIds.map((id) => [id, 0])),
    scenesBySubject: Object.fromEntries(castIds.map((id) => [id, 0])),
    openersUsed: 0,
    gesturesUsed: 0,
    objectsBought: 0,
    openerOfferedButUnaffordable: 0,
    rumors: 0,
    tasksDone: 0,
    tasksFailed: 0,
    energyFloor: 100,
    creditsPeak: 0,
    creditsFloor: 99,
    secrecyFloor: 100,
    blockedByEnergy: 0,
    emptyBlocks: 0,
    scenesThatPaidNothing: 0,
    intimacyFromScenes: 0,
    risksTaken: 0,
    risksSurvived: 0,
    scenesInPublic: 0,
    guardDropTotal: 0,
    flusterPeakTotal: 0,
    intimacyAt: [],
  };

  const policyRng = makeRng(deriveSeed(seed, `policy:${policy}`));

  for (let n = 0; n < weeks * DAYS_PER_WEEK * BLOCKS.length; n += 1) {
    stats.blocks += 1;
    const weekPlan = generateWeek({ phase: run.phase, cards, seed, week: run.week });
    const occupancy = occupancyAt(weekPlan, {
      day: run.day,
      block: run.block,
      cards,
      seed,
      week: run.week,
    });
    const task = generateDayTask({
      identity: IDENTITY,
      day: run.day,
      week: run.week,
      phase: run.phase,
      seed,
    });

    // Where can the player go? A location is reachable if somebody is there,
    // or if it offers solo work.
    const byLocation = {};
    for (const [id, where] of Object.entries(occupancy)) {
      (byLocation[where.locationId] ??= []).push(id);
    }

    const reachable = Object.keys(byLocation);
    let targetId = null;
    let locationId = null;

    // Prefer a location holding somebody the policy wants.
    const ranked = reachable
      .map((loc) => ({ loc, who: choose(byLocation[loc], relations) }))
      .filter((x) => x.who);
    if (ranked.length > 0) {
      // Whichever member the policy wants, or - for a player reading the map
      // rather than the roster - whoever happens to be somewhere visible.
      const best = preferExposure
        ? ranked.sort(
            (a, b) => (LOCATIONS[b.loc]?.exposureBase ?? 0) - (LOCATIONS[a.loc]?.exposureBase ?? 0),
          )[0]
        : ranked.sort((a, b) => relations[a.who].intimacy - relations[b.who].intimacy)[0];
      targetId = best.who;
      locationId = best.loc;
    }

    let taskDone = taskState.done;

    /**
     * A block is not always hers, and that is the whole day structure. The task
     * has to be discharged or it costs strain at rollover, and the facts that
     * unlock openers only come out of a room with nobody in it - so a player
     * who spends every block on a member is playing badly, not optimally.
     */
    const lastBlockOfDay = run.block === BLOCKS[BLOCKS.length - 1];
    const owesTask = Boolean(task) && !taskDone;
    const doTask = owesTask && (lastBlockOfDay || policyRng() < 0.45);
    const doSnoop = !doTask && policyRng() < snoopRate;
    if (doTask || doSnoop) targetId = null;
    let extraEnergy = 0;
    let playerDelta = null;

    if (targetId && player.energy > 10) {
      // --- a scene ---------------------------------------------------------
      const dormWitnessIds = Object.entries(occupancy)
        .filter(([id, w]) => w.locationId === 'dorm_living' && id !== targetId)
        .map(([id]) => id);

      const scene = {
        id: `s${sceneNo}`,
        seed: seed + sceneNo,
        rosterIds: [targetId],
        focusId: targetId,
        week: run.week,
        day: run.day,
        block: run.block,
        phase: run.phase,
        locationId,
        locationLabel: locationId,
        dormWitnessIds,
      };

      const client = createMockClient({ seed: seed + sceneNo, delay: 0 });

      // The opener, exactly as GiftModal offers it.
      const offer = giftsFor(memory.dossier[targetId], player.credits, usedGestures);
      // `giftsFor` returns every opener carrying an `unlocked` flag, not a
      // filtered list - GiftModal does the filtering. A harness that forgets
      // that reports the economy as dead when it is only unreachable from here.
      const sayable = offer.gesture.filter((g) => g.unlocked && !g.used);
      const buyable = offer.knowledge.filter((g) => g.purchasable);

      let note = null;
      if (sayable.length > 0) {
        const g = pick(policyRng, sayable);
        const said = spendGesture(g.id, memory.dossier[targetId], usedGestures, targetId);
        if (said) {
          usedGestures = said.usedGestures;
          note = said.sceneNote;
          relations[targetId] = applySceneOutcome(relations[targetId], {
            intimacy: said.intimacyDelta,
            good: true,
          });
          stats.gesturesUsed += 1;
          stats.openersUsed += 1;
        }
      } else if (buyable.length > 0) {
        const g = pick(policyRng, buyable);
        const bought = purchase(g.id, memory.dossier[targetId], player.credits, targetId);
        if (bought) {
          player = { ...player, credits: bought.credits };
          note = bought.sceneNote;
          relations[targetId] = applySceneOutcome(relations[targetId], {
            intimacy: bought.intimacyDelta,
            good: true,
          });
          stats.objectsBought += 1;
          stats.openersUsed += 1;
        }
      } else if (KNOWLEDGE_REACHABLE(memory.dossier[targetId])) {
        // She has told the player something, and there is still no way to show
        // it. Every one of these is a fact that bought nothing.
        stats.openerOfferedButUnaffordable += 1;
      }

      let session = beginScene({
        cards,
        lineup,
        identity: IDENTITY,
        player,
        lang: 'en',
        memory,
        relations,
        scene,
      });
      if (note) session = openWithGift(session, note);

      session = await runTurn(session, { text: openingDirective(Boolean(note)), client });

      for (let t = 0; t < turnsPerScene; t += 1) {
        const { available } = availableStances(relations[targetId], { energy: player.energy });
        // A bold player takes the overt move whenever the room allows it; that
        // is the whole bet, and it is the only thing that moves admissibility.
        const overt = available.filter((s) => isRiskStance(s, session.exposure));
        const stance =
          preferRisk && overt.length > 0 ? pick(policyRng, overt) : pick(policyRng, available);
        session = await runTurn(session, { stance, text: '', client });
      }

      const result = await endScene(session, {
        client,
        memory,
        relations,
        cards,
        scene,
        rng: makeRng(deriveSeed(seed, `scene:${sceneNo}`)),
      });

      memory = result.memory;
      relations = result.relations;
      stats.rumors += result.rumors.length;
      stats.scenes += 1;

      /**
       * What did the scene actually pay?
       *
       * A scene that moves nothing is the worst thing this loop can produce -
       * the player spent a block and a turn of reading on it. Counting them is
       * the only way to tell "the numbers are tuned low" from "most scenes are
       * empty and a few are enormous".
       */
      if (result.delta.intimacy === 0) stats.scenesThatPaidNothing += 1;
      stats.intimacyFromScenes += result.delta.intimacy;
      if (session.meters.riskTaken) {
        stats.risksTaken += 1;
        if (result.delta.admissibility > 0) stats.risksSurvived += 1;
      }
      if (session.exposure >= 60) stats.scenesInPublic += 1;
      stats.guardDropTotal += session.meters.guardStart - session.meters.guard;
      stats.flusterPeakTotal += session.meters.flusterPeak;

      stats.scenesBySubject[targetId] += 1;
      sceneNo += 1;
      extraEnergy = 1;
    } else if (targetId === null && reachable.length === 0) {
      stats.emptyBlocks += 1;
    } else {
      // --- a block alone ---------------------------------------------------
      stats.soloBlocks += 1;
      if (player.energy <= 10) stats.blockedByEnergy += 1;

      // Where the task is, if it is due here; otherwise somewhere to snoop.
      const soloLoc =
        doTask && actionsFor(task.location).length > 0
          ? task.location
          : pick(policyRng, ['wardrobe', 'corridor', 'cafe', 'dorm_kitchen', 'practice_room']);

      if (doTask && soloLoc === task.location) {
        playerDelta = completeTask(task);
        taskDone = true;
        stats.tasksDone += 1;
      } else {
        const options = actionsFor(soloLoc);
        const snoop = options.find((a) => a.learns);
        const chosen = snoop ?? options[0];
        if (chosen) {
          const present = Object.entries(occupancy)
            .filter(([, w]) => w.locationId === soloLoc)
            .map(([id]) => id);
          const res = resolveSoloAction({
            locationId: soloLoc,
            actionId: chosen.id,
            cards,
            dossier: memory.dossier,
            present,
            foundRumors,
            rng: makeRng(deriveSeed(seed, `solo:${n}`)),
          });
          if (res) {
            player = applySoloPlayerDelta(player, res.playerDelta);
            if (chosen.learns) {
              stats.snoops += 1;
              if (!res.learned && !res.heard) stats.snoopsThatTaughtNothing += 1;
            }
            if (res.heard) {
              foundRumors = [...foundRumors, res.heard.text];
              stats.rumorsFound += 1;
            }
            if (res.learned) {
              stats.factsLearned += 1;
              stats.factsBySubject[res.learned.memberId] += 1;
              memory = {
                ...memory,
                dossier: addDossierEntry(
                  memory.dossier,
                  res.learned.memberId,
                  'known_facts',
                  res.learned.fact,
                ),
              };
            }
            const text = soloLedgerText(res, { locationLabel: soloLoc });
            memory = {
              ...memory,
              ledger: appendLedger(memory.ledger, {
                id: `w${run.week}d${run.day}${run.block}`,
                week: run.week,
                day: run.day,
                block: run.block,
                text,
                summary: text,
              }),
            };
          }
        }
      }
    }

    // --- advance, exactly as App.advance does ------------------------------
    const { run: next, rolledDay } = advanceBlock(run);
    let nextPlayer = playerDelta ? applyPlayerDeltas(player, playerDelta) : player;
    nextPlayer = spendBlockEnergy(nextPlayer, extraEnergy);

    if (rolledDay) {
      if (task && !taskDone) {
        const fail = failTask(task, castIds);
        nextPlayer = applyPlayerDeltas(nextPlayer, fail);
        stats.tasksFailed += 1;
        for (const [id, strain] of Object.entries(fail.strain)) {
          relations[id] = applySceneOutcome(relations[id], { strain });
        }
      }
      nextPlayer = restOvernight(nextPlayer);
      taskState = newTaskState();
      taskDone = false;
    } else {
      taskState = { ...taskState, done: taskDone };
    }

    player = nextPlayer;
    run = next;

    stats.energyFloor = Math.min(stats.energyFloor, player.energy);
    stats.creditsPeak = Math.max(stats.creditsPeak, player.credits);
    stats.creditsFloor = Math.min(stats.creditsFloor, player.credits);
    stats.secrecyFloor = Math.min(stats.secrecyFloor, player.secrecy);

    if (n % 21 === 0) {
      stats.intimacyAt.push({
        week: run.week,
        intimacy: Object.fromEntries(castIds.map((id) => [id, relations[id].intimacy])),
      });
    }
  }

  const endings = Object.fromEntries(castIds.map((id) => [id, resolveEnding(relations[id])]));
  return { stats, relations, memory, player, endings, balance: isBalanceEnding(relations), cards };
}

/** Does she have any fact at all that an opener could match? */
function KNOWLEDGE_REACHABLE(dossier) {
  return (dossier?.known_facts ?? []).length > 0;
}

function report(label, out) {
  const { stats, relations, player, endings } = out;
  log(`\n=== ${label} ===`);
  log(
    `blocks ${stats.blocks}  scenes ${stats.scenes}  solo ${stats.soloBlocks}  empty ${stats.emptyBlocks}`,
  );
  log(
    `snoops ${stats.snoops} (${stats.snoopsThatTaughtNothing} taught nothing)  facts ${stats.factsLearned}  rumors found ${stats.rumorsFound}`,
  );
  log(
    `openers ${stats.openersUsed} (${stats.objectsBought} bought, ${stats.gesturesUsed} said)  rumors ${stats.rumors}`,
  );
  log(`tasks ${stats.tasksDone} done / ${stats.tasksFailed} failed`);
  log(
    `scenes that paid nothing ${stats.scenesThatPaidNothing}/${stats.scenes}  ` +
      `intimacy from scenes ${stats.intimacyFromScenes} (${(
        stats.intimacyFromScenes / Math.max(1, stats.scenes)
      ).toFixed(2)}/scene)`,
  );
  log(
    `mean guard drop ${(stats.guardDropTotal / Math.max(1, stats.scenes)).toFixed(1)}  ` +
      `mean fluster peak ${(stats.flusterPeakTotal / Math.max(1, stats.scenes)).toFixed(1)}`,
  );
  log(
    `public scenes ${stats.scenesInPublic}  risks ${stats.risksTaken} (${stats.risksSurvived} paid off)  ` +
      `facts with nothing to spend them on ${stats.openerOfferedButUnaffordable}`,
  );
  log(
    `energy floor ${stats.energyFloor}  credits ${stats.creditsFloor}..${stats.creditsPeak} (end ${player.credits})  secrecy floor ${stats.secrecyFloor}  competence ${player.competence}`,
  );
  log('scenes per member: ' + JSON.stringify(stats.scenesBySubject));
  log('facts per member:  ' + JSON.stringify(stats.factsBySubject));
  for (const [id, rel] of Object.entries(relations)) {
    log(
      `  ${id.padEnd(7)} I${String(rel.intimacy).padStart(3)} A${String(rel.admissibility).padStart(3)} ` +
        `S${String(rel.strain).padStart(3)} J${String(rel.jealousy).padStart(3)} ` +
        `${rel.stage.padEnd(13)} -> ${endings[id]}`,
    );
  }
  log(`balance ending: ${out.balance}`);
  log('intimacy over time:');
  for (const row of stats.intimacyAt) {
    log(`  w${row.week} ` + Object.values(row.intimacy).map((v) => String(v).padStart(3)).join(' '));
  }
}

describe('a whole campaign through the real engine', () => {
  it(
    'plays 189 blocks without the loop breaking',
    async () => {
      const out = await playCampaign({ seed: 7, policy: 'balanced' });
      report('balanced, seed 7', out);

      expect(out.stats.blocks).toBe(WEEKS_PER_CAMPAIGN * DAYS_PER_WEEK * BLOCKS.length);
      expect(out.stats.scenes).toBeGreaterThan(30);
      // Every block must do something. A block that is neither a scene nor
      // solo work is a block the player stared at an empty map.
      expect(out.stats.emptyBlocks).toBe(0);
    },
    120000,
  );

  it(
    'lets the knowledge economy actually turn over',
    async () => {
      const out = await playCampaign({ seed: 11, policy: 'spread' });
      report('spread, seed 11', out);

      // Facts have to reach the player, and openers have to be spendable.
      expect(out.stats.factsLearned).toBeGreaterThan(8);
      expect(out.stats.openersUsed).toBeGreaterThan(5);
    },
    120000,
  );

  /**
   * The second axis has to be CLIMBABLE, not merely non-zero.
   *
   * Playing entirely in private should plateau - that is the `confidante`
   * hazard doing its job. Playing in public should not. If both policies land
   * in the same place the exposure trade-off in section 5b is decoration, and
   * the whole map is a menu.
   */
  it(
    'rewards playing in public and plateaus a player who never does',
    async () => {
      const shy = await playCampaign({ seed: 21, policy: 'balanced' });
      const bold = await playCampaign({ seed: 21, policy: 'bold' });
      report('balanced, seed 21', shy);
      report('bold, seed 21', bold);

      const meanA = (o) =>
        Object.values(o.relations).reduce((s, r) => s + r.admissibility, 0) /
        Object.keys(o.relations).length;

      expect(meanA(bold)).toBeGreaterThan(meanA(shy));
      // and the bet has to be real in both directions
      expect(bold.stats.risksTaken).toBeGreaterThan(shy.stats.risksTaken);
    },
    180000,
  );
});

/**
 * The distribution, across every policy and several seeds.
 *
 * Opt-in (HARNESS_SWEEP=1) because it is a minute of wall clock and its output
 * is a reading, not a pass/fail. This is the replacement for the balanceSim
 * table in CLAUDE.md section 5b, which was measured against a model of a scene
 * rather than a scene.
 */
describe.skipIf(!process.env.HARNESS_SWEEP)('policy sweep', () => {
  it(
    'reports what each kind of player gets',
    async () => {
      const seeds = [3, 7, 11, 21, 42];
      const table = {};

      for (const policy of Object.keys(POLICIES)) {
        const tally = {};
        let balance = 0;
        let good = 0;
        let total = 0;

        for (const seed of seeds) {
          const out = await playCampaign({ seed, policy });
          if (out.balance) balance += 1;
          for (const ending of Object.values(out.endings)) {
            tally[ending] = (tally[ending] ?? 0) + 1;
            if (GOOD_ENDINGS.has(ending)) good += 1;
            total += 1;
          }
        }
        table[policy] = { tally, balance, goodPct: ((good / total) * 100).toFixed(0) };
      }

      log('\n=== policy sweep, 5 seeds x 5 members ===');
      for (const [policy, row] of Object.entries(table)) {
        log(
          `${policy.padEnd(9)} good ${String(row.goodPct).padStart(3)}%  balance ${row.balance}/${seeds.length}  ` +
            Object.entries(row.tally)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => `${k}:${v}`)
              .join(' '),
        );
      }

      expect(Object.keys(table)).toHaveLength(Object.keys(POLICIES).length);
    },
    600000,
  );
});

/**
 * Is the balance ending reachable at all?
 *
 * Section 5b calls it "the hardest ending in the game, not the default one",
 * and the sweep above returns 0 for every policy - but five seeds cannot tell
 * "very rare" from "impossible", and those are completely different bugs.
 * Opt-in (HARNESS_BALANCE=1) because it is several minutes of wall clock.
 */
describe.skipIf(!process.env.HARNESS_BALANCE)('balance ending reachability', () => {
  it(
    'says how often the best policies get all five',
    async () => {
      const seeds = Array.from({ length: 20 }, (_, i) => 100 + i * 7);

      for (const policy of ['balanced', 'expert']) {
        let balance = 0;
        let allGood = 0;
        const shortfall = {};

        for (const seed of seeds) {
          const out = await playCampaign({ seed, policy });
          if (out.balance) balance += 1;
          const endings = Object.values(out.endings);
          if (endings.every((e) => GOOD_ENDINGS.has(e))) allGood += 1;
          // What stopped it, when it was only one member short?
          const bad = Object.entries(out.endings).filter(([, e]) => !GOOD_ENDINGS.has(e));
          if (bad.length === 1) shortfall[bad[0][1]] = (shortfall[bad[0][1]] ?? 0) + 1;
        }

        log(
          `${policy.padEnd(9)} balance ${balance}/${seeds.length}  all-good ${allGood}/${seeds.length}  ` +
            `one member short: ${JSON.stringify(shortfall)}`,
        );
      }

      expect(seeds).toHaveLength(20);
    },
    900000,
  );
});

export { playCampaign, report };
