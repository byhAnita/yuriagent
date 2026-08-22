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
 *
 * Every knowledge gift here answers a specific habit on a specific card rather
 * than a generic idol-shaped need. An earlier catalogue did the reverse - eight
 * neutral objects, one fact per member written to fit them - and it produced a
 * fixed lookup: jisoo always meant the annotated script, hyewon always meant the
 * knee brace. Writing the gift to the habit instead is what makes the reaction
 * specific AND makes which gift you can buy depend on what you happened to
 * learn first.
 */

export const GENERIC_GIFTS = [
  { id: 'iced_coffee', cost: 1, effect: 1 },
  { id: 'rose', cost: 1, effect: 1 },
  { id: 'lozenges', cost: 2, effect: 1 },
  { id: 'snack_box', cost: 2, effect: 1 },
];

export const KNOWLEDGE_GIFTS = [
  /**
   * Irene - cold hands, the laundry, the purple notebooks.
   *
   * `requires` carries paraphrases, not just the card's own wording. The
   * summarizer writes dossier entries in its own words (section 11), so a
   * single tight needle would mean the gift silently never unlocks for a player
   * whose model happened to phrase it as "her hands are always cold".
   */
  {
    id: 'hand_warmer',
    cost: 3,
    effect: 5,
    requires: ['cold hand', 'hands are cold', 'hands are always cold', 'hands go cold'],
  },
  { id: 'fabric_softener', cost: 3, effect: 5, requires: ['softener', 'laundry', 'washing'] },
  { id: 'purple_notebook', cost: 3, effect: 5, requires: ['purple notebook', 'purple journal', 'notebooks in purple'] },

  // Nana - the trained makeup artist, the ankle she never mentions.
  { id: 'makeup_brush_set', cost: 4, effect: 5, requires: ['makeup', 'does her own face', 'make-up'] },
  { id: 'ankle_tape', cost: 3, effect: 5, requires: ['ankle'] },

  // Jisoo - the film camera, the scripts, the homesickness.
  { id: 'film_roll', cost: 4, effect: 5, requires: ['film', 'photos', 'photograph'] },
  { id: 'script_annotations', cost: 3, effect: 5, requires: ['script', 'annotates'] },
  { id: 'hometown_dish', cost: 4, effect: 5, requires: ['homesick', 'kimchi', 'misses home', 'food from home'] },

  // Hyewon - the piano, the anime she will not be hurried through.
  { id: 'piano_songbook', cost: 3, effect: 5, requires: ['piano'] },
  { id: 'anime_artbook', cost: 3, effect: 5, requires: ['anime', 'animation'] },

  // Yeri - the lyrics out of novels, the perfume, the third language.
  { id: 'lyric_notebook', cost: 3, effect: 5, requires: ['writes music', 'writes lyrics', 'writing songs'] },
  { id: 'perfume', cost: 5, effect: 5, requires: ['perfume', 'scent'] },
  { id: 'phrasebook', cost: 3, effect: 5, requires: ['third language', 'teaching herself a language'] },
];

export const ALL_GIFTS = [...GENERIC_GIFTS, ...KNOWLEDGE_GIFTS];

export function getGift(id) {
  return ALL_GIFTS.find((g) => g.id === id) ?? null;
}
