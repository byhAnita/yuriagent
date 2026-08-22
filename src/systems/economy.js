/**
 * Credits and the knowledge-gated gift economy. CLAUDE.md section 11.
 *
 * The point of this module is that money is not the constraint - ATTENTION is.
 * A knowledge-gated gift cannot be bought at any price until the matching fact
 * exists in her dossier, so paying attention during dialogue is what unlocks
 * the strong move. Credits only pace it.
 */

import { GENERIC_GIFTS, KNOWLEDGE_GIFTS, BUYABLE_GIFTS, getGift } from '../data/gifts.js';
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
  if (!gift?.requires) return null;
  const facts = [...(dossier?.known_facts ?? []), ...(dossier?.player_told_her ?? [])];
  for (const fact of facts) {
    const hay = String(fact).toLowerCase();
    if (gift.requires.some((needle) => hay.includes(needle.toLowerCase()))) return fact;
  }
  return null;
}

/** Does anything she has told you match what this gift needs to know? */
export function isUnlocked(gift, dossier) {
  if (!gift) return false;
  if (!gift.requires) return true;
  return matchedFact(gift, dossier) !== null;
}

/**
 * What the gift modal shows for this member.
 *
 * Locked knowledge gifts are RETURNED, not hidden. Seeing that there is
 * something you could give her if you knew her better is the pull that makes
 * the dossier feel like a mechanic instead of plumbing.
 */
export function giftsFor(dossier, credits, usedGestures = []) {
  const entry = (g, unlocked) => ({
    ...g,
    unlocked,
    affordable: credits >= g.cost,
    purchasable: unlocked && credits >= g.cost,
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

export function canPurchase(giftId, dossier, credits) {
  const gift = getGift(giftId);
  if (!gift || gift.object === false) return false;
  return isUnlocked(gift, dossier) && credits >= gift.cost;
}

/**
 * Buy and open the scene with it.
 * Returns the spend plus the note injected at the head of prompt block 5.
 */
export function purchase(giftId, dossier, credits, memberName) {
  if (!canPurchase(giftId, dossier, credits)) return null;
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
    : `the player has just handed ${memberName} a ${name}. An ordinary, thoughtful gesture - kind, but nothing she could not have guessed at.`;

  return {
    giftId,
    tier: knowledge ? 'knowledge' : 'generic',
    fact,
    credits: credits - gift.cost,
    intimacyDelta: gift.effect,
    sceneNote,
  };
}

export function earn(credits, amount) {
  return Math.max(0, credits + amount);
}
