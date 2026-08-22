import { describe, it, expect } from 'vitest';
import { witnessedExposure, sceneExposure } from './exposure.js';
import { propagate, WEIGHT_WITNESSED, WEIGHT_RUMOR } from './rumor.js';
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
    // Section 6: a witness has to be able to DESCRIBE what they saw. `tease`
    // and `press` are loud and deniable, and deniable cannot move admissibility.
    expect(isRiskStance('tease', witnessedExposure(20, 3))).toBe(false);
    expect(isRiskStance('press', witnessedExposure(20, 3))).toBe(false);
  });
});

describe('the others in the room take the jealousy', () => {
  const scene = {
    exposure: 25,
    phase: 'prep',
    locationId: 'practice_room',
    presentIds: ['irene', 'nana', 'jisoo'],
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
