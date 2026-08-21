import { describe, it, expect } from 'vitest';
import {
  jealousyBand,
  exclusivity,
  jealousyGain,
  decay,
  addJealousy,
  canConvert,
  convert,
  unaddressedStrain,
  sceneModifiers,
} from './jealousy.js';
import { newRelation } from './relationship.js';
import { JEALOUSY_BANDS } from '../config/constants.js';

const rel = (patch) => ({ ...newRelation(50), ...patch });

describe('jealousyBand', () => {
  it('maps the four bands at their boundaries', () => {
    expect(jealousyBand(0)).toBe('calm');
    expect(jealousyBand(24)).toBe('calm');
    expect(jealousyBand(25)).toBe('piqued');
    expect(jealousyBand(49)).toBe('piqued');
    expect(jealousyBand(50)).toBe('sharp');
    expect(jealousyBand(74)).toBe('sharp');
    expect(jealousyBand(75)).toBe('corrosive');
  });
});

describe('exclusivity', () => {
  it('rises monotonically along the stage ladder', () => {
    const ladder = ['stranger', 'colleague', 'good_friends', 'nameless', 'unspoken', 'ours', 'out'];
    const values = ladder.map(exclusivity);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('falls back to neutral for an unknown stage', () => {
    expect(exclusivity('nonsense')).toBe(1);
  });
});

describe('jealousyGain', () => {
  it('is negligible for a stranger and consequential at nameless', () => {
    const stranger = jealousyGain(1, rel({ intimacy: 10, stage: 'stranger' }));
    const deep = jealousyGain(1, rel({ intimacy: 70, stage: 'nameless' }));

    // Assertions are about the SHAPE of the curve, not the current scale
    // factor - that number belongs to balanceSim and is expected to move.
    expect(stranger).toBeLessThan(1);
    expect(deep / stranger).toBeGreaterThan(20);

    // A deeply invested member should need a handful of rumors to reach
    // `piqued`, not two and not thirty.
    const toPiqued = JEALOUSY_BANDS.piqued / deep;
    expect(toPiqued).toBeGreaterThan(2);
    expect(toPiqued).toBeLessThan(12);
  });

  it('scales linearly with rumor weight', () => {
    const r = rel({ intimacy: 60, stage: 'nameless' });
    expect(jealousyGain(2.5, r)).toBeCloseTo(jealousyGain(1, r) * 2.5, 10);
  });

  it('is the mechanism that makes breadth expensive as a route deepens', () => {
    const shallow = jealousyGain(1, rel({ intimacy: 20, stage: 'colleague' }));
    const mid = jealousyGain(1, rel({ intimacy: 45, stage: 'good_friends' }));
    const deep = jealousyGain(1, rel({ intimacy: 90, stage: 'ours' }));
    expect(shallow).toBeLessThan(mid);
    expect(mid).toBeLessThan(deep);
  });
});

describe('decay and accumulation', () => {
  it('decays by the fixed step and floors at zero', () => {
    expect(decay(rel({ jealousy: 12 })).jealousy).toBe(7);
    expect(decay(rel({ jealousy: 2 })).jealousy).toBe(0);
  });

  it('caps accumulation at 100', () => {
    expect(addJealousy(rel({ jealousy: 97 }), 20).jealousy).toBe(100);
  });
});

describe('convert', () => {
  it('only fires inside the piqued band', () => {
    expect(canConvert(rel({ jealousy: 24 }))).toBe(false);
    expect(canConvert(rel({ jealousy: 30 }))).toBe(true);
    expect(canConvert(rel({ jealousy: 60 }))).toBe(false);
  });

  it('turns pressure into closeness', () => {
    const out = convert(rel({ jealousy: 40, intimacy: 50 }));
    expect(out.jealousy).toBe(20);
    expect(out.intimacy).toBe(52);
  });

  it('is a no-op outside the band', () => {
    const input = rel({ jealousy: 70, intimacy: 50 });
    expect(convert(input)).toEqual(input);
  });
});

describe('unaddressedStrain', () => {
  it('charges nothing until sharp', () => {
    expect(unaddressedStrain(rel({ jealousy: 40 }))).toBe(0);
    expect(unaddressedStrain(rel({ jealousy: 55 }))).toBe(3);
    expect(unaddressedStrain(rel({ jealousy: 80 }))).toBe(8);
  });
});

describe('sceneModifiers', () => {
  it('keeps a calm member unmodified and hides her hidden conflict', () => {
    const m = sceneModifiers(rel({ jealousy: 5 }));
    expect(m.guardBonus).toBe(0);
    expect(m.lockedStances).toEqual([]);
    expect(m.revealHiddenConflict).toBe(false);
  });

  it('makes piqued an opportunity rather than a penalty', () => {
    const m = sceneModifiers(rel({ jealousy: 30 }));
    expect(m.probes).toBe(true);
    expect(m.guardBonus).toBe(0);
    expect(m.lockedStances).toEqual([]);
    expect(m.revealHiddenConflict).toBe(true);
  });

  it('raises guard and locks stances from sharp upward', () => {
    const m = sceneModifiers(rel({ jealousy: 60 }));
    expect(m.guardBonus).toBe(15);
    expect(m.lockedStances).toContain('touch');
    expect(m.hostileGroupScene).toBe(false);
    expect(sceneModifiers(rel({ jealousy: 90 })).hostileGroupScene).toBe(true);
  });
});
