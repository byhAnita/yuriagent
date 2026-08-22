/**
 * Asking someone to spend a day with you. CLAUDE.md section 10.
 *
 * PURE. No React, no network, no I/O - the caller applies what this returns.
 *
 * A date is offered at the start of a weekend day, is refusable, and consumes
 * the whole day. The gate comes straight off the two axes:
 *
 *   public date  -> admissibility. How nameable is this?
 *   private date -> intimacy.      How close are we?
 *
 * So the two are not substitutes. A player deep in the `confidante` plateau
 * gets the private date easily and cannot get the public one at all, which is
 * the plateau stating its terms as plainly as the game can.
 *
 * A REFUSAL IS NOT A FAILURE. It is the first time a hidden number becomes a
 * visible yes or no, which is what pillar 1 asks the player to read. Asking too
 * early costs the block and nothing else.
 */

import { DATE_KINDS, DATE_REFUSING_STRAIN, DATE_JEALOUSY_FACTOR } from '../config/constants.js';
import { locationsForRole, resolveSlot } from '../data/phaseMaps.js';
import { strainBand } from './relationship.js';
import { jealousyBand } from './jealousy.js';
import { makeRng, deriveSeed } from './rng.js';

export const DATE_KIND_IDS = Object.keys(DATE_KINDS);

/** Why she said no, or why the offer is not live. Never a bare false. */
export const REFUSAL = {
  TOO_SOON: 'too_soon',
  STRAIN: 'strain',
  JEALOUSY: 'jealousy',
  CREDITS: 'credits',
  DECLINED: 'declined',
};

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

/** Where this kind of date happens this phase. */
export function dateLocation(phase, kind) {
  if (kind === 'private') return resolveSlot(phase, 'her_room');
  return locationsForRole(phase, 'public_date')[0] ?? null;
}

/**
 * How likely she is to say yes, before the dice.
 *
 * Returned rather than hidden so the UI can hint at it without printing a
 * number - section 20 keeps stats out of prose, and pillar 1 wants the player
 * reading her rather than reading a percentage.
 */
export function acceptChance(rel, kind) {
  const def = DATE_KINDS[kind];
  if (!def) return 0;

  if (strainBand(rel.strain) === DATE_REFUSING_STRAIN || rel.strain >= 90) return 0;

  const value = rel[def.axis] ?? 0;
  if (value < def.floor) return 0;

  const base = clamp01((value - def.floor) / (def.sure - def.floor));
  const factor = DATE_JEALOUSY_FACTOR[jealousyBand(rel.jealousy ?? 0)] ?? 1;
  return clamp01(base * factor);
}

/**
 * Why she cannot be asked right now, or null if she can.
 *
 * Ordered by what the player most needs to know. Strain and jealousy outrank
 * the axis because they are states the player can repair; "too soon" is the
 * one that just means keep going.
 */
export function blockedReason(rel, kind, player = {}) {
  const def = DATE_KINDS[kind];
  if (!def) return REFUSAL.TOO_SOON;

  if (strainBand(rel.strain) === DATE_REFUSING_STRAIN || rel.strain >= 90) return REFUSAL.STRAIN;
  if (jealousyBand(rel.jealousy ?? 0) === 'corrosive') return REFUSAL.JEALOUSY;
  if ((rel[def.axis] ?? 0) < def.floor) return REFUSAL.TOO_SOON;
  if (def.credits > 0 && (player.credits ?? 0) < def.credits) return REFUSAL.CREDITS;
  return null;
}

/**
 * Every date the player could put to someone this weekend.
 *
 * An unaffordable date IS listed, with its price. That is deliberately unlike
 * section 11's locked gifts, which stay hidden because naming one spoils the
 * fact it waits on. A price is not a spoiler, it is a thing the player can go
 * and do something about.
 */
export function dateOffers({ phase, cast = [], relations = {}, player = {} }) {
  const offers = [];

  for (const card of cast) {
    const rel = relations[card.id];
    if (!rel) continue;

    for (const kind of DATE_KIND_IDS) {
      const locationId = dateLocation(phase, kind);
      if (!locationId) continue;

      const reason = blockedReason(rel, kind, player);
      offers.push({
        memberId: card.id,
        kind,
        locationId,
        cost: DATE_KINDS[kind].credits,
        available: reason === null,
        reason,
        chance: reason === null ? acceptChance(rel, kind) : 0,
      });
    }
  }

  return offers;
}

/**
 * Put the question. Seeded on the moment, so the answer is the same if the
 * player closes the modal and opens it again - a coin you can reflip is not a
 * bet.
 *
 * @returns {{ accepted: boolean, reason: string|null, chance: number }}
 */
export function askOut({ rel, kind, player = {}, seed, week = 0, day = 0, memberId = '' }) {
  const reason = blockedReason(rel, kind, player);
  if (reason) return { accepted: false, reason, chance: 0 };

  const chance = acceptChance(rel, kind);
  const rng = makeRng(deriveSeed(seed, `date:${memberId}:${kind}:${week}:${day}`));

  return rng() < chance
    ? { accepted: true, reason: null, chance }
    : { accepted: false, reason: REFUSAL.DECLINED, chance };
}

/**
 * What the day costs and what it is worth, once she has said yes.
 *
 * The credits are spent on acceptance and not on the asking - she turned you
 * down, you did not buy her dinner. Section 11's economy needed a second sink
 * and this is it: a gift for her today, or affording to take her out on
 * Saturday.
 */
export function dateCost(kind) {
  return DATE_KINDS[kind]?.credits ?? 0;
}

/**
 * Who finds out.
 *
 * A public date is WITNESSED-TIER for every absent member - no probability
 * roll, the way section 5b treats a group scene. This is what keeps it distinct
 * from simply running into her at the cafe on a Tuesday evening, which would
 * otherwise offer most of the same exposure for a fraction of the cost.
 *
 * A private date leaks nothing outward, but the approach is still seen: her
 * door is in the dorm, and `approachWitnessed` already means the others watch
 * you go in.
 */
export function dateWitnesses({ kind, cast = [], memberId }) {
  const others = cast.map((c) => c.id ?? c).filter((id) => id !== memberId);
  return { witnessed: others, certain: kind === 'public' };
}
