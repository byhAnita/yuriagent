/**
 * Openers. CLAUDE.md sections 11 and 12.
 *
 * How the player walks into a scene. Three kinds:
 *
 *   generic   - anyone could have brought it, costs little, does little
 *   object    - a knowledge-gated purchase, because the fact implies a thing
 *   gesture   - a knowledge-gated ACTION, because most facts do not
 *
 * The last one is the important one. An economy whose only verb is BUY reads as
 * a shop, and most of what you learn about a person cannot be answered with a
 * purchase: you do not buy somebody their habit of balancing objects on their
 * head, or the fact that they eat slowly. `object: false` means the fact opens
 * the scene by being acted on, and nothing else. Seven of the twenty-five are
 * things; the other eighteen are things you do.
 *
 * One opener per fact, and no two members share one. The fact is quoted into
 * the scene note either way, because the payoff is identical: she hears that
 * you remembered.
 *
 * `requires` is matched against dossier.known_facts by substring, so a fact the
 * summarizer wrote in its own words still unlocks the right opener. Needles are
 * unique across the whole cast - one that matched two members' facts would hand
 * over a second opener free, and there is a test that asserts it cannot happen.
 */

export const GENERIC_GIFTS = [
  { id: 'iced_coffee', cost: 1, effect: 1 },
  { id: 'rose', cost: 1, effect: 1 },
  { id: 'lozenges', cost: 2, effect: 1 },
  { id: 'snack_box', cost: 2, effect: 1 },
];

export const KNOWLEDGE_GIFTS = [
  // --- Irene ----------------------------------------------------------------
  { id: 'chicken_free_dinner', cost: 4, effect: 5, requires: ['chicken'] },
  /**
   * Needles carry paraphrases. The summarizer writes dossier entries in its own
   * words, so a single tight needle means the opener silently never unlocks for
   * a player whose model said "her hands are always cold" instead.
   */
  {
    id: 'mugwort_pack',
    cost: 3,
    effect: 5,
    requires: ['mugwort', 'cold hand', 'hands are cold', 'hands are always cold', 'hands go cold'],
  },
  { id: 'ask_about_softener', effect: 5, object: false, requires: ['fabric softener', 'laundry'] },
  { id: 'squats_together', effect: 5, object: false, requires: ['gym', 'workout'] },
  { id: 'cold_sikhye', cost: 3, effect: 5, requires: ['sikhye'] },

  // --- Yeri -----------------------------------------------------------------
  { id: 'sing_the_duet', effect: 5, object: false, requires: ['ariana'] },
  {
    id: 'invite_her_friends',
    effect: 5,
    object: false,
    requires: ['famous friends', 'social butterfly'],
  },
  { id: 'haunted_house', effect: 5, object: false, requires: ['ghost', 'haunted'] },
  { id: 'pink_plushie', cost: 4, effect: 5, requires: ['hello kitty', 'pink'] },
  { id: 'wait_at_the_table', effect: 5, object: false, requires: ['more slowly', 'eats slowly', 'slow eater'] },

  // --- Jisoo ----------------------------------------------------------------
  { id: 'balance_the_bottle', effect: 5, object: false, requires: ['balanc'] },
  { id: 'all_nighter_co_op', effect: 5, object: false, requires: ['gamer', 'overwatch', 'maplestory'] },
  { id: 'hide_the_newspapers', effect: 5, object: false, requires: ['tissues', 'tasted paper'] },
  { id: 'speed_shopping_race', effect: 5, object: false, requires: ['shopping', 'shops'] },
  { id: 'late_night_ramen', cost: 3, effect: 5, requires: ['ramen'] },

  // --- Nana -----------------------------------------------------------------
  { id: 'ask_her_to_do_yours', effect: 5, object: false, requires: ['makeup artist', 'licensed'] },
  { id: 'magical_girl_figure', cost: 4, effect: 5, requires: ['magical-girl', 'magical girl'] },
  { id: 'insulated_water_jug', cost: 4, effect: 5, requires: ['litres of water', 'liters of water', 'five litres'] },
  { id: 'get_her_talking', effect: 5, object: false, requires: ['talks incredibly fast', 'talks fast', 'trips over her words'] },
  { id: 'ask_for_a_vitamin', effect: 5, object: false, requires: ['vitamin', 'supplement'] },

  // --- Hyewon ---------------------------------------------------------------
  { id: 'hot_takoyaki_box', cost: 4, effect: 5, requires: ['takoyaki'] },
  { id: 'gear_second_pose', effect: 5, object: false, requires: ['one piece', 'anime'] },
  { id: 'ask_for_the_flow', effect: 5, object: false, requires: ['innocent rapper'] },
  { id: 'a_long_hug', effect: 5, object: false, requires: ['skinship', 'hugs and clings'] },
  { id: 'ask_her_to_shoot_you', effect: 5, object: false, requires: ['kang-photo', 'legendary photos'] },
];

/**
 * Only the ones you can actually buy. A gesture-only opener has no price and
 * never appears in the shop half of the modal.
 */
export const BUYABLE_GIFTS = KNOWLEDGE_GIFTS.filter((g) => g.object !== false);

export const ALL_GIFTS = [...GENERIC_GIFTS, ...KNOWLEDGE_GIFTS];

export function getGift(id) {
  return ALL_GIFTS.find((g) => g.id === id) ?? null;
}
