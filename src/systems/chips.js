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

/**
 * The verbs. CLAUDE.md section 6.
 *
 * ORDER IS NOT MEANING. It used to be, by accident - see `generateChips` - and
 * the whole vocabulary read as three options because of it.
 */
export const STANCES = [
  'flirt',
  'care',
  'casual',
  'deflect',
  'joke',
  'press',
  'confide',
  'touch',
  'retreat',
  'apologize',
  'invite',
];

/**
 * The everyday register: warm, light, obvious, or off the subject.
 *
 * Weighted up in `generateChips`, because most turns in a conversation are not
 * events. A vocabulary where pressing and apologising are as likely as saying
 * something light reads as a random verb generator.
 */
export const COMMON_STANCES = ['care', 'casual', 'flirt', 'deflect'];

/**
 * Always available - a player must never be left without a move.
 *
 * `care` and `casual` belong here and `care` is the one that matters: it is
 * safe in `rift`, which finally gives the strain bands a recovery move that is
 * not `apologize`. Apologising presumes fault, and most of the time nobody is
 * at fault and she just needs somebody to notice.
 */
const SAFE_STANCES = ['deflect', 'joke', 'retreat', 'casual', 'care'];

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
 * witness could describe. `flirt` and `press` are loud but deniable, and
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
  // `care` rather than `reassure`: noticing covers both "she is unsettled about
  // your attention" and "she is simply tired", and the second had no move at all.
  if (jealousyBand(rel.jealousy) === 'piqued') out.push('care', 'confide');
  if (strainBand(rel.strain) === 'rift') out.push('apologize', 'care');
  if (rel.stage === 'reckless') out.push('retreat', 'care');
  if (rel.stage === 'confidante') out.push('press', 'invite');
  return out;
}

/**
 * A real shuffle, seeded.
 *
 * The previous line was `.sort(() => rng() - 0.5)`, which is a shuffle in the
 * same way a coin is a random number generator: `Array.prototype.sort` with an
 * inconsistent comparator gives no uniformity guarantee, and on a short array
 * it barely permutes. So POSITION IN `STANCES` decided how often a stance was
 * offered - measured over 2400 sets, element 0 appeared in 41% of them and
 * element 9 in 23%.
 *
 * The player reported this as the vocabulary being wrong, which it partly was;
 * but they had also been shown the top of an array every turn for a whole
 * campaign and reasonably concluded the game had three verbs.
 */
function shuffled(rng, items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Three chips for this turn.
 *
 * Deterministic given a seed and turn index so a re-render does not reshuffle
 * the player's options mid-decision.
 *
 * Order of preference, and each step has a reason:
 *   1. what the situation is ASKING for  - the game is only legible if the
 *      right move is reachable
 *   2. the common register, weighted     - most turns are not events
 *   3. anything else still legal         - so the sharp moves stay reachable
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

  const rest = available.filter((s) => !chosen.includes(s));
  const common = shuffled(rng, rest.filter((s) => COMMON_STANCES.includes(s)));
  const sharp = shuffled(rng, rest.filter((s) => !COMMON_STANCES.includes(s)));

  /**
   * The common register takes most of the bar, but never all of it.
   *
   * ONE SLOT IS RESERVED for something outside it, and that reservation is
   * load-bearing rather than cosmetic: `touch`, `invite` and `confide` are the
   * only stances that can move admissibility (`RISK_STANCES` above), so a bar
   * filled entirely with warm everyday verbs is a bar on which the second axis
   * cannot move. That is precisely the shape of the `markRisk` bug - the whole
   * second half of the relationship model quietly unreachable - arriving by a
   * different door.
   *
   * So: fill to `count - 1` from the common four, leave the last slot to the
   * rest, and top up from whatever is left if either list runs dry.
   */
  for (const s of common) {
    if (chosen.length >= count - 1) break;
    chosen.push(s);
  }
  for (const s of sharp) {
    if (chosen.length >= count) break;
    chosen.push(s);
  }
  for (const s of [...common, ...sharp]) {
    if (chosen.length >= count) break;
    if (!chosen.includes(s)) chosen.push(s);
  }

  return chosen.slice(0, count);
}
