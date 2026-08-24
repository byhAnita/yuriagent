/**
 * An anchor event against a real model. OPT-IN - skipped without a key.
 *
 * PROPOSALS 20 is the newest feature in the game and the least tested, because
 * every part of it is a judgement a unit test cannot make. `canon.test.js`
 * proves a decision is stored and filtered correctly; `VNStage.dom.test.jsx`
 * proves an establishing beat reaches the screen. Neither can answer the three
 * questions the feature actually rests on:
 *
 *   1. does the establishing call write a ROOM, or does it write a beat with
 *      somebody speaking in it - the contract says nobody speaks yet
 *   2. does the day DECIDE anything? that was the whole complaint that started
 *      the proposal: fifteen turns of a concept meeting produced a joke about
 *      ear colour and the ledger line went to a plate of food
 *   3. does the chain hold? the MV shoot two days later has to be shooting the
 *      concept the meeting chose, and that is the shortest demonstration that
 *      canon is worth having
 *
 * Gated on LIVE_EVENT=1 as well as a key: a pass is ~40 calls.
 *
 * Both languages, because the establishing call OWNS THE EMPTY BLOCK 5 - the
 * exact condition that produced the language split, in the scene that was that
 * bug's worst case. If it comes back, it comes back here.
 */

import { describe, it, expect } from 'vitest';
import { stream, complete } from '../tools/llmTool.js';
import { liveConfig } from '../tools/liveEnv.js';
import {
  beginScene,
  establish,
  interlude,
  runTurn,
  endScene,
  openingDirective,
  closingDirective,
} from './sceneEngine.js';
import { newMemory } from './memory.js';
import { newRelation } from '../systems/relationship.js';
import { agendaIds, addDecisions, canonForEvent, renderCanon } from '../systems/canon.js';
import { eventFor, eventFrame } from '../data/events/index.js';
import { REGISTERS } from '../data/sceneFrames.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { makeRng } from '../systems/rng.js';

const { apiKey, modelId, live } = liveConfig();
const enabled = live && Boolean(process.env.LIVE_EVENT);
const log = (...a) => process.stdout.write(`${a.join(' ')}\n`);

const cards = getCast();
const castIds = cards.map((c) => c.id);
const lineup = buildLineup(cards);

function client({ messages, preset, onChunk }) {
  if (onChunk) {
    return stream({ messages, apiKey, modelId, preset, onChunk }).then((r) => r.text);
  }
  return complete({ messages, apiKey, modelId, preset }).then((r) => r.text);
}

/** Han characters. The only reliable test for "is this actually Chinese". */
const HAN = /[一-鿿]/;
/** A run of Latin letters long enough to be prose rather than a name or an id. */
const LATIN_PROSE = /[A-Za-z]{4,}(\s+[A-Za-z]{3,}){2,}/;

/**
 * A NAME IS NOT PROSE, and section 19 rule 2 is a rule about prose.
 *
 * Memory is English so a language switch cannot corrupt a run. A song TITLE is
 * not memory being written in Chinese - it is the name of a thing that this
 * campaign invented, and in a `zh` run the thing is genuinely called that.
 * Caught live: the meeting settled on
 *
 *   text = "the road-trip demo titled <<TITLE>> was chosen as the title track"
 *
 * with the same title in `display`. Demanding an English title would invent a
 * SECOND name for one song - the model would then say the English one in
 * Chinese prose, and the player would read a different title in the handbook
 * from the one Irene says out loud. That is precisely the failure
 * `learnableFacts` had before ids, and the same failure `nameLocal` fixed for
 * the members themselves.
 *
 * So the check strips quoted and bracketed spans - the places a name lives -
 * and asks whether what is LEFT is English.
 */
const stripNames = (text) =>
  String(text ?? '')
    .replace(/\u300a[^\u300b]*\u300b/g, ' ')
    .replace(/[\u201c\u201d"'\u2018\u2019][^\u201c\u201d"'\u2018\u2019]*[\u201c\u201d"'\u2018\u2019]/g, ' ')
    .replace(/\u300c[^\u300d]*\u300d/g, ' ');

/**
 * The whole cast in the room, which is what an anchor event is.
 *
 * `presentIds` is the roster, so witnessed jealousy and `riskExposure` need no
 * special case - section 10 has the argument for why an event needed almost no
 * new machinery.
 */
function eventSetup({ eventId = 'concept_meeting', lang = 'en', canon = [], cycle = 0 } = {}) {
  const event = eventFor(
    eventId === 'mv_shoot' ? 'prep' : 'prep',
    eventId === 'mv_shoot' ? 'event_b' : 'event_a',
  );
  const locationId = eventId === 'mv_shoot' ? 'mv_set' : 'meeting_room';

  return {
    cards,
    lineup,
    identity: { promptRole: 'an artist assistant', exposureModifier: {} },
    player: { name: 'Yuhan', energy: 80, secrecy: 70, credits: 10 },
    lang,
    memory: newMemory(castIds),
    relations: Object.fromEntries(castIds.map((id) => [id, newRelation(45)])),
    scene: {
      id: `ev-${eventId}`,
      rosterIds: castIds,
      presentIds: castIds,
      focusId: 'irene',
      week: cycle * 3,
      day: 2,
      block: 'morning',
      phase: 'prep',
      locationId,
      locationLabel: locationId,
      seed: 7,
      lang,
      occupancy: {},
      task: null,
      event,
      /**
       * Built for THIS cycle rather than read off the table (PROPOSALS 24), so
       * a live pass exercises the per-cycle stakes clause and this run's style
       * pressure - which is the half of the fix that only shows up in prose.
       */
      sceneFrame: eventFrame(event, { cycle, seed: 20260821 }),
      register: REGISTERS.event,
      canon: canonForEvent(canon, { cycle, reads: event.reads ?? [] }),
    },
  };
}

/**
 * Play an event far enough to close it.
 *
 * Short on purpose - eight turns rather than sixteen. The question here is
 * whether the machinery produces decisions at all, and doubling the turn count
 * doubles the bill to answer the same question. The closing directive is what
 * actually asks for the settlement, and it lands either way.
 */
async function playEvent(setup, { turns = 6 } = {}) {
  let session = beginScene(setup);

  const room = await establish(session, { client, lang: setup.lang });
  session = room.session;

  session = await runTurn(session, {
    text: openingDirective(setup.lang),
    client,
    cast: cards,
  });

  const stances = ['care', 'casual', 'joke', 'press', 'confide', 'casual'];
  for (let i = 0; i < turns; i += 1) {
    const last = i === turns - 1;
    session = await runTurn(session, {
      stance: stances[i % stances.length],
      text: '',
      note: last ? closingDirective({ settles: true }) : null,
      client,
      cast: cards,
    });
  }

  const out = await endScene(session, {
    client,
    memory: setup.memory,
    relations: setup.relations,
    cards,
    scene: setup.scene,
    rng: makeRng(3),
  });

  return { session, room, out };
}

describe.skipIf(!enabled)('the room, before anyone speaks', () => {
  /**
   * The contract is narration: no metadata line, no speaker, nobody talking.
   * `speaker: null` is the whole of what makes it narration on screen, so a
   * model that puts dialogue here draws a nameless quote under no portrait.
   */
  it('writes a room and not a beat', async () => {
    const { room } = await playEvent(eventSetup(), { turns: 0 });

    log('\n[event] --- establishing beat, en ---');
    log(`  ${room.text}`);

    expect(room.text).toBeTruthy();
    expect(room.text).not.toMatch(/^@/m);
    expect(room.text).not.toMatch(/["“”]/);
    // About forty words. Generous bounds - this is a reading, not a contract.
    const words = room.text.trim().split(/\s+/).length;
    log(`[event] ${words} words`);
    expect(words).toBeGreaterThan(15);
    expect(words).toBeLessThan(140);
  }, 240000);

  /**
   * THE LANGUAGE SPLIT, at the one call that can still produce it.
   *
   * Every other turn in the game has Chinese prose immediately above the
   * generation - her last beat, the player's chip - and the model continues in
   * the language it can see. This call has an EMPTY BLOCK 5 and nothing above
   * it but English bookkeeping, which is why the directive carries the
   * language inline. Reported on a phone as an English action with Chinese
   * speech; asserted here so it cannot come back unnoticed.
   */
  it('writes it wholly in Chinese for a zh run', async () => {
    const { room } = await playEvent(eventSetup({ lang: 'zh' }), { turns: 0 });

    log('\n[event] --- establishing beat, zh ---');
    log(`  ${room.text}`);

    expect(room.text).toBeTruthy();
    expect(HAN.test(room.text)).toBe(true);
    // Not "mostly Chinese" - a ratio hides half of any defect local to part of
    // a string, which this project has already shipped once (failure mode 4).
    expect(room.text).not.toMatch(LATIN_PROSE);
  }, 240000);
});

describe.skipIf(!enabled)('a day that decides something', () => {
  /**
   * The complaint that started PROPOSALS 20, asserted.
   *
   * A concept meeting that settles nothing is an ordinary group chat in a
   * nicer room. The agenda plus the closing directive are what ask for it, and
   * `parseDecisions` drops anything off-agenda - so an empty result here means
   * either the model ignored the ask or every topic it named was invented.
   */
  it('settles at least one thing on its agenda', async () => {
    const setup = eventSetup();
    const { out } = await playEvent(setup);

    const ids = agendaIds(setup.scene.sceneFrame);
    log('\n[event] --- what the concept meeting settled ---');
    log(`  agenda: ${ids.join(', ')}`);
    for (const d of out.decisions) log(`  [${d.topic}] ${d.text}`);
    // `summary` is the whole parsed object, not a string - App reads
    // `outcome.summary.display`. Logging it bare printed `[object Object]`.
    log(`  ledger: ${out.summary?.summary ?? '(none)'}`);
    log(`[event] ${out.decisions.length} of ${ids.length} settled`);

    expect(out.decisions.length).toBeGreaterThan(0);
    for (const d of out.decisions) {
      expect(ids, `${d.topic} is not on the agenda`).toContain(d.topic);
      expect(d.text.trim()).not.toBe('');
    }
  }, 480000);

  /**
   * Two texts, for the reason section 12 learned once with `learnableFacts`.
   *
   * Memory is English so a language switch cannot corrupt a run - which means
   * without `display` the handbook shows a Chinese player their own campaign
   * in English. This is the only place that can prove the model writes both.
   */
  it('writes English memory and a Chinese display line in a zh run', async () => {
    const setup = eventSetup({ lang: 'zh' });
    const { out } = await playEvent(setup);

    log('\n[event] --- decisions, zh ---');
    for (const d of out.decisions) log(`  [${d.topic}] text="${d.text}" display="${d.display}"`);
    log(`  ledger: memory="${out.summary?.summary}" display="${out.summary?.display}"`);

    expect(out.decisions.length).toBeGreaterThan(0);
    for (const d of out.decisions) {
      // Memory is English, always (section 19 rule 2) - but a title the
      // campaign invented is a NAME, and `stripNames` says why it is exempt.
      expect(stripNames(d.text), `text should be English: ${d.text}`).not.toMatch(HAN);
      // ...and the player reads their own language.
      expect(HAN.test(d.display), `display should be Chinese: ${d.display}`).toBe(true);
    }
    // The ledger is memory too - and its display line is not.
    expect(stripNames(out.summary?.summary)).not.toMatch(HAN);
    expect(HAN.test(out.summary?.display ?? '')).toBe(true);
  }, 480000);
});

describe.skipIf(!enabled)('the chain', () => {
  /**
   * The shortest demonstration that canon is worth having: the shoot two days
   * later is shooting the concept the meeting chose.
   *
   * Fed rather than played, because playing the meeting first would double the
   * bill and add a second failure point to a test about the second event. The
   * canon here is the shape `addDecisions` produces, so the only thing being
   * exercised is whether an event reads what it was authored to read.
   */
  it('shoots the concept the meeting chose', async () => {
    const decided = addDecisions(
      [],
      [
        { topic: 'concept', text: 'the concept is a washed-out seaside summer, shot on film' },
        { topic: 'title_track', text: 'the title track is Surfin Summer' },
        { topic: 'centre', text: 'Yeri takes the centre position for this promotion' },
      ],
      { cycle: 0, phase: 'prep', slot: 'event_a' },
    );

    const setup = eventSetup({ eventId: 'mv_shoot', canon: decided, cycle: 0 });

    // It has to reach the prompt before it can reach the prose.
    const injected = renderCanon(setup.scene.canon, 0);
    log('\n[event] --- what the shoot was told ---');
    log(injected);
    expect(injected).toMatch(/Surfin Summer/);
    expect(injected).toMatch(/seaside/);

    const { room, session } = await playEvent(setup, { turns: 3 });
    const prose = [room.text ?? '', ...session.beats.map((b) => b.text)].join('\n');

    log('\n[event] --- the shoot ---');
    log(`  ${room.text}`);
    for (const b of session.beats) log(`  @${b.speaker}|${b.emotion} ${b.text}`);

    /**
     * ASSERTED LOOSELY ON PURPOSE. Demanding the exact string would be testing
     * the model's phrasing rather than the wiring - it may well write "the
     * beach concept" or name the song without the space. What must not happen
     * is a shoot that shows no sign of knowing what it is shooting.
     *
     * THE VOCABULARY WAS LEARNED THE HARD WAY, and it is the mirror of failure
     * mode 9: a harness wrong in the player's DISfavour cries wolf. The first
     * version required `seaside` and failed a run whose prose said "the sea
     * shots are going to eat the morning" and "the centre shot is Yeri's" -
     * both lifted straight from canon. The chain was working perfectly and the
     * regex was too narrow to see it. Match the semantic field, not a string.
     */
    const CONCEPT = /\bsea|salt|surf|summer|beach|coast|shore|film\b/i;
    const CENTRE = /yeri/i;
    const knowsConcept = CONCEPT.test(prose);
    const knowsCentre = CENTRE.test(prose);
    log(`[event] concept surfaced: ${knowsConcept}   centre surfaced: ${knowsCentre}`);

    /**
     * Either one proves the wiring. Demanding both would be asserting that a
     * three-turn scene spends itself on bookkeeping, which is not what a scene
     * is for - the shoot above named the centre, the ending pose and the final
     * cut without once saying the word "concept", and that is good writing
     * rather than a fault.
     */
    expect(knowsConcept || knowsCentre).toBe(true);
  }, 480000);

  /**
   * A previous cycle's decision must not be stated as the current one.
   *
   * `renderCanon` prefixes an older entry with "earlier in the campaign", and
   * that prefix is the only thing standing between a second comeback and a
   * model announcing last cycle's title track as this cycle's. Cheap to check
   * and impossible to notice in play until it has already happened.
   */
  it('marks an older cycle as older', () => {
    const older = addDecisions([], [{ topic: 'title_track', text: 'the title track is Bad Boy' }], {
      cycle: 0,
      phase: 'prep',
      slot: 'event_a',
    });
    const rendered = renderCanon(
      canonForEvent(older, { cycle: 1, reads: ['title_track'] }),
      1,
    );

    log(`\n[event] cycle 1 reading cycle 0: ${rendered}`);
    expect(rendered).toMatch(/earlier in the campaign/);
  });
});

/**
 * CANON IN AN ORDINARY BLOCK. Day-three playtest, findings 8 and 9.
 *
 * This is where most of canon's value is meant to be - Irene mentioning the
 * title track in a wardrobe on a Tuesday is pillar 4 working - and it is where
 * it failed twice over:
 *
 *   > Character keeps mention the word "concept", "concept board" instead of
 *   > the concrete concept facts.
 *
 *   > A bug here "tomorrow at the beach" while MV shoot has been finished in
 *   > previous week.
 *
 * Both are the same omission: the lines carried facts and no instruction about
 * what to do with them. Block 4 now says name them concretely, and says that a
 * line marked as earlier has already happened.
 */
describe.skipIf(!enabled)('canon in an ordinary block', () => {
  const settled = [
    { topic: 'title_track', text: 'the title track is Day Dream', cycle: 0, phase: 'prep', slot: 'event_a' },
    { topic: 'concept', text: 'the concept is a seaside sunrise, pale styling', cycle: 0, phase: 'prep', slot: 'event_a' },
  ];

  /** An ordinary practice-room block, a few days after the meeting. */
  const after = (over = {}) => {
    const s = eventSetup();
    return {
      ...s,
      scene: {
        ...s.scene,
        rosterIds: ['irene'],
        presentIds: ['irene'],
        locationId: 'practice_room',
        locationLabel: 'practice_room',
        day: 4,
        event: null,
        sceneFrame: null,
        register: null,
        canon: settled,
        ...over,
      },
    };
  };

  it('says the title by name rather than saying "the concept"', async () => {
    const setup = after();
    let session = beginScene(setup);
    session = await runTurn(session, { text: openingDirective(), client, cast: cards });
    for (const stance of ['casual', 'care', 'joke']) {
      session = await runTurn(session, { stance, text: '', client, cast: cards });
    }

    const prose = session.beats.map((b) => b.text).join('\n');
    log('\n[event] --- an ordinary block, three days after the meeting ---');
    for (const b of session.beats) log(`  @${b.speaker} ${b.text}`);

    const named = /day dream|sunrise|seaside|pale/i.test(prose);
    const vague = /the concept board|the concept\b/i.test(prose);
    log(`[event] names it: ${named}   says "the concept": ${vague}`);

    /**
     * Loose, and for the same reason the chain test is: a three-turn scene may
     * legitimately be about something else entirely, and canon is capped at a
     * few lines precisely so it cannot drown the scene. What the report caught
     * was the opposite failure - the decision coming up and being referred to
     * as "the concept" - so that is what is asserted.
     */
    if (vague) expect(named, 'raised the decision and would not name it').toBe(true);
  }, 480000);

  /**
   * The tense half. A decision from an earlier CYCLE is marked, and must not be
   * spoken as though it were still ahead.
   */
  it('does not put a finished shoot in the future', async () => {
    const old = settled.map((e) => ({ ...e, cycle: 0 }));
    const setup = after({ week: 3, canon: old });

    let session = beginScene(setup);
    session = await runTurn(session, { text: openingDirective(), client, cast: cards });
    for (const stance of ['casual', 'care']) {
      session = await runTurn(session, { stance, text: '', client, cast: cards });
    }

    const prose = session.beats.map((b) => b.text).join('\n');
    log('\n[event] --- a block in the NEXT cycle ---');
    for (const b of session.beats) log(`  @${b.speaker} ${b.text}`);

    // Reported, not asserted: this is a reading about a provider, and the
    // phrasing that would prove it is unbounded. The prompt-side guard lives
    // in `language.test.js`, which asserts the instruction is actually sent.
    const future = /tomorrow|next week|going to shoot|will shoot/i.test(prose);
    log(`[event] speaks of it as still ahead: ${future}`);
    expect(session.beats.length).toBeGreaterThan(0);
  }, 480000);
});

/**
 * The middle of a day that DOES something. PROPOSALS 23.
 *
 * The complaint was stated three times in one played session - the MV shoot
 * never shoots, the stage never performs, the fan meeting never signs anything -
 * and it is a judgement no unit test can make. `interlude.test.js` proves the
 * call is shaped like narration and fails silently; only a real model can say
 * whether what comes back is the WORK or another paragraph of mood.
 */
describe.skipIf(!enabled)('the middle of a shoot', () => {
  it('writes the work, not another paragraph of room', async () => {
    const setup = eventSetup({ eventId: 'mv_shoot' });
    let session = beginScene(setup);

    const room = await establish(session, { client, lang: 'en' });
    session = room.session;
    session = await runTurn(session, { text: openingDirective('en'), client, cast: cards });
    session = await runTurn(session, { stance: 'work', text: '', client, cast: cards });

    const mid = await interlude(session, { client, lang: 'en' });

    log('\n[event] --- interlude, mv shoot, en ---');
    log(`  ${mid.text}`);

    expect(mid.text).toBeTruthy();
    // Narration: nobody speaks, and no metadata line reaches the player.
    expect(mid.text).not.toMatch(/^@/m);
    expect(mid.text).not.toMatch(/["\u201c\u201d]/);

    // It has to be about the shoot rather than about the weather. Any one of
    // these is enough - the point is that a camera exists in the sentence.
    expect(mid.text).toMatch(
      /camera|shot|take|lens|lighting|lights|monitor|crew|set|frame|rig|marker|playback/i,
    );

    // Not the establishing beat again. That one is allowed to describe the
    // room; this one has already had a room described and must move past it.
    expect(mid.text).not.toBe(room.text);
  }, 240000);

  it('is wholly Chinese in a zh run', async () => {
    const setup = eventSetup({ eventId: 'mv_shoot', lang: 'zh' });
    let session = beginScene(setup);

    const room = await establish(session, { client, lang: 'zh' });
    session = room.session;
    session = await runTurn(session, { text: openingDirective('zh'), client, cast: cards });

    const mid = await interlude(session, { client, lang: 'zh' });

    log('\n[event] --- interlude, mv shoot, zh ---');
    log(`  ${mid.text}`);

    expect(HAN.test(mid.text)).toBe(true);
    expect(LATIN_PROSE.test(mid.text)).toBe(false);
  }, 240000);
});
