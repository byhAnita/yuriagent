import { describe, it, expect } from 'vitest';
import {
  newPool,
  openScene,
  appendRound,
  closeScene,
  noteScene,
  poolEntries,
  roundCount,
  fromSave,
  toSave,
  HISTORY_FULL_MAX,
} from './pool.js';
import { buildTier2 } from './tiers.js';

/** Play one whole scene, so the tests read like the engine does. */
function playScene(pool, id, rounds, summary) {
  let next = openScene(pool, { id, label: 'practice room' });
  for (let i = 0; i < rounds; i += 1) {
    next = appendRound(next, { text: `${id} round ${i + 1}`, choice: `choice ${i + 1}` });
  }
  return closeScene(next, { summary });
}

describe('the pool', () => {
  it('keeps the open scene visible round by round', () => {
    let pool = openScene(newPool(), { id: 's1' });
    pool = appendRound(pool, { text: 'she does not look up', choice: 'wait' });
    pool = appendRound(pool, { text: 'she looks up' });

    expect(roundCount(pool)).toBe(2);
    expect(poolEntries(pool)).toEqual([
      { id: 's1.1', type: 'full', text: 'she does not look up', choice: 'wait' },
      { id: 's1.2', type: 'full', text: 'she looks up', choice: null },
    ]);
  });

  it('ignores an empty round rather than storing a blank', () => {
    let pool = openScene(newPool(), { id: 's1' });
    pool = appendRound(pool, { text: '   ' });
    expect(roundCount(pool)).toBe(0);
  });

  /**
   * The window itself. Three closed scenes stay full; the fourth collapses the
   * three below it and keeps only itself.
   */
  it('collapses in place when one scene too many closes', () => {
    let pool = newPool();
    for (let i = 1; i <= HISTORY_FULL_MAX; i += 1) {
      pool = playScene(pool, `s${i}`, 2, `summary ${i}`);
    }
    expect(pool.closed.every((s) => s.type === 'full')).toBe(true);

    pool = playScene(pool, 's4', 2, 'summary 4');

    expect(pool.closed.map((s) => s.type)).toEqual(['summary', 'summary', 'summary', 'full']);
    expect(pool.closed.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4']);
  });

  /**
   * The reason the window exists. Everything before the newest scene has to be
   * byte-identical across a round, or tier 2 is a miss on every call.
   */
  it('leaves the rendered prefix untouched when a round is appended', () => {
    let pool = playScene(newPool(), 's1', 2, 'they talked');
    pool = openScene(pool, { id: 's2' });
    pool = appendRound(pool, { text: 'first', choice: 'a' });

    const before = buildTier2(poolEntries(pool));
    pool = appendRound(pool, { text: 'second', choice: 'b' });
    const after = buildTier2(poolEntries(pool));

    expect(after.startsWith(before)).toBe(true);
  });

  it('never reorders or drops a scene, only rewrites it in place', () => {
    let pool = newPool();
    for (let i = 1; i <= HISTORY_FULL_MAX + 2; i += 1) {
      pool = playScene(pool, `s${i}`, 1, `summary ${i}`);
    }
    expect(pool.closed.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4', 's5']);
    // A collapsed scene keeps its sentence and gives up its rounds.
    expect(pool.closed[0]).toMatchObject({ type: 'summary', summary: 'summary 1', rounds: [] });
  });

  /**
   * A model that forgets `sum|` costs one line of history, not the window. If
   * the scene stayed full forever the pool would grow without bound.
   */
  it('closes a scene with no summary rather than leaving it open', () => {
    let pool = openScene(newPool(), { id: 's1', label: 'wardrobe' });
    pool = appendRound(pool, { text: 'something happened' });
    pool = closeScene(pool, {});

    expect(pool.current).toBe(null);
    expect(pool.closed[0].summary).toContain('wardrobe');
  });

  it('closes an abandoned scene when a new one opens', () => {
    let pool = openScene(newPool(), { id: 's1' });
    pool = appendRound(pool, { text: 'walked out halfway' });
    pool = openScene(pool, { id: 's2' });

    expect(pool.closed).toHaveLength(1);
    expect(pool.current.id).toBe('s2');
  });

  /**
   * An afternoon of tidying the wardrobe must not push a scene with her out of
   * the window. A note is born collapsed and never occupies a full slot.
   */
  it('records solo work as one line that never costs a full slot', () => {
    let pool = newPool();
    for (let i = 0; i < 4; i += 1) {
      pool = noteScene(pool, { id: `n${i}`, summary: `you tidied the wardrobe (${i})` });
    }
    expect(pool.closed).toHaveLength(4);
    expect(pool.closed.every((s) => s.type === 'summary')).toBe(true);

    pool = playScene(pool, 's1', 2, 'they talked');
    expect(pool.closed.filter((s) => s.type === 'full')).toHaveLength(1);
    expect(poolEntries(pool).filter((e) => e.type === 'full')).toHaveLength(2);
  });

  it('ignores a note with nothing in it', () => {
    expect(noteScene(newPool(), { summary: '  ' }).closed).toHaveLength(0);
  });

  it('round-trips through a save, and survives a broken one', () => {
    const pool = playScene(newPool(), 's1', 2, 'they talked');
    expect(fromSave(toSave(pool)).closed).toEqual(pool.closed);
    expect(fromSave(null)).toEqual(newPool());
    expect(fromSave({ closed: 'nonsense' })).toEqual(newPool());
  });

  /** A save taken mid-scene is a save taken at the room door (section 15). */
  it('drops an open scene on load', () => {
    let pool = openScene(newPool(), { id: 's1' });
    pool = appendRound(pool, { text: 'mid-scene' });
    expect(fromSave(toSave(pool)).current).toBe(null);
  });
});
