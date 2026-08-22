/**
 * Exposure and presence. CLAUDE.md sections 6, 5b, 10.
 *
 * exposure is DERIVED, never reported by the model. That is what makes map
 * choice matter romantically instead of only logistically: the practice room at
 * night is low, the cafe at noon is high, and the player can reason about it
 * before committing a time block.
 *
 * exposure and presence are deliberately independent. Public places raise both
 * together; the dorm is the one place that splits them - nearly invisible to the
 * outside world and watched by everyone who lives there.
 */

import { LOCATIONS } from '../data/locations.js';
import { WITNESS_EXPOSURE_FLOOR } from '../config/constants.js';
import { clamp } from './rng.js';

/** Evening hides you; the middle of the day does not. */
export const BLOCK_MODIFIER = { morning: 0, afternoon: 8, evening: -12 };

/** COMEBACK week puts cameras on everything. */
export const PHASE_MODIFIER = { prep: -5, comeback: 12, rest: 0 };

/** Secrecy 70 is the assistant's starting value and the neutral point. */
export const SECRECY_NEUTRAL = 70;
export const SECRECY_WEIGHT = 0.3;

/**
 * Visibility of a scene to the outside world.
 *
 * @param {object} ctx - { locationId, block, phase, secrecy, identity }
 * @returns {number} 0-100
 */
export function sceneExposure({ locationId, block, phase, secrecy = SECRECY_NEUTRAL, identity }) {
  const loc = LOCATIONS[locationId];
  if (!loc) throw new Error(`Unknown location: ${locationId}`);

  const identityMod = identity?.exposureModifier?.[locationId] ?? 0;

  return clamp(
    loc.exposureBase +
      (BLOCK_MODIFIER[block] ?? 0) +
      (PHASE_MODIFIER[phase] ?? 0) +
      (SECRECY_NEUTRAL - secrecy) * SECRECY_WEIGHT +
      identityMod,
  );
}

/**
 * Who could witness what happens here.
 *
 * `presence` on a location is a category rather than a number so that it can
 * respond to phase: the practice room holds the whole cast during PREP and
 * COMEBACK and nobody during REST.
 *
 * @returns {number} how many other cast members are plausibly in earshot
 */
export function presenceCount(locationId, phase, castSize) {
  const loc = LOCATIONS[locationId];
  if (!loc) throw new Error(`Unknown location: ${locationId}`);
  const others = Math.max(0, castSize - 1);

  switch (loc.presence) {
    case 'all':
      return others;
    case 'group_phase':
      return phase === 'rest' ? 0 : others;
    case 'few':
      return Math.min(2, others);
    case 'random':
      return Math.min(1, others);
    case 'solo':
      return 0;
    default:
      return 0;
  }
}

/**
 * Entering a bedroom while the others are in the living room is itself an
 * event, even though nothing about the scene leaks outward. The others saw you
 * go in.
 */
export function approachIsWitnessed(locationId) {
  return Boolean(LOCATIONS[locationId]?.approachWitnessed);
}

/** A deliberate risk only counts as one where it could actually cost something. */
/**
 * Exposure once you account for who else is standing there.
 *
 * Section 5b: a gesture in a group scene is WITNESSED at
 * `WITNESS_EXPOSURE_FLOOR` - direct observation, no probability roll - and
 * "witnessed gestures give a larger admissibility gain and a larger jealousy
 * hit than rumors. High-risk, high-reward is the mechanical identity of a group
 * scene."
 *
 * That was written for scenes with two members interactive, but it is true of
 * ANY room with somebody else in it. Turning to one member in front of the
 * others is itself the gesture: nobody has to touch anyone for four people to
 * have watched the player choose. So a practice room at exposure 25 with three
 * bandmates in it is not a private place, and reaching for her hand there is a
 * public act whatever the outside world can see.
 *
 * This is what makes a crowded room the cheapest admissibility in the game and
 * the most expensive jealousy - the same choice, two bills.
 */
export function witnessedExposure(exposure, othersPresent = 0) {
  if (othersPresent <= 0) return exposure;
  return Math.max(exposure, WITNESS_EXPOSURE_FLOOR);
}

export function isRiskyEnough(exposure, threshold) {
  return exposure >= threshold;
}
