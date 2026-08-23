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
  endScene,
  interject,
  isGroupScene,
  turnTo,
  speakerOnPass,
  interjectionDirective,
  chimeDirective,
  secondVoiceDirective,
  closingDirective,
} from './sceneEngine.js';
import { newMemory } from './memory.js';
import { newRelation } from '../systems/relationship.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { getIdentity } from '../data/identities.js';
import { INTERJECT_THRESHOLD } from '../config/constants.js';
import { dialogueShape } from '../systems/dialogue.js';

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
      stance: 'flirt',
      text: '',
      client: says(BEAT('irene')),
      cast: cards,
    });

    expect(lastUser(session)).toContain('(to Irene)');
    expect(lastUser(session)).toContain('[flirt]');
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
      stance: 'flirt',
      text: 'hi',
      client: says(BEAT('irene')),
      cast: cards,
    });

    expect(lastUser(session)).toBe('[flirt] hi');
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

    expect(sent).toMatch(/write ONE beat for Nana only/i);
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

/**
 * Reported from play: "avoid becoming your chat, others are silent", and
 * separately that the cast were too hostile to each other for five women who
 * have shared a dorm for years.
 *
 * Both were the same defect. There was one bar and it was priced for jealousy,
 * so the arithmetic made ordinary conversation impossible: a week-1 bystander
 * at intimacy 10 who had been quiet for four turns scored 0.66 against a bar of
 * 1.0, and the jealousy term was the only thing in the formula big enough to
 * clear it on its own. A group scene could therefore be silent or it could be
 * jealous, and there was no third setting anywhere in the number.
 *
 * Two bars now. This block is the one that did not exist.
 */
describe('the room joins in', () => {
  const quiet = (memberId, turns) => {
    const relations = relationsWith(memberId, {});
    const opened = beginScene(setup({ relations }));
    return { relations, session: { ...opened, silentTurns: { [memberId]: turns } } };
  };

  it('lets somebody with no jealousy at all join in on the topic', async () => {
    const { relations, session } = quiet('nana', 2);

    const { interjectorId, kind } = await interject(session, {
      client: says(BEAT('nana')),
      relations,
      cards,
    });

    expect(interjectorId).toBe('nana');
    expect(kind).toBe('chime');
  });

  it('asks for a beat about the topic, not about the player', async () => {
    const { relations, session } = quiet('nana', 3);
    let sent = null;
    const client = vi.fn(async ({ messages, onChunk }) => {
      sent = messages.map((m) => m.content).join('\n');
      onChunk?.(BEAT('nana'));
      return BEAT('nana');
    });

    await interject(session, { client, relations, cards });

    expect(sent).toMatch(/write ONE beat for Nana only/i);
    expect(sent).toContain('joins in on what Irene and the player are talking about');
    expect(sent).toContain('easy company');
  });

  /**
   * The whole reason the chime directive says "easy company" out loud.
   *
   * Block 3 carries every present member's dossier and block 4 carries her
   * standing, so a model handed a bare "another member speaks" at a scene with
   * any jealousy in it will reliably write the jealousy. Naming the register is
   * what keeps a warm room warm - and it must not name the alternative, for the
   * same reason the cut-in never says "you are jealous".
   */
  it('never suggests she is upset about anything', () => {
    const text = chimeDirective('Nana', 'Irene');
    expect(text).not.toMatch(/jealous|upset|resent|attention|rival/i);
    expect(text).toMatch(/agreeing|adding|teasing/);
  });

  /**
   * One beat, said in a way the model actually obeys.
   *
   * "write one beat" alone did not take: measured at five members over eight
   * turns, every chime came back as two, so a full block ran to 34 beats and
   * an interjection was as long as the reply it cut into. Naming the FORM -
   * one metadata line, no second one - took it to exactly one beat every time
   * and halved the scene to 17 without making the room any quieter.
   *
   * Worth keeping asserted because it is the cheapest lever on how much
   * reading a group scene costs, and it is one careless reword away from
   * regressing invisibly.
   */
  it('asks for one beat in a way that names the form', () => {
    const text = chimeDirective('Nana', 'Irene');
    expect(text).toMatch(/ONE beat/);
    expect(text).toMatch(/no second metadata line/);
  });

  it('is a different beat from a cut-in', () => {
    expect(chimeDirective('Nana', 'Irene')).not.toBe(interjectionDirective('Nana', 'Irene'));
    expect(secondVoiceDirective('cut_in', 'Nana', 'Irene')).toBe(
      interjectionDirective('Nana', 'Irene'),
    );
    expect(secondVoiceDirective('chime', 'Nana', 'Irene')).toBe(chimeDirective('Nana', 'Irene'));
  });

  /**
   * The sharp one wins. A beat cannot be both warm and pointed, and the rarer
   * event is the more interesting one, so jealousy takes precedence over a
   * quieter member who merely had something to add.
   */
  it('lets a genuinely unsettled member take it instead', async () => {
    const relations = Object.fromEntries(
      ids.map((id) => [
        id,
        { ...newRelation(20), ...(id === 'jisoo' ? { intimacy: 60, jealousy: 70 } : {}) },
      ]),
    );
    const opened = beginScene(setup({ relations }));
    const session = { ...opened, silentTurns: { nana: 4, jisoo: 0 } };

    const { interjectorId, kind } = await interject(session, {
      client: says(BEAT('jisoo')),
      relations,
      cards,
    });

    expect(interjectorId).toBe('jisoo');
    expect(kind).toBe('cut_in');
  });

  /**
   * Section 5b calls `piqued` an OPPORTUNITY rather than a tax - she probes,
   * and the player noticing it is one of the strongest intimacy gains in the
   * game. Letting her interrupt about it spends the moment before the player
   * can read it, so she may join in but she may not cut in.
   */
  it('does not let a merely piqued member cut in', async () => {
    const relations = relationsWith('nana', { intimacy: 60, jealousy: 30 });
    const opened = beginScene(setup({ relations }));
    const session = { ...opened, silentTurns: { nana: 3 } };

    const { kind } = await interject(session, {
      client: says(BEAT('nana')),
      relations,
      cards,
    });

    expect(kind).toBe('chime');
  });
});

/**
 * Reported twice from a played day, in a drink room and in a dorm kitchen with
 * exactly one member in each: "Irene interrupted herself", "the same Nana
 * interrupted herself".
 *
 * It was never an interjection - the engine has always returned early on a
 * one-member roster - but it was true by accident of where the check happened
 * to live, and nothing said so out loud. `systems/dialogue.js` says it once and
 * both the engine and the screen read it, so a room with one person in it
 * cannot produce a second voice under any of the five scene kinds.
 */
describe('a room with one person in it', () => {
  const alone = () => {
    const s = setup();
    s.scene.rosterIds = ['irene'];
    s.scene.presentIds = ['irene'];
    return s;
  };

  it('is not a group scene at all', () => {
    expect(dialogueShape({ rosterIds: ['irene'] }).interject).toBe(false);
    expect(isGroupScene(beginScene(alone()))).toBe(false);
  });

  it('never makes a second call, whatever her state', async () => {
    const s = alone();
    // Everything that could possibly raise a stake, at once.
    s.relations = relationsWith('irene', { intimacy: 100, jealousy: 100 });
    const client = vi.fn(says(BEAT('irene')));

    const opened = { ...beginScene(s), silentTurns: { irene: 9 }, mentioned: ['irene'] };
    const { interjectorId, kind } = await interject(opened, {
      client,
      relations: s.relations,
      cards,
    });

    expect(interjectorId).toBeNull();
    expect(kind).toBeNull();
    expect(client).not.toHaveBeenCalled();
  });

  it('hands a pass back to the only person there, rather than nobody', () => {
    const s = alone();
    expect(speakerOnPass(beginScene(s), s.relations)).toBe('irene');
  });
});

/**
 * How a scene ends. Reported from play:
 *
 *   *The door closes fully. A beat later, it opens again - just a crack.*
 *   "对了。"
 *   [ the block is over ]
 *
 * She was starting something and the budget ran out underneath her. The model
 * cannot pace a scene whose end it cannot see, and section 6 measured that
 * handing it a budget makes it worse - but the CLIENT knows exactly which turn
 * is last, and saying so once costs nothing.
 */
describe('the last turn says it is the last turn', () => {
  it('asks her to land it rather than open something', () => {
    const text = closingDirective();
    expect(text).toMatch(/last exchange/);
    expect(text).toMatch(/rather than open something new/);
  });

  /**
   * And does not script the parting. What she says on the way out is hers -
   * a goodbye at `colleague` and at `unspoken` are different scenes, the same
   * argument section 11 makes for generating a gift reaction rather than
   * authoring one.
   */
  it('does not write her goodbye for her', () => {
    const text = closingDirective();
    expect(text).not.toMatch(/["“]/);
    expect(text).not.toMatch(/see you|goodbye|good night|take care/i);
  });

  it('reaches the model as a note at the tail, not as a header edit', async () => {
    let sent = null;
    const client = async ({ messages, onChunk }) => {
      sent = messages;
      onChunk?.(BEAT('irene'));
      return BEAT('irene');
    };

    const session = await runTurn(beginScene(setup()), {
      stance: 'joke',
      text: '',
      note: closingDirective(),
      client,
      cast: cards,
    });

    // At the tail, and specifically just BEFORE the player's own move: the
    // note is the frame the turn happens in, so it reads as context rather
    // than as an afterthought tacked on behind what the player did.
    expect(sent.at(-2).content).toContain('last exchange');
    expect(sent.at(-1).content).toContain('[joke]');
    expect(sent[0].content).not.toContain('last exchange');
    expect(session.beats.length).toBeGreaterThan(0);
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

/**
 * A shared dorm evening. PROPOSALS 15.
 *
 * The group-scene machinery with one flag on it, and the flag inverts what the
 * dorm costs: nobody is singled out, so nobody is watching anybody, and
 * everyone present gains a little instead.
 */
describe('an evening with all of them', () => {
  const sharedSetup = () => {
    const base = setup();
    base.scene.locationId = 'dorm_living';
    base.scene.shared = 'watch_a_film';
    return base;
  };

  const play = async (base, stance = 'joke') => {
    let session = beginScene(base);
    session = await runTurn(session, {
      stance,
      text: '',
      client: says(BEAT('irene')),
      cast: cards,
    });
    return endScene(session, {
      client: says('{"summary":"They watched a film."}'),
      memory: base.memory,
      relations: base.relations,
      cards,
      scene: base.scene,
      rng: () => 0,
    });
  };

  it('leaves nobody jealous and nothing overheard', async () => {
    const base = sharedSetup();
    const out = await play(base);

    expect(out.rumors).toEqual([]);
    for (const id of ROOM) {
      expect(out.relations[id].jealousy, id).toBe(base.relations[id].jealousy);
    }
  });

  it('pays everyone who was in the room', async () => {
    const base = sharedSetup();
    const out = await play(base);

    for (const id of ROOM) {
      if (id === 'irene') continue; // the focus is paid by the scene itself
      expect(out.relations[id].intimacy, id).toBeGreaterThan(base.relations[id].intimacy);
    }
  });

  /**
   * ...and only the room. Somebody who spent the evening elsewhere gets
   * nothing, which is the difference between a shared evening and a free
   * intimacy tick for the whole cast.
   */
  it('pays nobody who was not there', async () => {
    const base = sharedSetup();
    const out = await play(base);

    expect(out.relations.yeri.intimacy).toBe(base.relations.yeri.intimacy);
    expect(out.relations.hyewon.intimacy).toBe(base.relations.hyewon.intimacy);
  });

  /**
   * The same evening without the flag, in which the player actually makes a
   * move, is the expensive one it always was.
   *
   * `confide` and not `joke`, and that is the assertion rather than a detail.
   * Being in the room together stopped being an event of its own - what buys a
   * witnessed hit is an overt move somebody could describe, and this test is
   * the only place the whole join is exercised: `runTurn` sets `singledOut`
   * from the stance, `endScene` passes it to `propagate`, `propagate` prices
   * it. Three correct halves with nothing calling between them is this
   * project's characteristic bug, so the test crosses all three seams.
   */
  it('still costs the earth when the player makes a move', async () => {
    const base = sharedSetup();
    delete base.scene.shared;
    const out = await play(base, 'confide');

    expect(out.rumors.length).toBeGreaterThan(0);
    expect(out.rumors.every((r) => r.witnessed)).toBe(true);
  });

  /** ...and the same room, same people, where the player only talked. */
  it('costs nothing when the player only talked', async () => {
    const base = sharedSetup();
    delete base.scene.shared;
    const out = await play(base, 'joke');

    expect(out.rumors).toEqual([]);
  });
});

/**
 * The last turn of a scene must not cost what a gift costs.
 *
 * `singledOut` was read off `Boolean(note)`, which was correct while an opener
 * was the only thing that appended one. Then the closing directive arrived -
 * a system note the stage adds to the LAST turn of every scene - and every
 * group scene in the game started ending witnessed: four absent members took
 * `WEIGHT_WITNESSED` and a dossier entry each for a conversation.
 *
 * No unit test could see it, because the note is chosen by `VNStage` and the
 * flag was computed in `runTurn`; the engine tests above all play one turn and
 * never reach the closing one. This plays the shape the stage actually sends.
 */
describe('the closing turn is not a gesture', () => {
  const play = async (turnArgs) => {
    const base = setup();
    let session = beginScene(base);
    session = await runTurn(session, {
      client: says(BEAT('irene')),
      cast: cards,
      ...turnArgs,
    });
    const out = await endScene(session, {
      client: says('{"summary":"They talked."}'),
      memory: base.memory,
      relations: base.relations,
      cards,
      scene: base.scene,
      rng: () => 0,
    });
    return { base, session, out };
  };

  it('leaves nobody witnessed when the player only talked', async () => {
    const { session, out } = await play({
      stance: 'joke',
      text: '',
      note: closingDirective(),
    });

    expect(session.singledOut).toBeFalsy();
    expect(out.rumors.filter((r) => r.witnessed)).toEqual([]);
  });

  /** ...and still charges in full for one that was. */
  it('charges the full price when the last turn IS a gesture', async () => {
    const { session, out } = await play({
      note: `System note: the player has just handed Irene a rose. ${closingDirective()}`,
      gesture: true,
    });

    expect(session.singledOut).toBe(true);
    expect(out.rumors.some((r) => r.witnessed)).toBe(true);
  });
});
