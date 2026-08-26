/**
 * What the code does with the numbers the model asked for. CLAUDE.md Part I.8,
 * I.9.
 *
 * The model decides what the scene MEANS - including how far it moved her - and
 * this file decides what the world ALLOWS. That division is the whole v2 design,
 * and everything here is a bound rather than a choice: nothing in this file ever
 * picks a delta, invents one, or scales one. It clamps, it vetoes one specific
 * rise, and it drops what does not belong to anybody in the room.
 *
 * Pure, per section 4. No React, no model, no I/O.
 */

import { DELTA_MAX, SCENE_DELTA_MAX } from '../config/rules.js';
import { RISK_EXPOSURE_THRESHOLD } from '../config/constants.js';
import { clamp } from './rng.js';

/** Suffix that marks a delta line as the second axis: `irene_adm+1`. */
export const ADMISSIBILITY_SUFFIX = '_adm';

/** The player's own movable values. Energy and credits are the world's, not hers. */
export const PLAYER_VALUES = ['selfId', 'mood', 'secrecy'];

/** An empty per-scene budget. One per scene, per member, per axis. */
export function newBudget() {
  return {};
}

/**
 * How much of a delta the scene's budget still has room for.
 *
 * The budget is the running NET, not the sum of absolute movement, so walking a
 * value back always fits and gives its room back. That is the honest reading of
 * "the scene may move her by six": a scene that lifts her four and drops her two
 * has moved her two, and should not then be forbidden from moving her again.
 */
function spend(budget, key, delta) {
  const used = budget[key] ?? 0;
  const wanted = used + delta;
  const capped = Math.sign(wanted) * Math.min(Math.abs(wanted), SCENE_DELTA_MAX);
  const allowed = capped - used;
  if (allowed === 0) return 0;
  budget[key] = capped;
  return allowed;
}

/**
 * Apply one round's deltas.
 *
 * @param {object} ctx
 * @param {object} ctx.relations - { [id]: { affection, admissibility, ... } }
 * @param {object} ctx.player    - { selfId, mood, secrecy }
 * @param {object} ctx.deltas    - straight off the parser
 * @param {string[]} ctx.present - who is in the room
 * @param {number} ctx.exposure  - the scene's, from `systems/exposure.js`
 * @param {object} ctx.budget    - the scene's running total; MUTATED
 * @param {boolean} ctx.first    - first round of a scene: nothing has happened
 * @returns {{relations, player, applied: object, refused: string[]}}
 */
export function applyDeltas({
  relations = {},
  player = {},
  deltas = {},
  present = [],
  exposure = 0,
  budget = newBudget(),
  first = false,
}) {
  const nextRelations = { ...relations };
  const nextPlayer = { ...player };
  const applied = {};
  const refused = [];

  /**
   * The first round of a scene moves nothing.
   *
   * The prompt says so too, and this says it again because both statements are
   * cheap and only one of them is guaranteed. Nothing has happened yet at the
   * moment the player walks in, so a model that opens with +2 is describing the
   * walk through the door.
   */
  if (first) return { relations: nextRelations, player: nextPlayer, applied, refused };

  const inRoom = new Set(present);

  for (const [rawKey, rawDelta] of Object.entries(deltas)) {
    const n = Number(rawDelta);
    if (!Number.isFinite(n) || n === 0) continue;

    /** ±2 a round. See Part I.8 - ±5 would be ten times too hot at ~650 rounds. */
    const bounded = Math.sign(n) * Math.min(Math.abs(n), DELTA_MAX);

    const key = String(rawKey);

    // The player's own values. Not gated on the roster - they are hers.
    const playerKey = PLAYER_VALUES.find((v) => v.toLowerCase() === key.toLowerCase());
    if (playerKey) {
      const allowed = spend(budget, playerKey, bounded);
      if (!allowed) continue;
      nextPlayer[playerKey] = clamp((nextPlayer[playerKey] ?? 0) + allowed);
      applied[playerKey] = allowed;
      continue;
    }

    const isAdmissibility = key.endsWith(ADMISSIBILITY_SUFFIX);
    const memberId = isAdmissibility ? key.slice(0, -ADMISSIBILITY_SUFFIX.length) : key;

    /**
     * ONLY PRESENT MEMBERS MOVE.
     *
     * A rumor lands in an absent member's dossier and does nothing until she is
     * in front of the player. That is what turns jealousy from a number ticking
     * in the background into a scene, and it is why the day screen's reading for
     * anybody not recently seen is CORRECTLY stale.
     */
    if (!inRoom.has(memberId) || !nextRelations[memberId]) {
      refused.push(key);
      continue;
    }

    /**
     * THE ONE CODE-SIDE VALUE RULE. Part I.9.
     *
     * `admissibility` may not RISE when the scene's exposure was low. The model
     * still picks the number; the world gets to say nobody saw that. A fall is
     * always allowed - something can go wrong in private.
     *
     * The spike says the model holds this unaided, so this is a safety net
     * rather than the mechanism. It is kept because it costs one comparison and
     * because this project has made the second axis unreachable three separate
     * times.
     */
    if (isAdmissibility && bounded > 0 && exposure < RISK_EXPOSURE_THRESHOLD) {
      refused.push(key);
      continue;
    }

    const axis = isAdmissibility ? 'admissibility' : 'affection';
    const allowed = spend(budget, `${memberId}:${axis}`, bounded);
    if (!allowed) continue;

    const rel = nextRelations[memberId];
    const value = clamp((rel[axis] ?? 0) + allowed);
    // The high-water mark is monotonic and decides which ending applies.
    const peak = axis === 'affection' ? 'peakAffection' : 'peakAdmissibility';
    nextRelations[memberId] = {
      ...rel,
      [axis]: value,
      [peak]: Math.max(rel[peak] ?? 0, value),
    };
    applied[key] = allowed;
  }

  return { relations: nextRelations, player: nextPlayer, applied, refused };
}
