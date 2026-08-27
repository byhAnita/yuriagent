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
import { RISK_EXPOSURE_THRESHOLD, MAX_STREAK } from '../config/constants.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { getIdentity } from '../data/identities.js';
import { EVENTS, eventFrame } from '../data/events/index.js';
import { renderFrame } from '../data/sceneFrames.js';

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

  /**
   * THE ROOM WITH EVERYBODY IN IT, which is the half this harness never drove.
   *
   * Every case above is a one-to-one in an empty practice room - and every
   * defect the first phone session found lived in the other case. A five-member
   * scene ran five paragraphs, aimed all four options at whoever the player last
   * answered, and let a member who was two locations away walk in with coffee.
   * None of it could surface here, because the harness only ever put one woman
   * in the room. **A harness that plays the easy case is a harness that agrees
   * with you** - the same lesson `balanceSim` taught by modelling a scene as a
   * number.
   *
   * Four things it looks for, and only the first two are strictly assertable:
   *
   *   1. the round stays about the two members the floor named;
   *   2. nobody who is absent is written into the room;
   *   3. the prose does not grow with the size of the room;
   *   4. the four options are not all aimed at one woman.
   *
   * (3) and (4) are printed rather than asserted. Length is a soft target and a
   * long round is a layout cost rather than a broken one; and "who is this
   * option aimed at" has no reliable test that is not itself a model call.
   */
  it(
    'holds a five-member room to one voice a round, in Chinese',
    async () => {
      const client = createClient({ apiKey, modelId });
      const ids = cards.map((c) => c.id);
      /**
       * HER NAME IN THE PROSE IS HER `zh` NAME, not the card's.
       *
       * Section 12: `nameLocal` exists because a `zh` run called Irene *Yilin*
       * and Hyewon *Huiyuan* - transliterations the model invented on the spot,
       * differently in different scenes. It works, which is why a first draft of
       * this assertion failed against perfectly correct output: it looked for
       * "Irene" in a paragraph that says the right thing in Chinese.
       */
      const nameOf = (id) => {
        const card = cards.find((c) => c.id === id);
        return card.nameLocal?.zh ?? card.name;
      };

      let session = beginScene({
        cards,
        lineup,
        identity: getIdentity(),
        player: { name: 'Yuhan', selfId: 40, mood: 55, secrecy: 70, energy: 80 },
        relations: Object.fromEntries(ids.map((id) => [id, { affection: 5, admissibility: 0 }])),
        dossier: {},
        lang: 'zh',
        pool: newPool(),
        seed: 21,
        scene: {
          id: 'live-group',
          locationId: 'practice_room',
          locationLabel: 'X Practice Room',
          present: ids,
          roster: ids,
          activity: 'The group is running the new choreography, between takes.',
          week: 0,
          day: 1,
          block: 'afternoon',
          phase: 'prep',
        },
      });

      const seen = [];
      let choice = null;

      while (!isOver(session)) {
        /**
         * EVERY THIRD ROUND IS LET PASS, so the harness exercises the two
         * postures a skip produces. Answering every round can only ever produce
         * `answers`, which is the one mode that needed no proving.
         */
        const skip = seen.length > 0 && seen.length % 3 === 2;
        const out = await runRound(session, { client, choice: skip ? null : choice, skip });
        const turn = out.session.turn;
        session = out.session;
        seen.push({ ...turn, chars: out.round.prose.replace(/\s/g, '').length });

        log(`\n--- round ${seen.length}: ${nameOf(turn.primary)} [${turn.mode}]${skip ? ' (player let it pass)' : ''} ---`);
        log(out.round.prose);
        out.round.options.forEach((o, i) => log(`  ${'ABCD'[i]}. ${o}`));

        /**
         * ONE VOICE. The weakest true claim is that the one the floor named is
         * in the prose; a stronger one would be a claim about writing. What the
         * READINGS below are for is the half no assertion can reach.
         */
        expect(out.round.prose).toContain(nameOf(turn.primary));
        for (const o of out.round.options) expect(o.length).toBeLessThan(60);

        choice = out.round.options[0] ?? null;
      }

      const closed = endScene(session);
      const chars = seen.map((t) => t.chars);

      log('\n================ GROUP READINGS ================');
      log(`rounds: ${seen.length} of ${session.total}`);
      log(`speaker: ${seen.map((t) => nameOf(t.primary)).join(' -> ')}`);
      log(`mode:    ${seen.map((t) => t.mode).join(' -> ')}`);
      log(`prose chars: ${chars.join(', ')}`);
      log(`  mean ${Math.round(chars.reduce((a, b) => a + b, 0) / chars.length)}`);
      log(`addressee at exit: ${nameOf(closed.addresseeId)}`);
      log('\nRead the rounds above. Does one voice at a time read as a room,');
      log('or as five monologues taking turns?');

      /**
       * THE ROOM CIRCULATES, and nobody holds it past the cap. Both are the
       * belt against the defect this replaced - one member taking over so that
       * every round is her, which is what the first hand test reported.
       */
      expect(new Set(seen.map((t) => t.primary)).size).toBeGreaterThan(2);
      expect(seen.some((t) => t.mode !== 'answers')).toBe(true);
      expect(Math.max(...Object.values(session.floor.streak))).toBeLessThanOrEqual(MAX_STREAK);

      // Whoever the floor ended on is the subject `propagate` will price.
      expect(ids).toContain(closed.addresseeId);
    },
    600000,
  );

  /**
   * AN ANCHOR EVENT, WHICH IS THE ONE THING NO OFFLINE TEST CAN JUDGE.
   *
   * The frame reaching tier 3 is asserted offline; whether a room handed two
   * hundred tokens of agenda actually SETTLES anything is a question about a
   * model, and section 10 records what happened the last time nobody asked it -
   * fifteen turns of a concept meeting that produced a joke about ear colour and
   * a plate of food, with the ledger line for the whole day going to the food.
   *
   * That was v1, and the fix was the agenda field this now carries. It has never
   * been played through the v2 loop, where the frame sits in a tail rebuilt every
   * round rather than in a header written once.
   *
   * Three things, and the third is the one with teeth:
   *
   *   1. the day survives at all - format, language, four options, five voices;
   *   2. the room does the WORK rather than describing it, on the round the
   *      engine spends the interlude line on;
   *   3. `canon|` comes back, on a topic that was on the agenda, with a NAME in
   *      it rather than "the third demo".
   *
   * (3) is asserted because `endScene` already drops a decision whose topic was
   * not on the agenda - so what could fail here is the room settling nothing at
   * all, which is exactly the played defect.
   */
  it(
    'settles something at a concept meeting, in Chinese',
    async () => {
      /**
       * RAW, KEPT. A round with no options is two completely different bugs -
       * the model omitted the machine block, or the parser ate it - and the
       * parsed round cannot tell them apart. The option-echo defect was found
       * exactly this way and would not have been found any other way.
       */
      const inner = createClient({ apiKey, modelId });
      let lastRaw = '';
      const client = async (args) => {
        lastRaw = await inner(args);
        return lastRaw;
      };

      const ids = cards.map((c) => c.id);
      const event = EVENTS.concept_meeting;
      const frame = renderFrame(eventFrame(event, { cycle: 0, seed: 21 }));

      let session = beginScene({
        cards,
        lineup,
        identity: getIdentity(),
        player: { name: 'Yuhan', selfId: 40, mood: 55, secrecy: 70, energy: 80 },
        relations: Object.fromEntries(
          cards.map((c) => [c.id, { affection: 20, admissibility: 5 }]),
        ),
        dossier: {},
        lang: 'zh',
        pool: newPool(),
        seed: 21,
        scene: {
          id: 'live-event',
          locationId: 'meeting_room',
          locationLabel: 'Meeting Room',
          present: ids,
          roster: ids,
          frame,
          agenda: event.frame.agenda,
          week: 0,
          day: 2,
          block: 'morning',
          phase: 'prep',
        },
      });

      const rounds = [];
      let choice = null;
      while (!isOver(session)) {
        const out = await runRound(session, { client, choice });
        session = out.session;
        rounds.push(out.round);

        log(`\n--- round ${rounds.length} (${session.turn.primary}, ${session.turn.mode}) ---`);
        log(out.round.prose);
        out.round.options.forEach((o, i) => log(`  ${'ABCD'[i]}. ${o}`));
        if (out.round.canon?.length) log(`  [canon] ${JSON.stringify(out.round.canon)}`);
        if (out.round.options.length < 4) {
          log('  !! FEWER THAN FOUR OPTIONS - raw follows');
          log(`  <<<${lastRaw}>>>`);
        }

        choice = out.round.options[1] ?? out.round.options[0] ?? null;
      }

      const closed = endScene(session);
      const topics = event.frame.agenda.map((a) => a.id);

      log('\n================ EVENT READINGS ================');
      log(`rounds: ${rounds.length} of ${session.total}`);
      log(`agenda: ${topics.join(', ')}`);
      log(`settled: ${JSON.stringify(closed.canon)}`);
      log('\nRead the day above. Did a meeting happen, or five friends in a room?');

      for (const r of rounds) {
        expect(HAN.test(r.prose)).toBe(true);
        expect(LATIN_PROSE.test(r.prose)).toBe(false);
      }

      /**
       * A RATE, NOT EVERY ROUND, and the difference is a design promise rather
       * than a lowered bar.
       *
       * `OptionBar` backfills to four whatever the parser returns, so a round
       * that lost its machine block costs the player four written options and
       * never strands them - the same per-line tolerance the parser has. What
       * would be a real defect is that happening OFTEN, and an event is where it
       * is likeliest: the tail carries a frame, an agenda and the canon on top of
       * everything an ordinary round has, so the format reminder is competing
       * with twice as much text.
       *
       * Measured at one round in eight before `ROUND_WORDS` moved into the tail
       * beside the format line - the rounds that lost their options were the long
       * ones, every time.
       */
      const parsed = rounds.filter((r) => r.options.length === 4).length;
      log(`four options: ${parsed}/${rounds.length}`);
      expect(parsed / rounds.length).toBeGreaterThanOrEqual(0.75);

      /**
       * The day settled at least one of the things it was there to settle, and
       * `endScene` has already thrown away anything that was not on the agenda.
       * One rather than all four: a room that agrees pleasantly about every item
       * is a room where nothing was at stake, and the prompt says so outright.
       */
      expect(closed.canon.length).toBeGreaterThan(0);
      for (const d of closed.canon) expect(topics).toContain(d.topic);

      /**
       * ...and it has a NAME in it. The day-three playtest settled a title track
       * four times and never once named it - "the third demo", "the slow one" -
       * which reads as placeholder text in the scene and is worse afterwards,
       * because canon keeps the sentence forever and the handbook shows it to
       * the player.
       */
      expect(closed.canon.some((d) => HAN.test(d.text) || /[A-Z]/.test(d.text))).toBe(true);
    },
    900000,
  );
});
