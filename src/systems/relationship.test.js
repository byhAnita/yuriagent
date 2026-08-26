import { describe, it, expect } from 'vitest';
import {
  newRelation,
  resolveStage,
  strainBand,
  applySceneOutcome,
  applyRepair,
  resolveBadEnd,
  resolveEnding,
  isBalanceEnding,
  isAftermath,
} from './relationship.js';

describe('resolveStage', () => {
  it('walks the affection ladder when admissibility keeps pace', () => {
    expect(resolveStage(5, 0)).toBe('stranger');
    expect(resolveStage(25, 5)).toBe('colleague');
    expect(resolveStage(45, 20)).toBe('good_friends');
    expect(resolveStage(65, 30)).toBe('nameless');
    expect(resolveStage(80, 50)).toBe('unspoken');
    expect(resolveStage(95, 70)).toBe('ours');
    expect(resolveStage(95, 90)).toBe('out');
  });

  it('flags reckless when admissibility outruns affection by more than the gap', () => {
    expect(resolveStage(40, 61)).toBe('reckless');
    expect(resolveStage(40, 60)).not.toBe('reckless');
  });

  it('flags confidante when affection outran admissibility and stalled', () => {
    // nameless wants admissibility >= 20; 9 is more than PLATEAU_SLACK below it
    expect(resolveStage(65, 9)).toBe('confidante');
    expect(resolveStage(65, 10)).toBe('nameless');
  });

  it('never returns out below the admissibility threshold', () => {
    expect(resolveStage(100, 85)).toBe('ours');
    expect(resolveStage(100, 86)).toBe('out');
  });
});

describe('strainBand', () => {
  it('maps the four bands at their boundaries', () => {
    expect(strainBand(0)).toBe('stable');
    expect(strainBand(39)).toBe('stable');
    expect(strainBand(40)).toBe('tense');
    expect(strainBand(59)).toBe('tense');
    expect(strainBand(60)).toBe('rift');
    expect(strainBand(89)).toBe('rift');
    expect(strainBand(90)).toBe('critical');
  });
});

describe('applySceneOutcome', () => {
  it('tracks high-water marks monotonically', () => {
    let rel = newRelation(5);
    rel = applySceneOutcome(rel, { affection: 60, admissibility: 40 });
    expect(rel.peakAffection).toBe(65);
    rel = applySceneOutcome(rel, { affection: -50, admissibility: -30 });
    expect(rel.affection).toBe(15);
    expect(rel.peakAffection).toBe(65);
    expect(rel.peakAdmissibility).toBe(40);
  });

  it('decays strain on a good scene but not on a damaging one', () => {
    let rel = { ...newRelation(50), strain: 20 };
    rel = applySceneOutcome(rel, { good: true });
    expect(rel.strain).toBe(17);
    rel = applySceneOutcome(rel, { good: true, strain: 10 });
    expect(rel.strain).toBe(27);
  });

  it('clamps both axes to 0-100', () => {
    let rel = newRelation(5);
    rel = applySceneOutcome(rel, { affection: 999, admissibility: 999 });
    expect(rel.affection).toBe(100);
    expect(rel.admissibility).toBe(100);
    rel = applySceneOutcome(rel, { affection: -999, admissibility: -999 });
    expect(rel.affection).toBe(0);
    expect(rel.admissibility).toBe(0);
  });

  it('locks a bad end only after two consecutive critical scenes', () => {
    let rel = { ...newRelation(75), peakAffection: 75, strain: 85 };
    rel = applySceneOutcome(rel, { strain: 10 }); // 95, first critical
    expect(rel.endingLocked).toBeNull();
    rel = applySceneOutcome(rel, { strain: 0 }); // still critical, second
    expect(rel.endingLocked).toBe('nameless_end');
  });

  it('resets the critical counter when strain drops out of the band', () => {
    let rel = { ...newRelation(75), peakAffection: 75, strain: 95 };
    rel = applySceneOutcome(rel, {});
    expect(rel.criticalScenes).toBe(1);
    rel = applySceneOutcome(rel, { strain: -40 });
    expect(rel.criticalScenes).toBe(0);
    expect(rel.endingLocked).toBeNull();
  });
});

/**
 * The plateau. Section 5 calls `confidante` "affection outran admissibility and
 * stalled", and for a long time nothing stalled - a campaign ended with every
 * member at affection 100, admissibility near zero and `confidante_end` for all
 * five, with no good ending reachable by any policy. The stage was computed
 * correctly and the outcome was applied correctly; only the join was missing.
 */
describe('the plateau stalls', () => {
  const onPlateau = () => {
    const rel = applySceneOutcome({ ...newRelation(60), admissibility: 2 }, {});
    expect(rel.stage).toBe('confidante');
    return rel;
  };

  it('refuses further closeness while she is on it', () => {
    const rel = onPlateau();
    const after = applySceneOutcome(rel, { affection: 5, good: true });
    expect(after.affection).toBe(rel.affection);
  });

  it('but never takes any away - a stall is not a punishment', () => {
    const rel = onPlateau();
    expect(applySceneOutcome(rel, { affection: -8 }).affection).toBe(rel.affection - 8);
  });

  it('still lets the way out move', () => {
    const rel = onPlateau();
    const after = applySceneOutcome(rel, { admissibility: 9 });
    expect(after.admissibility).toBe(rel.admissibility + 9);
  });

  it('and releases as soon as admissibility catches up', () => {
    let rel = onPlateau();
    rel = applySceneOutcome(rel, { admissibility: 20 });
    expect(rel.stage).not.toBe('confidante');
    expect(applySceneOutcome(rel, { affection: 4 }).affection).toBe(rel.affection + 4);
  });

  it('lets the scene that walks her onto it count', () => {
    // Below the plateau, a gain that lands her on it is still paid. A wall you
    // can watch yourself hit is a rule; one that catches you mid-step is a bug.
    const below = applySceneOutcome({ ...newRelation(48), admissibility: 2 }, {});
    expect(below.stage).toBe('good_friends');
    const after = applySceneOutcome(below, { affection: 6 });
    expect(after.affection).toBe(54);
    expect(after.stage).toBe('confidante');
  });

  it('strain still decays on the plateau, so a stall is not a death spiral', () => {
    const rel = { ...onPlateau(), strain: 30 };
    expect(applySceneOutcome(rel, { affection: 3, good: true }).strain).toBe(27);
  });
});

describe('applyRepair', () => {
  it('only works inside the rift band', () => {
    expect(applyRepair({ ...newRelation(50), strain: 70 }).strain).toBe(40);
    expect(applyRepair({ ...newRelation(50), strain: 50 }).strain).toBe(50);
    expect(applyRepair({ ...newRelation(50), strain: 95 }).strain).toBe(95);
  });
});

describe('resolveBadEnd', () => {
  it('returns null when there was never enough there to break', () => {
    expect(resolveBadEnd({ ...newRelation(30), peakAffection: 39 })).toBeNull();
  });

  it('prefers severance when the collapse happened in the reckless zone', () => {
    const rel = { ...newRelation(50), peakAffection: 80, peakAdmissibility: 90, stage: 'reckless' };
    expect(resolveBadEnd(rel)).toBe('severance_end');
  });

  it('picks exposure when admissibility had gone public', () => {
    const rel = { ...newRelation(50), peakAffection: 80, peakAdmissibility: 60, stage: 'unspoken' };
    expect(resolveBadEnd(rel)).toBe('exposure_end');
  });

  it('picks nameless when it was deep and never nameable', () => {
    const rel = {
      ...newRelation(50),
      peakAffection: 75,
      peakAdmissibility: 20,
      admissibility: 20,
      stage: 'confidante',
    };
    expect(resolveBadEnd(rel)).toBe('nameless_end');
  });
});

describe('resolveEnding', () => {
  it('drifts when the route never got going', () => {
    expect(resolveEnding(newRelation(5))).toBe('drift_end');
  });

  it('honours a locked ending over the current position', () => {
    const rel = { ...newRelation(95), stage: 'out', endingLocked: 'exposure_end' };
    expect(resolveEnding(rel)).toBe('exposure_end');
  });
});

describe('isAftermath', () => {
  it('distinguishes a fresh low/low from a collapsed one', () => {
    expect(isAftermath(newRelation(5))).toBe(false);
    expect(isAftermath({ ...newRelation(5), peakAffection: 75 })).toBe(true);
  });
});

describe('isBalanceEnding', () => {
  const good = (jealousy) => ({
    ...newRelation(80),
    affection: 80,
    admissibility: 50,
    stage: 'unspoken',
    peakAffection: 80,
    jealousy,
  });

  it('requires every member good AND under the jealousy ceiling', () => {
    expect(isBalanceEnding({ a: good(10), b: good(20), c: good(40) })).toBe(true);
    expect(isBalanceEnding({ a: good(10), b: good(50) })).toBe(false);
  });

  it('fails if any single route collapsed', () => {
    const relations = { a: good(10), b: { ...good(10), endingLocked: 'severance_end' } };
    expect(isBalanceEnding(relations)).toBe(false);
  });
});
