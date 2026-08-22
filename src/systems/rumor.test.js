import { describe, it, expect } from 'vitest';
import { rumorProbability, proximity, propagate, WEIGHT_WITNESSED } from './rumor.js';
import { newRelation } from './relationship.js';
import { makeRng } from './rng.js';

const CAST = [
  { id: 'irene', name: 'Irene' },
  { id: 'nana', name: 'Nana' },
  { id: 'jisoo', name: 'Jisoo' },
];

const relations = (patch = {}) =>
  Object.fromEntries(CAST.map((c) => [c.id, { ...newRelation(50), stage: 'nameless', ...patch }]));

/** Deterministic dice so the assertions are about the model, not luck. */
const always = () => 0;
const never = () => 0.999999;

describe('rumorProbability', () => {
  it('is zero at or below the floor - privacy really is private', () => {
    expect(rumorProbability(0, 1)).toBe(0);
    expect(rumorProbability(30, 1)).toBe(0);
  });

  it('rises with exposure', () => {
    expect(rumorProbability(50, 1)).toBeGreaterThan(rumorProbability(40, 1));
    expect(rumorProbability(100, 1)).toBe(1);
  });

  it('scales by proximity', () => {
    expect(rumorProbability(80, 0.4)).toBeLessThan(rumorProbability(80, 1));
  });
});

describe('proximity', () => {
  it('collapses distance during comeback week', () => {
    expect(proximity('comeback')).toBe(1);
    expect(proximity('rest')).toBeLessThan(1);
    expect(proximity('rest', false)).toBeLessThan(proximity('rest', true));
  });
});

describe('propagate', () => {
  const scene = {
    exposure: 70,
    phase: 'rest',
    locationId: 'cafe',
    locationLabel: 'the cafe',
    presentIds: ['irene'],
  };
  const subject = { id: 'irene', name: 'Irene' };

  it('never tells the subject about her own scene', () => {
    const { rumors } = propagate({
      scene,
      subject,
      cast: CAST,
      relations: relations(),
      rng: always,
    });
    expect(rumors.some((r) => r.memberId === 'irene')).toBe(false);
  });

  it('a private scene reaches nobody', () => {
    const quiet = { ...scene, exposure: 10, locationId: 'dorm_room', locationLabel: 'her room' };
    const { rumors } = propagate({
      scene: quiet,
      subject,
      cast: CAST,
      relations: relations(),
      rng: always,
    });
    expect(rumors).toHaveLength(0);
  });

  it('a public scene reaches the others when the dice allow', () => {
    const { rumors, jealousyDeltas } = propagate({
      scene,
      subject,
      cast: CAST,
      relations: relations(),
      rng: always,
    });
    expect(rumors.map((r) => r.memberId).sort()).toEqual(['jisoo', 'nana']);
    expect(jealousyDeltas.nana).toBeGreaterThan(0);
  });

  it('phrases rumors from her point of view, never as a transcript', () => {
    const { rumors } = propagate({
      scene,
      subject,
      cast: CAST,
      relations: relations(),
      rng: always,
    });
    expect(rumors[0].text).toBe('you heard the player was at Cafe with Irene');
  });

  /**
   * Section 19, rule 2: memory is English whatever the UI language, so the
   * player can switch mid-run without corrupting history.
   *
   * `scene.locationLabel` is the PLAYER-facing name and `App` builds it with
   * `t()`, so on a `zh` run this line used to read "you heard the player was at
   * 练习室 with Irene" - and that went into `heard_about`, into block 3, and
   * into the save file. The name is now resolved from the location table, which
   * makes it impossible for a caller to get wrong rather than merely
   * inadvisable.
   */
  it('ignores the localized label the player sees', () => {
    const localized = { ...scene, locationLabel: '咖啡厅' };
    const { rumors } = propagate({
      scene: localized,
      subject,
      cast: CAST,
      relations: relations(),
      rng: always,
    });
    expect(rumors[0].text).toContain('Cafe');
    expect(rumors[0].text).not.toContain('咖啡厅');
  });

  it('a present member witnesses directly, with no roll and a bigger hit', () => {
    const group = { ...scene, presentIds: ['irene', 'nana'] };
    const { rumors, jealousyDeltas } = propagate({
      scene: group,
      subject,
      cast: CAST,
      relations: relations(),
      rng: never, // dice refuse; witnessing must not depend on them
    });
    const nana = rumors.find((r) => r.memberId === 'nana');
    expect(nana.witnessed).toBe(true);
    expect(nana.exposure).toBeGreaterThanOrEqual(80);
    expect(jealousyDeltas.nana).toBeGreaterThan(jealousyDeltas.jisoo ?? 0);
  });

  it('private scene, public approach: the bedroom leaks nothing but is still seen', () => {
    const bedroom = {
      exposure: 5,
      phase: 'rest',
      locationId: 'dorm_room',
      locationLabel: "Irene's room",
      presentIds: ['irene'],
      dormWitnessIds: ['nana'],
    };
    const { rumors, jealousyDeltas } = propagate({
      scene: bedroom,
      subject,
      cast: CAST,
      relations: relations(),
      rng: never,
    });
    expect(rumors).toHaveLength(1);
    expect(rumors[0].memberId).toBe('nana');
    expect(rumors[0].text).toContain('close the door');
    expect(jealousyDeltas.nana).toBeGreaterThan(0);
    expect(jealousyDeltas.jisoo).toBeUndefined();
  });

  it('costs a deeply invested member far more than a distant one', () => {
    const mixed = {
      irene: newRelation(50),
      nana: { ...newRelation(80), intimacy: 80, stage: 'unspoken' },
      jisoo: { ...newRelation(10), intimacy: 10, stage: 'stranger' },
    };
    const { jealousyDeltas } = propagate({
      scene,
      subject,
      cast: CAST,
      relations: mixed,
      rng: always,
    });
    expect(jealousyDeltas.nana).toBeGreaterThan(jealousyDeltas.jisoo * 10);
  });

  it('is reproducible from a seed', () => {
    const run = () =>
      propagate({
        scene: { ...scene, exposure: 55 },
        subject,
        cast: CAST,
        relations: relations(),
        rng: makeRng(1234),
      }).rumors.map((r) => r.memberId);
    expect(run()).toEqual(run());
  });

  it('weights witnessing well above hearsay', () => {
    expect(WEIGHT_WITNESSED).toBeGreaterThan(2);
  });
});
