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
 */

/**
 * effect fields:
 *   credits, competence, energy  - player deltas
 *   secrecy                      - usually negative, for the snoop actions
 *   learns                       - pulls a fact into a member's dossier
 *   ledger                       - i18n key for the line written to block 2
 */
export const SOLO_ACTIONS = {
  wardrobe: [
    { id: 'prep_fittings', credits: 2, competence: 1, energy: -2 },
    { id: 'read_fitting_notes', secrecy: -5, energy: -1, learns: true },
  ],
  corridor: [
    { id: 'chase_schedule', credits: 2, competence: 1, energy: -2 },
    { id: 'overhear', secrecy: -3, energy: -1, learns: true },
  ],
  practice_room: [
    { id: 'run_setlist', credits: 1, competence: 2, energy: -4 },
    { id: 'tidy_room', credits: 1, energy: -1 },
  ],
  broadcast_studio: [{ id: 'help_crew', credits: 2, competence: 2, energy: -5 }],
  drama_set: [{ id: 'wait_on_set', credits: 1, competence: 1, energy: -3 }],
  cafe: [
    { id: 'coffee_run', credits: -2, competence: 1, energy: -1, goodwill: true },
    { id: 'sit_alone', energy: 4 },
  ],
  dorm_kitchen: [
    { id: 'cook_for_dorm', credits: 1, energy: -3, goodwill: true },
    { id: 'clean_up', credits: 1, energy: -2 },
  ],
  dorm_living: [{ id: 'wait_up', energy: -1, learns: true, secrecy: -1 }],
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
