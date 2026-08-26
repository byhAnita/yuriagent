import { describe, it, expect } from 'vitest';
import { applyDeltas, newBudget } from './values.js';
import { DELTA_MAX, SCENE_DELTA_MAX } from '../config/rules.js';
import { RISK_EXPOSURE_THRESHOLD } from '../config/constants.js';

const LOW = RISK_EXPOSURE_THRESHOLD - 20;
const HIGH = RISK_EXPOSURE_THRESHOLD + 10;

function rel(affection = 10, admissibility = 0) {
  return { irene: { affection, admissibility }, nana: { affection: 5, admissibility: 0 } };
}

const base = { present: ['irene'], player: { selfId: 40, mood: 55, secrecy: 70 } };

describe('applying what the model asked for', () => {
  it('moves affection by what it said', () => {
    const out = applyDeltas({ ...base, relations: rel(), deltas: { irene: 2 }, exposure: LOW });
    expect(out.relations.irene.affection).toBe(12);
    expect(out.relations.irene.peakAffection).toBe(12);
  });

  it('bounds a round to the delta max, however hot the model runs', () => {
    const out = applyDeltas({ ...base, relations: rel(), deltas: { irene: 9 }, exposure: LOW });
    expect(out.relations.irene.affection).toBe(10 + DELTA_MAX);
  });

  it('moves nothing at all on the first round of a scene', () => {
    const out = applyDeltas({
      ...base,
      relations: rel(),
      deltas: { irene: 2, mood: 1 },
      exposure: HIGH,
      first: true,
    });
    expect(out.relations.irene.affection).toBe(10);
    expect(out.player.mood).toBe(55);
    expect(out.applied).toEqual({});
  });

  /** Part I.9. The model picks the number; the world says nobody saw that. */
  it('refuses an admissibility RISE at low exposure', () => {
    const out = applyDeltas({
      ...base,
      relations: rel(),
      deltas: { irene_adm: 2 },
      exposure: LOW,
    });
    expect(out.relations.irene.admissibility).toBe(0);
    expect(out.refused).toContain('irene_adm');
  });

  it('allows the same rise once somebody could have seen it', () => {
    const out = applyDeltas({
      ...base,
      relations: rel(),
      deltas: { irene_adm: 2 },
      exposure: HIGH,
    });
    expect(out.relations.irene.admissibility).toBe(2);
    expect(out.relations.irene.peakAdmissibility).toBe(2);
  });

  /** Something can go wrong in private. The veto is on the rise only. */
  it('lets admissibility FALL at low exposure', () => {
    const out = applyDeltas({
      ...base,
      relations: rel(10, 30),
      deltas: { irene_adm: -2 },
      exposure: LOW,
    });
    expect(out.relations.irene.admissibility).toBe(28);
  });

  /** Part I.8. A rumor waits in her dossier until she is in front of the player. */
  it('drops a member who is not in the room', () => {
    const out = applyDeltas({ ...base, relations: rel(), deltas: { nana: 2 }, exposure: HIGH });
    expect(out.relations.nana.affection).toBe(5);
    expect(out.refused).toContain('nana');
  });

  it('moves the player without asking who is in the room', () => {
    const out = applyDeltas({
      ...base,
      present: [],
      relations: rel(),
      deltas: { mood: -2, selfId: 1 },
      exposure: LOW,
    });
    expect(out.player.mood).toBe(53);
    expect(out.player.selfId).toBe(41);
  });

  it('ignores a value nobody has', () => {
    const out = applyDeltas({ ...base, relations: rel(), deltas: { strain: 2 }, exposure: HIGH });
    expect(out.applied).toEqual({});
    expect(out.refused).toContain('strain');
  });

  /**
   * The scene budget. Clamping a total is the same kind of rule as clamping to
   * 0-100 - it bounds, it does not choose.
   */
  it('clamps the scene total across rounds, per member per axis', () => {
    const budget = newBudget();
    let relations = rel();
    for (let i = 0; i < 6; i += 1) {
      ({ relations } = applyDeltas({
        ...base,
        relations,
        deltas: { irene: 2 },
        exposure: LOW,
        budget,
      }));
    }
    expect(relations.irene.affection).toBe(10 + SCENE_DELTA_MAX);
  });

  it('keeps the two axes on separate budgets', () => {
    const budget = newBudget();
    let relations = rel();
    for (let i = 0; i < 6; i += 1) {
      ({ relations } = applyDeltas({
        ...base,
        relations,
        deltas: { irene: 2, irene_adm: 2 },
        exposure: HIGH,
        budget,
      }));
    }
    expect(relations.irene.affection).toBe(10 + SCENE_DELTA_MAX);
    expect(relations.irene.admissibility).toBe(SCENE_DELTA_MAX);
  });

  it('lets a spent budget be walked back the other way', () => {
    const budget = newBudget();
    let relations = rel();
    for (let i = 0; i < 4; i += 1) {
      ({ relations } = applyDeltas({ ...base, relations, deltas: { irene: 2 }, exposure: LOW, budget }));
    }
    expect(relations.irene.affection).toBe(16);
    ({ relations } = applyDeltas({ ...base, relations, deltas: { irene: -2 }, exposure: LOW, budget }));
    expect(relations.irene.affection).toBe(14);
  });

  it('never leaves a value outside 0-100', () => {
    const out = applyDeltas({ ...base, relations: rel(1), deltas: { irene: -2 }, exposure: LOW });
    expect(out.relations.irene.affection).toBe(0);
  });

  it('does not mutate what it was given', () => {
    const relations = rel();
    const player = { ...base.player };
    applyDeltas({ ...base, relations, player, deltas: { irene: 2, mood: 2 }, exposure: LOW });
    expect(relations.irene.affection).toBe(10);
    expect(player.mood).toBe(55);
  });
});
