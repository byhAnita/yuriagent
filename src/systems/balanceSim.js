/**
 * Headless balance harness. CLAUDE.md section 5b. Dev only, never shipped.
 *
 * Five interacting tracks cannot be tuned on paper. This runs whole
 * playthroughs with no UI and no LLM and reports the distribution of endings,
 * so the exclusivity coefficients can be moved against evidence instead of
 * intuition.
 *
 * Target: the balance ending - all five at `unspoken` or above with jealousy
 * held under 50 - is reachable in well under 10% of competent runs.
 *
 * The scene model below is a DELIBERATE STAND-IN for the LLM turn loop. It is
 * not trying to be a good model of conversation; it is trying to be an unbiased
 * driver of the same state transitions the real loop will produce, so that the
 * coefficients it tunes remain meaningful once the model is wired in.
 */

import { newRelation, applySceneOutcome, resolveEnding, isBalanceEnding } from './relationship.js';
import { jealousyBand, addJealousy, decay, convert, unaddressedStrain } from './jealousy.js';
import { sceneExposure } from './exposure.js';
import { propagate } from './rumor.js';
import { generateWeek, occupancyAt } from './calendar.js';
import {
  RISK_EXPOSURE_THRESHOLD,
  BLOCKS,
  DAYS_PER_WEEK,
  PHASES,
  CYCLES_PER_CAMPAIGN,
} from '../config/constants.js';
import { makeRng, deriveSeed } from './rng.js';

/**
 * How a player spends their blocks. Each returns the member id to visit.
 *
 * `balanced` is the competent multi-route player: convert anyone who is piqued
 * before she hardens, otherwise feed whoever is furthest behind. If the balance
 * ending is reachable at all, this is the policy that finds it.
 */
export const POLICIES = {
  devoted: (cast, relations) =>
    cast.reduce((best, c) => (relations[c.id].intimacy > relations[best.id].intimacy ? c : best))
      .id,

  spread: (cast, relations, { blockIndex }) => cast[blockIndex % cast.length].id,

  balanced: (cast, relations) => {
    const piqued = cast.filter((c) => jealousyBand(relations[c.id].jealousy) === 'piqued');
    if (piqued.length > 0) {
      return piqued.reduce((worst, c) =>
        relations[c.id].jealousy > relations[worst.id].jealousy ? c : worst,
      ).id;
    }
    const hot = cast.filter((c) => relations[c.id].jealousy >= 50);
    const pool = hot.length > 0 ? hot : cast;
    return pool.reduce((low, c) => (relations[c.id].intimacy < relations[low.id].intimacy ? c : low))
      .id;
  },

  random: (cast, relations, { rng }) => cast[Math.floor(rng() * cast.length)].id,
};

/**
 * One scene, without a model.
 *
 * Guard falls further when she is already close and less when jealousy has her
 * defended; a deliberate risk is only taken where it could cost something, and
 * it succeeds more often when there is something real underneath it.
 */
function simulateScene({ rel, exposure, rng, takeRisks }) {
  const jband = jealousyBand(rel.jealousy);
  const guardPenalty = jband === 'sharp' || jband === 'corrosive' ? 0.35 : 0;

  const quality = rng() * (1 - guardPenalty) + (rel.intimacy / 100) * 0.25;
  const delta = { good: quality > 0.45 };

  if (quality > 0.65) delta.intimacy = 2 + Math.floor(rng() * 3);
  else if (quality > 0.45) delta.intimacy = 1 + Math.floor(rng() * 2);
  else delta.intimacy = 0;

  // Admissibility only moves where being seen is actually possible.
  if (takeRisks && exposure >= RISK_EXPOSURE_THRESHOLD) {
    const survives = rng() < 0.35 + (rel.intimacy / 100) * 0.4;
    if (survives) delta.admissibility = 3 + Math.floor(rng() * 4);
    else delta.strain = 10 + Math.floor(rng() * 11);
  }

  if (rel.stage === 'reckless') delta.strain = (delta.strain ?? 0) + 5;
  delta.strain = (delta.strain ?? 0) + unaddressedStrain(rel);

  return delta;
}

/** A full campaign: CYCLES_PER_CAMPAIGN repetitions of PREP / COMEBACK / REST. */
export function runPlaythrough({
  cards,
  seed,
  policy = 'balanced',
  takeRisks = true,
  cycles = CYCLES_PER_CAMPAIGN,
}) {
  const cast = cards;
  const relations = Object.fromEntries(
    cast.map((c) => [c.id, newRelation(c.startIntimacy ?? 5)]),
  );
  const rng = makeRng(deriveSeed(seed, `run:${policy}`));
  const choose = POLICIES[policy] ?? POLICIES.balanced;

  let blockIndex = 0;

  const totalWeeks = PHASES.length * cycles;

  for (let week = 0; week < totalWeeks; week++) {
    const phase = PHASES[week % PHASES.length];
    const weekPlan = generateWeek({ phase, cards: cast, seed, week });

    for (let day = 0; day < DAYS_PER_WEEK; day++) {
      for (const block of BLOCKS) {
        blockIndex++;

        const targetId = choose(cast, relations, { blockIndex, rng });
        const target = cast.find((c) => c.id === targetId);
        const occupancy = occupancyAt(weekPlan, { day, block, cards: cast, seed, week });
        const locationId = occupancy[targetId].locationId;

        const exposure = sceneExposure({ locationId, block, phase, secrecy: 70 });

        // The scene itself.
        const before = relations[targetId];
        const delta = simulateScene({ rel: before, exposure, rng, takeRisks });
        relations[targetId] = applySceneOutcome(before, delta);

        // Attention paid, or a chance converted.
        relations[targetId] =
          jealousyBand(relations[targetId].jealousy) === 'piqued'
            ? convert(relations[targetId])
            : decay(relations[targetId]);

        // Who else was in the room, and who else finds out.
        const presentIds = [targetId];
        for (const c of cast) {
          if (c.id !== targetId && occupancy[c.id].locationId === locationId) {
            presentIds.push(c.id);
            if (presentIds.length >= 2) break;
          }
        }

        const dormWitnessIds = cast
          .filter((c) => c.id !== targetId && occupancy[c.id].locationId === 'dorm_living')
          .map((c) => c.id);

        const { jealousyDeltas } = propagate({
          scene: {
            exposure,
            phase,
            locationId,
            locationLabel: locationId,
            presentIds,
            dormWitnessIds,
          },
          subject: { id: targetId, name: target.name },
          cast,
          relations,
          rng,
        });

        for (const [id, amount] of Object.entries(jealousyDeltas)) {
          relations[id] = addJealousy(relations[id], amount);
        }

        // Jealousy that nobody addressed turns into damage over time.
        for (const c of cast) {
          if (c.id === targetId) continue;
          const s = unaddressedStrain(relations[c.id]);
          if (s > 0) relations[c.id] = applySceneOutcome(relations[c.id], { strain: s });
        }

      }
    }
  }

  const endings = Object.fromEntries(
    cast.map((c) => [c.id, resolveEnding(relations[c.id])]),
  );

  return { relations, endings, balance: isBalanceEnding(relations) };
}

/**
 * Run N playthroughs and report the distribution.
 *
 * @returns {{ runs, balanceRate, endings, meanJealousy, meanIntimacy }}
 */
export function runBatch({ cards, runs = 500, policy = 'balanced', takeRisks = true, seed0 = 1 }) {
  const endings = {};
  let balanceCount = 0;
  let jealousySum = 0;
  let intimacySum = 0;
  let n = 0;

  for (let i = 0; i < runs; i++) {
    const result = runPlaythrough({ cards, seed: seed0 + i, policy, takeRisks });
    if (result.balance) balanceCount++;
    for (const e of Object.values(result.endings)) endings[e] = (endings[e] ?? 0) + 1;
    for (const rel of Object.values(result.relations)) {
      jealousySum += rel.jealousy;
      intimacySum += rel.intimacy;
      n++;
    }
  }

  return {
    runs,
    policy,
    balanceRate: balanceCount / runs,
    endings,
    meanJealousy: jealousySum / n,
    meanIntimacy: intimacySum / n,
  };
}

/** Human-readable report for the console harness. */
export function formatReport(report) {
  const lines = [
    `policy=${report.policy}  runs=${report.runs}`,
    `balance ending: ${(report.balanceRate * 100).toFixed(1)}%`,
    `mean intimacy: ${report.meanIntimacy.toFixed(1)}  mean jealousy: ${report.meanJealousy.toFixed(1)}`,
    'endings:',
  ];
  const total = Object.values(report.endings).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(report.endings).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${k.padEnd(18)} ${((v / total) * 100).toFixed(1)}%`);
  }
  return lines.join('\n');
}
