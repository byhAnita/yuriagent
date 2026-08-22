/**
 * The relationship model. CLAUDE.md section 5.
 *
 * Two axes plus a wound counter:
 *   intimacy      - how emotionally close
 *   admissibility - how nameable / showable it is
 *   strain        - accumulated damage; the only thing that produces a Bad End
 *
 * Bad Ends are exits from the map, not regions on it. Low/low is where every
 * run starts, so which ending fires is decided by the high-water marks at the
 * moment of collapse, not by the current coordinates.
 *
 * Pure. No React, no network, no Math.random.
 */

import {
  STAGE_A_MIN,
  RECKLESS_GAP,
  PLATEAU_SLACK,
  STRAIN_BANDS,
  STRAIN_DECAY_PER_GOOD_SCENE,
  CRITICAL_SCENES_TO_BAD_END,
  REPAIR_STRAIN_DROP,
} from '../config/constants.js';
import { clamp } from './rng.js';

export const STAGE_LADDER = [
  'stranger',
  'colleague',
  'good_friends',
  'nameless',
  'unspoken',
  'ours',
  'out',
];

export function newRelation(startIntimacy = 5) {
  return {
    intimacy: startIntimacy,
    admissibility: 0,
    strain: 0,
    jealousy: 0,
    peakIntimacy: startIntimacy,
    peakAdmissibility: 0,
    criticalScenes: 0,
    stage: resolveStage(startIntimacy, 0),
    endingLocked: null,
  };
}

/** Where on the map this relationship currently sits. */
export function resolveStage(intimacy, admissibility) {
  if (admissibility > intimacy + RECKLESS_GAP) return 'reckless';

  const tier =
    intimacy <= 15
      ? 'stranger'
      : intimacy <= 30
        ? 'colleague'
        : intimacy <= 50
          ? 'good_friends'
          : intimacy <= 70
            ? 'nameless'
            : intimacy <= 85
              ? 'unspoken'
              : admissibility >= STAGE_A_MIN.out
                ? 'out'
                : 'ours';

  if (admissibility < STAGE_A_MIN[tier] - PLATEAU_SLACK) return 'confidante';
  return tier;
}

export function strainBand(strain) {
  if (strain >= STRAIN_BANDS.critical) return 'critical';
  if (strain >= STRAIN_BANDS.rift) return 'rift';
  if (strain >= STRAIN_BANDS.tense) return 'tense';
  return 'stable';
}

/** True once this relationship has been somewhere worth losing. */
export function hasHistory(rel) {
  return rel.peakIntimacy >= 40;
}

/**
 * Bottom-left means Stranger on a fresh run and Aftermath on a collapsed one.
 * Same coordinates, different framing and a different chip set.
 */
export function isAftermath(rel) {
  return hasHistory(rel) && rel.intimacy < 30;
}

/**
 * Apply the accumulated result of one scene.
 *
 * `delta` is computed by the systems that watched the scene, never reported by
 * the model: { intimacy, admissibility, strain, good }.
 * `good` marks a scene that went well, which is what lets strain decay.
 */
export function applySceneOutcome(rel, delta = {}) {
  const next = { ...rel };

  /**
   * The plateau has to actually plateau.
   *
   * `confidante` is described as "intimacy outran admissibility and stalled"
   * in section 5 and as a plateau everywhere else, but nothing stalled: a
   * relationship on the plateau went on gaining intimacy scene after scene, so
   * a full campaign ended with all five members at intimacy 100, admissibility
   * near zero, and `confidante_end` for everybody. Not one good ending was
   * reachable by any policy, including one that took a public risk in every
   * scene it could - the headless campaign harness found this immediately and
   * no unit test could, because `resolveStage` was right and this function was
   * right and only the join between them was wrong.
   *
   * So: while she is on the plateau, getting closer is not on offer. Nothing
   * is taken away - admissibility still moves, strain still decays, the
   * openers still land as scenes - but the number that measures how close you
   * are stops until the thing that is holding it back is dealt with. That is
   * the game's own thesis in one line: privacy is safe, and stagnant.
   *
   * Walking ONTO the plateau is still allowed - the gain that takes her there
   * lands, and the stall starts on the next scene. A wall you can see yourself
   * hit reads as a rule; one that catches you mid-step reads as a bug.
   */
  const stalled = rel.stage === 'confidante';
  const intimacyGain = delta.intimacy ?? 0;

  next.intimacy = clamp(next.intimacy + (stalled && intimacyGain > 0 ? 0 : intimacyGain));
  next.admissibility = clamp(next.admissibility + (delta.admissibility ?? 0));
  next.strain = clamp(next.strain + (delta.strain ?? 0));

  if (delta.good && (delta.strain ?? 0) <= 0) {
    next.strain = clamp(next.strain - STRAIN_DECAY_PER_GOOD_SCENE);
  }

  next.peakIntimacy = Math.max(next.peakIntimacy, next.intimacy);
  next.peakAdmissibility = Math.max(next.peakAdmissibility, next.admissibility);
  next.stage = resolveStage(next.intimacy, next.admissibility);

  next.criticalScenes = strainBand(next.strain) === 'critical' ? next.criticalScenes + 1 : 0;

  if (next.endingLocked == null && next.criticalScenes >= CRITICAL_SCENES_TO_BAD_END) {
    next.endingLocked = resolveBadEnd(next);
  }

  return next;
}

/** Repair event: available once per cycle per character while in `rift`. */
export function applyRepair(rel) {
  if (strainBand(rel.strain) !== 'rift') return rel;
  return { ...rel, strain: clamp(rel.strain - REPAIR_STRAIN_DROP), criticalScenes: 0 };
}

/**
 * Which collapse this is. Decided by where it fell FROM.
 * Returns null when there was never enough there to break.
 */
export function resolveBadEnd(rel) {
  if (rel.peakIntimacy < 40) return null;
  if (rel.stage === 'reckless') return 'severance_end';
  if (rel.peakAdmissibility >= 60) return 'exposure_end';
  if (rel.peakIntimacy >= 70 && rel.admissibility < 30) return 'nameless_end';
  return 'severance_end';
}

/**
 * The ending for one character at campaign end. Endings resolve per character:
 * a run can finish with one `ours`, one `nameless_end` and three `drift_end`.
 */
export function resolveEnding(rel) {
  if (rel.endingLocked) return rel.endingLocked;
  if (rel.peakIntimacy < 40) return 'drift_end';

  switch (rel.stage) {
    case 'out':
      return 'out_end';
    case 'ours':
      return 'ours_end';
    case 'unspoken':
      return 'unspoken_end';
    // The signature zone gets its own ending. Deeply close, never nameable, and
    // crucially NOT broken - which is a different thing from `nameless_end`,
    // the collapse that leaves her permanently filed as a friend.
    case 'nameless':
      return 'unnamed_end';
    case 'confidante':
      return 'confidante_end';
    case 'good_friends':
      return 'friends_end';
    // Public before private was ready, and it survived to the end anyway.
    // Nothing has broken yet. It is going to.
    case 'reckless':
      return 'reckless_end';
    default:
      return 'drift_end';
  }
}

/**
 * Endings that count as having got somewhere real.
 *
 * `unnamed_end` belongs here. Five relationships that are deeply close and
 * cannot be named is the truest version of this game's balance ending -
 * considerably more interesting than five public girlfriends, and it is the
 * bar the simulator is tuned against.
 */
export const GOOD_ENDINGS = new Set(['out_end', 'ours_end', 'unspoken_end', 'unnamed_end']);

/**
 * The balance ending: every member at `nameless` or above with jealousy held
 * under 50 and nothing collapsed. Reachable, and by design the hardest result
 * in the game.
 */
export function isBalanceEnding(relations) {
  const all = Object.values(relations);
  if (all.length < 2) return false;
  return all.every((r) => GOOD_ENDINGS.has(resolveEnding(r)) && r.jealousy < 50 && !r.endingLocked);
}
