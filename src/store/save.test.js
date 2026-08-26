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
import {
  toSave,
  fromSave,
  saveTo,
  loadFrom,
  listSlots,
  peekSlot,
  deleteSlot,
  clearAuto,
  hasAnySave,
  isSlotId,
  SLOT_IDS,
  AUTO_SLOT,
  MANUAL_SLOTS,
  SCHEMA_VERSION,
} from './save.js';
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
    irene: { ...newRelation(5), affection: 62, admissibility: 24, peakAffection: 62 },
  },
  memory: {
    dossier: { irene: { known_facts: [{ text: 'has cold hands', factId: 'cold_hands' }] } },
    ledger: [{ id: 's1', day: 1, block: 'morning', type: 'full', text: 'They talked.' }],
  },
  calendar: { taskState: { taskId: 'prep_outfits', done: true, day: 2 } },
  flags: { firedEvents: ['prep:event_a:0'], usedGestures: ['squats_together'], foundRumors: [] },
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
    expect(out.flags.firedEvents).toEqual(['prep:event_a:0']);
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

  /** `focusId` is derived from affection (section 15). Storing it lets it lie. */
  it('never stores focusId', () => {
    expect(JSON.stringify(toSave(aRun()))).not.toContain('focusId');
  });
});

describe('a round trip', () => {
  it('comes back the way it went in', () => {
    expect(saveTo(AUTO_SLOT, aRun())).toBe(true);
    const back = loadFrom(AUTO_SLOT, defaults());

    expect(back.run.week).toBe(4);
    expect(back.player.name).toBe('Yuhan');
    expect(back.player.dishes).toBe(1);
    expect(back.relations.irene.affection).toBe(62);
    expect(back.memory.dossier.irene.known_facts[0].factId).toBe('cold_hands');
    expect(back.memory.ledger).toHaveLength(1);
    expect(back.calendar.taskState.done).toBe(true);
    expect(back.flags.firedEvents).toEqual(['prep:event_a:0']);
  });

  it('reports and clears itself', () => {
    expect(hasAnySave()).toBe(false);
    saveTo(AUTO_SLOT, aRun());
    expect(hasAnySave()).toBe(true);

    const header = peekSlot(AUTO_SLOT);
    expect(header.name).toBe('Yuhan');
    expect(header.week).toBe(4);
    expect(header.savedAt).toBeGreaterThan(0);

    clearAuto();
    expect(hasAnySave()).toBe(false);
    expect(peekSlot(AUTO_SLOT).empty).toBe(true);
  });
});

/**
 * Six slots. CLAUDE.md section 15.
 *
 * The assertions worth having are the ones about what a slot must NOT do to
 * its neighbours - a save feature whose slots leak into each other is worse
 * than one slot, because the player is relying on it.
 */
describe('slots', () => {
  it('offers one auto slot and five the player writes', () => {
    expect(SLOT_IDS).toHaveLength(MANUAL_SLOTS + 1);
    expect(SLOT_IDS[0]).toBe(AUTO_SLOT);
    expect(listSlots().every((s) => s.empty)).toBe(true);
  });

  it('refuses an id it does not know rather than inventing a slot', () => {
    expect(isSlotId('7')).toBe(false);
    expect(saveTo('7', aRun())).toBe(false);
    expect(loadFrom('7', defaults())).toBeNull();
    expect(deleteSlot('__proto__')).toBe(false);
    expect(hasAnySave()).toBe(false);
  });

  it('keeps slots independent', () => {
    saveTo('1', aRun());
    saveTo('2', { ...aRun(), player: { ...aRun().player, name: 'Other' } });

    expect(loadFrom('1', defaults()).player.name).toBe('Yuhan');
    expect(loadFrom('2', defaults()).player.name).toBe('Other');

    deleteSlot('1');
    expect(peekSlot('1').empty).toBe(true);
    expect(loadFrom('2', defaults()).player.name).toBe('Other');
  });

  it('overwrites a slot in place without touching the others', () => {
    saveTo('1', aRun());
    saveTo('2', aRun());
    saveTo('1', { ...aRun(), run: { ...aRun().run, week: 7 } });

    expect(peekSlot('1').week).toBe(7);
    expect(peekSlot('2').week).toBe(4);
  });

  /**
   * `restart` calls this. The single-slot build wiped the only save there was;
   * under six that would mean starting a new run silently destroys five
   * campaigns the player deliberately kept.
   */
  it('clears the autosave and leaves the player slots alone', () => {
    saveTo(AUTO_SLOT, aRun());
    saveTo('3', aRun());

    clearAuto();

    expect(peekSlot(AUTO_SLOT).empty).toBe(true);
    expect(peekSlot('3').empty).toBe(false);
    expect(hasAnySave()).toBe(true);
  });

  /**
   * A slot has to be legible before it is loaded, or six saves of one campaign
   * are indistinguishable. `focusId` is DERIVED at read time and never stored.
   */
  it('names whoever holds the highest affection without storing it', () => {
    saveTo('1', aRun());

    expect(peekSlot('1').focusId).toBe('irene');
    expect(peekSlot('1').focusAffection).toBe(62);
    expect(JSON.stringify(localStorage.getItem(SAVE_KEY))).not.toContain('focusId');
  });

  it('names nobody when nothing has started', () => {
    saveTo('1', { ...aRun(), relations: Object.fromEntries(MVP_CAST.map((id) => [id, newRelation(0)])) });
    expect(peekSlot('1').focusId).toBeNull();
  });

  /**
   * The migration. A player mid-campaign when this shipped has a bare record
   * under the same key, and must not lose the campaign to a container shape
   * they never asked for.
   */
  it('adopts a single-slot save as the autosave', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave(aRun())));

    expect(peekSlot(AUTO_SLOT).name).toBe('Yuhan');
    expect(loadFrom(AUTO_SLOT, defaults()).run.week).toBe(4);
    expect(listSlots().filter((s) => !s.empty)).toHaveLength(1);
  });

  it('keeps the adopted run when a new slot is written beside it', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave(aRun())));
    saveTo('1', { ...aRun(), player: { ...aRun().player, name: 'Later' } });

    expect(peekSlot(AUTO_SLOT).name).toBe('Yuhan');
    expect(peekSlot('1').name).toBe('Later');
  });
});

describe('everything that can be wrong with a record', () => {
  it('loads nothing rather than throwing on garbage', () => {
    localStorage.setItem(SAVE_KEY, '{ this is not json');
    expect(loadFrom(AUTO_SLOT, defaults())).toBeNull();
    expect(peekSlot(AUTO_SLOT).empty).toBe(true);
    expect(listSlots()).toHaveLength(SLOT_IDS.length);
  });

  it('loads nothing when there is nothing', () => {
    expect(loadFrom(AUTO_SLOT, defaults())).toBeNull();
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
    const back = fromSave({ relations: { irene: { affection: 70 } } }, defaults());

    expect(back.relations.irene.affection).toBe(70);
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

    expect(saveTo(AUTO_SLOT, aRun())).toBe(false);
    expect(loadFrom(AUTO_SLOT, defaults())).toBeNull();
    expect(hasAnySave()).toBe(false);
    expect(peekSlot(AUTO_SLOT).empty).toBe(true);
    expect(() => clearAuto()).not.toThrow();

    // The list still renders: the slot screen must not be the thing that
    // breaks when storage does.
    expect(listSlots()).toHaveLength(SLOT_IDS.length);
  });
});

/**
 * The migration `firedEvents` needed when it gained a cycle.
 *
 * Yuhan has live autosaves on a phone from hand-testing, so this is not a
 * hypothetical: without it, loading one would reschedule every anchor event the
 * player already sat through. The save loads, the run continues, and the
 * concept meeting simply happens twice - the quiet kind of break.
 */
describe('firedEvents survives gaining a cycle', () => {
  const load = (firedEvents) =>
    fromSave(toSave({ ...aRun(), flags: { firedEvents } }), defaults()).flags.firedEvents;

  it('keys an old recurring event to cycle 0, where it happened', () => {
    expect(load(['prep:event_a'])).toEqual(['prep:event_a:0']);
    expect(load(['comeback:event_b'])).toEqual(['comeback:event_b:0']);
  });

  /**
   * The half that a blanket "append :0 to two-part keys" would have got wrong.
   * The cruise and the island are keyed `phase:slot` ON PURPOSE - they fire
   * once in a campaign - so rewriting them would corrupt the two keys that were
   * already correct.
   */
  it('leaves a one-off event alone, because two parts is its real shape', () => {
    expect(load(['rest:event_a'])).toEqual(['rest:event_a']);
    expect(load(['rest:event_b'])).toEqual(['rest:event_b']);
  });

  it('is idempotent, so loading a migrated save again changes nothing', () => {
    const once = load(['prep:event_a', 'rest:event_a']);
    expect(load(once)).toEqual(once);
  });

  it('drops junk rather than throwing', () => {
    expect(load(['prep:event_a', 42, null, 'nonsense'])).toEqual(['prep:event_a:0', 'nonsense']);
    expect(load('not an array')).toEqual([]);
  });
});
