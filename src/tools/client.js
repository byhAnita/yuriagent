/**
 * Picks between the real router and the offline writer.
 *
 * With no key the game runs on the mock. That is a real mode rather than a
 * degraded one - it is what keeps the loop playable for free and what lets
 * development continue without spending tokens.
 *
 * A failed live call falls back to the mock for that turn rather than dropping
 * the player out of a scene. Losing one beat to a flaky network is survivable;
 * losing the scene is not.
 */

import { stream, complete, withRetry } from './llmTool.js';
import { createMockClient } from './mockClient.js';
import { recordCall } from './debugLog.js';

export function createClient({ apiKey, modelId, seed = 1, onFallback = null }) {
  const mock = createMockClient({ seed });

  /**
   * Every call is recorded here and nowhere else.
   *
   * This is the only layer that knows which writer answered, and that fact
   * reaches neither the parser nor the screen - so a player cannot report it
   * and a live probe cannot reproduce it. Recording is in memory, costs
   * nothing, and never leaves the device.
   */
  const record = (args) => recordCall({ modelId, ...args });

  /**
   * No key is not a failure, so it never reports one.
   *
   * Section 3 calls playing without a key a supported mode rather than a
   * degraded one, and a notice on every beat would contradict that. The signal
   * is only for the case the player cannot otherwise explain: they HAVE a key,
   * the model is answering most turns, and one turn quietly came from
   * somewhere else.
   */
  if (!apiKey) {
    return async function offlineClient({ messages, preset, onChunk }) {
      const started = Date.now();
      const out = await mock({ messages, preset, onChunk });
      record({ preset, source: 'mock', modelId: null, messages, out, ms: Date.now() - started });
      return out;
    };
  }

  return async function client({ messages, preset, onChunk }) {
    const started = Date.now();
    try {
      if (preset === 'turn' && onChunk) {
        const { text } = await withRetry(() =>
          stream({ messages, apiKey, modelId, preset, onChunk }),
        );
        onFallback?.(null);
        record({ preset, source: 'live', messages, out: text, ms: Date.now() - started });
        return text;
      }
      const { text } = await withRetry(() => complete({ messages, apiKey, modelId, preset }));
      if (preset !== 'chips') onFallback?.(null);
      record({ preset, source: 'live', messages, out: text, ms: Date.now() - started });
      return text;
    } catch (error) {
      /**
       * Tell somebody. A silent substitution is what made this hard to find:
       * the player reads a canned line in the offline writer's voice, believes
       * the model wrote it, and has no way to know the call failed.
       *
       * Chips are excluded because section 6 already says a failed chip call is
       * meant to be invisible - the static set is a complete input system and
       * the player should never learn it was reached for.
       */
      if (preset !== 'chips') onFallback?.(error ?? new Error('call failed'));

      const out = await mock({ messages, preset, onChunk });
      /**
       * The record that matters most, and the one the player cannot see.
       *
       * `source: 'fallback'` says the router was tried and failed, so the beat
       * on screen came from the offline writer in the model's place. Chips
       * suppress the on-screen notice by design (section 6); nothing suppresses
       * the record.
       */
      record({ preset, source: 'fallback', messages, out, ms: Date.now() - started, error });
      return out;
    }
  };
}
