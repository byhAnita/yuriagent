/**
 * An offline stand-in for the model, so the game is playable with no API key.
 *
 * Not an attempt at good writing - it exists so the round loop, the option bar,
 * the value bounds, the pool and the scene-exit path can all be exercised end to
 * end by a person, on a plane, for free. Section 3 calls this a supported mode
 * rather than a degraded one, which is the whole reason it emits the REAL wire
 * format including the failures a small model makes.
 *
 * It is a tenth of its v1 size, and the reason is the architecture rather than
 * this file. v1 asked the model five different questions - a beat, a chip set,
 * an interjection, an establishing paragraph, a summary - so the mock had to be
 * able to answer five. v2 asks one, and `Read her` is the only other call in the
 * game.
 */

import { makeRng, deriveSeed, pick } from '../systems/rng.js';
import { THOUGHTS_ZH } from './mockLines.zh.js';
import { mockRound } from './mockRound.js';

/** What `Read her` returns: her unspoken thought, never a number (Part I.2). */
const THOUGHTS = [
  'She is wondering whether you noticed her hands were shaking.',
  'She is counting how many people are still in the building.',
  'She is deciding, right now, not to say the thing she wants to say.',
  'She is aware this looks like something, and she has not moved away.',
];

let counter = 0;

/**
 * @param {object} opts - { seed, failureRate, delay, chunkDelay }
 *   `failureRate` emits a malformed reply, so the parser tolerance in Part I.4
 *   is exercised in real play rather than only in tests.
 *
 *   `delay: 0` means no pacing at all, including between stream chunks. It used
 *   to mean only "no think time" and the per-chunk 12ms stayed, so a headless
 *   campaign spent minutes inside setTimeout pretending to type. A caller that
 *   wants the typing effect asks for it.
 */
export function createMockClient({
  seed = 7,
  failureRate = 0.08,
  delay = 260,
  chunkDelay = delay > 0 ? 12 : 0,
} = {}) {
  return async function mockClient({ messages, preset, onChunk }) {
    const rng = makeRng(deriveSeed(seed, `mock:${counter++}`));
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));

    /**
     * Which language the game is being played in, read off the prompt.
     *
     * Detected rather than passed, because this writer is also the fallback for
     * a failed live call (`tools/client.js`) and that path has no plumbing to
     * hand it settings. Tier 1 always states the language, so the prompt is the
     * one thing guaranteed to be in scope.
     *
     * This mattered more than "offline play is English": a Chinese player WITH a
     * key saw an occasional English reply whenever a live call failed and
     * silently fell through to here.
     */
    const prompt = messages.map((m) => m.content).join('\n');
    const zh = /Simplified Chinese/.test(prompt);
    const tail = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

    if (preset === 'thought') return pick(rng, zh ? THOUGHTS_ZH : THOUGHTS);

    const text = mockRound(tail, { rng, zh, failureRate });
    if (onChunk) {
      for (let i = 0; i < text.length; i += 5) {
        onChunk(text.slice(i, i + 5));
        if (chunkDelay > 0) await new Promise((r) => setTimeout(r, chunkDelay));
      }
    }
    return text;
  };
}
