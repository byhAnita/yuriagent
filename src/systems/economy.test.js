import { describe, it, expect } from 'vitest';
import { isUnlocked, giftsFor, canPurchase, purchase, earn } from './economy.js';
import { getGift } from '../data/gifts.js';
import { generateDayTask, completeTask, failTask, canAttempt, applyPlayerDeltas } from './tasks.js';

const empty = { known_facts: [], player_told_her: [] };
const knowsCold = { known_facts: ['hates cold hands'], player_told_her: [] };

describe('knowledge gating', () => {
  it('leaves generic gifts always available', () => {
    expect(isUnlocked(getGift('rose'), empty)).toBe(true);
  });

  it('locks a knowledge gift until the fact exists', () => {
    expect(isUnlocked(getGift('hand_warmer'), empty)).toBe(false);
    expect(isUnlocked(getGift('hand_warmer'), knowsCold)).toBe(true);
  });

  it('matches a fact the summarizer wrote in its own words', () => {
    const loose = { known_facts: ['her hands are always cold in the studio'], player_told_her: [] };
    expect(isUnlocked(getGift('hand_warmer'), loose)).toBe(true);
  });

  it('also matches things the player told her', () => {
    const told = { known_facts: [], player_told_her: ['kimchi fried rice is her comfort food'] };
    expect(isUnlocked(getGift('kimchi_kit'), told)).toBe(true);
  });

  /** A gift id from an older catalogue must not take the modal down. */
  it('treats an unknown gift id as locked rather than throwing', () => {
    expect(() => isUnlocked(getGift('a_gift_that_no_longer_exists'), knowsCold)).not.toThrow();
    expect(isUnlocked(getGift('a_gift_that_no_longer_exists'), knowsCold)).toBe(false);
    expect(canPurchase('a_gift_that_no_longer_exists', knowsCold, 999)).toBe(false);
  });

  it('money is not the constraint - attention is', () => {
    expect(canPurchase('hand_warmer', empty, 999)).toBe(false);
    expect(canPurchase('hand_warmer', knowsCold, 3)).toBe(true);
    expect(canPurchase('hand_warmer', knowsCold, 2)).toBe(false);
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
    const warmer = knowledge.find((g) => g.id === 'hand_warmer');
    expect(warmer.unlocked).toBe(true);
    expect(warmer.affordable).toBe(false);
    expect(warmer.purchasable).toBe(false);
  });
});

describe('purchase', () => {
  it('returns null when the gift is not purchasable', () => {
    expect(purchase('hand_warmer', empty, 100, 'Irene')).toBeNull();
  });

  it('spends credits and writes the scene-opening note', () => {
    const out = purchase('hand_warmer', knowsCold, 10, 'Irene');
    expect(out.credits).toBe(7);
    expect(out.intimacyDelta).toBe(5);
    expect(out.sceneNote).toContain('Irene');
    expect(out.sceneNote).toContain('hand warmer');
  });

  it('is worth far more than a generic gift', () => {
    const generic = purchase('rose', empty, 10, 'Irene');
    const known = purchase('hand_warmer', knowsCold, 10, 'Irene');
    expect(known.intimacyDelta).toBeGreaterThan(generic.intimacyDelta * 4);
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

  it('charges strain to the members a failure actually touched', () => {
    const out = failTask(task, ['irene', 'yeri']);
    expect(out.competence).toBeLessThan(0);
    expect(out.strain.irene).toBe(8);
    expect(out.strain.yeri).toBe(8);
  });

  it('charges no member strain when the failure touched nobody', () => {
    const kit = { ...task, affectsMembers: false };
    expect(failTask(kit, ['irene']).strain).toEqual({});
  });

  it('clamps player stats', () => {
    const player = { competence: 2, energy: 3, credits: 1 };
    const out = applyPlayerDeltas(player, { competence: -10, energy: -10, credits: -10 });
    expect(out.competence).toBe(0);
    expect(out.energy).toBe(0);
    expect(out.credits).toBe(0);
  });
});
