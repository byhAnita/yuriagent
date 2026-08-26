import { describe, it, expect } from 'vitest';
import { rumorProbability, proximity, propagate } from './rumor.js';
import { newRelation } from './relationship.js';
import { makeRng } from './rng.js';

const CAST = [
  { id: 'irene', name: 'Irene' },
  { id: 'nana', name: 'Nana' },
  { id: 'jisoo', name: 'Jisoo' },
];

const relations = (patch = {}) =>
  Object.fromEntries(CAST.map((c) => [c.id, { ...newRelation(50), ...patch }]));

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
    const { rumors } = propagate({
      scene,
      subject,
      cast: CAST,
      relations: relations(),
      rng: always,
    });
    expect(rumors.map((r) => r.memberId).sort()).toEqual(['jisoo', 'nana']);
    expect(rumors.every((r) => r.kind === 'heard')).toBe(true);
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

  it('a present member witnesses directly, with no roll', () => {
    // `singledOut` because co-presence alone no longer buys a witnessed event -
    // see `witnessed.test.js`, which owns that rule.
    const group = { ...scene, presentIds: ['irene', 'nana'], singledOut: true };
    const { rumors } = propagate({
      scene: group,
      subject,
      cast: CAST,
      relations: relations(),
      rng: never, // dice refuse; witnessing must not depend on them
    });
    const nana = rumors.find((r) => r.memberId === 'nana');
    expect(nana.witnessed).toBe(true);
    expect(nana.exposure).toBeGreaterThanOrEqual(80);
    // Jisoo was not in the room and the dice refused, so she hears nothing.
    expect(rumors.find((r) => r.memberId === 'jisoo')).toBeUndefined();
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
    const { rumors } = propagate({
      scene: bedroom,
      subject,
      cast: CAST,
      relations: relations(),
      rng: never,
    });
    expect(rumors).toHaveLength(1);
    expect(rumors[0].memberId).toBe('nana');
    expect(rumors[0].text).toContain('close the door');
  });

  /**
   * IT COSTS NOTHING, AND THAT IS THE CHANGE (Part I.8).
   *
   * This used to assert that a deeply invested member took ten times the
   * jealousy of a distant one - the exclusivity curve, scaled. Both the number
   * and the curve are gone: a rumor lands in her dossier and does nothing at all
   * until she is in front of the player, at which point the model reads it and
   * writes what it cost her.
   *
   * So the two women get the same entry, and the difference between what Nana
   * feels about it and what Jisoo feels about it is the model's answer, in a
   * scene, rather than a multiplier here.
   */
  it('writes the same entry whatever she already feels', () => {
    const mixed = {
      irene: newRelation(50),
      nana: { ...newRelation(80), affection: 80 },
      jisoo: { ...newRelation(10), affection: 10 },
    };
    const out = propagate({ scene, subject, cast: CAST, relations: mixed, rng: always });

    expect(out.rumors.map((r) => r.memberId).sort()).toEqual(['jisoo', 'nana']);
    expect(new Set(out.rumors.map((r) => r.text)).size).toBe(1);
    expect(out).not.toHaveProperty('jealousyDeltas');
  });

  /** Nothing here may touch a relationship. It reports; the scene decides. */
  it('never returns a number', () => {
    const out = propagate({ scene, subject, cast: CAST, relations: relations(), rng: always });
    expect(Object.keys(out).sort()).toEqual(['noticed', 'rumors']);
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

  /**
   * The three tiers survive as three DIFFERENT THINGS SHE FOUND OUT, which is
   * all they were ever really for. What is gone is the weight each carried into
   * a jealousy formula.
   */
  it('keeps watching and hearing distinguishable in what it writes', () => {
    const watched = propagate({
      scene: { ...scene, presentIds: ['irene', 'nana'], singledOut: true },
      subject,
      cast: CAST,
      relations: relations(),
      rng: never,
    });
    const heard = propagate({ scene, subject, cast: CAST, relations: relations(), rng: always });

    expect(watched.rumors[0].kind).toBe('witnessed');
    expect(heard.rumors[0].kind).toBe('heard');
    expect(watched.rumors[0].text).not.toBe(heard.rumors[0].text);
  });
});

/**
 * An anchor event does not charge admission. Day-three playtest, reported five
 * separate times - once for every event played.
 *
 * > A witness error here, I didn't give Irene anything or do special
 * > interaction. Player just join the special event group chat, there
 * > shouldn't be a witness.
 *
 * The presence tier prices choosing one woman in a room that held three. At an
 * anchor event the company put all five there, attendance IS the day, and the
 * engine picks an addressee whether the player singles anybody out or not - so
 * every event ended with four lines on the aftermath screen for turning up to
 * work.
 */
describe('a room nobody chose to be in', () => {
  const cast = [
    { id: 'irene', name: 'Irene' },
    { id: 'nana', name: 'Nana' },
    { id: 'jisoo', name: 'Jisoo' },
    { id: 'hyewon', name: 'Hyewon' },
    { id: 'yeri', name: 'Yeri' },
  ];
  const relations = Object.fromEntries(cast.map((c) => [c.id, newRelation(45)]));
  const subject = { id: 'irene', name: 'Irene' };

  const event = (over = {}) => ({
    exposure: 35,
    phase: 'prep',
    locationId: 'meeting_room',
    locationLabel: 'Meeting Room',
    presentIds: cast.map((c) => c.id),
    collective: true,
    singledOut: false,
    ...over,
  });

  const run = (scene) =>
    propagate({ scene, subject, cast, relations, rng: makeRng(3) });

  it('charges nobody for attending the concept meeting', () => {
    const { noticed, rumors } = run(event());

    expect(noticed, 'four bystanders were charged for turning up to work').toEqual([]);
    expect(rumors).toEqual([]);
  });

  /**
   * The half that must NOT change. Section 10: singling somebody out in front
   * of the other four is the loudest act available to the player, and an event
   * is where it is loudest. Only the presence tier is exempted.
   */
  it('still witnesses a gesture at full weight', () => {
    const { rumors } = run(event({ singledOut: true }));

    expect(rumors).toHaveLength(4);
    expect(rumors.every((r) => r.kind === 'witnessed')).toBe(true);
    for (const c of cast.slice(1)) {
      expect(
        rumors.some((r) => r.memberId === c.id),
        `${c.id} saw nothing`,
      ).toBe(true);
    }
  });

  /**
   * ...and an ORDINARY crowded room is untouched, which is the whole reason
   * this is a flag rather than a change to the presence tier. The player chose
   * to spend that block on one of the three women standing in it.
   */
  it('leaves an ordinary occupied room charging presence', () => {
    const { noticed, rumors } = run(event({ collective: false, locationId: 'practice_room' }));

    // Told to the PLAYER, and written into nobody's dossier. Section 5b: a note
    // every group scene saying she was in the room would flush the four-entry
    // FIFO of anything that mattered.
    expect(noticed).toHaveLength(4);
    expect(rumors).toEqual([]);
  });
});
