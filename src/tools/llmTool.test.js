/**
 * The router. CLAUDE.md sections 3 and 4.
 *
 * These exist because of a scene that froze with no error anywhere: a request
 * that never settles never rejects, so `withRetry` never retries, the offline
 * fallback in client.js never fires, and the UI sits with `pending` true and
 * every control disabled. A dead socket looked exactly like a dead game.
 */

import { describe, it, expect, vi } from 'vitest';
import { complete, stream, withRetry, LlmError } from './llmTool.js';
import { createClient } from './client.js';

/** A fetch that never settles unless its signal aborts. */
function hangingFetch() {
  return (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      if (signal.aborted) return reject(new DOMException('aborted', 'AbortError'));
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
}

/** A response whose body opens and then goes silent forever. */
function stallingStreamFetch() {
  return async (_url, { signal }) => ({
    ok: true,
    body: {
      getReader: () => ({
        read: () =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
      }),
    },
  });
}

describe('nothing may hang forever', () => {
  it('gives up on a request that never settles', async () => {
    vi.useFakeTimers();
    try {
      const promise = complete({ messages: [], apiKey: 'k', fetchImpl: hangingFetch() });
      const assertion = expect(promise).rejects.toBeInstanceOf(LlmError);
      await vi.advanceTimersByTimeAsync(60000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up on a stream that opens and then goes silent', async () => {
    vi.useFakeTimers();
    try {
      const promise = stream({ messages: [], apiKey: 'k', fetchImpl: stallingStreamFetch() });
      const assertion = expect(promise).rejects.toThrow(/timed out/);
      await vi.advanceTimersByTimeAsync(60000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * Retryable is the load-bearing part. A timeout means the connection stalled,
   * not that the request was wrong - so it must retry, and then fall through to
   * the offline writer rather than stranding the scene.
   */
  it('treats a timeout as retryable', async () => {
    vi.useFakeTimers();
    try {
      const promise = complete({ messages: [], apiKey: 'k', fetchImpl: hangingFetch() });
      const assertion = promise.catch((e) => e);
      await vi.advanceTimersByTimeAsync(60000);
      const err = await assertion;
      expect(err).toBeInstanceOf(LlmError);
      expect(err.retryable).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a hanging provider still produces a playable turn', async () => {
    vi.useFakeTimers();
    try {
      const client = createClient({ apiKey: 'k', modelId: 'deepseek-v4-flash', seed: 1 });
      const promise = client({
        messages: [{ role: 'system', content: 'x' }],
        preset: 'thought',
      });
      // Three attempts plus backoff, then the offline writer answers.
      await vi.advanceTimersByTimeAsync(400000);
      const text = await promise;
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a caller can still cancel', () => {
  it('aborts when the outer signal aborts', async () => {
    const outer = new AbortController();
    const promise = complete({
      messages: [],
      apiKey: 'k',
      signal: outer.signal,
      fetchImpl: hangingFetch(),
    });
    outer.abort();
    await expect(promise).rejects.toBeInstanceOf(LlmError);
  });
});

describe('withRetry', () => {
  it('does not retry a request that was wrong', async () => {
    const fn = vi.fn(async () => {
      throw new LlmError('bad key', { status: 401, retryable: false });
    });
    await expect(withRetry(fn, { attempts: 3, baseDelay: 1 })).rejects.toThrow(/bad key/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a stalled one', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new LlmError('timed out', { retryable: true });
      return 'ok';
    });
    await expect(withRetry(fn, { attempts: 3, baseDelay: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
