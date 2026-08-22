/**
 * Stance chips. CLAUDE.md section 6.
 *
 * Three per turn, generated client-side from templates filtered by stage,
 * strain band and jealousy band. Zero LLM cost, instant render, and they cover
 * the latency of the previous stream - which is the real reason they exist.
 *
 * Chips are VERBS. The player picks a stance; the model writes the line.
 */

import { strainBand } from './relationship.js';
import { jealousyBand, sceneModifiers } from './jealousy.js';
import { makeRng, deriveSeed } from './rng.js';
import { RISK_EXPOSURE_THRESHOLD } from '../config/constants.js';

export const STANCES = [
  'tease',
  'reassure',
  'deflect',
  'press',
  'confide',
  'touch',
  'retreat',
  'joke',
  'apologize',
  'invite',
];

/** Always available - a player must never be left without a move. */
const SAFE_STANCES = ['deflect', 'joke', 'retreat'];

/** Minimum intimacy before a stance is even offered. */
const INTIMACY_GATE = { touch: 50, confide: 30, invite: 20 };

/** Stances that read as pushing, and are withdrawn once things are damaged. */
const AGGRESSIVE = ['press', 'touch', 'confide'];

/** Low energy narrows the palette rather than blocking play. */
export const LOW_ENERGY = 25;

/**
 * Which stances are legal right now, and why the others are not.
 * Returning the reasons lets the UI grey a chip with an explanation instead of
 * silently hiding it, which is the difference between a rule and a mystery.
 */
export function availableStances(rel, { energy = 100 } = {}) {
  const band = strainBand(rel.strain);
  const jband = jealousyBand(rel.jealousy);
  const { lockedStances } = sceneModifiers(rel);

  const locked = {};
  for (const stance of STANCES) {
    if (band === 'rift' || band === 'critical') {
      if (AGGRESSIVE.includes(stance)) {
        locked[stance] = 'rift';
        continue;
      }
    }
    if (lockedStances.includes(stance)) {
      locked[stance] = `jealousy:${jband}`;
      continue;
    }
    const gate = INTIMACY_GATE[stance];
    if (gate != null && rel.intimacy < gate) {
      locked[stance] = `intimacy<${gate}`;
      continue;
    }
    if (energy < LOW_ENERGY && !SAFE_STANCES.includes(stance)) {
      locked[stance] = 'energy';
    }
  }

  return {
    available: STANCES.filter((s) => !locked[s]),
    locked,
  };
}

/**
 * The overt moves - the ones somebody watching could put a name to.
 *
 * CLAUDE.md section 5 says admissibility rises from "surviving deliberate risk
 * at high Exposure", and section 6 prices it: risk at exposure >= 60 pays
 * `admissibility += 3..6` on a survival and `strain += 10..20` on a failure.
 * Nothing ever set the flag, so `riskTaken` was false in every scene ever
 * played, admissibility never left 0, and every route plateaued at
 * `confidante` - which made all four good endings and the balance ending
 * unreachable in the shipped game. A headless campaign found it; no unit test
 * could, because each half was correct on its own.
 *
 * These three and not the others: reaching for her, asking her somewhere, and
 * saying the unsayable where you can be overheard are the gestures that a
 * witness could describe. `tease` and `press` are loud but deniable, and
 * deniable is exactly what does not move admissibility.
 */
export const RISK_STANCES = ['touch', 'invite', 'confide'];

/**
 * Is this stance a bet, here?
 *
 * The player is not told in so many words - the exposure meter is on screen and
 * reading it is the game. But the chip carries a marker, because a bet nobody
 * knew they were placing is not a bet.
 */
export function isRiskStance(stance, exposure) {
  return RISK_STANCES.includes(stance) && exposure >= RISK_EXPOSURE_THRESHOLD;
}

/**
 * Which stances the situation is actively asking for. These get offered first,
 * because the game is only legible if the right move is reachable.
 */
export function suggestedStances(rel) {
  const out = [];
  if (jealousyBand(rel.jealousy) === 'piqued') out.push('reassure', 'confide');
  if (strainBand(rel.strain) === 'rift') out.push('apologize', 'retreat');
  if (rel.stage === 'reckless') out.push('retreat', 'reassure');
  if (rel.stage === 'confidante') out.push('press', 'invite');
  return out;
}

/**
 * Three chips for this turn.
 *
 * Deterministic given a seed and turn index so a re-render does not reshuffle
 * the player's options mid-decision.
 */
export function generateChips(rel, { energy = 100, seed = 1, turn = 0, count = 3 } = {}) {
  const { available } = availableStances(rel, { energy });
  if (available.length === 0) return [...SAFE_STANCES].slice(0, count);

  const suggested = suggestedStances(rel).filter((s) => available.includes(s));
  const chosen = [];

  for (const s of suggested) {
    if (chosen.length >= count) break;
    if (!chosen.includes(s)) chosen.push(s);
  }

  const rng = makeRng(deriveSeed(seed, `chips:${rel.stage}:${turn}`));
  const rest = available.filter((s) => !chosen.includes(s)).sort(() => rng() - 0.5);
  for (const s of rest) {
    if (chosen.length >= count) break;
    chosen.push(s);
  }

  return chosen.slice(0, count);
}
