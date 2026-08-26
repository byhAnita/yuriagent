/**
 * Every id the UI looks up must resolve in every shipped locale.
 *
 * A missing key does not throw - it renders the key, so `gift.takoyaki_pan`
 * appears on a button and nothing fails anywhere near where the mistake was
 * made. With 29 gifts, a gesture line for each, ten stances and nine stages,
 * that is a lot of surface to check by eye at every content change.
 */

import { describe, it, expect } from 'vitest';
import en from './en.js';
import zh from './zh.js';
import { FACT_IDS } from '../data/facts.js';
import { GENERIC_GIFTS, BUYABLE_GIFTS, KNOWLEDGE_GIFTS } from '../data/gifts.js';
import { SOLO_ACTIONS } from '../data/soloActions.js';
import { EMOTIONS } from '../agent/roundParser.js';
import { PHASES, mapFor } from '../data/phaseMaps.js';

const LOCALES = { en, zh };

describe('i18n coverage', () => {
  for (const [name, dict] of Object.entries(LOCALES)) {
    describe(name, () => {
      /** Only things you can buy need a shop label; gesture-only openers do not. */
      it('labels every buyable gift', () => {
        for (const gift of [...GENERIC_GIFTS, ...BUYABLE_GIFTS]) {
          expect(dict.gift?.[gift.id], `gift.${gift.id}`).toBeTruthy();
        }
      });

      it('carries no shop label for an opener that is not an object', () => {
        for (const gift of KNOWLEDGE_GIFTS.filter((g) => g.object === false)) {
          expect(dict.gift?.[gift.id], `gift.${gift.id} should not exist`).toBeUndefined();
        }
      });

      /** Knowledge gifts can also be spent as a line, and that needs its own text. */
      it('labels the gesture for every knowledge gift', () => {
        for (const gift of KNOWLEDGE_GIFTS) {
          expect(dict.gesture?.[gift.id], `gesture.${gift.id}`).toBeTruthy();
        }
      });

      it('carries the gift modal chrome', () => {
        for (const key of ['title', 'generic', 'knowledge', 'gesture', 'free', 'locked', 'hint', 'skip']) {
          expect(dict.gift?.[key], `gift.${key}`).toBeTruthy();
        }
      });

      /**
       * Added after a careless bulk replace overwrote settings.title with the
       * gift modal heading. Both locales got the same wrong value, so the
       * en/zh parity check below passed happily - identical is not the same as
       * correct, and only naming the keys catches it.
       */
      it('carries the settings chrome', () => {
        for (const key of ['title', 'theme', 'fontSize', 'language', 'model', 'apiKey']) {
          expect(dict.settings?.[key], `settings.${key}`).toBeTruthy();
        }
        expect(dict.settings.title).not.toBe(dict.gift.title);
      });

      /**
       * The handbook is where canon reaches the PLAYER (section 7). Its empty
       * state is load-bearing rather than chrome: a campaign in its first week
       * has decided nothing, and that panel is the only thing that tells the
       * player where these lines are going to come from.
       */
      it('carries the handbook chrome', () => {
        for (const key of ['title', 'open', 'close', 'cycle', 'empty']) {
          expect(dict.handbook?.[key], `handbook.${key}`).toBeTruthy();
        }
        expect(dict.handbook.empty.length).toBeGreaterThan(20);
      });

      /**
       * Every room the player can reach needs a name.
       *
       * This assertion was missing, and the phase-map work added twelve rooms
       * at once. A missing key renders as `location.hair_salon` on the map -
       * it does not throw, and nothing fails anywhere near the mistake.
       */
      it('names every location on every phase map', () => {
        for (const phase of PHASES) {
          for (const id of mapFor(phase)) {
            expect(dict.location?.[id], `location.${id} (${phase})`).toBeTruthy();
          }
        }
      });

      /** Every solo action needs a button label AND the line it prints after. */
      it('labels every solo action and its outcome', () => {
        for (const [room, actions] of Object.entries(SOLO_ACTIONS)) {
          for (const a of actions) {
            expect(dict.solo?.[a.id], `solo.${a.id} (${room})`).toBeTruthy();
            expect(dict.solo?.[`${a.id}_result`], `solo.${a.id}_result (${room})`).toBeTruthy();
          }
        }
      });

      it('carries the scene chrome', () => {
        for (const key of ['leave', 'outOfTurns', 'turnsLeft', 'readHer', 'sayIt', 'give', 'send']) {
          expect(dict.vn?.[key], `vn.${key}`).toBeTruthy();
        }
        /** The four options are backfilled when fewer than four parsed. */
        for (const key of ['a', 'b', 'c', 'd']) {
          expect(dict.vn?.fallback?.[key], `vn.fallback.${key}`).toBeTruthy();
        }
      });
    });
  }

  /**
   * The two locales must describe the same game. A key present in one and not
   * the other is how a locale silently degrades as content is added.
   */
  it('keeps en and zh in step', () => {
    const flatten = (obj, prefix = '') =>
      Object.entries(obj).flatMap(([k, v]) =>
        v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
      );

    const inEn = new Set(flatten(en));
    const inZh = new Set(flatten(zh));

    // `fact.*` is the one deliberate asymmetry; see the rule below it.
    const chrome = (k) => !k.startsWith('fact.');

    expect([...inEn].filter((k) => !inZh.has(k))).toEqual([]);
    expect([...inZh].filter(chrome).filter((k) => !inEn.has(k))).toEqual([]);
  });

  /**
   * Facts are the exception, and it is a rule rather than an oversight.
   *
   * A fact's English is its CANONICAL form: it goes into memory, into block 3,
   * and it is what gift needles are matched against by substring. There is
   * exactly one of it and it lives in `data/facts.js`, because `i18n/en.js`
   * exists to be reworded for how things read on screen and a reword there
   * would silently unhook an opener - the regression section 12 records having
   * happened twice.
   *
   * So English has no `fact.*` keys at all and falls back to canonical, while
   * every other locale must translate every fact. Both halves are asserted:
   * the first stops somebody "fixing" the asymmetry by duplicating the
   * English, the second stops a new fact shipping untranslated.
   */
  it('keeps fact text canonical in English and translated everywhere else', () => {
    expect(en.fact).toBeUndefined();

    for (const [lang, dict] of Object.entries(LOCALES)) {
      if (lang === 'en') continue;
      for (const id of FACT_IDS) {
        expect(dict.fact?.[id], `${lang} is missing fact.${id}`).toBeTruthy();
      }
    }
  });

  /** Emotion names are machine tokens and must never be localized (section 19). */
  it('does not localize the machine tokens', () => {
    for (const dict of Object.values(LOCALES)) {
      for (const emotion of EMOTIONS) {
        expect(dict.stance?.[emotion]).toBeUndefined();
      }
    }
  });
});
