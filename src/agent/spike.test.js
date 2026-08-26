/**
 * PHASE 0. The spike, and it is allowed to be thrown away.
 *
 * Five rounds in a practice room, in Chinese, against the real model. It exists
 * to answer three questions that no amount of design settles, and that every
 * later phase would otherwise bake an assumption about:
 *
 *   1. Does ~80 words feel like a round, or like a fragment?
 *   2. Does the prose read NATIVE now that the model is instructed in English
 *      and immersed in Chinese - or is it still translationese?
 *   3. Does the model hold the two axes apart on its own? `admissibility` must
 *      not move in an empty practice room at night, however well it goes.
 *
 * Only the third has an assertion. The first two are read by a human, because
 * a native reader is the only instrument that exists for them - which is
 * exactly how the defect was found in the first place.
 *
 * Run: LIVE_PROVIDER=1 SPIKE=1 npx vitest run spike
 */

import { describe, it, expect } from 'vitest';
import { stream } from '../tools/llmTool.js';
import { liveConfig } from '../tools/liveEnv.js';
import { buildTier1, buildTier2, buildTier3, buildMessages } from './tiers.js';
import { createRoundStream } from './roundParser.js';
import { ROUND_WORDS, DELTA_MAX } from '../config/rules.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';

const { apiKey, modelId, live } = liveConfig();
const enabled = live && Boolean(process.env.SPIKE);
const log = (...a) => process.stdout.write(`${a.join(' ')}\n`);

const cards = getCast().filter((c) => c.id === 'irene');
const lineup = buildLineup(getCast());

/** Han characters. The only reliable test for "is this actually Chinese". */
const HAN = /[一-鿿]/;
/** A run of Latin letters long enough to be prose rather than a name or an id. */
const LATIN_PROSE = /[A-Za-z]{4,}(\s+[A-Za-z]{3,}){2,}/;

/**
 * A deliberately unhelpful room for the second axis: the practice room is
 * `exposureBase` 25, and it is night, and nobody else is in it. If
 * `admissibility` climbs here, the model has not understood the difference and
 * the code veto in phase 3 stops being a safety net and becomes load-bearing.
 */
const SCENE = {
  locationLabel: 'X Practice Room',
  activity: 'Irene is running the new choreography alone, long after everyone else has gone.',
  week: 0,
  dayName: 'Tuesday',
  block: 'evening',
  phase: 'prep',
};

const ROUNDS = 5;

async function playScene(lang) {
  const relations = { irene: { affection: 8, admissibility: 0 } };
  const player = { selfId: 40, mood: 55, secrecy: 70 };

  const tier1 = buildTier1({
    cards,
    lineup,
    identity: { promptRole: 'an artist assistant' },
    playerName: 'Yuhan',
    lang,
  });

  const entries = [];
  let lastChoice = null;
  const transcript = [];

  for (let i = 0; i < ROUNDS; i += 1) {
    const tier3 = buildTier3({
      cards,
      present: ['irene'],
      relations,
      player,
      dossier: {},
      ...SCENE,
      roundIndex: i,
      roundsLeft: ROUNDS - 1 - i,
      lastChoice,
      lang,
    });

    const reader = createRoundStream();
    let firstWordAt = null;
    const started = Date.now();

    await stream({
      messages: buildMessages({ tier1, tier2: buildTier2(entries), tier3 }),
      apiKey,
      modelId,
      preset: 'round',
      onChunk: (chunk) => {
        const shown = reader.push(chunk);
        if (shown && firstWordAt === null) firstWordAt = Date.now() - started;
      },
    });

    const round = reader.result();
    const wall = Date.now() - started;

    // Apply what the model asked for, unclamped and unvetoed - the point is to
    // see what it does when nothing stops it.
    for (const [who, d] of Object.entries(round.deltas)) {
      if (relations[who]) relations[who].affection += d;
      else if (who in player) player[who] += d;
    }

    transcript.push({ round, wall, firstWordAt });

    log(`\n--- round ${i + 1} (${wall}ms, first word ${firstWordAt ?? '-'}ms) ---`);
    log(round.prose);
    log(`  [emo] ${round.emotion ?? '-'}   [deltas] ${JSON.stringify(round.deltas)}`);
    round.options.forEach((o, n) => log(`  ${'ABCD'[n]}. ${o}`));
    if (round.summary) log(`  [sum] ${round.summary}`);

    // A middling choice every time, so the scene is driven by the writing
    // rather than by a player trying to win.
    lastChoice = round.options[1] ?? round.options[0] ?? null;
    entries.push({ id: `R${i + 1}`, type: 'full', text: round.prose, choice: lastChoice });
  }

  return { transcript, relations, player };
}

describe.skipIf(!enabled)('the spike', () => {
  it(
    'plays five rounds in Chinese and reports what it did',
    async () => {
      log('\n================ SPIKE, zh ================');
      const { transcript, relations, player } = await playScene('zh');

      const words = transcript.map((t) => t.round.prose.replace(/\s/g, '').length);
      const withOptions = transcript.filter((t) => t.round.options.length === 4).length;
      const firsts = transcript.map((t) => t.firstWordAt).filter((n) => n !== null);

      log('\n================ READINGS ================');
      log(`prose length (chars): ${words.join(', ')}  (target ~${ROUND_WORDS} words)`);
      log(`rounds with four options: ${withOptions}/${ROUNDS}`);
      log(`wall per round: ${transcript.map((t) => t.wall).join(', ')}ms`);
      log(`first word: ${firsts.join(', ')}ms`);
      log(`affection 8 -> ${relations.irene.affection}`);
      log(`admissibility 0 -> ${relations.irene.admissibility}`);
      log(`player: selfId ${player.selfId}, mood ${player.mood}, secrecy ${player.secrecy}`);
      log('\nRead the prose above. Does it read as Chinese, or as translated English?');

      // The contract has to hold, or none of the readings mean anything.
      for (const { round } of transcript) {
        expect(round.prose.length).toBeGreaterThan(20);
        expect(HAN.test(round.prose)).toBe(true);
        expect(LATIN_PROSE.test(round.prose)).toBe(false);
        expect(round.options.length).toBeGreaterThanOrEqual(3);
      }

      /**
       * THE ONE REAL ASSERTION. Nobody could see any of this, so nothing here
       * may raise `admissibility` - and nothing ever raises it in an empty
       * room, so a rise is the model failing to hold the axes apart rather
       * than a scene going well.
       */
      expect(relations.irene.admissibility).toBeLessThanOrEqual(0);

      // And the delta bound, which the model has to hold on its own.
      for (const { round } of transcript) {
        for (const d of Object.values(round.deltas)) {
          expect(Math.abs(d)).toBeLessThanOrEqual(DELTA_MAX);
        }
      }

      // The first round of a scene has nothing to react to.
      expect(Object.keys(transcript[0].round.deltas)).toHaveLength(0);
    },
    600000,
  );

  /**
   * The same scene in English, for comparison. Not asserted on - it is here so
   * the two transcripts can be read side by side, which is the only way to tell
   * "the Chinese is stiff" from "the writing is stiff".
   */
  it(
    'plays the same scene in English, for comparison',
    async () => {
      log('\n================ SPIKE, en ================');
      await playScene('en');
    },
    600000,
  );
});
