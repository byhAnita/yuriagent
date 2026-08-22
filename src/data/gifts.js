/**
 * Gift catalogue. CLAUDE.md sections 11 and 12.
 *
 * Two tiers. Generic gifts cost little and do little. Knowledge-gated gifts are
 * only purchasable once the matching fact is in her dossier - and because the
 * fact is then also in the prompt, the model writes a reaction that could not
 * have been written for anyone else. That is the whole loop:
 *
 *   dialogue -> dossier fact -> a specific gift -> unique reaction
 *
 * **One gift per fact, and no two members share one.** Five members, five facts
 * each, twenty-five knowledge gifts. Earlier versions had eight neutral objects
 * shared across the cast and one matching fact per member, which made the whole
 * economy a lookup: learning anything about jisoo told you exactly what to buy.
 * Writing a gift for each individual habit means what you can buy depends on
 * which fact you happened to turn up, and the gift itself says who she is.
 *
 * `requires` is matched against dossier.known_facts by substring, so a fact the
 * summarizer wrote in its own words still unlocks the right gift. Needles carry
 * paraphrases for that reason, and they are chosen to be unique across the cast
 * - a needle that matches two members' facts hands over a second gift free, and
 * there is a test that asserts it cannot happen.
 */

export const GENERIC_GIFTS = [
  { id: 'iced_coffee', cost: 1, effect: 1 },
  { id: 'rose', cost: 1, effect: 1 },
  { id: 'lozenges', cost: 2, effect: 1 },
  { id: 'snack_box', cost: 2, effect: 1 },
];

export const KNOWLEDGE_GIFTS = [
  // --- Irene: the laundry, the notebooks, the mind maps, the cold hands ------
  { id: 'fabric_softener', cost: 3, effect: 5, requires: ['softener', 'laundry'] },
  { id: 'purple_notebook', cost: 3, effect: 5, requires: ['purple notebook', 'purple'] },
  { id: 'fineliner_set', cost: 3, effect: 5, requires: ['mind map'] },
  {
    id: 'hand_warmer',
    cost: 3,
    effect: 5,
    requires: ['cold hand', 'hands are cold', 'hands are always cold', 'hands go cold'],
  },
  { id: 'stretching_band', cost: 4, effect: 5, requires: ['flexible', 'flexibility'] },

  // --- Nana: the trained artist, the figures, the ankle, the dorm, the fox ---
  { id: 'makeup_brush_set', cost: 4, effect: 5, requires: ['makeup', 'make-up', 'does her own face'] },
  { id: 'magical_girl_figure', cost: 4, effect: 5, requires: ['magical-girl', 'magical girl'] },
  { id: 'ankle_tape', cost: 3, effect: 5, requires: ['ankle'] },
  { id: 'dorm_mug_set', cost: 4, effect: 5, requires: ['only child'] },
  { id: 'fox_keyring', cost: 3, effect: 5, requires: ['desert fox'] },

  // --- Jisoo: the film, the nicknames, the heat, the dog, the comics --------
  { id: 'film_roll', cost: 4, effect: 5, requires: ['shoots on film', 'undeveloped'] },
  { id: 'label_maker', cost: 3, effect: 5, requires: ['nickname'] },
  { id: 'spicy_ramyun_crate', cost: 3, effect: 5, requires: ['spiciest', 'instant noodles'] },
  { id: 'pet_photo_frame', cost: 3, effect: 5, requires: ['her dog'] },
  { id: 'comic_volume', cost: 3, effect: 5, requires: ['comics'] },

  // --- Hyewon: the piano, the anime, the selfies, the arithmetic, takoyaki --
  { id: 'piano_songbook', cost: 3, effect: 5, requires: ['piano'] },
  { id: 'anime_artbook', cost: 4, effect: 5, requires: ['anime'] },
  { id: 'phone_ring_light', cost: 4, effect: 5, requires: ['selfies', 'selca'] },
  { id: 'puzzle_book', cost: 3, effect: 5, requires: ['arithmetic', 'in her head'] },
  { id: 'takoyaki_pan', cost: 4, effect: 5, requires: ['takoyaki'] },

  // --- Yeri: the lyrics, the perfume, the language, the mess, the kimchi ----
  { id: 'lyric_notebook', cost: 3, effect: 5, requires: ['writes music', 'writes lyrics'] },
  { id: 'perfume', cost: 5, effect: 5, requires: ['perfume'] },
  { id: 'phrasebook', cost: 3, effect: 5, requires: ['third language'] },
  { id: 'desk_organiser', cost: 3, effect: 5, requires: ['messiest'] },
  { id: 'kimchi_kit', cost: 4, effect: 5, requires: ['kimchi fried rice', 'kimchi'] },
];

export const ALL_GIFTS = [...GENERIC_GIFTS, ...KNOWLEDGE_GIFTS];

export function getGift(id) {
  return ALL_GIFTS.find((g) => g.id === id) ?? null;
}
