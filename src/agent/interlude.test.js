/**
 * The mid-event interlude. PROPOSALS 23.
 *
 * Reported three times in one session, once per physical event:
 *
 *   > Still No description of MV shooting scene.
 *   > Same issue - no description for comeback stage performance.
 *   > Still no fan-meeting description.
 *
 * The properties asserted here are the ones that make this NARRATION rather
 * than a director with a speaker id - it is what keeps the parser's roster rule
 * untouched, and the roster rule is the one guarantee this project has never
 * softened.
 */

import { describe, it, expect } from 'vitest';
import {
  beginScene,
  interlude,
  interludeDirective,
  establishingDirective,
  INTERLUDE_PLAIN,
} from './sceneEngine.js';
import { buildMessages } from './promptBuilder.js';
import { createMockClient } from '../tools/mockClient.js';
import { getCast } from '../data/cast.js';
import { EVENTS, EVENT_IDS } from '../data/events/index.js';
import { buildLineup } from '../systems/castBuilder.js';
import { newRelation } from '../systems/relationship.js';
import { newMemory } from './memory.js';

const cards = getCast();
const lineup = buildLineup(cards);
const castIds = cards.map((c) => c.id);

function setup() {
  return {
    cards,
    lineup,
    identity: { promptRole: 'an artist assistant' },
    player: { name: 'You', energy: 80, secrecy: 70, credits: 10 },
    lang: 'en',
    memory: newMemory(castIds),
    relations: Object.fromEntries(castIds.map((id) => [id, newRelation(5)])),
    scene: {
      id: 's1',
      rosterIds: ['irene'],
      presentIds: castIds,
      focusId: 'irene',
      week: 0,
      day: 1,
      block: 'afternoon',
      phase: 'prep',
      locationId: 'practice_room',
      locationLabel: 'Set',
      event: EVENTS.mv_shoot,
      sceneFrame: EVENTS.mv_shoot.frame,
    },
  };
}

const client = createMockClient({ seed: 3, delay: 0, failureRate: 0 });

describe('which days get one', () => {
  /**
   * A meeting IS people talking, so establishing it once is enough and a second
   * paragraph of room would be the padding that makes generated prose read as
   * generated. The three that DO something are the three that get it.
   */
  it('is the shoot, the stage and the fan meeting, and nothing else', () => {
    const physical = EVENT_IDS.filter((id) => EVENTS[id].physical);
    expect(physical.sort()).toEqual(['fan_meeting', 'music_bank', 'mv_shoot']);
    expect(EVENTS.concept_meeting.physical).toBeUndefined();
  });
});

describe('the directive', () => {
  /**
   * Not "more atmosphere" - the room was established forty words ago. What is
   * missing is the WORK, which is the one thing dialogue between five friends
   * cannot show.
   */
  it('asks for the work rather than the mood', () => {
    expect(INTERLUDE_PLAIN).toMatch(/set up, shot, played, carried or handed/);
    expect(INTERLUDE_PLAIN).toMatch(/the work, not the mood/);
  });

  /** Section 9 rule 6, and the parser is not involved in this call. */
  it('forbids dialogue, a metadata line and anyone else\'s beat', () => {
    expect(INTERLUDE_PLAIN).toMatch(/no dialogue/);
    expect(INTERLUDE_PLAIN).toMatch(/no metadata line/);
    expect(INTERLUDE_PLAIN).toMatch(/do not write anyone's beat/);
  });

  /** Pillar 1 is 30-50 word bursts, and this is a paragraph beside them. */
  it('asks for about forty words', () => {
    expect(INTERLUDE_PLAIN).toMatch(/forty words/);
  });

  it('carries the language, and says nothing extra in English', () => {
    expect(interludeDirective('zh')).toContain('Simplified Chinese');
    expect(interludeDirective('en')).not.toMatch(/Write it in/);
    expect(interludeDirective()).toBe(interludeDirective('en'));
  });

  /**
   * The two narration calls have to ask for different things, or the second one
   * is the first one again - which is exactly the failure the event chain had
   * (PROPOSALS 24) arriving in a new place.
   */
  it('is not the establishing beat with extra words', () => {
    expect(interludeDirective('en')).not.toBe(establishingDirective('en'));
    expect(INTERLUDE_PLAIN).not.toMatch(/before anyone speaks/);
  });
});

describe('the call', () => {
  it('appends both halves at the tail and returns the prose', async () => {
    const session = beginScene(setup());
    const before = buildMessages(session.frame).length;

    const { session: after, text } = await interlude(session, { client });

    expect(text.length).toBeGreaterThan(20);
    expect(buildMessages(after.frame)).toHaveLength(before + 2);
  });

  /** Section 8, invariant 1: nothing above block 5 may move. */
  it('changes nothing above block 5', async () => {
    const session = beginScene(setup());
    const prefix = buildMessages(session.frame)[0].content;
    const { session: after } = await interlude(session, { client });

    expect(buildMessages(after.frame)[0].content).toBe(prefix);
  });

  it('strips a metadata line the model emitted anyway', async () => {
    const chatty = async () => '@irene|neutral|guard50|fluster0\nThey reset for the next take.';
    const { text } = await interlude(beginScene(setup()), { client: chatty });

    expect(text).not.toContain('@irene');
    expect(text).toContain('reset for the next take');
  });

  /**
   * A flatter event is an acceptable failure; a scene that stops is not.
   * Section 3 keeps every degraded mode playable, and the client-side guard is
   * a ref rather than the turn number precisely so a failure here does not burn
   * the interlude - but the engine must still hand the session back untouched.
   */
  it('gives the session back untouched when the call fails', async () => {
    const dead = async () => {
      throw new Error('provider down');
    };
    const session = beginScene(setup());
    const { session: after, text } = await interlude(session, { client: dead });

    expect(after).toBe(session);
    expect(text).toBeNull();
  });

  it('gives it back untouched when the model returns nothing usable', async () => {
    const session = beginScene(setup());
    const { session: after, text } = await interlude(session, { client: async () => '  ' });

    expect(after).toBe(session);
    expect(text).toBeNull();
  });
});
