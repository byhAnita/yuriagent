/**
 * The relationship model. CLAUDE.md Part I.8.
 *
 * Two axes and nothing else:
 *   affection      - how emotionally close she is
 *   admissibility  - how far either of them could let this BE SEEN
 *
 * `admissibility` is restraint as a number, and it is the whole reason this is
 * not a generic romance. It rises only when something happened where others
 * could see it and it survived. Deeply close and completely unable to name it is
 * a stable, interesting place to be - not a failure.
 *
 * WHAT USED TO BE HERE AND IS NOT ANY MORE.
 *
 * `strain` is gone (Part I.8). It locked stances (retired), shortened scenes
 * (retired), gated repair events (never built), and decided bad ends. With the
 * model deciding affection, a bad scene simply moves affection down - THAT IS THE
 * DAMAGE - and a second damage axis only code can read is exactly the hidden
 * machinery this redesign removes. `mood` replaces it on the player's side, where
 * it belongs.
 *
 * `jealousy` is gone with it, on the same argument and it is the same argument.
 * A rumor lands in an absent member's dossier and does nothing until she is in
 * front of the player, at which point the model reads it and writes her reaction.
 * Jealousy stops being a number ticking in the background and becomes a scene.
 *
 * `applySceneOutcome` is gone because nothing computes what a scene was worth any
 * more: `systems/values.js` applies the deltas the model asked for, round by
 * round, bounded. The plateau brake it carried went with it - see `resolveStage`
 * below, which still NAMES the plateau because that is a true reading of where a
 * relationship sits. What it no longer does is silently refuse a gain the model
 * already decided on, which would be the code authoring the scene again.
 *
 * Bad Ends are exits from the map, not regions on it. Low/low is where every run
 * starts, so which ending fires is decided by the high-water marks at the moment
 * of collapse, not by the current coordinates.
 *
 * Pure. No React, no network, no Math.random.
 */

import { STAGE_A_MIN, RECKLESS_GAP, PLATEAU_SLACK } from '../config/constants.js';

export const STAGE_LADDER = [
  'stranger',
  'colleague',
  'good_friends',
  'nameless',
  'unspoken',
  'ours',
  'out',
];

/**
 * A fresh relationship. Two axes, two high-water marks, nothing else.
 *
 * `stage` is NOT stored, and that is a correction rather than a simplification.
 * It used to be a field kept up to date by `applySceneOutcome`; `applyDeltas`
 * replaced that function and never wrote it, so the moment v2 landed every
 * relation carried the stage it started at, forever, while the day screen showed
 * the right one because it happened to call `resolveStage` itself. Same shape as
 * `affection` vs `intimacy`: two correct halves and a stale join between them.
 *
 * So it goes the way `focusId` already goes - derived at read time, never stored,
 * impossible to be wrong about.
 */
export function newRelation(startAffection = 5) {
  return {
    affection: startAffection,
    admissibility: 0,
    peakAffection: startAffection,
    peakAdmissibility: 0,
    endingLocked: null,
  };
}

/** Where on the map this relationship currently sits. */
export function resolveStage(affection, admissibility) {
  if (admissibility > affection + RECKLESS_GAP) return 'reckless';

  const tier =
    affection <= 15
      ? 'stranger'
      : affection <= 30
        ? 'colleague'
        : affection <= 50
          ? 'good_friends'
          : affection <= 70
            ? 'nameless'
            : affection <= 85
              ? 'unspoken'
              : admissibility >= STAGE_A_MIN.out
                ? 'out'
                : 'ours';

  if (admissibility < STAGE_A_MIN[tier] - PLATEAU_SLACK) return 'confidante';
  return tier;
}

/** The stage a relation is at, from the two numbers that decide it. */
export function stageOf(rel = {}) {
  return resolveStage(rel.affection ?? 0, rel.admissibility ?? 0);
}

/**
 * Move affection by a fixed amount the WORLD decided, and keep the peak honest.
 *
 * This is not a back door into the model's job. Every number a SCENE is worth
 * comes through `systems/values.js`, bounded and budgeted, because the model
 * decided it. This is for the two things the world decides on its own: a shared
 * dorm evening pays everybody in the room a little (section 10b), and an opener
 * is paid for by what the player knew and spent (section 11). Neither is a
 * judgement about how the conversation went - one is cooking together and the
 * other is a purchase - which is exactly why they are allowed to be a constant.
 *
 * It replaces `applySceneOutcome`, which took a delta bag and also carried the
 * plateau brake, the strain decay and the bad-end trigger. Those are gone; this
 * is the one line of it that had a job left.
 */
export function addAffection(rel, delta = 0) {
  const affection = Math.max(0, Math.min(100, (rel.affection ?? 0) + delta));
  return {
    ...rel,
    affection,
    peakAffection: Math.max(rel.peakAffection ?? 0, affection),
  };
}

/** True once this relationship has been somewhere worth losing. */
export function hasHistory(rel) {
  return rel.peakAffection >= 40;
}

/**
 * Bottom-left means Stranger on a fresh run and Aftermath on a collapsed one.
 * Same coordinates, different framing.
 */
export function isAftermath(rel) {
  return hasHistory(rel) && rel.affection < 30;
}

/**
 * Which collapse this is. Decided by where it fell FROM.
 * Returns null when there was never enough there to break.
 *
 * NOTHING CALLS THIS YET, and that is deliberate rather than an oversight.
 * `criticalScenes` used to trigger it off two consecutive scenes in the critical
 * strain band, and strain is gone - so what a collapse IS in v2 is an open
 * question, and it belongs with the endings work rather than here. Written down
 * because an unwired function that looks wired is this project's most expensive
 * recurring bug: `markRisk` was tested, correct, and never called for six
 * milestones.
 */
export function resolveBadEnd(rel) {
  if (rel.peakAffection < 40) return null;
  if (stageOf(rel) === 'reckless') return 'severance_end';
  if (rel.peakAdmissibility >= 60) return 'exposure_end';
  if (rel.peakAffection >= 70 && rel.admissibility < 30) return 'nameless_end';
  return 'severance_end';
}

/**
 * The ending for one character at campaign end. Endings resolve per character:
 * a run can finish with one `ours`, one `nameless_end` and three `drift_end`.
 */
export function resolveEnding(rel) {
  if (rel.endingLocked) return rel.endingLocked;
  if (rel.peakAffection < 40) return 'drift_end';

  switch (stageOf(rel)) {
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
 * considerably more interesting than five public girlfriends.
 */
export const GOOD_ENDINGS = new Set(['out_end', 'ours_end', 'unspoken_end', 'unnamed_end']);

/**
 * The balance ending: every member at `nameless` or above, nothing collapsed.
 *
 * The jealousy clause is gone with the number behind it. What made the balance
 * ending hard was never the clause - it is that five routes have to be held
 * inside a narrow band at once, and every scene spent on one is a scene not
 * spent on the other four. That pressure is still there; it is now paid in
 * blocks rather than in a hidden counter.
 */
export function isBalanceEnding(relations) {
  const all = Object.values(relations);
  if (all.length < 2) return false;
  return all.every((r) => GOOD_ENDINGS.has(resolveEnding(r)) && !r.endingLocked);
}
