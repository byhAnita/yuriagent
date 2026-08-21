import { describe, it, expect } from 'vitest';
import { sceneExposure, presenceCount, approachIsWitnessed } from './exposure.js';

describe('sceneExposure', () => {
  it('makes the same room safer at night than at midday', () => {
    const base = { locationId: 'practice_room', phase: 'prep', secrecy: 70 };
    const noon = sceneExposure({ ...base, block: 'afternoon' });
    const night = sceneExposure({ ...base, block: 'evening' });
    expect(night).toBeLessThan(noon);
  });

  it('ranks the cafe above the practice room in every block', () => {
    for (const block of ['morning', 'afternoon', 'evening']) {
      const ctx = { block, phase: 'rest', secrecy: 70 };
      expect(sceneExposure({ ...ctx, locationId: 'cafe' })).toBeGreaterThan(
        sceneExposure({ ...ctx, locationId: 'practice_room' }),
      );
    }
  });

  it('raises everything during comeback week', () => {
    const ctx = { locationId: 'cafe', block: 'morning', secrecy: 70 };
    expect(sceneExposure({ ...ctx, phase: 'comeback' })).toBeGreaterThan(
      sceneExposure({ ...ctx, phase: 'prep' }),
    );
  });

  it('amplifies exposure when the player is careless', () => {
    const ctx = { locationId: 'cafe', block: 'morning', phase: 'rest' };
    expect(sceneExposure({ ...ctx, secrecy: 10 })).toBeGreaterThan(
      sceneExposure({ ...ctx, secrecy: 90 }),
    );
  });

  it('applies an identity modifier for the location', () => {
    const ctx = { locationId: 'wardrobe', block: 'morning', phase: 'prep', secrecy: 70 };
    const plain = sceneExposure(ctx);
    const assistant = sceneExposure({
      ...ctx,
      identity: { exposureModifier: { wardrobe: -10 } },
    });
    expect(assistant).toBe(plain - 10);
  });

  it('clamps to 0-100', () => {
    const hot = sceneExposure({
      locationId: 'broadcast_studio',
      block: 'afternoon',
      phase: 'comeback',
      secrecy: 0,
    });
    expect(hot).toBe(100);
    const cold = sceneExposure({
      locationId: 'dorm_room',
      block: 'evening',
      phase: 'prep',
      secrecy: 100,
    });
    expect(cold).toBe(0);
  });

  it('throws on an unknown location rather than guessing', () => {
    expect(() => sceneExposure({ locationId: 'moon', block: 'morning', phase: 'prep' })).toThrow();
  });
});

describe('the dorm splits exposure from presence', () => {
  it('is the safest place from the outside and the most watched from inside', () => {
    const ctx = { block: 'evening', phase: 'rest', secrecy: 70 };
    const dorm = sceneExposure({ ...ctx, locationId: 'dorm_living' });
    const cafe = sceneExposure({ ...ctx, locationId: 'cafe' });

    expect(dorm).toBeLessThan(cafe);
    expect(presenceCount('dorm_living', 'rest', 5)).toBeGreaterThan(
      presenceCount('cafe', 'rest', 5),
    );
  });
});

describe('presenceCount', () => {
  it('empties the practice room during rest week', () => {
    expect(presenceCount('practice_room', 'comeback', 5)).toBe(4);
    expect(presenceCount('practice_room', 'rest', 5)).toBe(0);
  });

  it('keeps the drama set solo and the living room full', () => {
    expect(presenceCount('drama_set', 'prep', 5)).toBe(0);
    expect(presenceCount('dorm_living', 'prep', 5)).toBe(4);
  });

  it('never reports more witnesses than there are other members', () => {
    expect(presenceCount('dorm_living', 'prep', 1)).toBe(0);
    expect(presenceCount('cafe', 'prep', 2)).toBe(1);
  });
});

describe('approachIsWitnessed', () => {
  it('is set only on the bedroom', () => {
    expect(approachIsWitnessed('dorm_room')).toBe(true);
    expect(approachIsWitnessed('dorm_living')).toBe(false);
    expect(approachIsWitnessed('cafe')).toBe(false);
  });
});
