/**
 * Things you can carry into a scene. CLAUDE.md Part I.10.
 *
 * ONE FLAT LIST, AND NOTHING IS GATED. v1 had three kinds - generic, a
 * knowledge-gated purchase, and a knowledge-gated gesture - and the second and
 * third were both code deciding whether the player had EARNED a gift, by
 * matching substrings against dossier text. That broke twice during content
 * rewrites, and it was the wrong question anyway: I.1 gives the model what the
 * scene means, and "was this the right thing to bring her" is exactly that.
 *
 * So the shelf is open. The model has her `facts` in tier 3, so a mugwort pack
 * handed to the woman whose hands are always cold reads as attention paid, and
 * the same pack handed to somebody else reads as a puzzle - **written, not
 * priced.** The knowledge moves from a `requires` array into the player's head,
 * which is the only place it was ever interesting.
 *
 * THE GESTURES ARE GONE, and they are not a loss. Eighteen of the twenty-five
 * openers were `object: false` - asking after her ankle, doing a set of squats
 * with her, hugging her and not letting go - and every one of them was a thing
 * to SAY, offered from a sheet, at the door. Part I.10 puts them where they
 * belong: the model reads her facts and writes one of the four options as the
 * gesture, when the moment is apt. Contextual, unspammable, and impossible to
 * turn into a checklist, which is what a sheet of twenty-five made of them.
 *
 * What is left needs a list, because choosing among things you are carrying and
 * paying for one is a real choice that four written options cannot hold.
 *
 * `cost` is credits and is the only number here. It is not a judgement about
 * what the object MEANS - the model settles that - it is what the thing costs,
 * and it competes with the other credit sink, which is affording to take her
 * out on Saturday.
 */

export const GIFTS = [
  /**
   * The one opener that is not bought.
   *
   * It costs a block in the dorm kitchen instead of credits, so it is offered
   * only while the player is carrying one - `stock` names the counter on the
   * player that gates and pays for it.
   */
  { id: 'home_cooked', cost: 0, stock: 'dishes' },

  { id: 'iced_coffee', cost: 1 },
  { id: 'rose', cost: 1 },
  { id: 'lozenges', cost: 2 },
  { id: 'snack_box', cost: 2 },

  /**
   * The specific ones. These used to be LOCKED behind the matching fact and now
   * they are simply on the shelf: knowing which of them means something to whom
   * is the player's job. They cost more because a mugwort pack costs more than a
   * rose, not because they are worth more to her.
   *
   * `factId` IS NOT A GATE. It is the answer to "why would she care", and it
   * exists because the first ungated build could not supply one. Played:
   *
   *   > I give Irene a mugwort pack - her cold hand facts - while her reply is
   *   > to use it for waist ache and use it like a tea bag??
   *
   * The note said only *the player has just handed Irene a mugwort pack*, so the
   * model reached for the commonest thing a herbal pack is for and invented a
   * sore back. Part I.10 said it would read her `facts` in tier 3 and connect
   * them, and that was the one claim in it that overreached: **an inference that
   * can be stated should be stated** (section 11 measured this once already).
   *
   * So the id names the fact this object answers, exactly - never a substring,
   * which is what broke twice - and `economy.js` quotes that fact into the note
   * only when the player has actually learned it. Nothing is locked; the shelf
   * is still open; what changes is whether the note can say why.
   */
  { id: 'chicken_free_dinner', cost: 4, factId: 'no_chicken' },
  { id: 'mugwort_pack', cost: 3, factId: 'cold_hands' },
  { id: 'cold_sikhye', cost: 3, factId: 'drinks_sikhye' },
  { id: 'pink_plushie', cost: 4, factId: 'pink_and_kitty' },
  { id: 'late_night_ramen', cost: 3, factId: 'ramen_before_bed' },
  { id: 'insulated_water_jug', cost: 4, factId: 'five_litres_of_water' },
  { id: 'hot_takoyaki_box', cost: 4, factId: 'takoyaki_rounds' },
  { id: 'magical_girl_figure', cost: 4, factId: 'magical_girl_figures' },
];

export function getGift(id) {
  return GIFTS.find((g) => g.id === id) ?? null;
}
