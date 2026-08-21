/**
 * Credits and the knowledge-gated gift economy. CLAUDE.md section 11.
 *
 * The point of this module is that money is not the constraint - ATTENTION is.
 * A knowledge-gated gift cannot be bought at any price until the matching fact
 * exists in her dossier, so paying attention during dialogue is what unlocks
 * the strong move. Credits only pace it.
 */

import { GENERIC_GIFTS, KNOWLEDGE_GIFTS, getGift } from '../data/gifts.js';

/** Does anything she has told you match what this gift needs to know? */
export function isUnlocked(gift, dossier) {
  if (!gift.requires) return true;
  const facts = [...(dossier?.known_facts ?? []), ...(dossier?.player_told_her ?? [])]
    .join(' ')
    .toLowerCase();
  return gift.requires.some((needle) => facts.includes(needle.toLowerCase()));
}

/**
 * What the gift modal shows for this member.
 *
 * Locked knowledge gifts are RETURNED, not hidden. Seeing that there is
 * something you could give her if you knew her better is the pull that makes
 * the dossier feel like a mechanic instead of plumbing.
 */
export function giftsFor(dossier, credits) {
  const entry = (g, unlocked) => ({
    ...g,
    unlocked,
    affordable: credits >= g.cost,
    purchasable: unlocked && credits >= g.cost,
  });

  return {
    generic: GENERIC_GIFTS.map((g) => entry(g, true)),
    knowledge: KNOWLEDGE_GIFTS.map((g) => entry(g, isUnlocked(g, dossier))),
  };
}

export function canPurchase(giftId, dossier, credits) {
  const gift = getGift(giftId);
  if (!gift) return false;
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

  /**
   * The note has to carry the TIER, not just the object. A hand warmer and an
   * iced coffee are the same sentence otherwise, and the model has no way to
   * know that one of them proves you were listening. Proportionate reactions
   * are the entire payoff of the knowledge economy.
   */
  const sceneNote = knowledge
    ? `the player has just handed ${memberName} a ${name}. She has never told anyone she needed one - only somebody who had been paying very close attention would have known to bring it. She was not expecting this.`
    : `the player has just handed ${memberName} a ${name}. An ordinary, thoughtful gesture - kind, but nothing she could not have guessed at.`;

  return {
    giftId,
    tier: knowledge ? 'knowledge' : 'generic',
    credits: credits - gift.cost,
    intimacyDelta: gift.effect,
    sceneNote,
  };
}

export function earn(credits, amount) {
  return Math.max(0, credits + amount);
}
