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

export function createClient({ apiKey, modelId, seed = 1, onFallback = null }) {
  const mock = createMockClient({ seed });

  /**
   * No key is not a failure, so it never reports one.
   *
   * Section 3 calls playing without a key a supported mode rather than a
   * degraded one, and a notice on every beat would contradict that. The signal
   * is only for the case the player cannot otherwise explain: they HAVE a key,
   * the model is answering most turns, and one turn quietly came from
   * somewhere else.
   */
  if (!apiKey) return mock;

  return async function client({ messages, preset, onChunk }) {
    try {
      if (preset === 'turn' && onChunk) {
        const { text } = await withRetry(() =>
          stream({ messages, apiKey, modelId, preset, onChunk }),
        );
        onFallback?.(null);
        return text;
      }
      const { text } = await withRetry(() => complete({ messages, apiKey, modelId, preset }));
      if (preset !== 'chips') onFallback?.(null);
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
      return mock({ messages, preset, onChunk });
    }
  };
}
