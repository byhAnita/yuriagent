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
import { GENERIC_GIFTS, BUYABLE_GIFTS, KNOWLEDGE_GIFTS } from '../data/gifts.js';
import { STANCES } from '../systems/chips.js';
import { EMOTIONS } from '../agent/promptBuilder.js';

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

      it('labels every stance', () => {
        for (const stance of STANCES) {
          expect(dict.stance?.[stance], `stance.${stance}`).toBeTruthy();
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

      it('carries the scene chrome', () => {
        for (const key of ['continue', 'leave', 'outOfTurns', 'turnsLeft', 'readHer', 'sayIt']) {
          expect(dict.vn?.[key], `vn.${key}`).toBeTruthy();
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

    expect([...inEn].filter((k) => !inZh.has(k))).toEqual([]);
    expect([...inZh].filter((k) => !inEn.has(k))).toEqual([]);
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
