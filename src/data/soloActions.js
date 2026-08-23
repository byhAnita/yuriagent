/**
 * What the assistant does in an empty room.
 *
 * Authored, deterministic, no LLM call - the same argument as the calendar.
 * Spending a model call on "you restocked the wardrobe" is waste, and these
 * need to be instant because they are the filler between scenes.
 *
 * The important ones are not the credit earners. They are the SNOOP actions:
 * an empty room is how you learn something about a member who is not there,
 * which is the second path into `known_facts` and therefore into the
 * knowledge-gated gifts. That is what makes an empty room worth entering.
 *
 * Snooping trades `secrecy` for knowledge. Low secrecy amplifies scene exposure
 * and feeds `exposure_end`, so the cost is real and it lands later.
 *
 * **Almost every room can teach you something.** Only three could at first, and
 * that quietly funnelled the whole knowledge economy through the wardrobe: the
 * other rooms were credit dispensers you visited when the wardrobe was busy.
 * Anywhere the player is alone, a block and some energy can buy a fact. What
 * changes room to room is the SECRECY price - a corridor is cheap to loiter in,
 * a live studio green room is not - so where you go to learn something is a
 * real choice rather than a fixed errand.
 *
 * Your own room is the exception, and stays one. There is nothing to find out
 * about anyone else in it.
 */

/**
 * effect fields:
 *   credits, competence, energy  - player deltas
 *   secrecy                      - usually negative, for the snoop actions
 *   learns                       - 'fact' or 'rumor'; which kind of find this
 *                                  snoop can turn up. See the note below.
 *   ledger                       - i18n key for the line written to block 2
 */

/**
 * WHICH kind a room teaches is decided by its slot, not by a die roll.
 *
 * `data/phaseMaps.js` has said so since phase maps shipped - `social` carries
 * the `rumor` role and `workroom_a`, `workroom_b` and `venue` carry
 * `knowledge` - and nothing read it. Every snoop drew from one pool weighted
 * 3:1, so the rumor room taught facts, the wardrobe taught rumors, and the
 * role table was decoration.
 *
 * It reads better as well as cleaner. A rumor is something people say about
 * you, so you hear it where people talk; a fact is something about HER, so you
 * find it where her work is. The player learns the map's grammar once and it
 * holds in every phase.
 */
export const SOLO_ACTIONS = {
  // --- workroom A: where the group works ------------------------------------
  practice_room: [
    { id: 'run_setlist', credits: 1, competence: 2, energy: -4 },
    { id: 'tidy_room', credits: 1, energy: -1 },
    { id: 'watch_the_playback', secrecy: -4, energy: -1, learns: 'fact' },
  ],
  broadcast_studio: [
    { id: 'help_crew', credits: 2, competence: 2, energy: -5 },
    { id: 'read_the_run_order', secrecy: -5, energy: -2, learns: 'fact' },
  ],

  // --- workroom B: where she is worked ON ------------------------------------
  wardrobe: [
    { id: 'prep_fittings', credits: 2, competence: 1, energy: -2 },
    { id: 'read_fitting_notes', secrecy: -5, energy: -1, learns: 'fact' },
  ],
  makeup_room: [
    { id: 'lay_out_the_kit', credits: 2, competence: 1, energy: -2 },
    { id: 'read_the_face_charts', secrecy: -5, energy: -1, learns: 'fact' },
  ],
  photo_studio: [
    { id: 'hold_the_reflector', credits: 2, competence: 1, energy: -3 },
    { id: 'scroll_the_contact_sheet', secrecy: -4, energy: -1, learns: 'fact' },
  ],

  /**
   * --- social: the only rooms where rumors live -----------------------------
   *
   * Nothing about her work happens here, so nothing about HER is learnable.
   * What you get instead is what the others have already heard about you,
   * which is section 5b's `heard_about` channel and the only way to see
   * jealousy coming without spending a Read her on it.
   */
  drink_room: [
    { id: 'do_the_drinks_run', credits: 2, energy: -2, goodwill: true },
    { id: 'linger_by_the_urn', secrecy: -3, energy: -1, learns: 'rumor' },
  ],
  green_room: [
    { id: 'stock_the_green_room', credits: 2, competence: 1, energy: -3 },
    // Comeback week, and everybody in here is between takes with nothing to do
    // but watch the assistant loiter. The most expensive rumor in the game.
    { id: 'stay_by_the_monitors', secrecy: -6, energy: -2, learns: 'rumor' },
  ],
  hair_salon: [
    { id: 'sweep_the_floor', credits: 1, energy: -2 },
    { id: 'wait_your_turn', secrecy: -4, energy: -1, learns: 'rumor' },
  ],

  // --- venue: out in the world, where a fact is a glimpse off duty -----------
  cafe: [
    { id: 'coffee_run', credits: -2, competence: 1, energy: -1, goodwill: true },
    { id: 'sit_alone', energy: 4 },
    { id: 'listen_in', secrecy: -2, energy: -1, learns: 'fact' },
  ],
  bistro: [
    { id: 'work_the_tables', credits: 3, energy: -4 },
    { id: 'clear_their_table', secrecy: -2, energy: -1, learns: 'fact' },
  ],
  han_river: [
    { id: 'walk_it_off', energy: 6 },
    { id: 'sit_on_the_steps', secrecy: -2, energy: -1, learns: 'fact' },
  ],

  // --- off the map, kept because a phase may want them again ----------------
  corridor: [
    { id: 'chase_schedule', credits: 2, competence: 1, energy: -2 },
    { id: 'overhear', secrecy: -3, energy: -1, learns: 'rumor' },
  ],
  drama_set: [
    { id: 'wait_on_set', credits: 1, competence: 1, energy: -3 },
    { id: 'read_call_sheet', secrecy: -4, energy: -1, learns: 'fact' },
  ],
  dorm_kitchen: [
    /**
     * Cooking alone produces an OBJECT rather than credits.
     *
     * A gift that is not a purchase, and the one use for a dorm evening that
     * is neither a snoop nor a scene. Generic tier - anybody can cook - so it
     * stays weaker than an opener bought on a fact; what it costs is a block
     * instead of money (PROPOSALS 15).
     */
    { id: 'cook_a_dish', energy: -3, dish: true },
    { id: 'cook_for_dorm', credits: 1, energy: -3, goodwill: true },
    { id: 'clean_up', credits: 1, energy: -2 },
    { id: 'read_the_fridge', secrecy: -2, energy: -1, learns: 'fact' },
  ],
  dorm_living: [{ id: 'wait_up', energy: -1, learns: 'fact', secrecy: -1 }],
  dorm_player_room: [
    { id: 'sleep_it_off', energy: 30, rest: true },
    { id: 'lie_awake', energy: 12, competence: 1, rest: true },
  ],
};

export function actionsFor(locationId) {
  return SOLO_ACTIONS[locationId] ?? [];
}

export function getSoloAction(locationId, actionId) {
  return actionsFor(locationId).find((a) => a.id === actionId) ?? null;
}
