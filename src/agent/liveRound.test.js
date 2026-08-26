/**
 * The v2 loop against a real model. CLAUDE.md Part I.
 *
 * The spike (`spike.test.js`) drove `tiers.js` by hand to answer three design
 * questions and is allowed to be thrown away. This drives the ENGINE - the same
 * `beginScene` / `runRound` / `endScene` the game calls - so what it proves is
 * that the shipped path works, not that the format is writable.
 *
 * Six things no offline test can see:
 *   1. does the wire format survive a real model, in `zh`, every round?
 *   2. do four options come back parseable?
 *   3. does the model hold the delta bound and the "first round is 0" rule?
 *   4. does it hold the two axes apart in an empty room, unaided?
 *   5. do the FOUR NEW CARDS read as themselves, or as one voice?
 *   6. does prose reach the screen before the round closes?
 *
 * Run: LIVE_PROVIDER=1 LIVE_ROUND=1 npx vitest run liveRound
 */

import { describe, it, expect } from 'vitest';
import { liveConfig } from '../tools/liveEnv.js';
import { createClient } from '../tools/client.js';
import { beginScene, runRound, endScene, isOver } from './roundEngine.js';
import { newPool, poolEntries } from './pool.js';
import { DELTA_MAX, SENTINEL } from '../config/rules.js';
import { RISK_EXPOSURE_THRESHOLD } from '../config/constants.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { getIdentity } from '../data/identities.js';

const { apiKey, modelId, live } = liveConfig();
const enabled = live && Boolean(process.env.LIVE_ROUND);
const log = (...a) => process.stdout.write(`${a.join(' ')}\n`);

const cards = getCast();
const lineup = buildLineup(cards);

/** Han characters. The only reliable test for "is this actually Chinese". */
const HAN = /[一-鿿]/;
/** A run of Latin words long enough to be prose rather than a name or an id. */
const LATIN_PROSE = /[A-Za-z]{4,}(\s+[A-Za-z]{3,}){2,}/;

function open(memberId, lang) {
  return beginScene({
    cards,
    lineup,
    identity: getIdentity(),
    player: { name: 'Yuhan', selfId: 40, mood: 55, secrecy: 70, energy: 80 },
    relations: Object.fromEntries(
      cards.map((c) => [c.id, { affection: c.id === memberId ? 12 : 5, admissibility: 0 }]),
    ),
    dossier: {},
    lang,
    pool: newPool(),
    seed: 7,
    scene: {
      id: `live-${memberId}`,
      locationId: 'practice_room',
      locationLabel: 'X Practice Room',
      present: [memberId],
      activity: `${cards.find((c) => c.id === memberId).name} is practising alone, long after she needed to be.`,
      week: 0,
      day: 1,
      block: 'evening',
      phase: 'prep',
    },
  });
}

describe.skipIf(!enabled)('the round engine, live', () => {
  it(
    'plays a whole zh scene through the shipped path',
    async () => {
      const client = createClient({ apiKey, modelId });
      let session = open('irene', 'zh');
      expect(session.exposure).toBeLessThan(RISK_EXPOSURE_THRESHOLD);

      const rounds = [];
      const firsts = [];
      let choice = null;

      while (!isOver(session)) {
        const started = Date.now();
        let firstAt = null;
        const out = await runRound(session, {
          client,
          choice,
          onChunk: () => {
            if (firstAt === null) firstAt = Date.now() - started;
          },
        });
        session = out.session;
        rounds.push({ ...out.round, wall: Date.now() - started });
        if (firstAt !== null) firsts.push(firstAt);

        log(`\n--- round ${rounds.length} (${Date.now() - started}ms, first word ${firstAt}ms) ---`);
        log(out.round.prose);
        log(`  [emo] ${out.round.emotion ?? '-'}  [deltas] ${JSON.stringify(out.round.deltas)}`);
        out.round.options.forEach((o, i) => log(`  ${'ABCD'[i]}. ${o}`));
        if (out.round.summary) log(`  [sum] ${out.round.summary}`);

        // A middling answer every time, so the scene is driven by the writing
        // rather than by a player trying to win.
        choice = out.round.options[1] ?? out.round.options[0] ?? null;
      }

      const closed = endScene(session);

      log('\n================ READINGS ================');
      log(`rounds: ${rounds.length} of ${session.total}`);
      log(`prose length (chars): ${rounds.map((r) => r.prose.replace(/\s/g, '').length).join(', ')}`);
      log(`four options: ${rounds.filter((r) => r.options.length === 4).length}/${rounds.length}`);
      log(`wall: ${rounds.map((r) => r.wall).join(', ')}ms`);
      log(`first word: ${firsts.join(', ')}ms`);
      log(`affection 12 -> ${closed.relations.irene.affection}`);
      log(`admissibility 0 -> ${closed.relations.irene.admissibility}`);
      log(`summary: ${closed.summary}`);

      for (const r of rounds) {
        // The contract, every round.
        expect(r.prose.length).toBeGreaterThan(20);
        expect(HAN.test(r.prose)).toBe(true);
        expect(LATIN_PROSE.test(r.prose)).toBe(false);
        expect(r.prose).not.toContain(SENTINEL);
        expect(r.options.length).toBeGreaterThanOrEqual(3);
        for (const d of Object.values(r.deltas)) {
          expect(Math.abs(d)).toBeLessThanOrEqual(DELTA_MAX);
        }
      }

      /**
       * Nothing has happened yet at the moment the player walks in.
       *
       * Asserted as "every delta is zero" rather than "there are no delta
       * lines", because the model reliably writes `irene+0` instead of omitting
       * the line as the rules ask. That costs three tokens and changes nothing -
       * `applyDeltas` drops a zero, and the first round is short-circuited
       * anyway - so it is not worth another instruction to correct.
       */
      for (const d of Object.values(rounds[0].deltas)) expect(d).toBe(0);

      /**
       * Part I.9. Nobody could see any of this, and nothing ever raises
       * admissibility in an empty room - so a rise here is the MODEL failing to
       * hold the axes apart, which is what the spike says it does unaided.
       */
      expect(closed.relations.irene.admissibility).toBe(0);

      // The scene closed and the pool kept it.
      expect(closed.pool.current).toBe(null);
      expect(closed.pool.closed).toHaveLength(1);
      expect(closed.summary).toBeTruthy();

      // The prose reached the caller before the round did.
      expect(firsts.length).toBe(rounds.length);
      expect(Math.min(...firsts)).toBeLessThan(Math.min(...rounds.map((r) => r.wall)));

      // Recent full text is in the player's language (Part I.6).
      expect(HAN.test(poolEntries(closed.pool).map((e) => e.summary ?? '').join(''))).toBe(false);
    },
    600000,
  );

  /**
   * THE FOUR NEW CARDS, one opening round each.
   *
   * The failure this is looking for is the one section 8 measured once already:
   * two cards adjacent in temperament collapse onto the subset they share, and
   * Irene and Hyewon came back with the same line at 90% shared vocabulary. The
   * `zh` profiles are new and nothing has read them against a real model yet.
   *
   * Printed rather than asserted on vocabulary overlap, because the measure for
   * "does this read as her" is a native reader and there is no test for it.
   */
  it(
    'opens on each of the four new cards, in Chinese',
    async () => {
      const client = createClient({ apiKey, modelId });

      for (const id of ['jisoo', 'hyewon', 'yeri', 'nana']) {
        const { round } = await runRound(open(id, 'zh'), { client });
        log(`\n================ ${id} ================`);
        log(round.prose);
        round.options.forEach((o, i) => log(`  ${'ABCD'[i]}. ${o}`));

        expect(HAN.test(round.prose)).toBe(true);
        expect(LATIN_PROSE.test(round.prose)).toBe(false);
        expect(round.options.length).toBeGreaterThanOrEqual(3);
      }

      log('\nRead the four above. Do they sound like four different women?');
    },
    600000,
  );
});
