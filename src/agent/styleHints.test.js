/**
 * Her voice in the language the scene is being written in. PROPOSALS 26.
 *
 * `styleHints` has been on the card schema since M0, section 12 built it for
 * exactly this, and until now NOTHING READ IT - eight cards, every hint null,
 * one comment mentioning the field. A designed slot with no consumer is the
 * `markRisk` shape in its mildest form, and the only reason it was mild is that
 * every hint was null, so the absence was invisible.
 *
 * These assertions are therefore mostly about the JOIN: that a hint on a card
 * reaches block 4, that it does so only in the language it belongs to, and that
 * a card without one is byte-for-byte what it was.
 */

import { describe, it, expect } from 'vitest';
import { buildSceneHeader } from './promptBuilder.js';
import { getCast } from '../data/cast.js';
import { newRelation } from '../systems/relationship.js';

const cards = getCast();
const castIds = cards.map((c) => c.id);
const relations = Object.fromEntries(castIds.map((id) => [id, newRelation(30)]));

const block = (lang, rosterIds = ['irene'], source = cards) =>
  buildSceneHeader({
    roster: source.filter((c) => rosterIds.includes(c.id)),
    absent: source.filter((c) => !rosterIds.includes(c.id)),
    relations,
    player: { name: 'Yuhan', energy: 80 },
    week: 0,
    day: 1,
    block: 'evening',
    phase: 'prep',
    locationLabel: 'X Practice Room',
    exposure: 20,
    lang,
  });

const hintFor = (id) => cards.find((c) => c.id === id).styleHints.zh;

describe('the hint reaches the prompt', () => {
  it('is in block 4 for a zh scene', () => {
    expect(block('zh')).toContain(hintFor('irene'));
  });

  /**
   * English is the language the card is AUTHORED in, so a hint there would be
   * the card said twice - and `speechStyle` is already repeated in this block.
   */
  it('is absent in en, where the card already says it', () => {
    expect(block('en')).not.toContain(hintFor('irene'));
    expect(block('en')).toContain('Irene speaks like this');
  });

  /** Roster-scoped, like everything else in block 4 (section 7, rule 1). */
  it('is only there for members who are in the room', () => {
    const text = block('zh', ['irene']);
    expect(text).toContain(hintFor('irene'));
    expect(text).not.toContain(hintFor('yeri'));
  });

  it('carries every present member in a group scene', () => {
    const text = block('zh', ['irene', 'yeri']);
    expect(text).toContain(hintFor('irene'));
    expect(text).toContain(hintFor('yeri'));
  });

  /**
   * A card with no hint for this language is the normal case - `ko` is null on
   * every card, and a custom card may ship none at all. It must render exactly
   * what it rendered before, not an empty line.
   */
  it('says nothing at all when a card has no hint for the language', () => {
    const text = block('ko');
    expect(text).not.toMatch(/sounds like this/);
  });

  it('says nothing when the card carries no styleHints object', () => {
    const bare = cards.map((c) => ({ ...c, styleHints: undefined }));
    expect(() => block('zh', ['irene'], bare)).not.toThrow();
    expect(block('zh', ['irene'], bare)).not.toMatch(/sounds like this/);
  });
});

describe('the cast is actually voiced', () => {
  /**
   * The MVP five, and only those. The library cards (seulgi, wendy, joy) are
   * deliberately left without one - the Latin stage name and the English card
   * stand, the same rule `nameLocal` follows.
   */
  it('has a zh hint for every member of the shipped cast', () => {
    for (const c of cards) {
      expect(c.styleHints?.zh, `${c.id} has no zh voicing`).toBeTruthy();
      expect(c.styleHints.zh.length).toBeGreaterThan(20);
    }
  });

  /** Two members with the same voicing is two members with the same character. */
  it('gives each of them a different one', () => {
    const seen = new Set(cards.map((c) => c.styleHints.zh));
    expect(seen.size).toBe(cards.length);
  });
});

/**
 * The prose rules that sit beside it. These reach every `zh` scene, hinted card
 * or not, and they are the half of PROPOSALS 26 that costs nothing.
 */
describe('the zh block says how to write, not only what language', () => {
  it('asks for a novelist rather than a translator', () => {
    const text = block('zh');
    expect(text).toMatch(/Chinese novelist writes, not as a translator/);
    expect(text).toMatch(/never carry an/);
  });

  it('keeps the two rules that were already there', () => {
    const text = block('zh');
    expect(text).toMatch(/Simplified characters only/);
    expect(text).toMatch(/never use male-coded physical description/);
  });

  it('says none of it in English', () => {
    const text = block('en');
    expect(text).not.toMatch(/Chinese novelist/);
    expect(text).not.toMatch(/Simplified characters only/);
  });
});
