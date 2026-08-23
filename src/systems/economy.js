/**
 * Credits and the knowledge-gated gift economy. CLAUDE.md section 11.
 *
 * The point of this module is that money is not the constraint - ATTENTION is.
 * A knowledge-gated gift cannot be bought at any price until the matching fact
 * exists in her dossier, so paying attention during dialogue is what unlocks
 * the strong move. Credits only pace it.
 */

import { GENERIC_GIFTS, KNOWLEDGE_GIFTS, BUYABLE_GIFTS, getGift } from '../data/gifts.js';
import { entryText } from './dossierEntry.js';
import { GESTURE_EFFECT } from '../config/constants.js';

/**
 * WHICH remembered line unlocks this gift, or null.
 *
 * Returning the fact rather than a boolean is the point. The note that opens the
 * scene quotes it back (section 11), so the model does not have to infer for
 * itself that a knee brace has anything to do with the injury sitting three
 * blocks earlier in the dossier. At this model tier that inference is not
 * reliable, and what it produces when it fails is a generic thank-you - the one
 * thing the knowledge economy exists to avoid.
 *
 * Matched per entry, not against the concatenation of all of them, so a needle
 * cannot be satisfied by the seam between two unrelated facts.
 */
export function matchedFact(gift, dossier) {
  // A null gift means an id that no longer exists - a save written against an
  // older catalogue, say. That must read as "not unlocked", never as a crash
  // that takes the gift modal down with it.
  if (!gift?.requires && !gift?.factIds) return null;
  const facts = [...(dossier?.known_facts ?? []), ...(dossier?.player_told_her ?? [])];

  for (const fact of facts) {
    /**
     * The id first, because it cannot be reworded.
     *
     * A snooped fact arrives with the id it was awarded under, so the match is
     * exact and survives any rewrite of either the card or the needle list -
     * the regression section 12 records having happened twice. Only a fact the
     * summarizer wrote in its own words has no id, and that is what the
     * substring pass below is for.
     */
    const id = typeof fact === 'object' ? fact.factId : null;
    if (id && gift.factIds?.includes(id)) return entryText(fact);

    const hay = entryText(fact).toLowerCase();
    if (gift.requires?.some((needle) => hay.includes(needle.toLowerCase()))) return entryText(fact);
  }
  return null;
}

/** Does anything she has told you match what this gift needs to know? */
export function isUnlocked(gift, dossier) {
  if (!gift) return false;
  if (!gift.requires && !gift.factIds) return true;
  return matchedFact(gift, dossier) !== null;
}

/**
 * What the gift modal shows for this member.
 *
 * Locked knowledge gifts are RETURNED, not hidden. Seeing that there is
 * something you could give her if you knew her better is the pull that makes
 * the dossier feel like a mechanic instead of plumbing.
 */
/**
 * @param {object} dossier
 * @param {number} credits
 * @param {string[]} usedGestures
 * @param {object} stock - counters for openers paid in something other than
 *   credits, e.g. `{ dishes: 2 }`. A gift carrying `stock` is unaffordable
 *   while its counter is zero and is not shown at all - the same rule locked
 *   knowledge gifts follow, for the same reason: an option the player cannot
 *   act on is clutter.
 */
export function giftsFor(dossier, credits, usedGestures = [], stock = {}) {
  const inStock = (g) => !g.stock || (stock[g.stock] ?? 0) > 0;
  const entry = (g, unlocked) => ({
    ...g,
    unlocked: unlocked && inStock(g),
    affordable: credits >= g.cost && inStock(g),
    purchasable: unlocked && credits >= g.cost && inStock(g),
  });

  const spent = new Set(usedGestures);

  return {
    generic: GENERIC_GIFTS.map((g) => entry(g, true)),
    // Only the openers that are actually an object. A gesture-only fact has no
    // price and never belongs in the shop half.
    knowledge: BUYABLE_GIFTS.map((g) => entry(g, isUnlocked(g, dossier))),

    /**
     * The same knowledge, spent by saying something instead of buying
     * something. Free, weaker, and available once - see GESTURE_EFFECT.
     *
     * Not every way of showing you were listening is a purchase. Asking how
     * the ankle held up, or bringing up the book she has been quoting, is the
     * more natural move most of the time, and a knowledge economy where the
     * only verb is BUY reads as a shop rather than as attention.
     */
    gesture: KNOWLEDGE_GIFTS.map((g) => ({
      ...g,
      cost: 0,
      effect: GESTURE_EFFECT,
      unlocked: isUnlocked(g, dossier),
      used: spent.has(g.id),
      purchasable: isUnlocked(g, dossier) && !spent.has(g.id),
    })),
  };
}

export function canGesture(giftId, dossier, usedGestures = []) {
  const gift = getGift(giftId);
  if (!gift?.requires) return false;
  return isUnlocked(gift, dossier) && !usedGestures.includes(giftId);
}

/**
 * Open the scene by saying something, rather than by handing something over.
 *
 * Named spend* rather than use*, because `use` is reserved for React hooks by
 * lint convention and this is a pure function in systems/.
 *
 * The note names the fact exactly as the gift note does, because the payoff is
 * identical: she hears that you remembered. What differs is that there is no
 * object in her hands, so the model must not invent one.
 */
export function spendGesture(giftId, dossier, usedGestures, memberName) {
  if (!canGesture(giftId, dossier, usedGestures)) return null;
  const fact = matchedFact(getGift(giftId), dossier);

  return {
    giftId,
    tier: 'gesture',
    fact,
    intimacyDelta: GESTURE_EFFECT,
    usedGestures: [...usedGestures, giftId],
    sceneNote:
      `the player has brought ${memberName} nothing at all. They opened by bringing up something she once let slip: "${fact}". ` +
      'There is no gift and no object - only that they remembered, and chose to lead with it. ' +
      'Do not invent a present; there is not one to react to.',
  };
}

export function canPurchase(giftId, dossier, credits, stock = {}) {
  const gift = getGift(giftId);
  if (!gift || gift.object === false) return false;
  // An opener paid in something other than credits still has to be in hand.
  if (gift.stock && (stock[gift.stock] ?? 0) <= 0) return false;
  return isUnlocked(gift, dossier) && credits >= gift.cost;
}

/**
 * Buy and open the scene with it.
 * Returns the spend plus the note injected at the head of prompt block 5.
 */
export function purchase(giftId, dossier, credits, memberName, stock = {}) {
  if (!canPurchase(giftId, dossier, credits, stock)) return null;
  const gift = getGift(giftId);
  const name = giftId.replace(/_/g, ' ');
  const knowledge = Boolean(gift.requires);
  const fact = matchedFact(gift, dossier);

  /**
   * The note carries the TIER and the FACT. The tier stops a hand warmer and an
   * iced coffee reading as the same sentence; the fact stops the model having to
   * work out for itself why this particular object proves you were listening.
   *
   * It deliberately does NOT script the reaction. Everything here is input - the
   * line she actually says is generated, so it can also move with how close she
   * already is (block 4 standing, section 8).
   */
  const sceneNote = knowledge
    ? `the player has just handed ${memberName} a ${name}.${
        fact ? ` She let this slip once: "${fact}".` : ''
      } She has never told anyone she needed one - only somebody who had been paying very close attention would have known to bring it. She was not expecting this.`
    : gift.stock === 'dishes'
      ? `the player has just handed ${memberName} something they cooked themselves, in the dorm kitchen, earlier. Not bought - made, and carried around since.`
      : `the player has just handed ${memberName} a ${name}. An ordinary, thoughtful gesture - kind, but nothing she could not have guessed at.`;

  return {
    giftId,
    tier: knowledge ? 'knowledge' : 'generic',
    fact,
    credits: credits - gift.cost,
    /** Which player counter this opener consumed, if not credits. */
    spentStock: gift.stock ?? null,
    intimacyDelta: gift.effect,
    sceneNote,
  };
}

export function earn(credits, amount) {
  return Math.max(0, credits + amount);
}
