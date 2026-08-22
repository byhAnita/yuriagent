/**
 * A fact has to be three things at once, and it cannot be one string.
 *
 * PROPOSALS 14. The bug was invisible in an English run by construction: the
 * canonical English IS the correct display in English, so nothing looked wrong
 * until somebody played in Chinese and read "has extremely cold hands" on an
 * otherwise Chinese screen.
 */

import { describe, it, expect } from 'vitest';
import {
  FACTS,
  FACT_IDS,
  resolveFact,
  cardFacts,
  factCanonical,
  factDisplay,
  factIdOf,
} from './facts.js';
import { getCast, LIBRARY } from './cast.js';
import zh from '../i18n/zh.js';

const cards = getCast();

describe('the fact table', () => {
  it('is ASCII, because it is model-facing English', () => {
    for (const [id, text] of Object.entries(FACTS)) {
      // eslint-disable-next-line no-control-regex
      expect(/^[\x20-\x7e]+$/.test(text), `${id}: ${text}`).toBe(true);
      expect(/^[a-z0-9_]+$/.test(id), id).toBe(true);
    }
  });

  it('gives every cast card five facts that resolve', () => {
    for (const card of cards) {
      const facts = cardFacts(card);
      expect(facts.length, card.id).toBe(5);
      for (const fact of facts) expect(fact.en).toBeTruthy();
    }
  });

  /**
   * A fact naming nobody is content that can never be found, and it is the
   * shape a rename leaves behind.
   */
  it('leaves no fact unowned and none owned twice', () => {
    const owners = new Map();
    for (const card of Object.values(LIBRARY)) {
      for (const id of card.learnableFacts ?? []) {
        expect(owners.has(id), `${id} on ${card.id} and ${owners.get(id)}`).toBe(false);
        owners.set(id, card.id);
      }
    }
    for (const id of FACT_IDS) {
      expect(owners.has(id), `${id} belongs to nobody`).toBe(true);
    }
  });
});

describe('resolving either shape', () => {
  it('takes a shipped id', () => {
    expect(resolveFact('cold_hands')).toEqual({ id: 'cold_hands', en: FACTS.cold_hands });
  });

  /**
   * A custom card is one file a player exports and sends to a friend, so it
   * cannot depend on a table it does not ship with, and it cannot add keys to
   * i18n either. Its facts carry their own text.
   */
  it('takes a custom card that carries its own text', () => {
    const own = { id: 'hates_cold', en: 'hates the cold', zh: 'PLACEHOLDER' };
    expect(factCanonical(own)).toBe('hates the cold');
    expect(factDisplay(own, 'zh')).toBe('PLACEHOLDER');
    expect(factIdOf(own)).toBe('hates_cold');
  });

  it('drops a fact it cannot resolve rather than throwing', () => {
    expect(resolveFact('no_such_fact')).toBeNull();
    expect(resolveFact({ en: 'no id' })).toBeNull();
    expect(resolveFact(null)).toBeNull();
    expect(factCanonical('no_such_fact')).toBe('');
    expect(cardFacts({ learnableFacts: ['cold_hands', 'no_such_fact'] })).toHaveLength(1);
  });
});

describe('canonical and display are not the same string', () => {
  it('keeps English canonical, in every locale', () => {
    for (const id of FACT_IDS) {
      expect(factCanonical(id)).toBe(FACTS[id]);
      expect(factDisplay(id, 'en')).toBe(FACTS[id]);
    }
  });

  it('shows a zh player Chinese, and nothing English', () => {
    for (const id of FACT_IDS) {
      const shown = factDisplay(id, 'zh');
      expect(shown, id).toBe(zh.fact[id]);
      expect(shown, id).not.toBe(FACTS[id]);
      // The real assertion: no Latin sentence survived onto the screen.
      expect(/[a-z]{4,}/.test(shown.replace(/Ariana Grande|Hello Kitty|rapper/g, '')), id).toBe(
        false,
      );
    }
  });

  /**
   * `ko` and `pt` are v2 and have no bundle. A fact must degrade to English
   * the way the i18n bundles do, not to a blank line - a fact shown in the
   * wrong language is cosmetic and a fact shown as nothing is a broken screen.
   */
  it('falls back to canonical for a locale that has not been translated', () => {
    expect(factDisplay('cold_hands', 'ko')).toBe(FACTS.cold_hands);
    expect(factDisplay('cold_hands', 'nonsense')).toBe(FACTS.cold_hands);
  });
});
