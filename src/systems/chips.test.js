import { describe, it, expect } from 'vitest';
import {
  availableStances,
  suggestedStances,
  generateChips,
  STANCES,
  COMMON_STANCES,
  RISK_STANCES,
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

  it('locks flirt and touch once jealousy turns sharp', () => {
    const { available, locked } = availableStances(rel({ intimacy: 80, jealousy: 60 }));
    expect(available).not.toContain('flirt');
    expect(locked.flirt).toBe('jealousy:sharp');
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
    expect(suggestedStances(rel({ jealousy: 30 }))).toContain('care');
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
    expect(generateChips(rel({ jealousy: 35 }))[0]).toBe('care');
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
    for (const stance of ['flirt', 'press', 'joke', 'deflect', 'retreat', 'apologize']) {
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

/**
 * The distribution, which is the thing that was actually broken.
 *
 * `generateChips` shuffled with `.sort(() => rng() - 0.5)` - not a shuffle, and
 * on a short array barely a permutation - so POSITION IN `STANCES` decided how
 * often a stance was offered. Element 0 came up in 41% of sets and element 9 in
 * 23%, and a player who had only ever seen the top of the array reported it as
 * the game having three verbs.
 *
 * These are frequency assertions rather than example assertions on purpose: no
 * single-call test can see a biased shuffle, which is exactly why it survived
 * a whole campaign.
 */
describe('the chips are actually shuffled', () => {
  /** A calm mid-game relation, so `suggestedStances` contributes nothing. */
  const calm = rel({ intimacy: 60, admissibility: 45, strain: 0, jealousy: 0, stage: 'nameless' });

  const sample = (r = calm, sets = 1200) => {
    const count = {};
    const bars = [];
    for (let seed = 1; seed <= sets / 8; seed += 1) {
      for (let turn = 0; turn < 8; turn += 1) {
        const chips = generateChips(r, { seed, turn });
        bars.push(chips);
        for (const s of chips) count[s] = (count[s] ?? 0) + 1;
      }
    }
    return { count, bars, sets: bars.length };
  };

  it('does not let array position decide how often a stance is offered', () => {
    const { count, sets } = sample();
    const others = STANCES.filter((s) => !COMMON_STANCES.includes(s));

    // Within a tier every stance should appear at a comparable rate. The old
    // implementation spread the same set nearly 2:1 from first to last.
    const rates = others.map((s) => (count[s] ?? 0) / sets);
    const spread = Math.max(...rates) / Math.min(...rates);
    expect(spread).toBeLessThan(1.5);
  });

  it('gives the four common tones the bulk of the bar', () => {
    const { count, sets } = sample();
    for (const s of COMMON_STANCES) {
      expect(count[s] / sets, s).toBeGreaterThan(0.3);
    }
  });

  /**
   * ...and never the WHOLE bar. `touch`, `invite` and `confide` are the only
   * stances that move admissibility, so a bar filled entirely with warm
   * everyday verbs is a bar on which the second axis cannot move - the
   * `markRisk` failure arriving by a different door.
   */
  it('always leaves a slot for something outside the common four', () => {
    const { bars } = sample();
    const allCommon = bars.filter((b) => b.every((s) => COMMON_STANCES.includes(s)));
    expect(allCommon).toEqual([]);
  });

  it('keeps a risk stance reachable often enough to matter', () => {
    const { bars, sets } = sample();
    const withRisk = bars.filter((b) => b.some((s) => RISK_STANCES.includes(s))).length;

    // Roughly every other bar. Over an eight-turn scene that is a >99% chance
    // of being offered at least one bet, which is what the second axis needs.
    expect(withRisk / sets).toBeGreaterThan(0.3);
  });

  /** Still stable within a turn: a re-render must not deal a new hand. */
  it('is deterministic for the same seed and turn', () => {
    expect(generateChips(calm, { seed: 7, turn: 3 })).toEqual(
      generateChips(calm, { seed: 7, turn: 3 }),
    );
  });

  it('gives a different hand on the next turn', () => {
    const a = generateChips(calm, { seed: 7, turn: 3 });
    const b = generateChips(calm, { seed: 7, turn: 4 });
    expect(a).not.toEqual(b);
  });
});

/**
 * The vocabulary change itself. Reported from a `zh` session on a phone:
 * "tease, apologize, reassure don't give the option we want in most cases."
 */
describe('the new vocabulary', () => {
  it('has no barbed default, and a warm one instead', () => {
    expect(STANCES).not.toContain('tease');
    expect(STANCES).not.toContain('reassure');
    expect(STANCES).toContain('flirt');
    expect(STANCES).toContain('care');
    expect(STANCES).toContain('casual');
  });

  /**
   * `care` is the recovery move, and it has to survive the band it recovers
   * from. `apologize` presumes fault; most of the time nobody is at fault and
   * she just needs somebody to notice.
   */
  it('leaves care available in rift, where apologize used to be the only move', () => {
    const hurt = rel({ strain: 70 });
    const { available } = availableStances(hurt);

    expect(available).toContain('care');
    expect(available).toContain('apologize');
    expect(available).not.toContain('press');
  });

  it('offers care as the answer while she is piqued', () => {
    expect(suggestedStances(rel({ jealousy: 30 }))).toContain('care');
  });

  /** Being playful about it when she is sharp is as wrong as teasing was. */
  it('locks flirt once jealousy turns sharp', () => {
    const { available, locked } = availableStances(rel({ jealousy: 60 }));
    expect(available).not.toContain('flirt');
    expect(locked.flirt).toBe('jealousy:sharp');
  });

  /** Flirting is loud and deniable, so it still cannot move admissibility. */
  it('does not make flirt a bet', () => {
    expect(isRiskStance('flirt', 100)).toBe(false);
  });
});
