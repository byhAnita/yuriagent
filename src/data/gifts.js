/**
 * Gift catalogue. CLAUDE.md section 11.
 *
 * Two tiers. Generic gifts cost little and do little. Knowledge-gated gifts are
 * only purchasable once the matching fact is in her dossier - and because the
 * fact is then also in the prompt, the model writes a reaction that could not
 * have been written for anyone else. That is the whole loop:
 *
 *   dialogue -> dossier fact -> a specific gift -> unique reaction
 *
 * `requires` is matched against dossier.known_facts by substring, so a fact the
 * summarizer wrote in its own words still unlocks the right gift.
 */

export const GENERIC_GIFTS = [
  { id: 'iced_coffee', cost: 1, effect: 1 },
  { id: 'rose', cost: 1, effect: 1 },
  { id: 'lozenges', cost: 2, effect: 1 },
  { id: 'snack_box', cost: 2, effect: 1 },
];

export const KNOWLEDGE_GIFTS = [
  { id: 'hand_warmer', cost: 3, effect: 5, requires: ['cold hands', 'cold'] },
  { id: 'hometown_dish', cost: 4, effect: 5, requires: ['hometown', 'homesick'] },
  { id: 'sheet_music', cost: 3, effect: 5, requires: ['composing', 'writes music'] },
  { id: 'script_annotations', cost: 3, effect: 5, requires: ['script', 'audition'] },
  { id: 'knee_brace', cost: 4, effect: 5, requires: ['knee', 'injury', 'old injury'] },
  { id: 'blackout_mask', cost: 3, effect: 5, requires: ['cannot sleep', 'insomnia', 'sleep'] },
  { id: 'makeup_brush_set', cost: 4, effect: 5, requires: ['makeup', 'does her own face'] },
  { id: 'film_camera', cost: 5, effect: 5, requires: ['photos', 'camera', 'film'] },
];

export const ALL_GIFTS = [...GENERIC_GIFTS, ...KNOWLEDGE_GIFTS];

export function getGift(id) {
  return ALL_GIFTS.find((g) => g.id === id) ?? null;
}
