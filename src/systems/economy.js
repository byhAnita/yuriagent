/**
 * Credits, and handing something over. CLAUDE.md Part I.10.
 *
 * THIS MODULE USED TO DECIDE WHETHER A GIFT LANDED, AND IT NO LONGER DOES.
 *
 * v1 matched a gift's `requires` needles against her dossier to work out whether
 * the player had earned it, then paid a fixed `+5` for a knowledge gift and `+1`
 * for a generic one. Two things were wrong with that, and they are the same
 * thing twice:
 *
 * 1. **The substring match broke.** Twice, during content rewrites - an opener
 *    that silently never unlocks is invisible, because nothing distinguishes it
 *    from a fact the player has not found yet.
 * 2. **The number was code deciding what the scene meant** (I.1), and it was
 *    paid on TOP of whatever the model moved in the round it wrote in reaction.
 *    A bought reaction and an earned one arrived at the same place by two
 *    different routes, one of which nobody could see.
 *
 * So what is left is the two things that genuinely are the world's to decide:
 * **can the player afford it, and are they carrying it.** The note goes into
 * tier 3, the model reads her `facts` alongside it, and her reaction moves
 * affection the way every other round does - bounded, visible, and once.
 */

import { GIFTS, getGift } from '../data/gifts.js';

/**
 * What the Give sheet shows.
 *
 * Everything, always - there is nothing to unlock and therefore nothing to hide.
 * `affordable` is the only state a row has, and an unaffordable row still shows,
 * because a price you cannot meet yet is information and a locked fact was not.
 *
 * @param {number} credits
 * @param {object} stock - counters for openers paid in something other than
 *   credits, e.g. `{ dishes: 2 }`. A gift carrying `stock` with an empty counter
 *   is not shown at all: it is not expensive, it does not exist right now.
 */
export function giftsFor(credits, stock = {}) {
  const inStock = (g) => !g.stock || (stock[g.stock] ?? 0) > 0;

  return GIFTS.filter(inStock).map((g) => ({
    ...g,
    affordable: credits >= g.cost,
  }));
}

export function canPurchase(giftId, credits, stock = {}) {
  const gift = getGift(giftId);
  // A null gift means an id that no longer exists - a save written against an
  // older catalogue, say. That must read as "no", never as a crash that takes
  // the sheet down with it.
  if (!gift) return false;
  if (gift.stock && (stock[gift.stock] ?? 0) <= 0) return false;
  return credits >= gift.cost;
}

/**
 * Hand it over. Returns the spend plus the note that goes into tier 3.
 *
 * The note says what the object is and who is holding it, and stops there. It
 * does NOT say whether this was a good idea - the model has her `facts` two
 * lines above it in the same block, so whether a mugwort pack is uncanny
 * attention or a baffling object is something it can read for itself. Scripting
 * that here is what made every gift scene open the same way.
 */
export function purchase(giftId, credits, memberName, stock = {}) {
  if (!canPurchase(giftId, credits, stock)) return null;
  const gift = getGift(giftId);
  const name = giftId.replace(/_/g, ' ');

  const sceneNote =
    gift.stock === 'dishes'
      ? `The player has just handed ${memberName} something they cooked themselves, in the dorm kitchen, earlier. Not bought - made, and carried around since.`
      : `The player has just handed ${memberName} a ${name}.`;

  return {
    giftId,
    credits: credits - gift.cost,
    /** Which player counter this opener consumed, if not credits. */
    spentStock: gift.stock ?? null,
    sceneNote,
  };
}

export function earn(credits, amount) {
  return Math.max(0, credits + amount);
}
