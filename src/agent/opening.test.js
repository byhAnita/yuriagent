/**
 * The opening beat, and the gift that may precede it.
 *
 * These exist because the reaction went missing once already: the scene opened
 * with a fake `*enters*` player action, which gave the model nothing to react
 * to, and the note did not say what kind of gift it was. Both are now asserted.
 */

import { describe, it, expect } from 'vitest';
import { beginScene, runTurn, openWithGift, openingDirective } from './sceneEngine.js';
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
    const out = purchase('hand_warmer', knowsCold().dossier.irene, 10, 'Irene');
    expect(out.tier).toBe('knowledge');
    expect(out.sceneNote).toContain('paying very close attention');
    expect(out.sceneNote).toContain('never told anyone');
    expect(out.intimacyDelta).toBeGreaterThan(
      purchase('rose', newMemory(castIds).dossier.irene, 10, 'Irene').intimacyDelta,
    );
  });
});

describe('the opening turn is an instruction, not a fake player action', () => {
  it('never sends a pretend player line', () => {
    expect(openingDirective(false)).not.toContain('*enters*');
    expect(openingDirective(false)).toContain('opening beat');
  });

  it('tells the model to answer the gift first when there is one', () => {
    expect(openingDirective(true)).toContain('just been handed');
  });

  it('puts the gift note in the messages, ahead of the opening instruction', async () => {
    const args = setup(knowsCold());
    const bought = purchase('hand_warmer', args.memory.dossier.irene, 10, 'Irene');

    let session = openWithGift(beginScene(args), bought.sceneNote);
    const client = createMockClient({ seed: 1, delay: 0 });
    session = await runTurn(session, { text: openingDirective(true), client });

    const contents = buildMessages(session.frame).map((m) => m.content);
    const giftAt = contents.findIndex((c) => c.includes('hand warmer'));
    const openAt = contents.findIndex((c) => c.includes('opening beat'));

    expect(giftAt).toBeGreaterThan(-1);
    expect(openAt).toBeGreaterThan(giftAt);
  });
});

describe('she actually reacts', () => {
  const client = createMockClient({ seed: 5, delay: 0 });

  it('answers a knowledge gift with something that is not a greeting', async () => {
    const args = setup(knowsCold());
    const bought = purchase('hand_warmer', args.memory.dossier.irene, 10, 'Irene');

    let session = openWithGift(beginScene(args), bought.sceneNote);
    session = await runTurn(session, { text: openingDirective(true), client });

    const text = session.beats.map((b) => b.text).join(' ');
    expect(text).not.toContain('You came');
    expect(/thank|attention|never said|how did/i.test(text)).toBe(true);
    expect(session.meters.fluster).toBeGreaterThan(10);
  });

  it('answers an ordinary gift more modestly than a knowledge one', async () => {
    const plainArgs = setup();
    const plain = purchase('rose', plainArgs.memory.dossier.irene, 10, 'Irene');
    let a = openWithGift(beginScene(plainArgs), plain.sceneNote);
    a = await runTurn(a, { text: openingDirective(true), client });

    const knowArgs = setup(knowsCold());
    const known = purchase('hand_warmer', knowArgs.memory.dossier.irene, 10, 'Irene');
    let b = openWithGift(beginScene(knowArgs), known.sceneNote);
    b = await runTurn(b, { text: openingDirective(true), client });

    expect(a.meters.fluster).toBeGreaterThan(0);
    expect(b.meters.fluster).toBeGreaterThan(a.meters.fluster);
  });

  it('opens with a plain greeting when the player brought nothing', async () => {
    let session = beginScene(setup());
    session = await runTurn(session, { text: openingDirective(false), client });

    const text = session.beats.map((b) => b.text).join(' ');
    expect(/thank/i.test(text)).toBe(false);
    expect(session.beats).toHaveLength(1);
  });

  it('never drops the opening beat to a format failure', async () => {
    const noisy = createMockClient({ seed: 9, failureRate: 1, delay: 0 });
    const args = setup(knowsCold());
    const bought = purchase('hand_warmer', args.memory.dossier.irene, 10, 'Irene');

    let session = openWithGift(beginScene(args), bought.sceneNote);
    session = await runTurn(session, { text: openingDirective(true), client: noisy });

    // even with the failure rate pinned at 1, the opening still parses
    expect(session.meters.fluster).toBeGreaterThan(0);
  });
});
