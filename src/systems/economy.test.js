import { describe, it, expect } from 'vitest';
import { giftsFor, canPurchase, purchase, earn } from './economy.js';
import { GIFTS } from '../data/gifts.js';
import { getCast } from '../data/cast.js';
import { generateDayTask, completeTask, failTask, canAttempt, applyPlayerDeltas } from './tasks.js';

/**
 * THE SHELF IS OPEN. CLAUDE.md Part I.10.
 *
 * Everything below used to have a second question in front of it - had the
 * player LEARNED the fact this gift is waiting on - answered by matching
 * substrings against her dossier. That gate is gone, and with it `isUnlocked`,
 * `canGesture` and `spendGesture`.
 *
 * What is asserted here is only what the world genuinely decides: can the player
 * afford it, and are they carrying it. Whether it was the RIGHT thing to bring
 * her is the model's to answer, in the round it writes in reaction.
 *
 * `matchedFact` came BACK, and it is worth being clear about what changed. It
 * used to answer "may this be bought"; it now answers "can the note say why she
 * would care" - see the last describe in this file. Nothing is locked either
 * way, and the assertions there check that as hard as they check the note.
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
    // `fact` survives, and is a STRING for the note rather than a number for a
    // relation. What it earned is the model's to decide, like everything else.
    expect(out.fact).toBeNull();
  });

  /**
   * WITHOUT THE FACT, THE NOTE SAYS ONLY WHAT THE OBJECT IS.
   *
   * The player has not learned why a mugwort pack would matter to her, so
   * neither has the note. She has no reason to read anything into it and
   * neither should the model.
   */
  it('does not claim attention the player has not paid', () => {
    const out = purchase('mugwort_pack', 10, 'Irene');
    expect(out.sceneNote).toContain('mugwort pack');
    expect(out.sceneNote).not.toMatch(/never told|paying attention|let this slip/i);
  });

  /** A dish is the one opener that says something the object name cannot. */
  it('says a cooked dish was made rather than bought', () => {
    const out = purchase('home_cooked', 0, 'Irene', { stock: { dishes: 1 } });
    expect(out.spentStock).toBe('dishes');
    expect(out.sceneNote).toMatch(/cooked themselves/i);
    expect(purchase('home_cooked', 99, 'Irene', { stock: { dishes: 0 } })).toBeNull();
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
 * WHY SHE WOULD CARE, WHEN THE PLAYER KNOWS WHY. CLAUDE.md Part I.10, section 11.
 *
 * Reported from the second hand test, and it is section 11's own rule arriving
 * for the second time:
 *
 *   > I give Irene a mugwort pack - her cold hand facts - while her reply is to
 *   > use it for waist ache and use it like a tea bag??
 *
 * The first ungated build said only "the player has just handed Irene a mugwort
 * pack" on the argument that the model has her `facts` in tier 3 and can join
 * the two. It could not: it reached for the commonest use of a herbal pack and
 * invented a sore back. **An inference that can be stated should be stated.**
 *
 * What this is NOT is the return of the gate. Anybody can still buy anything and
 * hand it to anybody - `canPurchase` does not look at a dossier at all, and the
 * assertions below check that as hard as they check the note.
 */
describe('a gift that answers something she once let slip', () => {
  const knows = { facts: [{ text: 'has extremely cold hands', factId: 'cold_hands' }] };
  const knowsOther = { facts: [{ text: 'will not eat chicken', factId: 'no_chicken' }] };

  it('quotes the fact into the note, and says nobody had to tell them', () => {
    const out = purchase('mugwort_pack', 10, 'Irene', { dossier: knows });

    expect(out.fact).toBe('has extremely cold hands');
    expect(out.sceneNote).toContain('has extremely cold hands');
    expect(out.sceneNote).toMatch(/never told them she needed one/i);
  });

  /**
   * MATCHED ON THE ID, NEVER ON TEXT. v1 matched `requires` needles by
   * substring and it broke twice during content rewrites, because a fact that
   * came up in dialogue is written by the summarizer in its own words. An id
   * cannot be reworded.
   */
  it('matches the id rather than the wording', () => {
    const reworded = { facts: [{ text: 'her hands go cold in the studio', factId: 'cold_hands' }] };
    expect(purchase('mugwort_pack', 10, 'Irene', { dossier: reworded }).fact).toBe(
      'her hands go cold in the studio',
    );

    const noId = { facts: [{ text: 'has extremely cold hands' }] };
    expect(purchase('mugwort_pack', 10, 'Irene', { dossier: noId }).fact).toBeNull();
  });

  /** A warm pack handed to somebody with no reason to want one is just a pack. */
  it('says nothing extra when the fact belongs to somebody else', () => {
    const out = purchase('mugwort_pack', 10, 'Nana', { dossier: knowsOther });
    expect(out.fact).toBeNull();
    expect(out.sceneNote).not.toMatch(/let this slip/i);
  });

  it('says nothing extra for a gift that answers no fact at all', () => {
    expect(purchase('rose', 10, 'Irene', { dossier: knows }).fact).toBeNull();
  });

  /**
   * THE SHELF IS STILL OPEN, which is the half that must not regress. Knowing
   * the fact changes the NOTE and nothing else - not the price, not whether it
   * can be bought, not who it can be handed to.
   */
  it('is not a gate: the same purchase succeeds either way', () => {
    expect(canPurchase('mugwort_pack', 3)).toBe(true);
    expect(purchase('mugwort_pack', 10, 'Irene').credits).toBe(
      purchase('mugwort_pack', 10, 'Irene', { dossier: knows }).credits,
    );
    expect(giftsFor(99).find((g) => g.id === 'mugwort_pack').affordable).toBe(true);
  });

  /**
   * A caller that cannot say what the player knows should not be claiming they
   * knew anything - the right degradation is the plain note, never a guess.
   */
  it('degrades to the plain note when no dossier is passed', () => {
    expect(purchase('mugwort_pack', 10, 'Irene').fact).toBeNull();
    expect(purchase('mugwort_pack', 10, 'Irene', {}).fact).toBeNull();
  });

  /** Every specific object names exactly one fact, and it has to be a real one. */
  it('names a fact that some member actually has', () => {
    const owned = new Set(getCast().flatMap((c) => c.learnableFacts ?? []));
    for (const gift of GIFTS.filter((g) => g.factId)) {
      expect(owned.has(gift.factId), `${gift.id} -> ${gift.factId}`).toBe(true);
    }
  });

  /** ...and no two objects answer the same fact, or one of them says nothing. */
  it('does not point two objects at one fact', () => {
    const seen = new Set();
    for (const gift of GIFTS.filter((g) => g.factId)) {
      expect(seen.has(gift.factId), gift.factId).toBe(false);
      seen.add(gift.factId);
    }
  });
});
