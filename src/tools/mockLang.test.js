/**
 * The offline writer speaks the game's language.
 *
 * This is the bug Yuhan actually hit, and eight live probes could not find it
 * because they call the router directly. `tools/client.js` falls back to this
 * writer for any turn the live call fails, and says nothing about it - so a
 * Chinese player with a working key saw an occasional English reply whenever
 * the network hiccuped, with no pattern and no explanation.
 *
 * It also broke a mode section 3 calls supported rather than degraded: a
 * Chinese player with no key at all got an entirely English game.
 *
 * The language is DETECTED from the prompt rather than passed in, because the
 * fallback path has no plumbing to hand it settings and block 1 always states
 * the language anyway.
 */

import { describe, it, expect } from 'vitest';
import { createMockClient } from './mockClient.js';
import { createClient } from './client.js';
import { STANCES } from '../systems/chips.js';
import { LINES_ZH, PLAYER_LINES_ZH } from './mockLines.zh.js';

const HAN = /[一-鿿]/;
const hasHan = (s) => HAN.test(String(s));
const hasWords = (s) => /[A-Za-z]{3,}/.test(String(s));

const mock = createMockClient({ seed: 3, delay: 0, failureRate: 0 });

const prompt = (lang, tail) => [
  {
    role: 'system',
    content: [
      'You write one beat of a visual novel.',
      'Present: Irene (irene)',
      '## Language',
      `Write all prose and dialogue in ${lang}.`,
    ].join('\n'),
  },
  { role: 'user', content: tail },
];

describe('beats', () => {
  it('writes Chinese prose when the prompt asks for Chinese', async () => {
    const out = await mock({ messages: prompt('Simplified Chinese', '[tease] '), preset: 'turn' });
    expect(hasHan(out)).toBe(true);
  });

  it('still writes English when the prompt asks for English', async () => {
    const out = await mock({ messages: prompt('English', '[tease] '), preset: 'turn' });
    expect(hasHan(out)).toBe(false);
    expect(hasWords(out)).toBe(true);
  });

  /** Section 9: the metadata line is machine tokens and never localizes. */
  it('keeps the metadata line ASCII in Chinese', async () => {
    const out = await mock({ messages: prompt('Simplified Chinese', '[touch] '), preset: 'turn' });
    const meta = out.split('\n')[0];
    expect(meta).toMatch(/^@[a-z0-9_]+\|[a-z]+\|guard\d+\|fluster\d+$/);
  });

  it('has a Chinese line for every stance the English table has', () => {
    for (const stance of STANCES) {
      expect(LINES_ZH[stance], `LINES_ZH.${stance}`).toBeTruthy();
      expect(PLAYER_LINES_ZH[stance], `PLAYER_LINES_ZH.${stance}`).toBeTruthy();
    }
  });
});

describe('the opening beat', () => {
  const open = (lang, note = '') =>
    mock({
      messages: prompt(lang, `${note}System note: write her opening beat.`),
      preset: 'turn',
    });

  it('opens in Chinese', async () => {
    expect(hasHan(await open('Simplified Chinese'))).toBe(true);
  });

  it('reacts to a knowledge gift in Chinese', async () => {
    const note = 'The player has just handed Irene a hand warmer. Only somebody paying very close attention would have known. ';
    const out = await open('Simplified Chinese', note);
    expect(hasHan(out)).toBe(true);
  });
});

describe('everything else the player reads', () => {
  it('thinks in Chinese', async () => {
    const out = await mock({
      messages: prompt('Simplified Chinese', 'report only her private thought'),
      preset: 'thought',
    });
    expect(hasHan(out)).toBe(true);
  });

  it('writes chip labels in Chinese, with ASCII stance ids', async () => {
    const out = await mock({
      messages: prompt('Simplified Chinese', 'Stances, once each: tease, reassure, deflect.'),
      preset: 'chips',
    });

    for (const line of out.split('\n')) {
      const [stance, label] = line.split('|');
      expect(stance).toMatch(/^[a-z]+$/);
      expect(hasHan(label)).toBe(true);
    }
  });

  /** Memory stays English (section 19 rule 2); only `display` is localized. */
  it('keeps the summary English and localizes only the display line', async () => {
    const out = await mock({
      messages: prompt('Simplified Chinese', 'The scene has ended.'),
      preset: 'summarize',
    });
    const parsed = JSON.parse(out);

    expect(hasHan(parsed.summary)).toBe(false);
    expect(hasHan(parsed.display)).toBe(true);
  });

  it('garbles in Chinese too, when it garbles', async () => {
    const messy = createMockClient({ seed: 1, delay: 0, failureRate: 1 });
    const out = await messy({
      messages: prompt('Simplified Chinese', '[press] '),
      preset: 'turn',
    });
    expect(hasHan(out)).toBe(true);
  });
});

/**
 * The path that actually bit. A live call that throws must not produce an
 * English beat in a Chinese game.
 */
describe('the fallback from a failed live call', () => {
  it('answers in Chinese when the router throws', async () => {
    const client = createClient({ apiKey: 'not-a-real-key', modelId: 'nope', seed: 5 });
    const out = await client({
      messages: prompt('Simplified Chinese', '[tease] '),
      preset: 'turn',
    });

    expect(out).toBeTruthy();
    expect(hasHan(out)).toBe(true);
  }, 60000);
});
