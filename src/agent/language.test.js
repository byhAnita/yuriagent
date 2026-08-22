/**
 * Playing in Chinese must not put English on the screen.
 *
 * Four bugs were reported from one `zh` session, and they are two different
 * mistakes wearing the same clothes:
 *
 * 1. The MODEL wrote English beats. The language directive existed, but only at
 *    the end of block 1 - roughly 1500 tokens above the dialogue, with three
 *    English blocks in between. Exactly the distance problem section 8 already
 *    documents for `speechStyle`. Written chips, whose directive sits at the
 *    tail, were Chinese throughout: same evidence, same direction.
 *
 * 2. The UI printed MEMORY. Ledger lines, dossier entries and rumor text are
 *    English on purpose (section 19 rule 2) so the player can switch language
 *    mid-run without corrupting history. They are not display strings, and
 *    showing them is a UI bug rather than a memory one.
 */

import { describe, it, expect } from 'vitest';
import { buildSceneHeader, buildSystemBlock } from './promptBuilder.js';
import { summarizerInstruction, SUMMARIZER_INSTRUCTION, parseSummary } from './summarizer.js';
import { propagate } from '../systems/rumor.js';
import { newRelation } from '../systems/relationship.js';
import { getCast } from '../data/cast.js';
import en from '../i18n/en.js';
import zh from '../i18n/zh.js';

const cards = getCast();
const roster = cards.slice(0, 1);
const relations = Object.fromEntries(cards.map((c) => [c.id, newRelation(5)]));

const header = (lang) =>
  buildSceneHeader({
    roster,
    absent: cards.slice(1),
    relations,
    player: { name: 'Yuhan', energy: 80 },
    week: 0,
    day: 0,
    block: 'evening',
    phase: 'prep',
    locationLabel: 'X Practice Room',
    exposure: 20,
    lang,
  });

describe('the language directive is repeated where the model can see it', () => {
  it('says it again in block 4, close to the dialogue', () => {
    expect(header('zh')).toContain('Simplified Chinese');
  });

  it('tells the model the English above it is bookkeeping', () => {
    expect(header('zh')).toContain('Do not answer in English');
  });

  it('keeps the machine tokens ASCII in the reminder too', () => {
    expect(header('zh')).toContain('Metadata lines, speaker ids and emotion names stay ASCII');
  });

  /** An English run needs no reminder, and the tokens would be wasted. */
  it('adds nothing at all for an English run', () => {
    expect(header('en')).not.toContain('Do not answer in English');
    expect(header(undefined)).not.toContain('Do not answer in English');
  });

  it('still carries the original directive in block 1', () => {
    const block1 = buildSystemBlock({ cards, lineup: {}, identity: {}, lang: 'zh' });
    expect(block1).toContain('Write all prose and dialogue in Simplified Chinese');
  });
});

describe('the summarizer writes twice: once for memory, once for the player', () => {
  it('asks for a display line in the player language', () => {
    expect(summarizerInstruction('zh')).toContain('display');
    expect(summarizerInstruction('zh')).toContain('Never English');
  });

  it('asks for nothing extra in English', () => {
    expect(summarizerInstruction('en')).toBe(SUMMARIZER_INSTRUCTION);
  });

  /** Memory stays English whatever the scene was written in. */
  it('keeps the memory line English in the contract', () => {
    expect(SUMMARIZER_INSTRUCTION).toContain('ENGLISH');
  });

  it('parses both lines out', () => {
    const raw = '{"summary":"They talked.","display":"她们聊了聊。","dossier_add":[]}';
    const out = parseSummary(raw, { rosterIds: ['irene'] });
    expect(out.summary).toBe('They talked.');
    expect(out.display).toBe('她们聊了聊。');
  });

  /**
   * A missing display line degrades to the wrong LANGUAGE, never to a blank.
   * An empty aftermath is worse than an English one.
   */
  it('falls back to the English line rather than showing nothing', () => {
    const out = parseSummary('{"summary":"They talked."}', { rosterIds: ['irene'] });
    expect(out.display).toBe('They talked.');
  });
});

describe('a rumor carries its shape, so the UI never has to print memory', () => {
  const out = propagate({
    scene: { exposure: 20, phase: 'prep', locationId: 'practice_room', presentIds: cards.map((c) => c.id) },
    subject: { id: 'irene', name: 'Irene' },
    cast: cards,
    relations,
    rng: () => 0.99,
  });

  it('says what kind of knowing it was', () => {
    for (const r of out.rumors) expect(['witnessed', 'approach', 'heard']).toContain(r.kind);
  });

  it('names the subject and the place separately from the sentence', () => {
    for (const r of out.rumors) {
      expect(r.subjectName).toBe('Irene');
      expect(r.locationId).toBe('practice_room');
    }
  });

  it('still stores the English line for her dossier', () => {
    expect(out.rumors[0].text).toContain('you saw the player with Irene');
  });

  it('has a localized template for every kind, in both locales', () => {
    for (const dict of [en, zh]) {
      for (const kind of ['witnessed', 'approach', 'heard']) {
        expect(dict.rumorLine?.[kind], kind).toBeTruthy();
      }
    }
  });

  it('gives the zh templates no English words to leak', () => {
    for (const kind of ['witnessed', 'approach', 'heard']) {
      const line = zh.rumorLine[kind].replace(/\{\w+\}/g, '');
      expect(/[a-z]{3,}/i.test(line), `zh.rumorLine.${kind}: ${line}`).toBe(false);
    }
  });
});
