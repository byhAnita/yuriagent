/**
 * The Chinese half of every card in the MVP cast. CLAUDE.md Part I.6.
 *
 * This is the file the whole v2 redesign turns on. `rv-simulator` reads native
 * in Chinese because the model is INSTRUCTED in English and IMMERSED in the
 * player's language, and a card is most of the immersion - roughly 1500 tokens
 * of tier 1 describing who these people are. v1 wrote all of it in English and
 * a native reader called the result machine translation.
 *
 * So: every romanceable member needs a `zh` profile, and four things about it
 * are asserted rather than reviewed, because all four have gone wrong once.
 */

import { describe, it, expect } from 'vitest';
import { getCast } from './cast.js';
import { renderProfile } from '../agent/tiers.js';

const cast = getCast();
const FIELDS = ['publicImage', 'personality', 'queerTexture', 'speechStyle'];

/** Han characters. The only reliable test for "is this actually Chinese". */
const HAN = /[一-鿿]/;

/**
 * Traditional-only characters that a model or a careless author reaches for.
 *
 * Not exhaustive and does not need to be - it is a smoke alarm. The rule is in
 * `config/rules.js` for the model; this is the same rule for the humans, and it
 * caught a hand-written identity paragraph before it was committed.
 */
const TRADITIONAL = /[說們這時個為對後點裡機關聯麼車東媽記樣過還經開間題錯認識愛實體歲頭練習聲響應導兒學會現實給讓親]/;

describe('the cast in Chinese', () => {
  it.each(cast.map((c) => [c.id, c]))('%s has a zh profile', (_id, card) => {
    expect(card.profileLocal?.zh).toBeTruthy();
    for (const field of FIELDS) {
      const text = card.profileLocal.zh[field];
      expect(text, field).toBeTruthy();
      expect(HAN.test(text), field).toBe(true);
    }
  });

  /**
   * Section 1b. `origin` is library metadata for the card picker and is NEVER
   * injected into a prompt - in fiction there is no Red Velvet, there is X.
   *
   * Worth asserting here specifically because three of these profiles are
   * adapted from `rv-simulator`, whose own text names the real groups. Leaking
   * one makes the model narrate the wrong world.
   */
  it('never names a real group, in either language', () => {
    const groups = [...new Set(cast.map((c) => c.origin).filter(Boolean))];
    const alsoZh = ['宇宙少女', '少女时代', '防弹', 'BLACKPINK', 'IZ*ONE', 'IZONE', 'Red Velvet'];

    for (const card of cast) {
      const rendered = `${renderProfile(card, 'zh')}\n${renderProfile(card, 'en')}`;
      for (const name of [...groups, ...alsoZh]) {
        expect(rendered, `${card.id} leaks ${name}`).not.toContain(name);
      }
    }
  });

  it('uses Simplified characters only', () => {
    for (const card of cast) {
      for (const field of FIELDS) {
        expect(TRADITIONAL.test(card.profileLocal.zh[field]), `${card.id}.${field}`).toBe(false);
      }
    }
  });

  /**
   * The mascot note is her animal, and the card is the source of truth for
   * which one. The adapted profiles came from a file whose jisoo is a rabbit
   * and whose hyewon is a cat, and ours are a cat and a deer - so a straight
   * lift would have put the wrong animal in the prompt beside the right one on
   * the portrait.
   */
  it('keeps the card mascot rather than the source it was adapted from', () => {
    const animal = { cat: '猫', deer: '鹿', turtle: '乌龟', fox: '狐狸', rabbit: '兔子' };
    for (const card of cast) {
      const note = card.profileLocal.zh.mascotNote;
      if (!note) continue;
      expect(note, card.id).toContain(animal[card.mascot]);
    }
  });

  /** And it all reaches the prompt, which is the join rather than the data. */
  it('is what renderProfile actually emits in zh', () => {
    for (const card of cast) {
      const zh = renderProfile(card, 'zh');
      expect(zh).toContain(card.profileLocal.zh.speechStyle);
      expect(zh).not.toContain(card.speechStyle);
    }
  });
});
