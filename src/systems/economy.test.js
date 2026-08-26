import { describe, it, expect } from 'vitest';
import {
  isUnlocked,
  giftsFor,
  canPurchase,
  purchase,
  earn,
  canGesture,
  spendGesture,
} from './economy.js';
import { GESTURE_EFFECT } from '../config/constants.js';
import { KNOWLEDGE_GIFTS } from '../data/gifts.js';
import { getGift } from '../data/gifts.js';
import { generateDayTask, completeTask, failTask, canAttempt, applyPlayerDeltas } from './tasks.js';

const empty = { known_facts: [], player_told_her: [] };
const knowsCold = { known_facts: ['hates cold hands'], player_told_her: [] };

describe('knowledge gating', () => {
  it('leaves generic gifts always available', () => {
    expect(isUnlocked(getGift('rose'), empty)).toBe(true);
  });

  it('locks a knowledge gift until the fact exists', () => {
    expect(isUnlocked(getGift('mugwort_pack'), empty)).toBe(false);
    expect(isUnlocked(getGift('mugwort_pack'), knowsCold)).toBe(true);
  });

  it('matches a fact the summarizer wrote in its own words', () => {
    const loose = { known_facts: ['her hands are always cold in the studio'], player_told_her: [] };
    expect(isUnlocked(getGift('mugwort_pack'), loose)).toBe(true);
  });

  it('also matches things the player told her', () => {
    const told = { known_facts: [], player_told_her: ['she drinks five litres of water a day'] };
    expect(isUnlocked(getGift('insulated_water_jug'), told)).toBe(true);
  });

  /** A gift id from an older catalogue must not take the modal down. */
  it('treats an unknown gift id as locked rather than throwing', () => {
    expect(() => isUnlocked(getGift('a_gift_that_no_longer_exists'), knowsCold)).not.toThrow();
    expect(isUnlocked(getGift('a_gift_that_no_longer_exists'), knowsCold)).toBe(false);
    expect(canPurchase('a_gift_that_no_longer_exists', knowsCold, 999)).toBe(false);
  });

  it('money is not the constraint - attention is', () => {
    expect(canPurchase('mugwort_pack', empty, 999)).toBe(false);
    expect(canPurchase('mugwort_pack', knowsCold, 3)).toBe(true);
    expect(canPurchase('mugwort_pack', knowsCold, 2)).toBe(false);
  });
});

describe('giftsFor', () => {
  it('shows locked gifts rather than hiding them', () => {
    const { knowledge } = giftsFor(empty, 100);
    expect(knowledge.length).toBeGreaterThan(0);
    expect(knowledge.every((g) => g.unlocked === false)).toBe(true);
    expect(knowledge.every((g) => g.purchasable === false)).toBe(true);
  });

  it('separates affordability from knowledge', () => {
    const { knowledge } = giftsFor(knowsCold, 0);
    const warmer = knowledge.find((g) => g.id === 'mugwort_pack');
    expect(warmer.unlocked).toBe(true);
    expect(warmer.affordable).toBe(false);
    expect(warmer.purchasable).toBe(false);
  });
});

describe('purchase', () => {
  it('returns null when the gift is not purchasable', () => {
    expect(purchase('mugwort_pack', empty, 100, 'Irene')).toBeNull();
  });

  it('spends credits and writes the scene-opening note', () => {
    const out = purchase('mugwort_pack', knowsCold, 10, 'Irene');
    expect(out.credits).toBe(7);
    expect(out.affectionDelta).toBe(5);
    expect(out.sceneNote).toContain('Irene');
    expect(out.sceneNote).toContain('mugwort pack');
  });

  it('is worth far more than a generic gift', () => {
    const generic = purchase('rose', empty, 10, 'Irene');
    const known = purchase('mugwort_pack', knowsCold, 10, 'Irene');
    expect(known.affectionDelta).toBeGreaterThan(generic.affectionDelta * 4);
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

/**
 * Spending knowledge by saying something. CLAUDE.md section 11.
 *
 * Not every way of showing you were listening is a purchase. Asking how the
 * ankle held up is the more natural move most of the time, and an economy whose
 * only verb is BUY reads as a shop rather than as attention.
 */
describe('a gesture is the other way to spend a fact', () => {
  const knowsLaundry = {
    known_facts: ['has extremely cold hands and warms them with mugwort packs'],
    player_told_her: [],
  };

  it('costs nothing and needs no credits', () => {
    expect(canGesture('mugwort_pack', knowsLaundry, [])).toBe(true);
    const said = spendGesture('mugwort_pack', knowsLaundry, [], 'Irene');
    expect(said.affectionDelta).toBe(GESTURE_EFFECT);
  });

  /** Free has to mean weaker, or the shop is decoration. */
  it('lands smaller than buying the object', () => {
    const said = spendGesture('mugwort_pack', knowsLaundry, [], 'Irene');
    const bought = purchase('mugwort_pack', knowsLaundry, 99, 'Irene');
    expect(said.affectionDelta).toBeLessThan(bought.affectionDelta);
  });

  /** ...and once, or it stops being attention and becomes a script. */
  it('can only be spent once per fact', () => {
    const said = spendGesture('mugwort_pack', knowsLaundry, [], 'Irene');
    expect(said.usedGestures).toContain('mugwort_pack');
    expect(canGesture('mugwort_pack', knowsLaundry, said.usedGestures)).toBe(false);
    expect(spendGesture('mugwort_pack', knowsLaundry, said.usedGestures, 'Irene')).toBeNull();
  });

  it('is locked by the same fact the object is locked by', () => {
    expect(canGesture('mugwort_pack', { known_facts: [] }, [])).toBe(false);
    expect(canGesture('iced_coffee', knowsLaundry, [])).toBe(false);
  });

  it('quotes the fact and names her, exactly as the gift note does', () => {
    const said = spendGesture('mugwort_pack', knowsLaundry, [], 'Irene');
    expect(said.fact).toBe(knowsLaundry.known_facts[0]);
    expect(said.sceneNote).toContain(said.fact);
    expect(said.sceneNote).toContain('Irene');
  });

  /**
   * The one thing the model must not do with a gesture is invent the present
   * that is not there - the opening beat is written from this note alone.
   */
  it('tells the model there is no object to react to', () => {
    const said = spendGesture('mugwort_pack', knowsLaundry, [], 'Irene');
    expect(said.tier).toBe('gesture');
    expect(said.sceneNote).toMatch(/no gift and no object/i);
    expect(said.sceneNote).toMatch(/do not invent a present/i);
    expect(said.sceneNote).not.toMatch(/handed/i);
  });

  it('shows a spent gesture as spent, and an unlearned one as locked', () => {
    const shown = giftsFor(knowsLaundry, 99, ['mugwort_pack']);
    const spent = shown.gesture.find((g) => g.id === 'mugwort_pack');
    const never = shown.gesture.find((g) => g.id === 'pink_plushie');

    expect(spent.unlocked).toBe(true);
    expect(spent.used).toBe(true);
    expect(spent.purchasable).toBe(false);

    expect(never.unlocked).toBe(false);
    expect(never.purchasable).toBe(false);
  });

  /**
   * Every fact can be spent as a line. Only some can be spent as an object -
   * you cannot buy somebody a fear of heights.
   */
  it('offers a gesture for every fact, and a purchase for only some', () => {
    const shown = giftsFor(knowsLaundry, 0);
    expect(shown.gesture).toHaveLength(KNOWLEDGE_GIFTS.length);
    expect(shown.knowledge.length).toBeLessThan(shown.gesture.length);
    expect(shown.gesture.every((g) => g.cost === 0)).toBe(true);
    expect(shown.knowledge.every((g) => g.cost > 0)).toBe(true);
  });

  it('refuses to sell an opener that is not an object', () => {
    const knowsGym = { known_facts: ['squeezes ten-minute gym sets into the breaks'], player_told_her: [] };
    expect(canGesture('squats_together', knowsGym, [])).toBe(true);
    expect(canPurchase('squats_together', knowsGym, 999)).toBe(false);
    expect(purchase('squats_together', knowsGym, 999, 'Irene')).toBeNull();
  });
});
