import { describe, it, expect } from 'vitest';
import { witnessedExposure, sceneExposure } from './exposure.js';
import { propagate } from './rumor.js';
import { newRelation } from './relationship.js';
import { applyDeltas } from './values.js';
import { RISK_EXPOSURE_THRESHOLD, WITNESS_EXPOSURE_FLOOR } from '../config/constants.js';

const cast = [
  { id: 'irene', name: 'Irene' },
  { id: 'nana', name: 'Nana' },
  { id: 'jisoo', name: 'Jisoo' },
];

const relations = Object.fromEntries(
  cast.map((c) => [c.id, { ...newRelation(5), affection: 60 }]),
);

/**
 * Turning to one member in front of the others is itself the gesture. Nobody
 * has to touch anyone for four people to have watched the player choose.
 */
describe('witnessedExposure', () => {
  it('changes nothing in an empty room', () => {
    expect(witnessedExposure(25, 0)).toBe(25);
    expect(witnessedExposure(25)).toBe(25);
  });

  it('lifts a private room to witnessed tier when somebody else is in it', () => {
    expect(witnessedExposure(25, 1)).toBe(WITNESS_EXPOSURE_FLOOR);
  });

  it('never lowers a room that is already louder than the floor', () => {
    expect(witnessedExposure(95, 2)).toBe(95);
  });

  /**
   * The consequence that matters: reaching for her hand in a practice room is
   * a PRIVATE act alone and a PUBLIC one with the others there.
   */
  it('turns a room where nothing could count into one where it can', () => {
    const alone = sceneExposure({ locationId: 'practice_room', block: 'evening', phase: 'prep' });
    expect(alone).toBeLessThan(RISK_EXPOSURE_THRESHOLD);
    expect(witnessedExposure(alone, 2)).toBeGreaterThanOrEqual(RISK_EXPOSURE_THRESHOLD);
  });

  /**
   * And the consequence, at the only place it has one now.
   *
   * This used to be asserted against `isRiskStance` - whether `touch` at this
   * exposure counted as a risk and `flirt` did not. v2 has no stances, so there
   * is no list of moves that count: the model writes what happened and proposes
   * what it was worth, and the world's one veto is Part I.9 - admissibility may
   * not RISE where nobody could see. Company is what changes that, so this is
   * the same claim in the mechanism that replaced the old one.
   */
  it('is what lets the second axis move at all', () => {
    const alone = sceneExposure({ locationId: 'practice_room', block: 'evening', phase: 'prep' });
    const args = {
      relations: { irene: { affection: 60, admissibility: 20 } },
      present: ['irene'],
      deltas: { irene_adm: 2 },
    };

    expect(applyDeltas({ ...args, exposure: alone }).relations.irene.admissibility).toBe(20);
    expect(
      applyDeltas({ ...args, exposure: witnessedExposure(alone, 2) }).relations.irene.admissibility,
    ).toBe(22);
  });
});

describe('the others in the room find out', () => {
  const scene = {
    exposure: 25,
    phase: 'prep',
    locationId: 'practice_room',
    presentIds: ['irene', 'nana', 'jisoo'],
    /**
     * The player handed Irene something in front of the other two.
     *
     * Standing in a room together is not an event on its own - something has to
     * have happened that the room could name. The block at the bottom of this
     * file covers the other half.
     */
    singledOut: true,
  };
  const rng = () => 0.99; // no hearsay roll ever succeeds

  const out = propagate({
    scene,
    subject: { id: 'irene', name: 'Irene' },
    cast,
    relations,
    rng,
  });

  it('gives every other member in the room a witnessed entry, with no roll', () => {
    expect(out.rumors).toHaveLength(2);
    for (const r of out.rumors) {
      expect(r.witnessed).toBe(true);
      expect(r.exposure).toBe(WITNESS_EXPOSURE_FLOOR);
    }
  });

  it('never tells the member the scene was with', () => {
    expect(out.rumors.map((r) => r.memberId)).not.toContain('irene');
  });

  it('phrases it as something she saw, not as a transcript', () => {
    expect(out.rumors[0].text).toContain('you saw the player with Irene');
    expect(out.rumors[0].text).not.toContain('affection');
  });

  /**
   * WHAT IT COSTS HER IS NOT DECIDED HERE ANY MORE (Part I.8).
   *
   * Three of the assertions this block used to carry were about a jealousy
   * number: that witnessing hit harder than hearsay, and that it scaled with how
   * invested the watcher already was. Both were true and both were a second
   * damage axis only code could read - so the rumor now lands in her dossier and
   * waits, and the model answers the question the next time she is in the room.
   *
   * What survives is the only part `propagate` is entitled to decide: WHETHER she
   * found out, and in which of the three ways.
   */
  it('moves nothing at all by itself', () => {
    expect(out).not.toHaveProperty('jealousyDeltas');
    expect(Object.keys(out).sort()).toEqual(['noticed', 'rumors']);
  });
});

/**
 * Being in the room together is not, by itself, an event.
 *
 * Reported from play: a practice-room scene with all five of them, in which the
 * player did nothing but talk, handed the other four a full witnessed hit each -
 * the heaviest event in the game, for a conversation about the choreography.
 * Every group scene therefore ended with the cast resenting each other, which is
 * bad fiction and the opposite of what a group scene is for.
 *
 * The rule that replaces it is what a witness can DESCRIBE: an overt move toward
 * one of them. The round loop PASSES `singledOut`; this asserts both sides.
 */
describe('a room full of people is not itself a gesture', () => {
  const room = {
    exposure: 25,
    phase: 'prep',
    locationId: 'practice_room',
    presentIds: ['irene', 'nana', 'jisoo'],
  };
  const call = (scene) =>
    propagate({
      scene,
      subject: { id: 'irene', name: 'Irene' },
      cast,
      relations,
      rng: () => 0.99,
    });

  /**
   * The player is TOLD she was standing there, and her dossier is not written
   * to. `heard_about` is for things she found out, and it is a four-entry FIFO -
   * a note every group scene saying she was in the room would flush anything
   * that mattered out of it.
   */
  it('tells the player who was watching, and writes nothing down', () => {
    const out = call(room);
    expect(out.noticed.map((n) => n.memberId).sort()).toEqual(['jisoo', 'nana']);
    expect(out.rumors).toHaveLength(0);
  });

  it('writes everybody watching an entry the moment the player picks one', () => {
    const out = call({ ...room, singledOut: true });
    expect(out.rumors).toHaveLength(2);
    expect(out.rumors.every((r) => r.kind === 'witnessed')).toBe(true);
    // ...and stops calling them mere bystanders in the same breath.
    expect(out.noticed).toHaveLength(0);
  });

  /**
   * The point of the rule is not to make group scenes safe. A gesture in front
   * of the others is still the loudest act available to the player - it now
   * simply requires an act, and the difference between these two calls is the
   * whole of what a player is deciding when they reach for her in company.
   */
  it('keeps a gesture made in private out of everybody else\'s memory', () => {
    const alone = call({ ...room, presentIds: ['irene'], singledOut: true });
    const watched = call({ ...room, singledOut: true });
    expect(alone.rumors).toHaveLength(0);
    expect(watched.rumors).toHaveLength(2);
  });

  /**
   * Hearsay is untouched. Being SEEN at the cafe together is news whatever was
   * said there, which is what makes exposure the outward-facing axis - the rule
   * above is about the room, not about the world.
   */
  it('does not gate the outward rumor on it', () => {
    const out = propagate({
      scene: { exposure: 90, phase: 'comeback', locationId: 'cafe', presentIds: ['irene'] },
      subject: { id: 'irene', name: 'Irene' },
      cast,
      relations,
      rng: () => 0.01,
    });
    expect(out.rumors.length).toBeGreaterThan(0);
    expect(out.rumors.every((r) => !r.witnessed)).toBe(true);
  });
});

describe('an empty room is still private', () => {
  it('produces no entry when nobody else is there', () => {
    const out = propagate({
      scene: {
        exposure: 20,
        phase: 'prep',
        locationId: 'practice_room',
        presentIds: ['irene'],
      },
      subject: { id: 'irene', name: 'Irene' },
      cast,
      relations,
      rng: () => 0.99,
    });

    expect(out.rumors).toHaveLength(0);
    expect(out.noticed).toHaveLength(0);
  });
});
