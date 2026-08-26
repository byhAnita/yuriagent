/**
 * The dorm's release valve. PROPOSALS 15.
 *
 * Section 10 makes the dorm safe from scandal and dangerous for jealousy, and
 * until this existed that tension was all cost: every dorm visit was a choice
 * of one member in front of four. Three rules make a shared evening the other
 * half of it, and all three are asserted here because a rule that is not
 * asserted is one that gets quietly broken.
 */

import { describe, it, expect } from 'vitest';
import { SHARED_ACTIVITIES, FILMS, sharedActivityFor, sharedFrame } from './sharedActivities.js';
import { LOCATIONS, DORM_LOCATIONS } from './locations.js';
import { actionsFor } from './soloActions.js';
import { GENERIC_GIFTS } from './gifts.js';
import { giftsFor, canPurchase, purchase } from '../systems/economy.js';
import { propagate } from '../systems/rumor.js';
import { newRelation } from '../systems/relationship.js';
import { getCast } from './cast.js';
import { makeRng } from '../systems/rng.js';
import en from '../i18n/en.js';
import zh from '../i18n/zh.js';

const cards = getCast();
const ids = cards.map((c) => c.id);

describe('the two shared rooms', () => {
  it('offers one in each shared dorm room and nowhere else', () => {
    expect(sharedActivityFor('dorm_kitchen').id).toBe('cook_together');
    expect(sharedActivityFor('dorm_living').id).toBe('watch_a_film');

    // Her room and yours are not places the group ends up.
    expect(sharedActivityFor('dorm_room')).toBeNull();
    expect(sharedActivityFor('dorm_player_room')).toBeNull();
    expect(sharedActivityFor('practice_room')).toBeNull();
  });

  it('sits at a location that exists and is in the dorm', () => {
    for (const activity of Object.values(SHARED_ACTIVITIES)) {
      expect(LOCATIONS[activity.locationId], activity.id).toBeTruthy();
      expect(DORM_LOCATIONS).toContain(activity.locationId);
    }
  });

  /** Model-facing English, like every other scene frame. */
  it('keeps its frame ASCII and unlocalized', () => {
    for (const activity of Object.values(SHARED_ACTIVITIES)) {
      const text = [activity.frame.setting, ...activity.frame.movements].join(' ');
      // eslint-disable-next-line no-control-regex
      expect(/^[\x20-\x7e{}]+$/.test(text), activity.id).toBe(true);
    }
  });

  /** Section 11's rule: a movement sets the SITUATION, never the OUTCOME. */
  it('never writes her reaction into a movement', () => {
    const scripted = /\bshe (takes|kisses|blushes|smiles|leans|admits|confesses|cries|says)\b/i;
    for (const activity of Object.values(SHARED_ACTIVITIES)) {
      for (const m of activity.frame.movements) {
        expect(scripted.test(m), `scripted: "${m}"`).toBe(false);
      }
    }
  });

  it('is named for the player in every locale', () => {
    for (const bundle of [en, zh]) {
      for (const activity of Object.values(SHARED_ACTIVITIES)) {
        expect(bundle.shared[activity.id], activity.id).toBeTruthy();
      }
      expect(bundle.shared.note).toBeTruthy();
    }
  });
});

describe('tonight is a specific film', () => {
  it('fills the placeholder', () => {
    const frame = sharedFrame(SHARED_ACTIVITIES.dorm_living, makeRng(1));
    expect(frame.setting).not.toContain('{film}');
    expect(FILMS.some((f) => frame.setting.includes(f))).toBe(true);
  });

  /**
   * Seeded, so backing out of the gift modal and walking in again is the same
   * evening. A film that changes when you look away is a film nobody is
   * watching.
   */
  it('is the same film for the same seed', () => {
    const one = sharedFrame(SHARED_ACTIVITIES.dorm_living, makeRng(7));
    const two = sharedFrame(SHARED_ACTIVITIES.dorm_living, makeRng(7));
    expect(one.setting).toBe(two.setting);
  });

  it('leaves a frame with no placeholder alone', () => {
    const frame = sharedFrame(SHARED_ACTIVITIES.dorm_kitchen, makeRng(1));
    expect(frame.setting).toBe(SHARED_ACTIVITIES.dorm_kitchen.frame.setting);
  });

  it('is null for no activity rather than a crash', () => {
    expect(sharedFrame(null)).toBeNull();
  });
});

describe('nobody is being singled out', () => {
  const relations = Object.fromEntries(ids.map((id) => [id, newRelation(70)]));
  const scene = {
    exposure: 15,
    phase: 'prep',
    locationId: 'dorm_living',
    locationLabel: 'Living room',
    presentIds: ids,
    dormWitnessIds: [],
  };

  /**
   * The rule the whole proposal turns on. Without it the release valve is its
   * own tax: five people watching a film would put a witnessed entry in four
   * dossiers, at a group scene's exposure floor, for an evening in which nothing
   * happened to anyone in particular.
   */
  it('writes into nobody dossier at all', () => {
    const out = propagate({
      scene: { ...scene, shared: true },
      subject: { id: 'irene', name: 'Irene' },
      cast: cards,
      relations,
      rng: () => 0,
    });

    expect(out.rumors).toEqual([]);
    expect(out.noticed).toEqual([]);
  });

  /**
   * ...and the same evening in which the player DOES single somebody out is
   * exactly what it always was.
   *
   * Note that this now needs `singledOut` as well as dropping `shared`, and the
   * two flags answer different questions: `shared` says the ACTIVITY singled
   * nobody out, `singledOut` says the PLAYER did.
   *
   * `shared` wins where they disagree, so an opener handed over during the film
   * still costs nothing. That is deliberate and it is the weaker half of the
   * rule - the dorm needs one thing that is unambiguously restorative, and a
   * release valve with an asterisk on it is not one. Worth watching in play: if
   * shared evenings become the cheap place to spend every opener, the fix is to
   * let `singledOut` override, not to take the valve away.
   */
  it('still costs the earth when somebody is singled out', () => {
    const out = propagate({
      scene: { ...scene, singledOut: true },
      subject: { id: 'irene', name: 'Irene' },
      cast: cards,
      relations,
      rng: () => 0,
    });

    expect(out.rumors.length).toBe(ids.length - 1);
    expect(out.rumors.every((r) => r.witnessed)).toBe(true);
  });
});

describe('the dish', () => {
  const dossier = { known_facts: [], player_told_her: [] };

  it('is an opener paid in a block rather than in credits', () => {
    const dish = GENERIC_GIFTS.find((g) => g.id === 'home_cooked');
    expect(dish.cost).toBe(0);
    expect(dish.stock).toBe('dishes');
    // Better than a shop gift, because a block is dearer than two credits.
    expect(dish.effect).toBeGreaterThan(GENERIC_GIFTS.find((g) => g.id === 'rose').effect);
  });

  it('is cooked by a solo action that produces no credits', () => {
    const action = actionsFor('dorm_kitchen').find((a) => a.id === 'cook_a_dish');
    expect(action.dish).toBe(true);
    expect(action.credits ?? 0).toBe(0);
  });

  /**
   * Not shown while the player is not carrying one - the same rule locked
   * knowledge gifts follow. An option that cannot be acted on is clutter.
   */
  it('is not offered when there is none in hand', () => {
    const none = giftsFor(dossier, 20, [], { dishes: 0 });
    expect(none.generic.find((g) => g.id === 'home_cooked').unlocked).toBe(false);
    expect(canPurchase('home_cooked', dossier, 20, { dishes: 0 })).toBe(false);

    const one = giftsFor(dossier, 20, [], { dishes: 1 });
    expect(one.generic.find((g) => g.id === 'home_cooked').purchasable).toBe(true);
    expect(canPurchase('home_cooked', dossier, 20, { dishes: 1 })).toBe(true);
  });

  it('spends the dish rather than any credits, and says so to the model', () => {
    const bought = purchase('home_cooked', dossier, 20, 'Irene', { dishes: 1 });

    expect(bought.credits).toBe(20);
    expect(bought.spentStock).toBe('dishes');
    expect(bought.sceneNote).toMatch(/cooked themselves/);
    // Made, not bought - which is the whole reason it is worth a block.
    expect(bought.sceneNote).not.toMatch(/handed Irene a home cooked/);
  });

  it('leaves an ordinary shop gift untouched', () => {
    const bought = purchase('rose', dossier, 20, 'Irene', { dishes: 0 });
    expect(bought.credits).toBe(19);
    expect(bought.spentStock).toBeNull();
  });

  it('is named in every locale', () => {
    for (const bundle of [en, zh]) {
      expect(bundle.gift.home_cooked).toBeTruthy();
      expect(bundle.solo.cook_a_dish).toBeTruthy();
      expect(bundle.solo.cook_a_dish_result).toBeTruthy();
    }
  });
});
