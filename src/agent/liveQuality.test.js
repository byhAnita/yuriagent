/**
 * What the writing is actually like. OPT-IN - skipped without a key.
 *
 * `tools/live.test.js` answers 'does the router work and does the contract
 * hold'. This answers the questions that decide whether the game is any good,
 * and that no offline test can reach:
 *
 *   1. do the meters MOVE? the whole micro-to-macro mapping in section 6 is
 *      thresholded (guard drop >= 15, fluster peak >= 60), and those numbers
 *      were calibrated against the offline writer, which is generous
 *   2. do the five members read as five people, or as one idol with five names
 *   3. does `zh` keep the machine tokens ASCII while writing Chinese prose
 *   4. does the summarizer produce a usable ledger line and real dossier facts
 *
 * Run with LIVE_QUALITY=1 and a key in .env.local. Costs real tokens, and
 * reports far more than it asserts, because most of these are readings about a
 * provider rather than contracts this repo controls.
 */

import { describe, it, expect } from 'vitest';
import { stream, complete } from '../tools/llmTool.js';
import { liveConfig } from '../tools/liveEnv.js';
import {
  beginScene,
  runTurn,
  endScene,
  openingDirective,
  readHer,
  closingDirective,
  interject,
  turnTo,
} from './sceneEngine.js';
import { newMemory, entryText } from './memory.js';
import { newRelation } from '../systems/relationship.js';
import { availableStances } from '../systems/chips.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { makeRng } from '../systems/rng.js';
import { GUARD_DROP_TO_PAY, FLUSTER_PEAK_TO_PAY } from '../config/constants.js';

const { apiKey, modelId, live } = liveConfig();

/**
 * Gated on an env flag as well as the key, unlike `tools/live.test.js`.
 *
 * That one is three calls and worth paying for on any run that has a key.
 * This one plays whole scenes - a single pass is dozens of calls - so it must
 * not fire just because a key happens to be present. `npm test` should never
 * cost money by surprise.
 */
const enabled = live && Boolean(process.env.LIVE_QUALITY);
const log = (...a) => process.stdout.write(`${a.join(' ')}\n`);

/**
 * The real thresholds, imported rather than copied.
 *
 * They were copied once, and after `GUARD_DROP_TO_PAY` / `FLUSTER_PEAK_TO_PAY`
 * moved, the report cheerfully printed "0/6 paid" for a sample in which one
 * scene had in fact cleared the fluster bar. A measurement harness that lies is
 * worse than none.
 */
const pays = (r) => r.drop >= GUARD_DROP_TO_PAY || r.peak >= FLUSTER_PEAK_TO_PAY;

const cards = getCast();
const castIds = cards.map((c) => c.id);
const lineup = buildLineup(cards);

function client({ messages, preset, onChunk }) {
  if (onChunk) {
    return stream({ messages, apiKey, modelId, preset, onChunk }).then(
      (r) => r.text,
    );
  }
  return complete({ messages, apiKey, modelId, preset }).then((r) => r.text);
}

function setup({
  memberId = 'irene',
  intimacy = 45,
  lang = 'en',
  locationId = 'practice_room',
  activity = null,
  task = null,
} = {}) {
  return {
    cards,
    lineup,
    identity: { promptRole: 'an artist assistant', exposureModifier: {} },
    player: { name: 'You', energy: 80, secrecy: 70, credits: 10 },
    lang,
    memory: newMemory(castIds),
    relations: Object.fromEntries(
      castIds.map((id) => [id, newRelation(intimacy)]),
    ),
    scene: {
      id: 'lq',
      rosterIds: [memberId],
      focusId: memberId,
      week: 0,
      day: 1,
      block: 'evening',
      phase: 'prep',
      locationId,
      locationLabel: locationId,
      seed: 1,
      occupancy: activity ? { [memberId]: { activity } } : {},
      task,
    },
  };
}

describe.skipIf(!enabled)('what the model actually writes', () => {
  /**
   * The central calibration question.
   *
   * Section 6 pays intimacy for a guard drop of 15 or more across a scene, and
   * for a fluster peak of 60. Those thresholds have only ever been met by the
   * offline writer. If a real model moves the meters by one or two a beat, a
   * scene against a real provider pays nothing at all - and the entire
   * relationship model would be driven by openers and by nothing the player
   * said.
   */
  it('moves the meters far enough for a scene to pay', async () => {
    const samples = Number(process.env.LIVE_SAMPLES ?? 1);
    const runs = [];

    for (let s = 0; s < samples; s += 1) {
      runs.push(await oneScene());
    }

    if (samples > 1) {
      log('\n[quality] --- distribution over ' + samples + ' scenes ---');
      for (const r of runs) {
        log(
          `  beats ${String(r.beats).padStart(3)}  guard drop ${String(r.drop).padStart(4)}  ` +
            `fluster peak ${String(r.peak).padStart(4)}  pays ${
              pays(r) ? 'yes' : 'NO'
            }`,
        );
      }
      const paid = runs.filter((r) => pays(r)).length;
      log(`[quality] ${paid}/${samples} scenes paid any intimacy at all`);
    }

    expect(runs.every((r) => r.beats > 3)).toBe(true);
  }, 900000);

  async function oneScene() {
    let session = beginScene(setup({ intimacy: 45 }));
    session = await runTurn(session, { text: openingDirective(), client });

    const path = [
      { turn: 0, guard: session.meters.guard, fluster: session.meters.fluster },
    ];
    const stances = ['flirt', 'confide', 'press', 'care', 'joke', 'invite'];

    for (let i = 0; i < stances.length; i += 1) {
      const { available } = availableStances(newRelation(45), { energy: 80 });
      const stance = available.includes(stances[i]) ? stances[i] : 'joke';
      session = await runTurn(session, { stance, text: '', client });
      path.push({
        turn: i + 1,
        stance,
        guard: session.meters.guard,
        fluster: session.meters.fluster,
      });
    }

    log(
      '\n[quality] --- meters over one scene (start guard ' +
        session.meters.guardStart +
        ') ---',
    );
    for (const p of path) {
      log(
        `  t${p.turn} ${String(p.stance ?? 'open').padEnd(9)} guard ${String(p.guard).padStart(3)}  fluster ${String(p.fluster).padStart(3)}`,
      );
    }

    const drop = session.meters.guardStart - session.meters.guard;
    log(
      // Interpolated, not typed. See `pays` above: the literals here said 15
      // and 60 while the real thresholds were 12 and 30, so the report was
      // misstating what it had just measured against - the same defect that
      // comment describes, moved from the arithmetic into the message.
      `[quality] guard drop over the scene: ${drop} (section 6 pays at ${GUARD_DROP_TO_PAY})` +
        `  fluster peak: ${session.meters.flusterPeak} (pays at ${FLUSTER_PEAK_TO_PAY})`,
    );

    const withMeta = session.beats.filter((b) => !b.inferred).length;
    log(`[quality] ${withMeta}/${session.beats.length} beats carried metadata`);

    if (Number(process.env.LIVE_SAMPLES ?? 1) === 1) {
      log('\n[quality] --- the scene ---');
      for (const b of session.beats)
        log(`  @${b.speaker}|${b.emotion}  ${b.text}`);
    }

    return {
      drop,
      peak: session.meters.flusterPeak,
      beats: session.beats.length,
    };
  }

  /**
   * Five people, or one idol with five names?
   *
   * Block 1 gained a differentiation directive for exactly this. The same
   * room, the same intimacy, the same opening instruction - the only thing
   * that varies is the card.
   */
  it('writes five different women into the same room', async () => {
    const opens = {};
    for (const id of castIds) {
      let s = beginScene(setup({ memberId: id }));
      s = await runTurn(s, { text: openingDirective(), client });
      opens[id] = s.beats.map((b) => b.text).join(' ');
    }

    log('\n[quality] --- the same room, five members ---');
    for (const [id, text] of Object.entries(opens))
      log(`  ${id.padEnd(7)} ${text}`);

    // Crude but real: how much vocabulary do any two of them share?
    const words = (t) =>
      new Set(
        t
          .toLowerCase()
          .replace(/[^a-z\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 4),
      );
    const ids = Object.keys(opens);
    let worst = 0;
    let worstPair = '';
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = words(opens[ids[i]]);
        const b = words(opens[ids[j]]);
        const shared = [...a].filter((w) => b.has(w)).length;
        const overlap = shared / Math.max(1, Math.min(a.size, b.size));
        if (overlap > worst) {
          worst = overlap;
          worstPair = `${ids[i]}/${ids[j]}`;
        }
      }
    }
    log(
      `[quality] worst vocabulary overlap: ${worstPair} ${(worst * 100).toFixed(0)}%`,
    );

    // Nobody should be speaking as somebody else - that one IS a contract.
    for (const [id, text] of Object.entries(opens)) {
      expect(text.length).toBeGreaterThan(0);
      for (const other of cards.filter((c) => c.id !== id)) {
        expect(text).not.toContain(other.name);
      }
    }
  }, 300000);

  /**
   * Section 19: prose in the player's language, machine tokens in ASCII
   * English. A localized emotion name kills the parser, and `zh` is the
   * primary locale.
   */
  it('writes Chinese prose without localizing a single machine token', async () => {
    let session = beginScene(setup({ lang: 'zh' }));
    session = await runTurn(session, { text: openingDirective(), client });
    session = await runTurn(session, { stance: 'flirt', text: '', client });

    log('\n[quality] --- zh ---');
    for (const b of session.beats)
      log(`  @${b.speaker}|${b.emotion}  ${b.text}`);

    const prose = session.beats.map((b) => b.text).join(' ');
    const han = (prose.match(/[一-鿿]/g) ?? []).length;
    log(
      `[quality] ${han} Han characters in ${prose.length} characters of prose`,
    );

    // The contract half: ids and emotions stay ASCII whatever the prose does.
    for (const b of session.beats) {
      expect(b.speaker).toBe('irene');
      if (b.emotion) expect(/^[a-z]+$/.test(b.emotion)).toBe(true);
    }
    expect(han).toBeGreaterThan(10);
  }, 180000);

  /**
   * The scene exit is the only thing that writes long-term memory. A summary
   * that says nothing, or a dossier entry that is a transcript rather than a
   * fact, degrades every later prompt in the run.
   */
  it('closes a scene with a usable ledger line and real dossier entries', async () => {
    const args = setup({ intimacy: 55 });
    let session = beginScene(args);
    session = await runTurn(session, { text: openingDirective(), client });
    session = await runTurn(session, { stance: 'confide', text: '', client });
    session = await runTurn(session, { stance: 'press', text: '', client });

    const { thought } = await readHer(session, { client });
    log(`\n[quality] --- read her ---\n  ${thought}`);

    const result = await endScene(session, {
      client,
      memory: args.memory,
      relations: args.relations,
      cards,
      scene: args.scene,
      rng: makeRng(5),
    });

    log('\n[quality] --- scene exit ---');
    log(`  ledger: ${result.memory.ledger.at(-1)?.text}`);
    log(`  dossier(irene): ${JSON.stringify(result.memory.dossier.irene)}`);
    log(`  deltas: ${JSON.stringify(result.delta)}`);
    log(`  rumors: ${result.rumors.length}`);

    expect(result.memory.ledger.length).toBeGreaterThan(0);
    // English memory whatever the UI language - section 19, rule 2.
    const line = result.memory.ledger.at(-1).text;
    expect(/[一-鿿]/.test(line)).toBe(false);
  }, 240000);

  /**
   * The other half of section 11's diagram: talking to her has to be able to
   * teach the player something they can SPEND. The summarizer used to write its
   * own phrasing, which matched no opener's `requires` needle, so every opener
   * in the game was reachable by snooping alone.
   */
  it('records a card fact in the card wording when it actually comes up', async () => {
    const args = setup({ intimacy: 55 });
    let session = beginScene(args);
    session = await runTurn(session, { text: openingDirective(), client });
    session = await runTurn(session, {
      text: 'You never sit still. Do you actually train on top of all this practice?',
      client,
    });
    session = await runTurn(session, {
      text: 'Ten minutes between runs. That is not a break, that is a second workout.',
      client,
    });

    const result = await endScene(session, {
      client,
      memory: args.memory,
      relations: args.relations,
      cards,
      scene: args.scene,
      rng: makeRng(9),
    });

    const facts = result.memory.dossier.irene.known_facts;
    log('\n[quality] --- fact capture ---');
    for (const b of session.beats) log(`  @${b.speaker}  ${b.text}`);
    log(`  known_facts: ${JSON.stringify(facts)}`);

    const gym = 'squeezes ten-minute gym sets into the breaks between practices';
    /**
     * `entryText`, not the entry - a dossier entry is `{ text, factId }` since
     * facts grew ids (PROPOSALS 14). This read the entry as a bare string and
     * threw, which nothing noticed because it only runs under LIVE_QUALITY=1.
     * A live-only test still has to survive a refactor of the thing it reads.
     */
    const matched = facts.some((f) => entryText(f).toLowerCase().includes('gym'));
    log(
      matched
        ? '[quality] a gym fact was recorded'
        : '[quality] NOT captured - the dialogue arm of the economy is still shut',
    );
    log(`  (the card wording is: "${gym}")`);

    expect(Array.isArray(facts)).toBe(true);
  }, 240000);


  /**
   * The same woman, the same room, a different reason to be in it.
   *
   * Every scene in the practice room used to open the same way, because block 4
   * named the location and nothing else - the model had to invent why she was
   * standing there. The calendar knew all along.
   */
  it('gives the same room a different scene when the schedule changes', async () => {
    const opens = {};
    for (const activity of ['group_practice', 'late_practice', 'solo_recording']) {
      let s = beginScene(setup({ activity }));
      s = await runTurn(s, { text: openingDirective(), client });
      opens[activity] = s.beats.map((b) => b.text).join(' ');
    }

    log('\n[quality] --- same room, three schedules ---');
    for (const [a, text] of Object.entries(opens)) log(`  ${a.padEnd(15)} ${text}`);

    for (const text of Object.values(opens)) expect(text.length).toBeGreaterThan(0);
  }, 240000);

  /**
   * The player's own job is the other half of "why is this conversation
   * happening now". A still-unfinished one is visible pressure she can name.
   */
  it('lets her notice the job the player has not done', async () => {
    let s = beginScene(
      setup({
        locationId: 'wardrobe',
        activity: 'fitting',
        task: { taskId: 'prep_outfits', done: false },
      }),
    );
    s = await runTurn(s, { text: openingDirective(), client });
    s = await runTurn(s, { stance: 'deflect', text: '', client });

    log('\n[quality] --- wardrobe, outfits not prepped ---');
    for (const b of s.beats) log(`  @${b.speaker}|${b.emotion}  ${b.text}`);

    expect(s.beats.length).toBeGreaterThan(0);
  }, 240000);

});

/**
 * The group scene, live. Section 10c, and reported after the first day of play.
 *
 * This is the one thing no offline test can settle, and the docs have said so
 * since the feature shipped: the failure mode is prose quality, not a
 * distribution. Two questions, both about tone:
 *
 *   1. does a chime read as somebody joining in, or does the model reach for
 *      the jealousy sitting in blocks 3 and 4 whatever the directive says
 *   2. does the room circulate, or does one member answer everything
 *
 * The reported bug was that the cast were hostile to each other for five women
 * who have shared a dorm for years, and that everyone but the addressee was
 * silent. Those had the same cause - one interjection bar, priced for jealousy
 * - and this measures whether splitting it fixed the writing and not merely
 * the arithmetic.
 */
const ROOM = ['irene', 'nana', 'jisoo'];

/** Words a warm chime should not be reaching for. */
const RESENTFUL =
  /jealous|jealousy|resent|possessive|glare|glares|coldly|icily|bitter|snap|snaps|snapped|sarcastic/i;

function groupSetup({ relations, locationId = 'practice_room', activity = 'group_practice' } = {}) {
  return {
    cards,
    lineup,
    identity: { promptRole: 'an artist assistant', exposureModifier: {} },
    player: { name: 'You', energy: 80, secrecy: 70, credits: 10 },
    lang: 'en',
    memory: newMemory(castIds),
    relations:
      relations ?? Object.fromEntries(castIds.map((id) => [id, newRelation(35)])),
    scene: {
      id: 'lg',
      rosterIds: ROOM,
      presentIds: ROOM,
      focusId: 'irene',
      week: 0,
      day: 1,
      block: 'afternoon',
      phase: 'prep',
      locationId,
      locationLabel: locationId,
      seed: 1,
      occupancy: Object.fromEntries(ROOM.map((id) => [id, { activity }])),
    },
  };
}

const nameOf = (id) => cards.find((c) => c.id === id)?.name ?? id;

describe.skipIf(!enabled)('a room with three of them in it', () => {
  /**
   * Six turns of ordinary practice-room conversation, with nobody jealous.
   *
   * Under the old single bar this scene produced ZERO second voices at any
   * point - a week-1 bystander scored 0.66 against a bar of 1.0 - so the whole
   * of it was the player and Irene while two other women stood there.
   */
  it('circulates, and stays warm while it does', async () => {
    let session = beginScene(groupSetup());
    session = await runTurn(session, { text: openingDirective(), client, cast: cards });

    const transcript = [];
    const voices = [];
    let chimes = 0;
    let cutIns = 0;

    for (const stance of ['joke', 'flirt', 'deflect', 'care', 'joke', 'press']) {
      const before = session.beats.length;
      session = await runTurn(session, { stance, text: '', client, cast: cards });
      for (const b of session.beats.slice(before)) {
        transcript.push(`  [${stance}] @${b.speaker}|${b.emotion}  ${b.text}`);
      }

      const seen = session.beats.length;
      const out = await interject(session, {
        client,
        relations: groupSetup().relations,
        cards,
      });
      session = out.session;

      if (out.interjectorId) {
        voices.push(out.interjectorId);
        if (out.kind === 'chime') chimes += 1;
        else cutIns += 1;
        for (const b of session.beats.slice(seen)) {
          transcript.push(`     ^-- ${out.kind} @${b.speaker}|${b.emotion}  ${b.text}`);
        }
      } else {
        transcript.push('     ^-- (nobody)');
      }
    }

    log('\n[quality] --- practice room, three of them, six turns ---');
    for (const line of transcript) log(line);

    const distinct = new Set(session.beats.map((b) => b.speaker));
    const second = session.beats.filter((b) => b.speaker !== 'irene');
    log(
      `\n[quality] voices=${[...distinct].join(',')} chimes=${chimes} cut-ins=${cutIns}` +
        ` second-voice beats=${second.length}/${session.beats.length}`,
    );

    const resentful = session.beats.filter((b) => RESENTFUL.test(b.text));
    log(`[quality] resentful lines: ${resentful.length}`);
    for (const b of resentful) log(`   !! @${b.speaker} ${b.text}`);

    // The bug was silence. Somebody other than the addressee has to speak.
    expect(distinct.size).toBeGreaterThan(1);
    expect(chimes).toBeGreaterThan(0);
    // Nobody is jealous in this fixture, so nothing should be a cut-in.
    expect(cutIns).toBe(0);
  }, 480000);

  /**
   * One call, one speaker - the rule that replaced section 9's two-member cap.
   *
   * A group scene is only as safe as a 1v1 because the CLIENT picks who speaks
   * and asks for one beat. If the model writes two members in one reply the
   * parser cannot help: both are rostered, so both are accepted.
   */
  it('never writes two of them in one reply', async () => {
    let session = beginScene(groupSetup());
    session = await runTurn(session, { text: openingDirective(), client, cast: cards });

    const replies = [];
    for (const stance of ['flirt', 'confide', 'joke']) {
      const before = session.beats.length;
      session = await runTurn(session, { stance, text: '', client, cast: cards });
      replies.push(session.beats.slice(before));

      const seen = session.beats.length;
      const out = await interject(session, {
        client,
        relations: groupSetup().relations,
        cards,
      });
      session = out.session;
      if (out.interjectorId) replies.push(session.beats.slice(seen));
    }

    log('\n[quality] --- one call, one speaker ---');
    for (const reply of replies) {
      const who = [...new Set(reply.map((b) => b.speaker))];
      log(`  ${who.join(' + ')}  (${reply.length} beat${reply.length === 1 ? '' : 's'})`);
      expect(who.length).toBeLessThanOrEqual(1);
    }
  }, 480000);

  /**
   * And the sharp register still exists when it is earned.
   *
   * The point of the split is not that nobody is ever jealous - it is that
   * jealousy stops being the only way into the room. Nana at `corrosive`
   * should read pointedly, and visibly differently from the warm chimes above.
   */
  it('still lets a genuinely unsettled member cut in, and sound like it', async () => {
    const relations = Object.fromEntries(
      castIds.map((id) => [
        id,
        { ...newRelation(35), ...(id === 'nana' ? { intimacy: 80, jealousy: 85 } : {}) },
      ]),
    );

    let session = beginScene(groupSetup({ relations }));
    session = await runTurn(session, { text: openingDirective(), client, cast: cards });
    session = await runTurn(session, { stance: 'confide', text: '', client, cast: cards });

    const seen = session.beats.length;
    const out = await interject(session, { client, relations, cards });

    log('\n[quality] --- nana at corrosive ---');
    log(`  kind=${out.kind} who=${out.interjectorId}`);
    for (const b of out.session.beats.slice(seen)) log(`  @${b.speaker}|${b.emotion}  ${b.text}`);

    expect(out.kind).toBe('cut_in');
    expect(out.interjectorId).toBe('nana');
  }, 480000);

  /**
   * An opener, handed over three turns into a conversation rather than at the
   * door - which is the whole point of moving it. The topic should TURN.
   */
  it('turns the conversation when the player hands somebody something', async () => {
    let session = beginScene(groupSetup());
    session = await runTurn(session, { text: openingDirective(), client, cast: cards });
    session = await runTurn(session, { stance: 'joke', text: '', client, cast: cards });

    const before = session.beats.map((b) => b.text).join(' ');

    session = turnTo(session, 'jisoo', groupSetup().relations);
    const note =
      `the player has just handed ${nameOf('jisoo')} an iced coffee. ` +
      'An ordinary, thoughtful gesture - kind, but nothing she could not have guessed at.';
    const seen = session.beats.length;
    session = await runTurn(session, { note, client, cast: cards });

    log('\n[quality] --- an opener, mid-scene ---');
    log(`  before: ${before}`);
    for (const b of session.beats.slice(seen)) log(`  after:  @${b.speaker}|${b.emotion}  ${b.text}`);

    const after = session.beats.slice(seen);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((b) => b.speaker === 'jisoo')).toBe(true);
  }, 480000);
});

/**
 * The two cases PROPOSALS 16 says are untested: a full eight-turn block, and
 * five members rather than three.
 *
 * Gated separately from LIVE_QUALITY because it is ~20 calls on its own and
 * the question it answers is a taste one - it reports far more than it
 * asserts, and the report is the point.
 */
describe.skipIf(!enabled || !process.env.LIVE_BIG_ROOM)('the whole room, a whole block', () => {
  it('holds up at five members over eight turns', async () => {
    const all = castIds;
    const relations = Object.fromEntries(all.map((id) => [id, newRelation(35)]));
    const base = {
      cards,
      lineup,
      identity: { promptRole: 'an artist assistant', exposureModifier: {} },
      player: { name: 'You', energy: 80, secrecy: 70, credits: 10 },
      lang: 'en',
      memory: newMemory(castIds),
      relations,
      scene: {
        id: 'lb',
        rosterIds: all,
        presentIds: all,
        focusId: 'irene',
        week: 0,
        day: 1,
        block: 'afternoon',
        phase: 'prep',
        locationId: 'practice_room',
        locationLabel: 'practice_room',
        seed: 1,
        occupancy: Object.fromEntries(all.map((id) => [id, { activity: 'group_practice' }])),
      },
    };

    let session = beginScene(base);
    session = await runTurn(session, { text: openingDirective(), client, cast: cards });

    const said = Object.fromEntries(all.map((id) => [id, 0]));
    const kinds = [];
    const lines = [];
    said[session.beats.at(-1)?.speaker ?? 'irene'] += 1;

    const stances = ['joke', 'flirt', 'deflect', 'care', 'confide', 'joke', 'press', 'flirt'];
    for (const stance of stances) {
      const before = session.beats.length;
      session = await runTurn(session, { stance, text: '', client, cast: cards });
      for (const b of session.beats.slice(before)) {
        said[b.speaker] = (said[b.speaker] ?? 0) + 1;
        lines.push(`  [${stance}] @${b.speaker}  ${b.text.replace(/\s+/g, ' ').slice(0, 110)}`);
      }

      const seen = session.beats.length;
      const out = await interject(session, { client, relations, cards });
      session = out.session;
      kinds.push(out.kind ?? 'none');
      for (const b of session.beats.slice(seen)) {
        said[b.speaker] = (said[b.speaker] ?? 0) + 1;
        lines.push(`     ^-- ${out.kind} @${b.speaker}  ${b.text.replace(/\s+/g, ' ').slice(0, 110)}`);
      }
    }

    log('\n[big] --- five members, eight turns ---');
    for (const l of lines) log(l);

    const chimes = kinds.filter((k) => k === 'chime').length;
    const quiet = kinds.filter((k) => k === 'none').length;
    log(`\n[big] second voice: ${chimes} chime, ${kinds.filter((k) => k === 'cut_in').length} cut-in, ${quiet} silent (of ${kinds.length})`);
    log(`[big] who spoke: ${all.map((id) => `${id}=${said[id]}`).join('  ')}`);
    log(`[big] beats total: ${session.beats.length}`);

    const spoke = all.filter((id) => said[id] > 0).length;
    log(`[big] ${spoke}/5 members said anything at all`);

    const resentful = session.beats.filter((b) => RESENTFUL.test(b.text));
    log(`[big] resentful lines: ${resentful.length}`);
    for (const b of resentful) log(`   !! @${b.speaker} ${b.text}`);

    expect(spoke).toBeGreaterThan(2);
  }, 900000);
});

/**
 * Nobody assigns the player a gender.
 *
 * The game never states one - the name is free text and no field anywhere
 * carries it - so a model that guesses is inventing something about the player
 * that the player did not choose. The case only arises when one member talks to
 * ANOTHER about them, which is neither narration nor being addressed, and it
 * became common the day a second voice started speaking most turns.
 *
 * Measured before the block 1 rule existed: a cut-in came back with "He's just
 * standing there." This is the regression check.
 */
describe.skipIf(!enabled || !process.env.LIVE_BIG_ROOM)('nobody guesses at the player', () => {
  it('never calls the player he or she, across a whole group block', async () => {
    const all = castIds;
    const relations = Object.fromEntries(
      all.map((id) => [
        id,
        // One member unsettled, so cut-ins fire too. The gendered line that
        // prompted this was a cut-in, and the two directives are separate.
        { ...newRelation(40), ...(id === 'nana' ? { intimacy: 80, jealousy: 85 } : {}) },
      ]),
    );

    let session = beginScene({
      cards,
      lineup,
      identity: { promptRole: 'an artist assistant', exposureModifier: {} },
      player: { name: 'Yuhan', energy: 80, secrecy: 70, credits: 10 },
      lang: 'en',
      memory: newMemory(castIds),
      relations,
      scene: {
        id: 'lg2',
        rosterIds: all,
        presentIds: all,
        focusId: 'irene',
        week: 0,
        day: 1,
        block: 'afternoon',
        phase: 'prep',
        locationId: 'practice_room',
        locationLabel: 'practice_room',
        seed: 3,
        occupancy: Object.fromEntries(all.map((id) => [id, { activity: 'group_practice' }])),
      },
    });

    session = await runTurn(session, { text: openingDirective(), client, cast: cards });
    for (const stance of ['joke', 'confide', 'flirt', 'press', 'care', 'joke']) {
      session = await runTurn(session, { stance, text: '', client, cast: cards });
      const out = await interject(session, { client, relations, cards });
      session = out.session;
    }

    /**
     * Word-boundary matched, and deliberately narrow. "she" is all over these
     * scenes correctly - five women - so only a pronoun applied to the PLAYER
     * counts, which in practice means one of these constructions near a verb
     * of standing, watching or arriving.
     */
    const GENDERED = /\b(he|him|his)\b/i;
    const hits = session.beats.filter((b) => GENDERED.test(b.text));

    log('\n[gender] --- five members, six turns, one at corrosive ---');
    log(`[gender] beats: ${session.beats.length}`);
    log(`[gender] beats containing he/him/his: ${hits.length}`);
    for (const b of hits) log(`   !! @${b.speaker} ${b.text.replace(/\s+/g, ' ')}`);

    expect(hits).toHaveLength(0);
  }, 900000);
});

/**
 * How a scene ends. Reported from play: the block ran out while she was
 * starting something, and the player read "this block is over" instead of
 * whatever she was about to say.
 */
describe.skipIf(!enabled)('the last turn lands', () => {
  it('parts rather than opening something new', async () => {
    let session = beginScene(setup({ intimacy: 55 }));
    session = await runTurn(session, { text: openingDirective(), client });
    for (const stance of ['joke', 'flirt', 'confide']) {
      session = await runTurn(session, { stance, text: '', client });
    }

    const before = session.beats.length;
    const closing = await runTurn(session, {
      stance: 'care',
      text: '',
      note: closingDirective(),
      client,
    });

    log('\n[quality] --- the last turn ---');
    for (const b of closing.beats.slice(before)) log(`  @${b.speaker}|${b.emotion}  ${b.text}`);

    expect(closing.beats.length).toBeGreaterThan(before);
  }, 240000);
});
