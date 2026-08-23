/**
 * The opening beat, and the opener that lands inside the scene.
 *
 * These exist because the reaction went missing once already: the scene opened
 * with a fake `*enters*` player action, which gave the model nothing to react
 * to, and the note did not say what kind of gift it was. Both are now asserted.
 */

import { describe, it, expect } from 'vitest';
import { beginScene, runTurn, openingDirective } from './sceneEngine.js';
import { buildMessages } from './promptBuilder.js';
import { purchase } from '../systems/economy.js';
import { newMemory, addDossierEntry } from './memory.js';
import { createMockClient } from '../tools/mockClient.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { newRelation } from '../systems/relationship.js';

const cards = getCast();
const lineup = buildLineup(cards);
const castIds = cards.map((c) => c.id);

function setup(memory = newMemory(castIds)) {
  return {
    cards,
    lineup,
    identity: { promptRole: 'an artist assistant' },
    player: { name: 'You', energy: 80, secrecy: 70, credits: 10 },
    lang: 'en',
    memory,
    relations: Object.fromEntries(castIds.map((id) => [id, newRelation(5)])),
    scene: {
      id: 's1',
      rosterIds: ['irene'],
      focusId: 'irene',
      week: 0,
      day: 1,
      block: 'evening',
      phase: 'prep',
      locationId: 'practice_room',
      locationLabel: 'X Practice Room',
    },
  };
}

const knowsCold = () => {
  const m = newMemory(castIds);
  m.dossier = addDossierEntry(m.dossier, 'irene', 'known_facts', 'hates cold hands');
  return m;
};

describe('the gift note carries its tier', () => {
  it('an ordinary gift reads as ordinary', () => {
    const out = purchase('rose', newMemory(castIds).dossier.irene, 10, 'Irene');
    expect(out.tier).toBe('generic');
    expect(out.sceneNote).toContain('ordinary, thoughtful gesture');
    expect(out.sceneNote).not.toContain('paying very close attention');
  });

  it('a knowledge gift says why it lands', () => {
    const out = purchase('mugwort_pack', knowsCold().dossier.irene, 10, 'Irene');
    expect(out.tier).toBe('knowledge');
    expect(out.sceneNote).toContain('paying very close attention');
    expect(out.sceneNote).toContain('never told anyone');
    expect(out.intimacyDelta).toBeGreaterThan(
      purchase('rose', newMemory(castIds).dossier.irene, 10, 'Irene').intimacyDelta,
    );
  });

  /**
   * The note has to say WHICH remembered line the gift was bought on. The fact
   * is in block 3, but the step from `mugwort_pack` to that one entry is an
   * inference, and at this model tier an unreliable inference produces exactly
   * the generic thank-you the knowledge economy exists to avoid.
   */
  it('quotes the fact the gift was bought on', () => {
    const out = purchase('mugwort_pack', knowsCold().dossier.irene, 10, 'Irene');
    expect(out.fact).toBe('hates cold hands');
    expect(out.sceneNote).toContain('"hates cold hands"');
  });

  it('finds the fact whichever way she let it slip', () => {
    const told = newMemory(castIds);
    told.dossier = addDossierEntry(
      told.dossier,
      'irene',
      'player_told_her',
      'her hands go cold in the practice room and she never says so',
    );
    const out = purchase('mugwort_pack', told.dossier.irene, 10, 'Irene');
    expect(out.fact).toContain('cold');
    expect(out.sceneNote).toContain(out.fact);
  });

  it('a generic gift names no fact, because it was bought on none', () => {
    const out = purchase('rose', knowsCold().dossier.irene, 10, 'Irene');
    expect(out.fact).toBeNull();
    expect(out.sceneNote).not.toContain('let this slip');
  });

  /**
   * A needle must be satisfied by one remembered line, not by the seam between
   * two unrelated ones - otherwise "cold" + "hands" in different entries would
   * unlock a gift nobody earned.
   */
  it('does not unlock on the seam between two unrelated facts', () => {
    const seam = newMemory(castIds);
    // Neither entry contains "does her own face". Concatenated, they do.
    seam.dossier = addDossierEntry(seam.dossier, 'irene', 'known_facts', 'she does her own');
    seam.dossier = addDossierEntry(seam.dossier, 'irene', 'known_facts', 'face is her best feature');
    expect(purchase('makeup_brush_set', seam.dossier.irene, 10, 'Irene')).toBeNull();
  });
});

describe('the opening turn is an instruction, not a fake player action', () => {
  it('never sends a pretend player line', () => {
    expect(openingDirective()).not.toContain('*enters*');
    expect(openingDirective()).toContain('opening beat');
  });

  /**
   * There is exactly one opening now.
   *
   * The gift-at-the-door variant is gone with the modal that produced it. It
   * was wrong for a reason worth keeping written down: choosing an opener
   * before the scene existed meant betting blind - in a group scene, picking
   * who to hand something to before seeing who was in the room - and it made
   * every gift the first thing that happened, so a scene could never be about
   * anything before it was about the gift.
   */
  it('has one shape, because nobody arrives holding anything any more', () => {
    expect(openingDirective()).toBe(openingDirective(true));
    expect(openingDirective()).not.toContain('just been handed');
  });
});

/**
 * Handing something over is a TURN. Section 11, and reported from play.
 *
 * The note goes in at the tail as a system note, which is section 8's
 * invariant 3 - new information mid-scene is appended, never edited into the
 * frozen header - and she answers it as the next beat.
 */
describe('an opener is a move inside the scene', () => {
  const client = createMockClient({ seed: 1, delay: 0 });

  const open = async (args) => {
    let session = beginScene(args);
    return runTurn(session, { text: openingDirective(), client, opening: true });
  };

  it('appends the note at the tail, after everything already said', async () => {
    const args = setup(knowsCold());
    const bought = purchase('mugwort_pack', args.memory.dossier.irene, 10, 'Irene');

    let session = await open(args);
    const before = buildMessages(session.frame).length;
    session = await runTurn(session, { note: bought.sceneNote, client });

    const contents = buildMessages(session.frame).map((m) => m.content);
    const giftAt = contents.findIndex((c) => c.includes('mugwort pack'));
    const openAt = contents.findIndex((c) => c.includes('opening beat'));

    expect(giftAt).toBeGreaterThan(openAt);
    expect(giftAt).toBeGreaterThanOrEqual(before - 1);
  });

  /**
   * Nothing above block 5 may move. The note is a new message, not an edit -
   * if it were folded into block 4 the whole prefix would churn and every
   * remaining turn of the scene would be a cache miss.
   */
  it('changes nothing above block 5', async () => {
    const args = setup(knowsCold());
    const bought = purchase('mugwort_pack', args.memory.dossier.irene, 10, 'Irene');

    const session = await open(args);
    const prefix = buildMessages(session.frame)[0].content;
    const after = await runTurn(session, { note: bought.sceneNote, client });

    expect(buildMessages(after.frame)[0].content).toBe(prefix);
  });

  /**
   * Handing something over without saying anything is a complete turn. The
   * player did a thing; they are not obliged to narrate it.
   */
  it('is a whole turn on its own, with no words after it', async () => {
    const args = setup(knowsCold());
    const bought = purchase('mugwort_pack', args.memory.dossier.irene, 10, 'Irene');

    const session = await runTurn(await open(args), { note: bought.sceneNote, client });
    const user = buildMessages(session.frame).filter((m) => m.role === 'user');

    expect(user.at(-1).content).toContain('mugwort pack');
    expect(user.at(-1).content).not.toContain('undefined');
  });

  /**
   * And it counts as choosing her in front of the room, which is what prices
   * the jealousy at scene exit. A gift is nameable by anybody watching.
   */
  it('marks the player as having singled her out', async () => {
    const args = setup(knowsCold());
    const bought = purchase('mugwort_pack', args.memory.dossier.irene, 10, 'Irene');

    const before = await open(args);
    expect(before.singledOut).toBeFalsy();

    const after = await runTurn(before, { note: bought.sceneNote, client });
    expect(after.singledOut).toBe(true);
  });
});

/**
 * The offline writer has to answer an opener too.
 *
 * Section 3 makes playing with no API key a supported mode, not a degraded
 * one, so a gift that produces a shrug offline would make the whole knowledge
 * economy invisible to anybody without a key. When the opener moved from the
 * door into the turn, the mock had to follow it - it recognised a gift only
 * from the opening directive, so mid-scene it fell through to the generic
 * stance table and every offline gift went unremarked.
 */
describe('she actually reacts', () => {
  const client = createMockClient({ seed: 5, delay: 0 });

  const hand = async (args, giftId, dossier) => {
    let s = beginScene(args);
    s = await runTurn(s, { text: openingDirective(), client, opening: true });
    const bought = purchase(giftId, dossier ?? args.memory.dossier.irene, 10, 'Irene');
    return runTurn(s, { note: bought.sceneNote, client });
  };

  it('answers a knowledge gift with something that is not a greeting', async () => {
    const args = setup(knowsCold());
    const session = await hand(args, 'mugwort_pack');

    const text = session.beats.at(-1).text;
    expect(text).not.toContain('You came');
    // She names the thing she was handed. A reaction that could have been
    // written before knowing what the gift was is the failure mode here.
    expect(text.toLowerCase()).toContain('mugwort pack');
  });

  it('answers an ordinary gift more modestly than a knowledge one', async () => {
    const a = await hand(setup(), 'rose');
    const b = await hand(setup(knowsCold()), 'mugwort_pack');

    expect(b.meters.fluster).toBeGreaterThan(a.meters.fluster);
  });

  /**
   * The offline writer is a lookup table and always will be, but it must not
   * read as one. Naming the object and moving register with how close she
   * already is are the two things it can do without inventing prose.
   */
  it('names the object it was handed', async () => {
    const s = await hand(setup(knowsCold()), 'mugwort_pack');
    expect(s.beats.at(-1).text.toLowerCase()).toContain('mugwort pack');
  });

  it('does not answer a colleague the way it answers someone at unspoken', async () => {
    const run = async (intimacy, admissibility) => {
      const args = setup(knowsCold());
      args.relations.irene = {
        ...args.relations.irene,
        intimacy,
        admissibility,
        peakIntimacy: intimacy,
        stage: intimacy > 70 ? 'unspoken' : 'colleague',
      };
      return hand(args, 'mugwort_pack');
    };

    const early = await run(25, 5);
    const late = await run(80, 50);

    // The two registers have deliberately disjoint pools, so this asserts which
    // one was drawn from rather than that the RNG moved.
    expect(late.beats.at(-1).text).not.toBe(early.beats.at(-1).text);
  });

  it('opens with a plain greeting, because the player is carrying nothing yet', async () => {
    let session = beginScene(setup());
    session = await runTurn(session, { text: openingDirective(), client });

    const text = session.beats.map((b) => b.text).join(' ');
    expect(/thank/i.test(text)).toBe(false);
    expect(session.beats).toHaveLength(1);
  });

  /**
   * A gift reaction is the one beat that must never be swallowed by a format
   * failure - the player paid credits for it, and a shrug reads as the game
   * being broken rather than as the model being small. The mock exempts the
   * opening beat from its failure rate for that reason, and an opener is now
   * a mid-scene turn, so the exemption had to follow it there.
   */
  it('never drops a gift reaction to a format failure', async () => {
    const noisy = createMockClient({ seed: 9, failureRate: 1, delay: 0 });
    const args = setup(knowsCold());
    const bought = purchase('mugwort_pack', args.memory.dossier.irene, 10, 'Irene');

    let session = beginScene(args);
    session = await runTurn(session, { text: openingDirective(), client: noisy, opening: true });
    session = await runTurn(session, { note: bought.sceneNote, client: noisy });

    expect(session.beats.at(-1).text.toLowerCase()).toContain('mugwort pack');
  });
});
