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

export function createClient({ apiKey, modelId, seed = 1 }) {
  const mock = createMockClient({ seed });
  if (!apiKey) return mock;

  return async function client({ messages, preset, onChunk }) {
    try {
      if (preset === 'turn' && onChunk) {
        const { text } = await withRetry(() =>
          stream({ messages, apiKey, modelId, preset, onChunk }),
        );
        return text;
      }
      const { text } = await withRetry(() => complete({ messages, apiKey, modelId, preset }));
      return text;
    } catch {
      return mock({ messages, preset, onChunk });
    }
  };
}
