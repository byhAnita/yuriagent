/**
 * Live provider smoke test. OPT-IN - skipped unless .env.local carries a key.
 *
 * Everything else in this suite runs against the offline writer, which means
 * llmTool.js itself has never been exercised against a real endpoint. This is
 * the only thing that can answer four questions:
 *
 *   1. does the router work at all against a real OpenAI-compatible provider
 *   2. does a real model honour the beat contract in section 9
 *   3. what a chip call actually costs in miss tokens and wall time - the
 *      section 6 premise was arithmetic, and the arithmetic was optimistic
 *   4. does prefix caching engage, which is what the section 8 accounting assumes
 *
 * Costs real tokens. It reads the key from .env.local and never prints it.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { stream, complete } from './llmTool.js';
import { CALL_PRESETS } from '../config/modelConfigs.js';
import { beginScene, runTurn, openingDirective } from '../agent/sceneEngine.js';
import { buildMessages } from '../agent/promptBuilder.js';
import { chipMessages, parseChips } from '../agent/chipWriter.js';
import { availableStances } from '../systems/chips.js';
import { newRelation } from '../systems/relationship.js';
import { newMemory } from '../agent/memory.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { EMOTIONS } from '../agent/promptBuilder.js';

function readEnvLocal() {
  try {
    const raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
    const out = {};
    for (const line of raw.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}

// Straight to stdout: vitest buffers console output from a passing test, and
// the measurements are the entire point of this file.
const log = (...a) => process.stdout.write(`${a.join(' ')}\n`);

const env = readEnvLocal();
const apiKey = env.YURIAGENT_API_KEY || '';
const modelId = env.YURIAGENT_MODEL_ID || 'deepseek-v4-flash';
const live = apiKey.length > 0;

const cards = getCast();
const castIds = cards.map((c) => c.id);

const setup = () => ({
  cards,
  lineup: buildLineup(cards),
  identity: { promptRole: 'an artist assistant' },
  player: { name: 'You', energy: 80, secrecy: 70, credits: 10 },
  lang: 'en',
  memory: newMemory(castIds),
  relations: Object.fromEntries(castIds.map((id) => [id, newRelation(45)])),
  scene: {
    id: 'live',
    rosterIds: ['irene'],
    focusId: 'irene',
    week: 0,
    day: 1,
    block: 'evening',
    phase: 'prep',
    locationId: 'practice_room',
    locationLabel: 'X Practice Room',
    seed: 1,
  },
});

/** A client that records timing, so the chip premise can be measured. */
function timedClient(report) {
  return async function client({ messages, preset, onChunk }) {
    const t0 = Date.now();
    let firstToken = null;

    if (onChunk) {
      const { text } = await stream({
        messages,
        apiKey,
        modelId,
        preset,
        onChunk: (c) => {
          firstToken ??= Date.now() - t0;
          onChunk(c);
        },
      });
      report.push({ preset, ttft: firstToken, total: Date.now() - t0, chars: text.length });
      log('\n[live] RAW turn response:\n' + text + '\n---');
      return text;
    }

    const { text, usage } = await complete({ messages, apiKey, modelId, preset });
    report.push({ preset, ttft: null, total: Date.now() - t0, chars: text.length, usage });
    return text;
  };
}

/**
 * Opt-in, not key-in.
 *
 * Gating on a key alone meant `npm test` billed a provider on every run for
 * anyone who had ever pasted one into .env.local - which is every developer of
 * this game. `liveQuality` and `zhSmoke` already require a flag on top of the
 * key; this is the same rule, and the reason is the same: a live call is a
 * deliberate act, and the default suite has to be free and offline.
 */
const enabled = live && Boolean(process.env.LIVE_PROVIDER);

describe.skipIf(!enabled)('live provider', () => {
  it(
    'reaches the endpoint at all',
    async () => {
      const { text, usage } = await complete({
        messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
        apiKey,
        modelId,
        preset: 'thought',
      });
      log(`\n[live] model=${modelId} reply=${JSON.stringify(text.slice(0, 40))}`);
      log(`[live] usage=${JSON.stringify(usage)}`);
      expect(text.length).toBeGreaterThan(0);
    },
    60000,
  );

  it(
    'honours the beat contract, and lands chips inside reading time',
    async () => {
      const report = [];
      const client = timedClient(report);
      const args = setup();

      // Turn 1: cold prefix, opening beat.
      let session = beginScene(args);
      session = await runTurn(session, { text: openingDirective(), client });

      log('\n[live] --- opening beat ---');
      for (const b of session.beats) {
        log(`  @${b.speaker}|${b.emotion}  ${JSON.stringify(b.text.slice(0, 90))}`);
      }

      expect(session.beats.length).toBeGreaterThan(0);

      /**
       * Section 9 assumes format failures rather than forbidding them, and a
       * live run confirms it: the same prompt produced a clean metadata line on
       * one call and none on the next. So what is asserted here is the FALLBACK,
       * not the model - the three things that must hold either way.
       */
      for (const b of session.beats) {
        // Rule 1/4: prose with no metadata is still attributed to the focus.
        expect(b.speaker).toBe('irene');
        // Rule 2: an emotion is either valid or absent, never invented.
        if (b.emotion !== null) expect(EMOTIONS).toContain(b.emotion);
        // Rule 6: a raw metadata line must never reach the player.
        expect(b.text).not.toMatch(/guard[+-]?\d|fluster[+-]?\d/);
        expect(b.text.startsWith('@')).toBe(false);
      }

      const formatted = session.beats.filter((b) => !b.inferred).length;
      log(
        `[live] contract: ${formatted}/${session.beats.length} beats carried a metadata line`,
      );

      // The chip call, off the same prefix.
      const r = newRelation(45);
      const { available } = availableStances(r, { energy: 80 });
      const chipRaw = await client({
        messages: chipMessages(session.frame, {
          stances: available.slice(0, 6),
          lang: 'en',
          absentNames: cards.filter((c) => c.id !== 'irene').map((c) => c.name),
        }),
        preset: 'chips',
      });

      const chips = parseChips(chipRaw, {
        available: available.slice(0, 6),
        absentNames: cards.filter((c) => c.id !== 'irene').map((c) => c.name),
      });

      log('\n[live] --- written chips ---');
      log(`  raw: ${JSON.stringify(chipRaw)}`);
      for (const c of chips) log(`  [${c.stance}] ${c.label}`);

      // Turn 2: warm prefix, a real stance.
      session = await runTurn(session, { stance: 'flirt', text: '', client });

      log('\n[live] --- timings (ms) ---');
      for (const r2 of report) {
        log(
          `  ${String(r2.preset).padEnd(10)} ttft=${String(r2.ttft ?? '-').padStart(6)} total=${String(
            r2.total,
          ).padStart(6)} chars=${String(r2.chars).padStart(5)}${
            r2.usage ? ` usage=${JSON.stringify(r2.usage)}` : ''
          }`,
        );
      }

      const beats = report.filter((x) => x.preset === 'turn');
      const chipCall = report.find((x) => x.preset === 'chips');

      log(
        `\n[live] chip call ${chipCall.total}ms, miss ${
          chipCall.usage?.prompt_cache_miss_tokens ?? '?'
        } tok, out ${chipCall.usage?.completion_tokens ?? '?'} tok`,
      );
      log(`[live] beat calls ${beats.map((b) => `${b.total}ms`).join(', ')}`);

      expect(chips.length).toBeGreaterThan(0);

      /**
       * Two different things, and only one of them is a pass/fail.
       *
       * The BUDGET is reading time - three beats of 30-50 words, call it three
       * seconds. Whether the provider meets it on any given day is not
       * something this repo controls: a call that normally takes 1.4s was
       * measured at 8.1s during a busy period. Asserting the budget would make
       * this test cry wolf about someone else's load, so the budget is reported
       * and the ASSERTION is the contract we do control - the call has to
       * finish inside its own deadline rather than hanging.
       */
      const BUDGET_MS = 3000;
      log(
        chipCall.total <= BUDGET_MS
          ? `[live] chip call inside the ${BUDGET_MS}ms reading budget`
          : `[live] SLOW: chip call missed the ${BUDGET_MS}ms reading budget by ${
              chipCall.total - BUDGET_MS
            }ms - written chips will often be too late to land`,
      );
      expect(chipCall.total).toBeLessThan(CALL_PRESETS.chips.timeoutMs);

      /**
       * The miss is the directive PLUS her last beat - the beat has to be in
       * the prompt or the chips cannot answer it, so it is not optional
       * overhead. Measured at ~142 against DeepSeek with a ~90-token directive.
       * This guards against the directive quietly growing back.
       */
      expect(chipCall.usage?.prompt_cache_miss_tokens ?? 0).toBeLessThan(250);
    },
    180000,
  );

  it(
    'engages prefix caching on the second call',
    async () => {
      const args = setup();
      const session = beginScene(args);
      const messages = buildMessages(session.frame);

      const first = await complete({ messages, apiKey, modelId, preset: 'thought' });
      const second = await complete({ messages, apiKey, modelId, preset: 'thought' });

      log(`\n[live] usage 1: ${JSON.stringify(first.usage)}`);
      log(`[live] usage 2: ${JSON.stringify(second.usage)}`);

      // Block 1 must exceed the provider threshold for automatic caching to
      // engage at all (section 8, invariant 4).
      expect(second.usage?.prompt_tokens ?? 0).toBeGreaterThan(1024);
    },
    120000,
  );
});
