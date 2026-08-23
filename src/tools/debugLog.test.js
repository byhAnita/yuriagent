/**
 * The call record, and the one rule it must never break.
 *
 * Section 22 puts the API key on the player's device and nowhere else. A debug
 * log exists to be pasted into a bug report, which makes it the likeliest way a
 * key ever leaves a machine - so the redaction is tested harder than the
 * feature.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  redact,
  languageOf,
  recordCall,
  recordedCalls,
  clearCalls,
  dumpCalls,
  installDebug,
  setDebug,
} from './debugLog.js';
import { createClient } from './client.js';

const zhPrompt = [
  {
    role: 'system',
    content: [
      'You write one beat of a visual novel.',
      'Present: Irene (irene)',
      'Write in Simplified Chinese: BOTH halves of every beat - the *action* between',
      'asterisks and the "speech" in quotes.',
    ].join('\n'),
  },
  { role: 'user', content: '## Language - Simplified Chinese\nWrite every beat below in Simplified Chinese' },
  { role: 'user', content: '[tease] ' },
];

beforeEach(() => {
  clearCalls();
  setDebug(false);
});

describe('redaction', () => {
  it('removes an OpenAI-shaped key', () => {
    expect(redact('key sk-abc123def456 end')).toBe('key [redacted] end');
  });

  it('removes a Google-shaped key', () => {
    expect(redact('AIzaSyA1b2C3d4E5f6')).toBe('[redacted]');
  });

  it('leaves ordinary prose alone', () => {
    expect(redact('She does not answer straight away.')).toBe('She does not answer straight away.');
  });

  /**
   * The real path. A key travels as its own argument and is never in
   * `messages`, but a record built from a prompt that somehow carried one must
   * still come out clean - that is the whole reason the pass exists.
   */
  it('never lets a key reach a record, wherever it was hiding', () => {
    recordCall({
      preset: 'turn',
      source: 'live',
      modelId: 'deepseek-chat',
      messages: [{ role: 'user', content: 'my key is sk-live-DEADBEEF0123 please' }],
      out: 'echoed back sk-live-DEADBEEF0123',
      error: new Error('401 from sk-live-DEADBEEF0123'),
    });

    const text = JSON.stringify(recordedCalls()) + dumpCalls(5);
    expect(text).not.toMatch(/sk-live-DEADBEEF/);
    expect(text).toMatch(/\[redacted\]/);
  });
});

describe('what the record says about language', () => {
  it('reports the language block 1 asked for, and that block 4 repeated it', () => {
    expect(languageOf(zhPrompt)).toEqual({ asked: 'Simplified Chinese', repeated: true });
  });

  it('reports an English prompt as asking for English and not repeating', () => {
    const en = [{ role: 'system', content: 'Write in English: BOTH halves of every beat' }];
    expect(languageOf(en)).toEqual({ asked: 'English', repeated: false });
  });

  it('survives a prompt with no directive at all', () => {
    expect(languageOf([])).toEqual({ asked: null, repeated: false });
    expect(languageOf(undefined)).toEqual({ asked: null, repeated: false });
  });
});

describe('the ring', () => {
  it('keeps the most recent calls and drops the oldest', () => {
    for (let i = 0; i < 45; i += 1) {
      recordCall({ preset: 'turn', source: 'live', messages: zhPrompt, out: `beat ${i}` });
    }

    const kept = recordedCalls();
    expect(kept).toHaveLength(40);
    expect(kept.at(-1).out).toBe('beat 44');
    expect(kept[0].out).toBe('beat 5');
  });

  it('numbers calls in order so a report can be read as a sequence', () => {
    recordCall({ preset: 'turn', source: 'live', messages: zhPrompt, out: 'a' });
    recordCall({ preset: 'chips', source: 'fallback', messages: zhPrompt, out: 'b' });

    expect(recordedCalls().map((c) => c.n)).toEqual([1, 2]);
  });

  it('clips a very long output rather than holding all of it', () => {
    recordCall({ preset: 'turn', source: 'live', messages: zhPrompt, out: 'x'.repeat(5000) });
    expect(recordedCalls()[0].out).toMatch(/more chars\]$/);
    expect(recordedCalls()[0].out.length).toBeLessThan(2100);
  });

  it('says so when there is nothing to dump', () => {
    expect(dumpCalls()).toMatch(/no model calls recorded/);
  });
});

describe('printing is opt-in, recording is not', () => {
  it('records without printing by default', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    recordCall({ preset: 'turn', source: 'live', messages: zhPrompt, out: 'quiet' });

    expect(spy).not.toHaveBeenCalled();
    expect(recordedCalls()).toHaveLength(1);
    spy.mockRestore();
  });

  it('prints once enabled', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setDebug(true);
    recordCall({ preset: 'turn', source: 'live', messages: zhPrompt, out: 'loud' });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('the console handles', () => {
  it('installs onto a target without touching the real global', () => {
    const target = {};
    installDebug(target);

    expect(typeof target.yuri.dump).toBe('function');
    expect(target.yuri.debug(false)).toMatch(/off/);
    expect(target.yuri.clear()).toMatch(/cleared/);
  });
});

/**
 * The whole reason this exists: `source` is the only place the game says which
 * writer answered, and the player cannot see it.
 */
describe('through the client', () => {
  it('records the offline writer as mock when there is no key', async () => {
    const client = createClient({ apiKey: '', seed: 2 });
    await client({ messages: zhPrompt, preset: 'turn' });

    expect(recordedCalls()[0].source).toBe('mock');
  });

  it('records a failed live call as fallback, with the error', async () => {
    const client = createClient({ apiKey: 'sk-not-a-real-key', modelId: 'nope', seed: 2 });
    await client({ messages: zhPrompt, preset: 'turn' });

    const [entry] = recordedCalls();
    expect(entry.source).toBe('fallback');
    expect(entry.error).toBeTruthy();
    // The beat the player read came from the mock, and it is in the record.
    expect(entry.out).toBeTruthy();
  }, 60000);

  it('does not put the key in the record of a failed call', async () => {
    const client = createClient({ apiKey: 'sk-secret-KEY-9876543210', modelId: 'nope', seed: 2 });
    await client({ messages: zhPrompt, preset: 'turn' });

    expect(JSON.stringify(recordedCalls())).not.toMatch(/secret-KEY/);
  }, 60000);
});
