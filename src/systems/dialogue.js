/**
 * What shape is this conversation? CLAUDE.md sections 6 and 10c. PURE.
 *
 * Every dialogue in the game is the same loop - an ordinary block, a date, a
 * shared dorm evening, an anchor event - and until this file existed each of
 * them decided its own two parameters in its own place. `App` picked a turn
 * limit from a lookup keyed on scene kind; `sceneEngine` decided whether a
 * second voice could speak by asking whether the roster had more than one
 * member, several call sites away. Nothing stated the two rules together, so
 * nothing could be checked against them.
 *
 * Yuhan's spec, and it is the right one:
 *
 *   count who is in the conversation
 *     -> one member: no second voice. more: allow one.
 *     -> set the turn limit from how many are in it
 *     -> then the ordinary turn loop
 *
 * Both answers come from the same number, which is why they belong in the same
 * function. A caller that knows the roster knows the shape.
 */

import { SCENE_TURN_LIMITS, TURNS_PER_EXTRA_MEMBER, SCENE_TURN_LIMIT_MAX } from '../config/constants.js';

/**
 * How long a conversation runs, given how many people are in it.
 *
 * A room with five people in it needs more turns than a room with one, because
 * the player's attention is being divided by five - eight turns across a full
 * cast is a turn and a half each, which is not a conversation with anybody. The
 * base is section 6's `SCENE_TURN_LIMIT` and every extra member buys a little
 * more room.
 *
 * It does NOT make a group scene better value than a 1v1, which is the thing to
 * watch. Both cost one block. But a 16-turn scene with five members gives each
 * of them ~3 turns of the player's attention against a 1v1's 8, so depth still
 * belongs to the private conversation - which is section 5b's whole claim that
 * breadth is cheap and shallow.
 *
 * Capped, because a date and an anchor event already sit at the cap and a
 * conversation that outruns them stops being a scene and becomes a day.
 */
export function turnLimitFor(memberCount, kind = 'ordinary') {
  const base = SCENE_TURN_LIMITS[kind] ?? SCENE_TURN_LIMITS.ordinary;
  const extra = Math.max(0, (memberCount ?? 1) - 1) * TURNS_PER_EXTRA_MEMBER;
  return Math.min(base + extra, SCENE_TURN_LIMIT_MAX);
}

/**
 * Can somebody who was not addressed speak up?
 *
 * Only if there is somebody else to be. This has always been true in the engine
 * - `interject` returns early on a one-member roster - but it was true by
 * accident of where the check happened to live, and the UI did not know it, so
 * a one-to-one scene still rendered the controls a group scene needs.
 */
export function allowsSecondVoice(memberCount) {
  return (memberCount ?? 1) > 1;
}

/**
 * The whole shape, from the roster.
 *
 * @param {object} args
 *   rosterIds - who may SPEAK. Not who is in the room: a member standing there
 *               who cannot answer changes nothing about the shape of the
 *               conversation (section 9's roster / presence split).
 *   kind      - 'ordinary' | 'date' | 'event'
 */
export function dialogueShape({ rosterIds = [], kind = 'ordinary' } = {}) {
  const members = rosterIds.length || 1;
  return {
    members,
    kind,
    group: allowsSecondVoice(members),
    interject: allowsSecondVoice(members),
    turnLimit: turnLimitFor(members, kind),
  };
}
