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
import { entryText, entryFactId } from './dossierEntry.js';

/**
 * Does the player know why this object would matter to HER?
 *
 * Matched on the fact id and nothing else. v1 matched `requires` needles against
 * dossier text by substring and it broke twice during content rewrites, because
 * the summarizer writes a fact in its own words. An id cannot be reworded.
 *
 * Two conditions, and both are necessary. The gift must name a fact, and THAT
 * MEMBER must be the one who has it - a mugwort pack handed to Nana matches
 * nothing, which is correct: it is a warm pack, and she has no reason to care.
 *
 * Returns the fact as the DOSSIER holds it, not as `data/facts.js` phrases it.
 * The dossier line is what tier 3 is already showing the model two blocks up, so
 * quoting it verbatim reinforces something present rather than introducing a
 * second wording of the same thing.
 */
export function matchedFact(gift, dossier) {
  if (!gift?.factId) return null;
  for (const entry of dossier?.facts ?? []) {
    if (entryFactId(entry) === gift.factId) return entryText(entry);
  }
  return null;
}

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
 * THE NOTE SAYS WHY, WHEN THERE IS A WHY THE PLAYER KNOWS.
 *
 * The first ungated build said only *the player has just handed Irene a mugwort
 * pack*, on the argument that the model has her `facts` in tier 3 and can join
 * the two. Played, it could not: it reached for the commonest use of a herbal
 * pack and invented a sore back, then had her brew it like tea. Section 11
 * measured exactly this once before and drew the rule this now follows -
 * **an inference that can be stated should be stated.** The step from
 * `mugwort_pack` to a line about cold hands three blocks up is an inference.
 *
 * Three notes, and which one you get depends only on what the PLAYER knows:
 *
 * | | |
 * |---|---|
 * | the object answers a fact she has learned about *this* member | the fact is quoted, and the note says nobody had to be told |
 * | the object is specific but the player has not learned the fact | plain. She has no reason to read anything into it, and neither should the model |
 * | a rose, a coffee, anything generic | plain, and correctly so |
 *
 * Note what this is NOT: a gate. Anybody can buy anything and hand it to
 * anybody. What the knowledge buys is the difference between *"thank you"* and
 * *"how did you know?"*, which is the whole product (section 11) - and it is
 * bought by having done the work, not by passing a check at the till.
 *
 * @param {object} dossier - HER dossier, for the fact match. Omitted, every
 *   note is the plain one, which is the right degradation: a caller that cannot
 *   say what the player knows should not be claiming they knew anything.
 */
export function purchase(giftId, credits, memberName, { stock = {}, dossier = null } = {}) {
  if (!canPurchase(giftId, credits, stock)) return null;
  const gift = getGift(giftId);
  const name = giftId.replace(/_/g, ' ');
  const fact = dossier ? matchedFact(gift, dossier) : null;

  const sceneNote = fact
    ? `The player has just handed ${memberName} a ${name}. She let this slip once: "${fact}". She never told them she needed one - only somebody who had been paying attention would have known to bring it.`
    : gift.stock === 'dishes'
      ? `The player has just handed ${memberName} something they cooked themselves, in the dorm kitchen, earlier. Not bought - made, and carried around since.`
      : `The player has just handed ${memberName} a ${name}.`;

  return {
    giftId,
    credits: credits - gift.cost,
    /** Which player counter this opener consumed, if not credits. */
    spentStock: gift.stock ?? null,
    /** The line that earned the reaction, or null. For the aftermath screen. */
    fact,
    sceneNote,
  };
}

export function earn(credits, amount) {
  return Math.max(0, credits + amount);
}
