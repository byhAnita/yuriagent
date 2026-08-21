import { describe, it, expect } from 'vitest';
import { buildLineup } from './castBuilder.js';
import { getCast, LIBRARY } from '../data/cast.js';

const cast = getCast();

describe('buildLineup on the MVP cast', () => {
  const lineup = buildLineup(cast);

  it('gives exactly one leader and one maknae', () => {
    const all = Object.values(lineup).flat();
    expect(all.filter((r) => r === 'leader')).toHaveLength(1);
    expect(all.filter((r) => r === 'maknae')).toHaveLength(1);
  });

  it('never assigns the same role twice', () => {
    const all = Object.values(lineup).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('leaves nobody without a role', () => {
    for (const c of cast) expect(lineup[c.id].length).toBeGreaterThan(0);
  });

  it('honours the cards: Irene leads, Yeri is maknae by one month', () => {
    expect(lineup.irene).toContain('leader');
    expect(lineup.yeri).toContain('maknae');
  });

  it('is deterministic', () => {
    expect(buildLineup(cast)).toEqual(buildLineup(cast));
  });
});

describe('buildLineup on an arbitrary five', () => {
  it('works for a cast that shares no real group', () => {
    const other = ['seulgi', 'wendy', 'joy', 'jisoo', 'hyewon'].map((id) => LIBRARY[id]);
    const lineup = buildLineup(other);
    const all = Object.values(lineup).flat();

    expect(all.filter((r) => r === 'leader')).toHaveLength(1);
    expect(new Set(all).size).toBe(all.length);
    for (const c of other) expect(lineup[c.id].length).toBeGreaterThan(0);
  });

  it('makes the youngest the maknae when no card asks for it', () => {
    const noMaknae = ['irene', 'seulgi', 'wendy', 'joy', 'jisoo'].map((id) => LIBRARY[id]);
    // joy 1996-09-03 is the youngest of that set
    expect(buildLineup(noMaknae).joy).toContain('maknae');
  });

  it('handles a two-member cast without duplicating roles', () => {
    const pair = ['irene', 'yeri'].map((id) => LIBRARY[id]);
    const lineup = buildLineup(pair);
    const all = Object.values(lineup).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('returns an empty lineup for an empty cast', () => {
    expect(buildLineup([])).toEqual({});
  });
});
