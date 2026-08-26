import { describe, it, expect } from 'vitest';
import { giftsFor, canPurchase, purchase, earn } from './economy.js';
import { GIFTS } from '../data/gifts.js';
import { generateDayTask, completeTask, failTask, canAttempt, applyPlayerDeltas } from './tasks.js';

/**
 * THE SHELF IS OPEN. CLAUDE.md Part I.10.
 *
 * Everything below used to have a second question in front of it - had the
 * player LEARNED the fact this gift is waiting on - answered by matching
 * substrings against her dossier. That gate is gone, and with it `isUnlocked`,
 * `matchedFact`, `canGesture` and `spendGesture`.
 *
 * What is asserted now is only what the world genuinely decides: can the player
 * afford it, and are they carrying it. Whether it was the RIGHT thing to bring
 * her is the model's to answer, in the round it writes in reaction, with her
 * `facts` sitting two lines above the note in tier 3.
 */
describe('the give sheet', () => {
  it('shows every gift, with nothing locked', () => {
    const shown = giftsFor(100);
    expect(shown.length).toBeGreaterThan(0);
    for (const g of shown) {
      expect(g, g.id).not.toHaveProperty('unlocked');
      expect(g, g.id).not.toHaveProperty('purchasable');
    }
  });

  /**
   * A price you cannot meet is information; a fact you have not found was not.
   * So an unaffordable row still shows, where a locked one used to be hidden.
   */
  it('shows what it cannot afford rather than hiding it', () => {
    const warmer = giftsFor(0).find((g) => g.id === 'mugwort_pack');
    expect(warmer).toBeTruthy();
    expect(warmer.affordable).toBe(false);
    expect(giftsFor(99).find((g) => g.id === 'mugwort_pack').affordable).toBe(true);
  });

  /**
   * An opener paid in something other than credits is NOT shown while its
   * counter is empty - it is not expensive, it does not exist right now.
   */
  it('hides an opener the player is not carrying', () => {
    expect(giftsFor(99, { dishes: 0 }).some((g) => g.id === 'home_cooked')).toBe(false);
    expect(giftsFor(99, { dishes: 1 }).some((g) => g.id === 'home_cooked')).toBe(true);
  });

  /** Every object in the catalogue is buyable. There is no other kind now. */
  it('offers the whole catalogue', () => {
    const ids = giftsFor(999, { dishes: 1 }).map((g) => g.id).sort();
    expect(ids).toEqual(GIFTS.map((g) => g.id).sort());
  });
});

describe('purchase', () => {
  it('refuses when the credits are not there', () => {
    expect(canPurchase('mugwort_pack', 3)).toBe(true);
    expect(canPurchase('mugwort_pack', 2)).toBe(false);
    expect(purchase('mugwort_pack', 2, 'Irene')).toBeNull();
  });

  /** A gift id from an older catalogue must not take the sheet down. */
  it('treats an unknown gift id as a refusal rather than throwing', () => {
    expect(() => canPurchase('a_gift_that_no_longer_exists', 999)).not.toThrow();
    expect(canPurchase('a_gift_that_no_longer_exists', 999)).toBe(false);
    expect(purchase('a_gift_that_no_longer_exists', 999, 'Irene')).toBeNull();
  });

  it('spends credits and writes the note that goes into tier 3', () => {
    const out = purchase('mugwort_pack', 10, 'Irene');
    expect(out.credits).toBe(7);
    expect(out.sceneNote).toContain('Irene');
    expect(out.sceneNote).toContain('mugwort pack');
  });

  /**
   * NO AFFECTION IS PAID HERE, and that is the point of the whole change.
   *
   * A knowledge gift used to be a flat +5 applied at the moment of handing it
   * over, on top of whatever the model then moved in the round it wrote in
   * reaction - I.1 upside down, and double-counted by two routes only one of
   * which was on screen.
   */
  it('moves no relationship number at all', () => {
    const out = purchase('mugwort_pack', 10, 'Irene');
    expect(out).not.toHaveProperty('affectionDelta');
    expect(out).not.toHaveProperty('tier');
    expect(out).not.toHaveProperty('fact');
  });

  /**
   * The note says what it is and who has it, and stops. It must not tell the
   * model this was uncanny attention - the model reads her facts and decides
   * that for itself, which is what makes the same object read two ways.
   */
  it('does not script her reaction', () => {
    const out = purchase('mugwort_pack', 10, 'Irene');
    expect(out.sceneNote).not.toMatch(/never told anyone|paying very close attention|not expecting/i);
  });

  /** A dish is the one opener that says something the object name cannot. */
  it('says a cooked dish was made rather than bought', () => {
    const out = purchase('home_cooked', 0, 'Irene', { dishes: 1 });
    expect(out.spentStock).toBe('dishes');
    expect(out.sceneNote).toMatch(/cooked themselves/i);
    expect(purchase('home_cooked', 99, 'Irene', { dishes: 0 })).toBeNull();
  });

  it('never lets credits go negative', () => {
    expect(earn(1, -50)).toBe(0);
  });
});

describe('tasks', () => {
  const identity = { taskPool: ['prep_outfits'] };
  const task = generateDayTask({ identity, day: 1, phase: 'prep', seed: 5 });

  it('is deterministic per day', () => {
    const again = generateDayTask({ identity, day: 1, phase: 'prep', seed: 5 });
    expect(again.taskId).toBe(task.taskId);
  });

  it('can only be discharged at its own location', () => {
    expect(canAttempt(task, task.location)).toBe(true);
    expect(canAttempt(task, 'cafe')).toBe(false);
  });

  it('rewards competence and credits on completion', () => {
    const d = completeTask(task);
    expect(d.competence).toBeGreaterThan(0);
    expect(d.credits).toBeGreaterThan(0);
  });

  /**
   * A FAILURE COSTS THE PLAYER, AND NOBODY ELSE A NUMBER (Part I.8).
   *
   * `failTask` used to return a per-member `strain` map when `affectsMembers`
   * was set - a missed outfit is her problem, not just yours - and that was one
   * of the places code decided what a thing was worth to her. The axis is gone.
   *
   * The beat is not: `affectsMembers` is still on the task, and letting somebody
   * down belongs in a scene where she can say so. Wiring that note into the tail
   * is phase 4's job, and this test is the marker for it.
   */
  it('charges a failure to the player and to no relationship', () => {
    const out = failTask(task);
    expect(out.competence).toBeLessThan(0);
    expect(out.energy).toBeLessThan(0);
    expect(out).not.toHaveProperty('strain');
  });

  it('says the same thing about a task that touched nobody', () => {
    expect(failTask({ ...task, affectsMembers: false })).toEqual(failTask(task));
  });

  it('clamps player stats', () => {
    const player = { competence: 2, energy: 3, credits: 1 };
    const out = applyPlayerDeltas(player, { competence: -10, energy: -10, credits: -10 });
    expect(out.competence).toBe(0);
    expect(out.energy).toBe(0);
    expect(out.credits).toBe(0);
  });
});
