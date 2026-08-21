/**
 * Block 4 standing. CLAUDE.md sections 7 and 8.
 *
 * Without this the model writes every scene at the same emotional distance,
 * which is the most obvious way a generated line reads as canned - the same
 * gift from a colleague and from someone at `unspoken` came back as the same
 * sentence, because nothing in the prompt distinguished them.
 */

import { describe, it, expect } from 'vitest';
import { buildSceneHeader, standingLine, STANDING } from './promptBuilder.js';
import { newRelation, resolveStage } from '../systems/relationship.js';

const rel = (intimacy, admissibility = 0, extra = {}) => ({
  ...newRelation(intimacy),
  admissibility,
  stage: resolveStage(intimacy, admissibility),
  ...extra,
});

const header = (relations, roster = [{ id: 'irene', name: 'Irene' }]) =>
  buildSceneHeader({
    roster,
    absent: [],
    week: 0,
    day: 1,
    block: 'evening',
    phase: 'prep',
    locationLabel: 'X Practice Room',
    exposure: 20,
    relations,
    player: { energy: 80 },
  });

describe('the header says where the two of you stand', () => {
  it('names a standing for every stage the map can actually produce', () => {
    const reachable = new Set();
    for (let i = 0; i <= 100; i += 1) {
      for (let a = 0; a <= 100; a += 1) reachable.add(resolveStage(i, a));
    }
    expect(reachable.size).toBeGreaterThan(6);
    for (const stage of reachable) {
      expect(STANDING[stage], `no standing sentence for stage "${stage}"`).toBeTruthy();
    }
  });

  it('says something different at colleague and at unspoken', () => {
    const early = header({ irene: rel(20) });
    const late = header({ irene: rel(80, 50) });
    expect(early).not.toBe(late);
    expect(early).toContain('colleague');
    expect(late).toContain('Neither of them has said it out loud');
  });

  /**
   * Numbers in the header invite the model to narrate the number, and section 9
   * forbids numbers in the prose. A sentence cannot be quoted back.
   */
  it('states no numbers', () => {
    const line = standingLine('Irene', rel(72, 45));
    expect(/\d/.test(line)).toBe(false);
  });

  it('only describes members who are present', () => {
    const relations = { irene: rel(70), yeri: rel(70) };
    const out = header(relations);
    expect(out).toContain('Irene');
    expect(out).not.toContain('Yeri put a name to');
  });

  /**
   * Same coordinates, different scene (section 5). Bottom-left with a high
   * peak is Aftermath, not Stranger, and she has to be written that way.
   */
  it('distinguishes never-started from fallen-back', () => {
    const fresh = standingLine('Irene', rel(20));
    const after = standingLine('Irene', rel(20, 0, { peakIntimacy: 70 }));
    expect(after).not.toBe(fresh);
    expect(after).toContain('closer than this once');
  });

  it('survives a relation with no cached stage', () => {
    const bare = { intimacy: 60, admissibility: 30, jealousy: 0, peakIntimacy: 60 };
    expect(standingLine('Irene', bare)).toContain('put a name to');
  });
});
