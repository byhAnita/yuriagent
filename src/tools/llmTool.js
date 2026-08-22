/**
 * The only place in the codebase that talks to a model. CLAUDE.md section 4.
 *
 * All four providers are OpenAI-compatible, so one client shape serves them
 * all. The key comes from the caller, is used once, and is never logged - error
 * messages are constructed so that a key cannot appear in them even by
 * accident.
 */

import { getModel, CALL_PRESETS, DEFAULT_MODEL } from '../config/modelConfigs.js';
import { REQUEST_TIMEOUT_MS, STREAM_STALL_MS } from '../config/constants.js';

export class LlmError extends Error {
  constructor(message, { status, retryable } = {}) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
    this.retryable = Boolean(retryable);
  }
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

/** Never let a response body carry a key back into a log line. */
function safeMessage(status, body) {
  const text = String(body ?? '').slice(0, 200);
  const scrubbed = text.replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***').replace(/AI[A-Za-z0-9_-]{20,}/g, 'AI***');
  return `model request failed (${status}): ${scrubbed}`;
}

/**
 * A deadline every request runs under.
 *
 * `deadline()` returns a signal that aborts on its own, plus a `bump` that
 * pushes the deadline out again - which is how a stream stays alive as long as
 * tokens keep arriving but dies if they stop. `done()` must always be called,
 * or a pending timer keeps the process alive in node.
 */
function deadline(ms, outerSignal) {
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), ms);

  const onOuter = () => controller.abort();
  outerSignal?.addEventListener('abort', onOuter);

  return {
    signal: controller.signal,
    bump(next = ms) {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), next);
    },
    done() {
      clearTimeout(timer);
      outerSignal?.removeEventListener('abort', onOuter);
    },
    aborted: () => controller.signal.aborted,
  };
}

/**
 * An aborted request is retryable: it means the connection stalled, not that
 * the request was wrong. Retryable is also what lets client.js fall back to the
 * offline writer instead of leaving the scene frozen.
 */
function asLlmError(err, timedOut) {
  if (err instanceof LlmError) return err;
  if (timedOut || err?.name === 'AbortError') {
    return new LlmError('model request timed out', { retryable: true });
  }
  return new LlmError(`model request failed: ${err?.name ?? 'network error'}`, { retryable: true });
}

function buildBody(messages, preset, model) {
  return JSON.stringify({
    model: model.model,
    messages,
    temperature: preset.temperature,
    max_tokens: preset.maxTokens,
    stream: Boolean(preset.stream),
  });
}

/**
 * One call. Non-streaming.
 *
 * @param {object} args - { messages, apiKey, modelId, preset, signal }
 * @returns {Promise<{ text, usage }>}
 */
export async function complete({
  messages,
  apiKey,
  modelId = DEFAULT_MODEL,
  preset = 'turn',
  signal,
  fetchImpl = globalThis.fetch,
}) {
  const model = getModel(modelId);
  const shape = { ...CALL_PRESETS[preset], stream: false };
  const clock = deadline(REQUEST_TIMEOUT_MS, signal);

  try {
    const res = await fetchImpl(`${model.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: buildBody(messages, shape, model),
      signal: clock.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new LlmError(safeMessage(res.status, body), {
        status: res.status,
        retryable: RETRYABLE_STATUS.has(res.status),
      });
    }

    const json = await res.json();
    return {
      text: json.choices?.[0]?.message?.content ?? '',
      usage: json.usage ?? null,
    };
  } catch (err) {
    throw asLlmError(err, clock.aborted());
  } finally {
    clock.done();
  }
}

/**
 * Streaming call. Invokes `onChunk` with each text delta as it arrives.
 *
 * Latency, not cost, is the binding constraint for this game (section 8), so
 * the first token reaching the UI quickly matters more than anything else here.
 */
export async function stream({
  messages,
  apiKey,
  modelId = DEFAULT_MODEL,
  preset = 'turn',
  onChunk = () => {},
  signal,
  fetchImpl = globalThis.fetch,
}) {
  const model = getModel(modelId);
  const shape = { ...CALL_PRESETS[preset], stream: true };

  // A stream may legitimately run for a while, so the deadline is on SILENCE
  // rather than on total duration: every token pushes it back out.
  const clock = deadline(REQUEST_TIMEOUT_MS, signal);

  try {
    const res = await fetchImpl(`${model.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: buildBody(messages, shape, model),
      signal: clock.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new LlmError(safeMessage(res.status, body), {
        status: res.status,
        retryable: RETRYABLE_STATUS.has(res.status),
      });
    }

    const reader = res.body?.getReader();
    if (!reader) throw new LlmError('model returned no stream body', { retryable: true });

    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      clock.bump(STREAM_STALL_MS);

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;

        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onChunk(delta);
          }
        } catch {
          // A partial SSE frame. The next chunk completes it; dropping one
          // malformed frame is always better than aborting a live scene.
        }
      }
    }

    return { text: full };
  } catch (err) {
    throw asLlmError(err, clock.aborted());
  } finally {
    clock.done();
  }
}

/** Retry with backoff. Only for calls that are safe to repeat. */
export async function withRetry(fn, { attempts = 3, baseDelay = 400 } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (err instanceof LlmError && !err.retryable) throw err;
      if (i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** i));
    }
  }
  throw lastError;
}
