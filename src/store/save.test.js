/**
 * Save and load. CLAUDE.md section 15.
 *
 * The assertions that matter are the defensive ones. A save is the only thing
 * standing between a player and losing a nine-week campaign, so every way it
 * can be wrong - truncated, from an older build, from a newer one, written by
 * a browser that then cleared its storage - has to produce a playable state
 * rather than an exception.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { toSave, fromSave, save, load, peek, hasSave, clearSave, SCHEMA_VERSION } from './save.js';
import { SAVE_KEY } from '../config/constants.js';
import { newRelation } from '../systems/relationship.js';
import { newMemory } from '../agent/memory.js';
import { newRun } from '../systems/clock.js';
import { MVP_CAST } from '../data/cast.js';

/** A localStorage that behaves, so the happy path can be exercised at all. */
function stubStorage() {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
  return map;
}

const defaults = () => ({
  run: newRun({ seed: 1 }),
  player: { name: '', dishes: 0, competence: 20, energy: 90, secrecy: 70, credits: 6 },
  cast: MVP_CAST,
  relations: Object.fromEntries(MVP_CAST.map((id) => [id, newRelation(5)])),
  memory: newMemory(MVP_CAST),
});

const aRun = () => ({
  run: { ...newRun({ seed: 1 }), week: 4, day: 2, block: 'evening', phase: 'comeback' },
  player: { name: 'Yuhan', dishes: 1, competence: 40, energy: 60, secrecy: 55, credits: 12 },
  cast: MVP_CAST,
  relations: {
    ...Object.fromEntries(MVP_CAST.map((id) => [id, newRelation(5)])),
    irene: { ...newRelation(5), intimacy: 62, admissibility: 24, peakIntimacy: 62 },
  },
  memory: {
    dossier: { irene: { known_facts: [{ text: 'has cold hands', factId: 'cold_hands' }] } },
    ledger: [{ id: 's1', day: 1, block: 'morning', type: 'full', text: 'They talked.' }],
  },
  calendar: { taskState: { taskId: 'prep_outfits', done: true, day: 2 } },
  flags: { firedEvents: ['prep:event_a'], usedGestures: ['squats_together'], foundRumors: [] },
  lang: 'zh',
  model: 'deepseek',
});

beforeEach(() => {
  stubStorage();
});

describe('what a save contains', () => {
  it('carries the run and stamps a version', () => {
    const out = toSave(aRun());

    expect(out.meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out.run.week).toBe(4);
    expect(out.player.name).toBe('Yuhan');
    expect(out.ledger).toHaveLength(1);
    expect(out.flags.firedEvents).toEqual(['prep:event_a']);
  });

  /**
   * Section 22, and the reason `apiKey.js` is its own module with its own
   * storage key: a save file can be exported or shared, and a key that rode
   * along inside one would be a leak the player never chose.
   */
  it('never contains an API key, a scene, or settings', () => {
    const text = JSON.stringify(toSave({ ...aRun(), apiKey: 'sk-should-not-be-here' }));

    expect(text).not.toContain('sk-should-not-be-here');
    expect(text).not.toContain('apiKey');
    expect(JSON.parse(text).scene).toBeUndefined();
    expect(JSON.parse(text).settings).toBeUndefined();
  });

  /** `focusId` is derived from intimacy (section 15). Storing it lets it lie. */
  it('never stores focusId', () => {
    expect(JSON.stringify(toSave(aRun()))).not.toContain('focusId');
  });
});

describe('a round trip', () => {
  it('comes back the way it went in', () => {
    expect(save(aRun())).toBe(true);
    const back = load(defaults());

    expect(back.run.week).toBe(4);
    expect(back.player.name).toBe('Yuhan');
    expect(back.player.dishes).toBe(1);
    expect(back.relations.irene.intimacy).toBe(62);
    expect(back.memory.dossier.irene.known_facts[0].factId).toBe('cold_hands');
    expect(back.memory.ledger).toHaveLength(1);
    expect(back.calendar.taskState.done).toBe(true);
    expect(back.flags.firedEvents).toEqual(['prep:event_a']);
  });

  it('reports and clears itself', () => {
    expect(hasSave()).toBe(false);
    save(aRun());
    expect(hasSave()).toBe(true);

    const header = peek();
    expect(header.name).toBe('Yuhan');
    expect(header.week).toBe(4);
    expect(header.savedAt).toBeGreaterThan(0);

    clearSave();
    expect(hasSave()).toBe(false);
    expect(peek()).toBeNull();
  });
});

describe('everything that can be wrong with a record', () => {
  it('loads nothing rather than throwing on garbage', () => {
    localStorage.setItem(SAVE_KEY, '{ this is not json');
    expect(load(defaults())).toBeNull();
    expect(peek()).toBeNull();
  });

  it('loads nothing when there is nothing', () => {
    expect(load(defaults())).toBeNull();
    expect(fromSave(null, defaults())).toBeNull();
    expect(fromSave('a string', defaults())).toBeNull();
  });

  /**
   * The realistic failure: a save written before a field existed. Section 15
   * says unknown or missing fields fill from defaults rather than throwing,
   * and the alternative is a player losing a campaign to a rename.
   */
  it('fills a missing field from defaults', () => {
    const back = fromSave({ run: { week: 2 }, player: { name: 'Yuhan' } }, defaults());

    expect(back.run.week).toBe(2);
    expect(back.run.block).toBe(defaults().run.block);
    expect(back.player.name).toBe('Yuhan');
    expect(back.player.energy).toBe(90);
    expect(back.memory.ledger).toEqual([]);
    expect(back.flags.firedEvents).toEqual([]);
  });

  /**
   * A cast that gained a member since the save was written must not come back
   * with `undefined` where her relationship should be - every reader of
   * `relations[id]` assumes it is there.
   */
  it('keeps a member the save had never heard of', () => {
    const back = fromSave({ relations: { irene: { intimacy: 70 } } }, defaults());

    expect(back.relations.irene.intimacy).toBe(70);
    // ...and the rest are still whole, not missing.
    for (const id of MVP_CAST) {
      expect(back.relations[id], id).toBeTruthy();
      expect(typeof back.relations[id].strain).toBe('number');
    }
  });

  it('ignores a field of the wrong type instead of trusting it', () => {
    const back = fromSave(
      { cast: 'irene', ledger: { nope: true }, flags: { firedEvents: 'prep:event_a' } },
      defaults(),
    );

    expect(back.cast).toEqual(MVP_CAST);
    expect(back.memory.ledger).toEqual([]);
    expect(back.flags.firedEvents).toEqual([]);
  });

  /**
   * A private window, or a full quota. A failed save must never take the run
   * down with it - the player would lose the thing the save was protecting.
   */
  it('survives storage that refuses to write', () => {
    globalThis.localStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };

    expect(save(aRun())).toBe(false);
    expect(load(defaults())).toBeNull();
    expect(hasSave()).toBe(false);
    expect(peek()).toBeNull();
    expect(() => clearSave()).not.toThrow();
  });
});
