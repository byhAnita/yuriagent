import { describe, it, expect } from 'vitest';
import {
  availableStances,
  suggestedStances,
  generateChips,
  STANCES,
  isRiskStance,
} from './chips.js';
import { RISK_EXPOSURE_THRESHOLD } from '../config/constants.js';
import { newRelation } from './relationship.js';

const rel = (patch) => ({ ...newRelation(50), intimacy: 50, ...patch });

describe('availableStances', () => {
  it('offers the full palette to a healthy close relationship', () => {
    const { available } = availableStances(rel({ intimacy: 60 }));
    expect(available).toEqual(STANCES);
  });

  it('gates touch behind intimacy and says why', () => {
    const { available, locked } = availableStances(rel({ intimacy: 40 }));
    expect(available).not.toContain('touch');
    expect(locked.touch).toBe('intimacy<50');
  });

  it('withdraws the aggressive stances in rift', () => {
    const { available, locked } = availableStances(rel({ intimacy: 80, strain: 70 }));
    for (const s of ['press', 'touch', 'confide']) {
      expect(available).not.toContain(s);
      expect(locked[s]).toBe('rift');
    }
  });

  it('locks tease and touch once jealousy turns sharp', () => {
    const { available, locked } = availableStances(rel({ intimacy: 80, jealousy: 60 }));
    expect(available).not.toContain('tease');
    expect(locked.tease).toBe('jealousy:sharp');
  });

  it('narrows rather than blocks at low energy', () => {
    const { available } = availableStances(rel({ intimacy: 80 }), { energy: 10 });
    expect(available.length).toBeGreaterThan(0);
    expect(available).toContain('deflect');
    expect(available).not.toContain('press');
  });

  it('never leaves the player with no move at all', () => {
    const worst = rel({ intimacy: 0, strain: 95, jealousy: 95 });
    const { available } = availableStances(worst, { energy: 0 });
    expect(available.length).toBeGreaterThan(0);
  });
});

describe('suggestedStances', () => {
  it('offers the conversion move while she is piqued', () => {
    expect(suggestedStances(rel({ jealousy: 30 }))).toContain('reassure');
  });

  it('offers repair in rift and retreat when reckless', () => {
    expect(suggestedStances(rel({ strain: 70 }))).toContain('apologize');
    expect(suggestedStances(rel({ stage: 'reckless' }))).toContain('retreat');
  });

  it('offers a push when stalled at confidante', () => {
    expect(suggestedStances(rel({ stage: 'confidante' }))).toContain('invite');
  });
});

describe('generateChips', () => {
  it('always returns three', () => {
    expect(generateChips(rel())).toHaveLength(3);
    expect(generateChips(rel({ strain: 95, jealousy: 95 }), { energy: 0 })).toHaveLength(3);
  });

  it('does not reshuffle on a re-render mid-decision', () => {
    const r = rel({ intimacy: 60 });
    expect(generateChips(r, { seed: 7, turn: 2 })).toEqual(generateChips(r, { seed: 7, turn: 2 }));
  });

  it('changes between turns', () => {
    const r = rel({ intimacy: 60 });
    const turns = [0, 1, 2, 3].map((t) => generateChips(r, { seed: 7, turn: t }).join());
    expect(new Set(turns).size).toBeGreaterThan(1);
  });

  it('leads with the move the situation is asking for', () => {
    expect(generateChips(rel({ jealousy: 35 }))[0]).toBe('reassure');
  });

  it('never offers a locked stance', () => {
    const r = rel({ intimacy: 80, strain: 70, jealousy: 60 });
    const { locked } = availableStances(r);
    for (const chip of generateChips(r)) expect(locked[chip]).toBeUndefined();
  });
});

/**
 * Which moves are a bet. Section 5 pays admissibility only for "surviving
 * deliberate risk at high Exposure", and until `sceneEngine` started calling
 * this, nothing in the game ever set the flag.
 */
describe('isRiskStance', () => {
  it('counts the overt moves where somebody could see', () => {
    for (const stance of ['touch', 'invite', 'confide']) {
      expect(isRiskStance(stance, 80)).toBe(true);
    }
  });

  it('does not count the loud but deniable ones', () => {
    // Deniable is exactly what fails to move admissibility: a witness has to
    // be able to describe what they saw.
    for (const stance of ['tease', 'press', 'joke', 'deflect', 'retreat', 'apologize']) {
      expect(isRiskStance(stance, 100)).toBe(false);
    }
  });

  it('is not a risk where nobody is watching', () => {
    expect(isRiskStance('touch', RISK_EXPOSURE_THRESHOLD - 1)).toBe(false);
    expect(isRiskStance('touch', RISK_EXPOSURE_THRESHOLD)).toBe(true);
  });

  it('survives a missing stance', () => {
    expect(isRiskStance(undefined, 90)).toBe(false);
    expect(isRiskStance(null, 90)).toBe(false);
  });
});
