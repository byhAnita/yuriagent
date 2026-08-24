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
import { buildSceneHeader, buildSystemBlock, nameFor } from './promptBuilder.js';
import { summarizerInstruction, SUMMARIZER_INSTRUCTION, parseSummary } from './summarizer.js';
import { propagate } from '../systems/rumor.js';
import { newRelation } from '../systems/relationship.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import en from '../i18n/en.js';
import zh from '../i18n/zh.js';

const cards = getCast();
const lineup = buildLineup(cards);
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
    expect(block1).toContain('Write in Simplified Chinese: BOTH halves of every beat');
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
    scene: {
      exposure: 20,
      phase: 'prep',
      locationId: 'practice_room',
      presentIds: cards.map((c) => c.id),
      // Co-presence alone no longer produces a witnessed rumor; the player has
      // to have made a move. See `witnessed.test.js`.
      singledOut: true,
    },
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

/**
 * Day-three playtest, `zh`. Four defects that all live in one place: what the
 * model is told about writing Chinese.
 */
describe('a zh run is told the things only a zh run needs', () => {
  const header = (over = {}) =>
    buildSceneHeader({
      roster: [{ id: 'irene', name: 'Irene' }],
      absent: [],
      week: 0,
      day: 1,
      block: 'morning',
      phase: 'prep',
      locationLabel: 'Practice Room',
      exposure: 20,
      lang: 'zh',
      cards,
      relations,
      ...over,
    });

  /** One Traditional character turned up mid-scene. The language NAME says
   *  Simplified and that was not enough on its own. */
  it('asks for Simplified characters explicitly', () => {
    expect(header()).toMatch(/Simplified characters only/i);
  });

  /**
   * Block 1 already says every character is a woman, and the model still gave
   * Irene an Adam's apple - because the phrase is stock description for a male
   * lead in Chinese web fiction, so it arrives as an idiom rather than as a
   * claim. An English rule about who these people are cannot reach a Chinese
   * cliche about how bodies are described.
   */
  it('forbids male-coded description where the idiom actually lives', () => {
    expect(header()).toMatch(/male-coded physical description/i);
  });

  it('says none of it in an English run', () => {
    const en = header({ lang: 'en' });
    expect(en).not.toMatch(/Simplified/);
    expect(en).not.toMatch(/male-coded/);
  });
});

/**
 * Canon reached the model correctly and came back as the word "concept" - and
 * as something still to come, a week after it happened. Two different defects
 * with one cause: the lines carried facts and no instructions about them.
 */
describe('canon is named concretely and in the right tense', () => {
  const withCanon = (canon, week = 3) =>
    buildSceneHeader({
      roster: [{ id: 'irene', name: 'Irene' }],
      absent: [],
      week,
      day: 1,
      block: 'morning',
      phase: 'prep',
      locationLabel: 'Practice Room',
      exposure: 20,
      cards,
      relations,
      canon,
    });

  const CANON = [
    { topic: 'title_track', text: 'the title track is Day Dream', cycle: 0 },
    { topic: 'concept', text: 'the concept is a seaside sunrise', cycle: 1 },
  ];

  it('tells the model to name the song rather than say "the concept"', () => {
    const h = withCanon(CANON);
    expect(h).toMatch(/name them concretely/i);
    expect(h).toMatch(/never as "the concept"/i);
  });

  it('tells it that a finished decision is finished', () => {
    expect(withCanon(CANON)).toMatch(/has already happened and is done/i);
  });

  /** The marker those instructions refer to has to actually be on the line. */
  it('still marks the older cycle on the entry itself', () => {
    const h = withCanon(CANON);
    expect(h).toContain('- earlier in the campaign: the title track is Day Dream');
    expect(h).toContain('- the concept is a seaside sunrise');
  });

  /** No canon, no section - and therefore no orphan instructions either. */
  it('says nothing at all when the campaign has decided nothing', () => {
    const h = withCanon([], 0);
    expect(h).not.toMatch(/Where the cycle stands/);
    expect(h).not.toMatch(/name them concretely/i);
  });
});

/**
 * A `zh` run called Irene "Yilin" and Hyewon "Huiyuan" - spellings the model
 * invented, differently in different scenes, because nothing told it how these
 * names are written in Chinese.
 */
describe('the cast have names in the language being played', () => {
  it('tells the model how to spell her name in a zh run', () => {
    const b = buildSystemBlock({ cards, lineup, identity: null, playerName: 'Y', lang: 'zh' });
    const irene = cards.find((c) => c.id === 'irene');

    expect(irene.nameLocal.zh).toBeTruthy();
    expect(b).toContain(`Write her name as ${irene.nameLocal.zh}`);
  });

  it('says nothing extra in an English run', () => {
    const b = buildSystemBlock({ cards, lineup, identity: null, playerName: 'Y', lang: 'en' });
    expect(b).not.toMatch(/Write her name as/);
  });

  /** The id is the machine token and stays ASCII in every locale (section 9). */
  it('keeps the speaker id ASCII either way', () => {
    const b = buildSystemBlock({ cards, lineup, identity: null, playerName: 'Y', lang: 'zh' });
    expect(b).toContain('(id: irene)');
  });

  it('falls back to the stage name rather than inventing one', () => {
    const card = { id: 'x', name: 'Nova', personality: 'p', speechStyle: 's' };
    expect(nameFor(card, 'zh')).toBe('Nova');
    expect(nameFor(card, 'en')).toBe('Nova');
  });

  /** Every MVP cast card carries one, or the fix reaches only some of them. */
  it('gives every member of the shipped cast a zh name', () => {
    for (const c of cards) {
      expect(c.nameLocal?.zh, `${c.id} has no zh name`).toBeTruthy();
    }
  });
});
