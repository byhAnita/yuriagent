import { describe, it, expect } from 'vitest';
import { witnessedExposure, sceneExposure } from './exposure.js';
import { propagate, WEIGHT_WITNESSED, WEIGHT_RUMOR, WEIGHT_PRESENT } from './rumor.js';
import { newRelation } from './relationship.js';
import { jealousyGain } from './jealousy.js';
import { isRiskStance } from './chips.js';
import { RISK_EXPOSURE_THRESHOLD, WITNESS_EXPOSURE_FLOOR } from '../config/constants.js';

const cast = [
  { id: 'irene', name: 'Irene' },
  { id: 'nana', name: 'Nana' },
  { id: 'jisoo', name: 'Jisoo' },
];

const relations = Object.fromEntries(
  cast.map((c) => [c.id, { ...newRelation(5), intimacy: 60, stage: 'nameless' }]),
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
   * a PRIVATE act alone and a PUBLIC one with the others there. The second axis
   * only moves on risks, so this is the difference between a gesture that
   * counts and one that does not.
   */
  it('turns a stance that would not count into one that does', () => {
    const alone = sceneExposure({ locationId: 'practice_room', block: 'evening', phase: 'prep' });
    expect(alone).toBeLessThan(RISK_EXPOSURE_THRESHOLD);
    expect(isRiskStance('touch', alone)).toBe(false);
    expect(isRiskStance('touch', witnessedExposure(alone, 2))).toBe(true);
  });

  it('still does not make a deniable stance count', () => {
    // Section 6: a witness has to be able to DESCRIBE what they saw. `flirt`
    // and `press` are loud and deniable, and deniable cannot move admissibility.
    expect(isRiskStance('flirt', witnessedExposure(20, 3))).toBe(false);
    expect(isRiskStance('press', witnessedExposure(20, 3))).toBe(false);
  });
});

describe('the others in the room take the jealousy', () => {
  const scene = {
    exposure: 25,
    phase: 'prep',
    locationId: 'practice_room',
    presentIds: ['irene', 'nana', 'jisoo'],
    /**
     * The player reached for her in front of the other two.
     *
     * Standing in a room together is no longer an event on its own - something
     * has to have happened that the room could name. The block at the bottom of
     * this file covers the other half.
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

  it('gives every other member in the room a witnessed rumor, with no roll', () => {
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
    expect(out.rumors[0].text).not.toContain('guard');
  });

  it('hits harder than hearsay would have', () => {
    const rel = relations.nana;
    expect(out.jealousyDeltas.nana).toBe(jealousyGain(WEIGHT_WITNESSED, rel));
    expect(out.jealousyDeltas.nana).toBeGreaterThan(jealousyGain(WEIGHT_RUMOR, rel));
  });

  it('scales with how invested the watcher already is', () => {
    const shallow = { ...newRelation(5), intimacy: 10, stage: 'colleague' };
    const deep = { ...newRelation(5), intimacy: 90, stage: 'unspoken' };

    expect(jealousyGain(WEIGHT_WITNESSED, deep)).toBeGreaterThan(
      jealousyGain(WEIGHT_WITNESSED, shallow),
    );
  });
});

/**
 * Being in the room together is not, by itself, an event.
 *
 * Reported from play: a practice-room scene with all five of them, in which the
 * player did nothing but talk, handed the other four a full witnessed jealousy
 * hit each - the heaviest event in the game, for a conversation about the
 * choreography. Every group scene therefore ended with the cast resenting each
 * other, which is bad fiction and the opposite of what a group scene is for.
 *
 * The rule that replaces it is the one section 6 already uses for what a
 * witness can DESCRIBE: an overt move toward one of them - a risk stance, a
 * gift, a gesture. The turn loop sets `singledOut`; this asserts both sides.
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
   * "Should not raise jealousy, or only raise a little" - which is a third
   * tier, not zero. Watching the player spend the evening with Irene is not
   * nothing; it is simply not the same as watching the player reach for her.
   */
  it('costs a little when the player only talked', () => {
    const out = call(room);
    expect(out.jealousyDeltas.nana).toBe(jealousyGain(WEIGHT_PRESENT, relations.nana));
    expect(out.jealousyDeltas.nana).toBeLessThan(jealousyGain(WEIGHT_RUMOR, relations.nana));
  });

  /**
   * ...and writes nothing down. `heard_about` is for things she found out, and
   * it is a four-entry FIFO - a note every group scene saying she was in the
   * room would flush anything that actually mattered out of it.
   */
  it('writes no rumor for having been in the room', () => {
    expect(call(room).rumors).toHaveLength(0);
  });

  it('gives everybody watching the full hit the moment the player picks one', () => {
    const out = call({ ...room, singledOut: true });
    expect(out.rumors).toHaveLength(2);
    expect(out.jealousyDeltas.nana).toBe(jealousyGain(WEIGHT_WITNESSED, relations.nana));
  });

  it('makes the overt move several times the price of the conversation', () => {
    const quiet = call(room).jealousyDeltas.nana;
    const overt = call({ ...room, singledOut: true }).jealousyDeltas.nana;
    expect(overt).toBeGreaterThan(quiet * 4);
  });

  /**
   * The point of the rule is not to make group scenes safe. A gesture in front
   * of the others is still the loudest single act in the game - it now simply
   * requires an act, and the difference between the two calls above is the
   * whole of what a player is deciding when they reach for her in company.
   */
  it('keeps the group scene the most expensive place to make a move', () => {
    const alone = call({ ...room, presentIds: ['irene'], singledOut: true });
    const watched = call({ ...room, singledOut: true });
    expect(Object.keys(alone.jealousyDeltas)).toHaveLength(0);
    expect(Object.keys(watched.jealousyDeltas)).toHaveLength(2);
  });

  /**
   * Hearsay is untouched. Being SEEN at the cafe together is news whatever was
   * said there, which is what makes exposure the outward-facing axis - the new
   * rule is about the room, not about the world.
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
  it('produces no witnessed rumor when nobody else is there', () => {
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
    expect(Object.keys(out.jealousyDeltas)).toHaveLength(0);
  });
});
