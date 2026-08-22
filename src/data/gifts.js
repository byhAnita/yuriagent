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
 * TWO WAYS AN OPENER UNLOCKS, because there are two ways a fact arrives.
 *
 * `factIds` is the exact one. A snooped fact is drawn from the card's
 * `learnableFacts` and reaches the dossier carrying the id it was awarded
 * under, so the match survives any rewording of either side - the regression
 * section 12 records having happened twice during content rewrites.
 *
 * `requires` is the tolerant one, matched against the entry text by substring.
 * A fact that came up in DIALOGUE is written by the summarizer in its own
 * words and has no id, and never can have one, so needles carry paraphrases:
 * a single tight needle means the opener silently never unlocks for a player
 * whose model said "her hands are always cold" instead.
 *
 * Both lists stay. Needles are unique across the whole cast - one that matched
 * two members' facts would hand over a second opener free - and there is a
 * test that asserts it cannot happen.
 */

export const GENERIC_GIFTS = [
  { id: 'iced_coffee', cost: 1, effect: 1 },
  { id: 'rose', cost: 1, effect: 1 },
  { id: 'lozenges', cost: 2, effect: 1 },
  { id: 'snack_box', cost: 2, effect: 1 },
];

export const KNOWLEDGE_GIFTS = [
  // --- Irene ----------------------------------------------------------------
  { id: 'chicken_free_dinner', factIds: ['no_chicken'], cost: 4, effect: 5, requires: ['chicken'] },
  {
    id: 'mugwort_pack',
    factIds: ['cold_hands'],
    cost: 3,
    effect: 5,
    requires: ['mugwort', 'cold hand', 'hands are cold', 'hands are always cold', 'hands go cold'],
  },
  { id: 'ask_about_softener', factIds: ['loves_laundry'], effect: 5, object: false, requires: ['fabric softener', 'laundry'] },
  { id: 'squats_together', factIds: ['gym_between_practice'], effect: 5, object: false, requires: ['gym', 'workout'] },
  { id: 'cold_sikhye', factIds: ['drinks_sikhye'], cost: 3, effect: 5, requires: ['sikhye'] },

  // --- Yeri -----------------------------------------------------------------
  { id: 'sing_the_duet', factIds: ['ariana_fan'], effect: 5, object: false, requires: ['ariana'] },
  {
    id: 'invite_her_friends',
    factIds: ['social_butterfly'],
    effect: 5,
    object: false,
    requires: ['famous friends', 'social butterfly'],
  },
  { id: 'haunted_house', factIds: ['fearless_of_ghosts'], effect: 5, object: false, requires: ['ghost', 'haunted'] },
  { id: 'pink_plushie', factIds: ['pink_and_kitty'], cost: 4, effect: 5, requires: ['hello kitty', 'pink'] },
  { id: 'wait_at_the_table', factIds: ['slow_eater'], effect: 5, object: false, requires: ['more slowly', 'eats slowly', 'slow eater'] },

  // --- Jisoo ----------------------------------------------------------------
  { id: 'balance_the_bottle', factIds: ['balances_things'], effect: 5, object: false, requires: ['balanc'] },
  { id: 'all_nighter_co_op', factIds: ['hardcore_gamer'], effect: 5, object: false, requires: ['gamer', 'overwatch', 'maplestory'] },
  { id: 'hide_the_newspapers', factIds: ['tasted_paper'], effect: 5, object: false, requires: ['tissues', 'tasted paper'] },
  { id: 'speed_shopping_race', factIds: ['speed_shopper'], effect: 5, object: false, requires: ['shopping', 'shops'] },
  { id: 'late_night_ramen', factIds: ['ramen_before_bed'], cost: 3, effect: 5, requires: ['ramen'] },

  // --- Nana -----------------------------------------------------------------
  { id: 'ask_her_to_do_yours', factIds: ['licensed_makeup_artist'], effect: 5, object: false, requires: ['makeup artist', 'licensed'] },
  { id: 'magical_girl_figure', factIds: ['magical_girl_figures'], cost: 4, effect: 5, requires: ['magical-girl', 'magical girl'] },
  { id: 'insulated_water_jug', factIds: ['five_litres_of_water'], cost: 4, effect: 5, requires: ['litres of water', 'liters of water', 'five litres'] },
  { id: 'get_her_talking', factIds: ['talks_too_fast'], effect: 5, object: false, requires: ['talks incredibly fast', 'talks fast', 'trips over her words'] },
  { id: 'ask_for_a_vitamin', factIds: ['vitamin_pouch'], effect: 5, object: false, requires: ['vitamin', 'supplement'] },

  // --- Hyewon ---------------------------------------------------------------
  { id: 'hot_takoyaki_box', factIds: ['takoyaki_rounds'], cost: 4, effect: 5, requires: ['takoyaki'] },
  { id: 'gear_second_pose', factIds: ['one_piece_fan'], effect: 5, object: false, requires: ['one piece', 'anime'] },
  { id: 'ask_for_the_flow', factIds: ['innocent_rapper'], effect: 5, object: false, requires: ['innocent rapper'] },
  { id: 'a_long_hug', factIds: ['skinship_monster'], effect: 5, object: false, requires: ['skinship', 'hugs and clings'] },
  { id: 'ask_her_to_shoot_you', factIds: ['kang_photo'], effect: 5, object: false, requires: ['kang-photo', 'legendary photos'] },
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
