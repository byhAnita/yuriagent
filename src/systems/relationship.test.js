import { describe, it, expect } from 'vitest';
import {
  newRelation,
  resolveStage,
  stageOf,
  addAffection,
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

/**
 * The stage is DERIVED, and this is the assertion that keeps it that way.
 *
 * It used to be a stored field, written by `applySceneOutcome`. `applyDeltas`
 * replaced that function and never wrote it, so from the moment v2 landed every
 * relation carried the stage it was created at - forever - while the day screen
 * happened to look right because it called `resolveStage` itself. Two correct
 * halves and a stale join, which is the shape this project keeps shipping.
 *
 * So nothing stores it, and a stale one cannot exist to be read.
 */
describe('the stage is derived, never stored', () => {
  it('is absent from a fresh relation', () => {
    expect(newRelation(5).stage).toBeUndefined();
  });

  it('follows the two numbers wherever they go', () => {
    expect(stageOf({ affection: 5, admissibility: 0 })).toBe('stranger');
    expect(stageOf({ affection: 80, admissibility: 50 })).toBe('unspoken');
  });

  /**
   * And a stale field on an old save cannot override it. `fromSave` merges what
   * it finds, so a v1 save still carries `stage: 'stranger'` next to affection
   * 80 - and every reader has to reach the second answer, not the first.
   */
  it('ignores a stale stage left behind by an older save', () => {
    expect(stageOf({ affection: 80, admissibility: 50, stage: 'stranger' })).toBe('unspoken');
    expect(resolveEnding({ affection: 80, admissibility: 50, peakAffection: 80, stage: 'stranger' }))
      .toBe('unspoken_end');
  });

  it('defaults an empty relation to the bottom of the ladder', () => {
    expect(stageOf({})).toBe('stranger');
    expect(stageOf()).toBe('stranger');
  });
});

/**
 * The one fixed affection gain left, and what it is for.
 *
 * Everything a SCENE is worth comes through `systems/values.js`, because the
 * model decided it. This is for the two things the world decides on its own - a
 * shared dorm evening, and an opener bought with credits - neither of which is a
 * judgement about how the conversation went.
 */
describe('addAffection', () => {
  it('moves the number and keeps the peak', () => {
    const rel = addAffection(newRelation(50), 6);
    expect(rel.affection).toBe(56);
    expect(rel.peakAffection).toBe(56);
  });

  it('clamps to 0-100', () => {
    expect(addAffection(newRelation(98), 9).affection).toBe(100);
    expect(addAffection(newRelation(3), -9).affection).toBe(0);
  });

  it('never lowers the high-water mark on the way down', () => {
    const rel = addAffection({ ...newRelation(70), peakAffection: 70 }, -20);
    expect(rel.affection).toBe(50);
    expect(rel.peakAffection).toBe(70);
  });

  /**
   * The plateau does not stop it, and that is the change rather than an
   * oversight. `applySceneOutcome` used to refuse affection GAINS at
   * `confidante`, which is code overruling a number somebody else already chose -
   * the v1 arrangement Part I undoes. `confidante` is still a true reading of
   * where the relationship sits, and the modal still says what to do about it.
   */
  it('does not brake on the plateau any more', () => {
    const stalled = { ...newRelation(60), admissibility: 2 };
    expect(stageOf(stalled)).toBe('confidante');
    expect(addAffection(stalled, 4).affection).toBe(64);
  });
});

describe('resolveBadEnd', () => {
  it('returns null when there was never enough there to break', () => {
    expect(resolveBadEnd({ ...newRelation(30), peakAffection: 39 })).toBeNull();
  });

  it('prefers severance when the collapse happened in the reckless zone', () => {
    const rel = {
      ...newRelation(50),
      affection: 40,
      admissibility: 90,
      peakAffection: 80,
      peakAdmissibility: 90,
    };
    expect(stageOf(rel)).toBe('reckless');
    expect(resolveBadEnd(rel)).toBe('severance_end');
  });

  it('picks exposure when admissibility had gone public', () => {
    const rel = {
      ...newRelation(50),
      affection: 80,
      admissibility: 50,
      peakAffection: 80,
      peakAdmissibility: 60,
    };
    expect(resolveBadEnd(rel)).toBe('exposure_end');
  });

  it('picks nameless when it was deep and never nameable', () => {
    const rel = {
      ...newRelation(50),
      affection: 75,
      admissibility: 20,
      peakAffection: 75,
      peakAdmissibility: 20,
    };
    expect(resolveBadEnd(rel)).toBe('nameless_end');
  });
});

describe('resolveEnding', () => {
  it('drifts when the route never got going', () => {
    expect(resolveEnding(newRelation(5))).toBe('drift_end');
  });

  it('honours a locked ending over the current position', () => {
    const rel = { ...newRelation(95), admissibility: 90, endingLocked: 'exposure_end' };
    expect(stageOf(rel)).toBe('out');
    expect(resolveEnding(rel)).toBe('exposure_end');
  });

  /**
   * The signature zone reached and HELD is a good ending, and it is deliberately
   * one letter away from the collapse that leaves her filed as a friend.
   */
  it('gives the nameless zone its own good ending', () => {
    const rel = { ...newRelation(65), affection: 65, admissibility: 30, peakAffection: 65 };
    expect(resolveEnding(rel)).toBe('unnamed_end');
  });
});

describe('isAftermath', () => {
  it('distinguishes a fresh low/low from a collapsed one', () => {
    expect(isAftermath(newRelation(5))).toBe(false);
    expect(isAftermath({ ...newRelation(5), peakAffection: 75 })).toBe(true);
  });
});

describe('isBalanceEnding', () => {
  const good = () => ({
    ...newRelation(80),
    affection: 80,
    admissibility: 50,
    peakAffection: 80,
  });

  /**
   * The jealousy ceiling used to be half this test, and it went with the number.
   * What made the balance ending hard was never that clause - it is that five
   * routes have to sit inside a narrow band at once and every block spent on one
   * is a block not spent on the other four.
   */
  it('requires every member to have got somewhere real', () => {
    expect(isBalanceEnding({ a: good(), b: good(), c: good() })).toBe(true);
    expect(isBalanceEnding({ a: good(), b: newRelation(5) })).toBe(false);
  });

  it('fails if any single route collapsed', () => {
    const relations = { a: good(), b: { ...good(), endingLocked: 'severance_end' } };
    expect(isBalanceEnding(relations)).toBe(false);
  });

  it('is not reachable with a cast of one', () => {
    expect(isBalanceEnding({ a: good() })).toBe(false);
  });
});
