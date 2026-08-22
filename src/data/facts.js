/**
 * What she lets slip, in two forms. CLAUDE.md sections 11, 12 and 19.
 *
 * A `learnableFacts` entry was one string doing three incompatible jobs:
 *
 *   | job                        | reader      | needs to be                 |
 *   |----------------------------|-------------|-----------------------------|
 *   | a line in prompt block 3   | the model   | English (section 19 rule 2) |
 *   | the needle a gift wants    | economy.js  | stable and comparable       |
 *   | the sentence after a snoop | the player  | the player's language       |
 *
 * It only looked correct because the third job is invisible in an English run.
 * A `zh` player learned that Irene "has extremely cold hands" - in English, on
 * a screen where every other word was Chinese.
 *
 * So a fact now has an **id**, a **canonical** English form, and a **display**
 * form per locale. The id is what the dossier and the gift catalogue hold, and
 * an id cannot be reworded by accident - which also fixes something section 12
 * already complains about, that gift `requires` matching "has regressed twice
 * during content rewrites".
 *
 * WHY THE CANONICAL TEXT IS HERE AND THE TRANSLATIONS ARE NOT
 *
 * The English is not a UI string. It goes into memory, into block 3, and it is
 * what gift needles are matched against by substring - so it must not live in
 * a file whose whole purpose is being reworded for how it reads on screen. A
 * polish pass on `i18n/en.js` would silently unhook an opener, which is the
 * exact regression above.
 *
 * The translations do live in `i18n/`, under `fact.<id>`, because section 21
 * keeps non-ASCII source out of everywhere else. So this file stays ASCII and
 * model-facing, and the localized half sits with the rest of the localized
 * half. Adding a locale means adding `fact.*` to one bundle and nothing here.
 */

import { localized } from '../i18n/index.js';

/**
 * id -> canonical English.
 *
 * Five per card, twenty-five in all, drawn from the member's publicly known
 * habits and stopping at persona level (section 22). Never a claim about a
 * real person's health, body, relationships or private life.
 */
export const FACTS = {
  // --- Irene ----------------------------------------------------------------
  no_chicken: 'cannot eat chicken, going back to something in childhood',
  cold_hands: 'has extremely cold hands and warms them with mugwort packs',
  loves_laundry: 'loves doing the laundry and the smell of fabric softener',
  gym_between_practice: 'squeezes ten-minute gym sets into the breaks between practices',
  drinks_sikhye: 'drinks sikhye instead of coffee, all year round',

  // --- Nana -----------------------------------------------------------------
  licensed_makeup_artist: 'a certified and licensed professional makeup artist',
  magical_girl_figures:
    'still keeps the magical-girl figures she grew up on, and means it about keeping the peace',
  five_litres_of_water: 'drinks up to five litres of water a day, for her skin',
  talks_too_fast: 'talks incredibly fast and trips over her words when excited',
  vitamin_pouch: 'carries a pouch of vitamins and supplements everywhere she goes',

  // --- Jisoo ----------------------------------------------------------------
  balances_things: 'balances objects on her head at random, with a completely blank face',
  hardcore_gamer: 'a hardcore gamer, Overwatch and MapleStory, and not casually',
  tasted_paper: 'tasted paper and tissues as a child, purely out of curiosity',
  speed_shopper: 'hates a long shopping trip and buys everything at speed',
  ramen_before_bed: 'eats ramen before bed on purpose, for the cheeks',

  // --- Hyewon ---------------------------------------------------------------
  takoyaki_rounds: 'wanders into other idols waiting rooms to hand out takoyaki',
  one_piece_fan: 'a serious anime fan, and One Piece above everything else',
  innocent_rapper: 'was the Innocent Rapper on the survival show and never lived it down',
  skinship_monster: 'a skinship monster who hugs and clings without thinking about it',
  kang_photo: 'takes legendary photos of her friends; they call her Kang-Photo',

  // --- Yeri -----------------------------------------------------------------
  ariana_fan: 'a devoted Ariana Grande fan, and a conspicuously successful one',
  social_butterfly: 'a social butterfly with an alarming number of famous friends',
  fearless_of_ghosts: 'has no fear of ghosts at all and walks into haunted houses first',
  pink_and_kitty: 'obsessed with the colour pink, and with Hello Kitty in particular',
  slow_eater: 'eats far more slowly than anyone else at the table',
};

export const FACT_IDS = Object.keys(FACTS);

/**
 * Normalise whichever shape a card gave us.
 *
 * Two are accepted, on purpose:
 *
 *   'cold_hands'                                    a shipped card, resolved here
 *   { id: 'hates_cold', en: '...', zh: '...' }      a custom card, self-contained
 *
 * A custom card is one file a player exports and sends to a friend, so it
 * cannot depend on a table it does not ship with, and it cannot add keys to
 * `i18n/` either (section 12). A shipped card would rather not carry its
 * translations inline five times over. Both work, and nothing outside this
 * module reads `learnableFacts` directly.
 *
 * Returns null for anything unrecognised rather than throwing: a card naming a
 * fact that a later catalogue cut should lose that fact, not take the run down.
 *
 * @returns {{ id: string, en: string, [locale: string]: string } | null}
 */
export function resolveFact(fact) {
  if (typeof fact === 'string') {
    const en = FACTS[fact];
    return en ? { id: fact, en } : null;
  }
  if (fact && typeof fact === 'object') {
    const en = fact.en ?? fact.text ?? null;
    if (!fact.id || !en) return null;
    return { ...fact, en };
  }
  return null;
}

/** Every resolvable fact on a card, in card order. */
export function cardFacts(card) {
  return (card?.learnableFacts ?? []).map(resolveFact).filter(Boolean);
}

/**
 * English. What the prompt sees, what memory stores, what gifts match.
 *
 * Never localized, in any locale, for the reason section 19 gives: the player
 * can switch language mid-run and history has to survive it.
 */
export function factCanonical(fact) {
  return resolveFact(fact)?.en ?? '';
}

/**
 * The player's language, falling back to canonical.
 *
 * A fallback rather than a blank, because a fact shown in the wrong language is
 * a cosmetic bug and a fact shown as nothing is a broken screen. An untranslated
 * locale - `ko`, `pt` - degrades to English exactly the way the bundles do.
 *
 * A custom card's own text wins over the bundle, because a player who typed the
 * fact in Chinese wrote the display form themselves and there is nothing for
 * `i18n/` to say about an id it has never heard of.
 */
export function factDisplay(fact, lang = 'en') {
  const entry = resolveFact(fact);
  if (!entry) return '';
  return entry[lang] || localized(lang, `fact.${entry.id}`) || entry.en;
}

export function factIdOf(fact) {
  return resolveFact(fact)?.id ?? null;
}
