/**
 * A group scene, through the real engine. Proposal 12.
 *
 * Two things make it a room rather than a queue, and both are joins rather
 * than functions: the player turn has to say WHO it is aimed at, and somebody
 * who was not asked has to be able to cut in. `systems/speaker.js` has been
 * deciding both since M4 and nothing called it.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  beginScene,
  runTurn,
  interject,
  isGroupScene,
  turnTo,
  speakerOnPass,
  interjectionDirective,
} from './sceneEngine.js';
import { newMemory } from './memory.js';
import { newRelation } from '../systems/relationship.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { getIdentity } from '../data/identities.js';
import { INTERJECT_THRESHOLD } from '../config/constants.js';

const cards = getCast();
const ids = cards.map((c) => c.id);
const ROOM = ['irene', 'nana', 'jisoo'];

const BEAT = (who) => `@${who}|neutral|guard50|fluster10\n*She looks over.* "Right."`;

/**
 * A client that STREAMS.
 *
 * `runTurn` and `interject` only ever feed the parser through `onChunk`, so a
 * client that merely resolves a string produces zero beats - and every
 * assertion about what was said then passes quietly against an empty array.
 * Worth stating outright: this caught three tests here that were testing
 * nothing.
 */
const says =
  (text) =>
  async ({ onChunk }) => {
    onChunk?.(text);
    return text;
  };

function setup({ relations } = {}) {
  return {
    cards,
    lineup: buildLineup(cards),
    identity: getIdentity(),
    player: { name: 'Yuhan', energy: 80, secrecy: 70, credits: 10 },
    lang: 'en',
    memory: newMemory(ids),
    relations: relations ?? Object.fromEntries(ids.map((id) => [id, newRelation(20)])),
    scene: {
      id: 'g1',
      seed: 1,
      rosterIds: ROOM,
      presentIds: ROOM,
      focusId: 'irene',
      week: 0,
      day: 1,
      block: 'evening',
      phase: 'prep',
      locationId: 'dorm_living',
      locationLabel: 'Living room',
    },
  };
}

/** Every relationship flat, with one of them dialled up. */
function relationsWith(memberId, patch) {
  return Object.fromEntries(
    ids.map((id) => [id, { ...newRelation(20), ...(id === memberId ? patch : {}) }]),
  );
}

const lastUser = (session) =>
  [...session.frame.turns].reverse().find((turn) => turn.role === 'user')?.content ?? '';

describe('addressing somebody', () => {
  it('knows a group scene from a one-member one', () => {
    expect(isGroupScene(beginScene(setup()))).toBe(true);

    const solo = setup();
    solo.scene.rosterIds = ['irene'];
    solo.scene.presentIds = ['irene'];
    expect(isGroupScene(beginScene(solo))).toBe(false);
  });

  it('says who the turn is aimed at, by name', async () => {
    const session = await runTurn(beginScene(setup()), {
      stance: 'tease',
      text: '',
      client: says(BEAT('irene')),
      cast: cards,
    });

    expect(lastUser(session)).toContain('(to Irene)');
    expect(lastUser(session)).toContain('[tease]');
  });

  /**
   * A one-member scene has to be byte-for-byte what it was, or every ordinary
   * turn in the game changes shape and section 8's prefix argument needs
   * re-measuring.
   */
  it('adds nothing at all to a one-member turn', async () => {
    const solo = setup();
    solo.scene.rosterIds = ['irene'];
    solo.scene.presentIds = ['irene'];

    const session = await runTurn(beginScene(solo), {
      stance: 'tease',
      text: 'hi',
      client: says(BEAT('irene')),
      cast: cards,
    });

    expect(lastUser(session)).toBe('[tease] hi');
  });

  it('follows the addressee when the player turns to somebody else', async () => {
    const s = setup();
    const turned = turnTo(beginScene(s), 'nana', s.relations);
    expect(turned.addresseeId).toBe('nana');

    const session = await runTurn(turned, {
      stance: 'joke',
      text: '',
      client: says(BEAT('nana')),
      cast: cards,
    });
    expect(lastUser(session)).toContain('(to Nana)');
  });

  it('refuses to turn to somebody who is not in the room', () => {
    const s = setup();
    const session = beginScene(s);
    expect(turnTo(session, 'yeri', s.relations).addresseeId).toBe(session.addresseeId);
  });
});

describe('somebody cuts in', () => {
  /**
   * The stake has to come from somewhere real. At intimacy 20 across the board
   * nobody clears the bar, which is the common case and the point: an
   * interjection every turn is a scene where nobody finishes a sentence.
   */
  it('stays quiet when nobody has anything at stake', async () => {
    const client = vi.fn(says(BEAT('irene')));
    const { session, interjectorId } = await interject(beginScene(setup()), {
      client,
      relations: setup().relations,
      cards,
    });

    expect(interjectorId).toBeNull();
    expect(client).not.toHaveBeenCalled();
    expect(session.beats).toHaveLength(0);
  });

  it('lets the member with the most at stake take a beat', async () => {
    const relations = relationsWith('nana', { intimacy: 90, jealousy: 80 });

    const { session, interjectorId } = await interject(beginScene(setup({ relations })), {
      client: says(BEAT('nana')),
      relations,
      cards,
    });

    expect(interjectorId).toBe('nana');
    expect(session.beats.at(-1).speaker).toBe('nana');
  });

  it('tells the model exactly who speaks and who they are cutting into', async () => {
    const relations = relationsWith('nana', { intimacy: 90, jealousy: 80 });
    let sent = null;
    const client = vi.fn(async ({ messages, onChunk }) => {
      sent = messages.map((m) => m.content).join('\n');
      onChunk?.(BEAT('nana'));
      return BEAT('nana');
    });

    await interject(beginScene(setup({ relations })), { client, relations, cards });

    expect(sent).toContain('write one beat for Nana only');
    expect(sent).toContain('Irene and the player were');
    expect(sent).toContain('Do not write anyone else');
  });

  /**
   * Her reason is deliberately NOT in the directive.
   *
   * Handing the model "you are jealous" makes it narrate the jealousy, the
   * same mistake section 8 forbids for relationship stats. The state is
   * already in blocks 3 and 4; her card decides how somebody like her
   * interrupts.
   */
  it('never tells her why she is cutting in', () => {
    const text = interjectionDirective('Nana', 'Irene');
    expect(text).not.toMatch(/jealous|intimacy|stake|because you/i);
  });

  it('never fires in a one-member scene', async () => {
    const solo = setup();
    solo.scene.rosterIds = ['irene'];
    solo.scene.presentIds = ['irene'];
    const client = vi.fn(says(BEAT('irene')));

    const { interjectorId } = await interject(beginScene(solo), {
      client,
      relations: solo.relations,
      cards,
    });

    expect(interjectorId).toBeNull();
    expect(client).not.toHaveBeenCalled();
  });

  /**
   * Her beat moves HER meters. Letting an interjection drop the addressee's
   * guard would hand the player a number they never earned - the same reason
   * `turnTo` carries meters per member.
   */
  it('does not move the addressee meters', async () => {
    const relations = relationsWith('nana', { intimacy: 90, jealousy: 80 });
    const opened = beginScene(setup({ relations }));
    const before = { ...opened.meters };

    const { session } = await interject(opened, {
      client: says('@nana|upset|guard20|fluster40\n*She cuts in.* "Sure."'),
      relations,
      cards,
    });

    expect(session.meters).toEqual(before);
    expect(session.metersByMember.nana.guard).toBe(20);
  });
});

describe('the room notices', () => {
  it('counts being named as a reason to speak up', async () => {
    const session = await runTurn(beginScene(setup()), {
      stance: 'joke',
      text: '',
      client: says('@irene|happy|guard40|fluster20\n*She grins.* "Ask Jisoo about that."'),
      cast: cards,
    });

    expect(session.mentioned).toContain('jisoo');
    expect(session.mentioned).not.toContain('nana');
  });

  it('counts how long each of them has said nothing', async () => {
    let session = beginScene(setup());
    for (let i = 0; i < 3; i += 1) {
      session = await runTurn(session, {
        stance: 'joke',
        text: '',
        client: says(BEAT('irene')),
        cast: cards,
      });
    }

    expect(session.silentTurns.irene).toBe(0);
    expect(session.silentTurns.nana).toBe(3);
  });

  /**
   * Silence alone eventually earns a beat. Without it a member who is neither
   * the addressee nor jealous never speaks, and stops being in the room.
   */
  it('lets sustained silence carry somebody over the bar', async () => {
    const relations = relationsWith('nana', { intimacy: 95 });
    const opened = beginScene(setup({ relations }));
    const waiting = { ...opened, silentTurns: { nana: 4, jisoo: 0 } };

    const { interjectorId } = await interject(waiting, {
      client: says(BEAT('nana')),
      relations,
      cards,
    });

    expect(interjectorId).toBe('nana');
  });
});

describe('passing', () => {
  it('hands the line to whoever has most at stake, bar or no bar', () => {
    const relations = relationsWith('jisoo', { intimacy: 70 });
    const session = beginScene(setup({ relations }));

    const who = speakerOnPass(session, relations);
    expect(who).toBe('jisoo');
    expect(who).not.toBe(session.addresseeId);
  });

  it('falls back to the addressee in a room with nobody else in it', () => {
    const solo = setup();
    solo.scene.rosterIds = ['irene'];
    solo.scene.presentIds = ['irene'];
    expect(speakerOnPass(beginScene(solo), solo.relations)).toBe('irene');
  });
});

describe('the threshold', () => {
  /**
   * UNMEASURED, and flagged as such in constants.js. The assertion is not that
   * 1.0 is right - it is that it sits in a range where the feature is neither
   * always on nor always off, which is the only thing checkable without a live
   * pass.
   */
  it('is somewhere a scene can reach and does not always clear', () => {
    expect(INTERJECT_THRESHOLD).toBeGreaterThan(0.5);
    expect(INTERJECT_THRESHOLD).toBeLessThan(2.5);
  });
});
