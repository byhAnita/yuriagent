/**
 * The style pools. PROPOSALS 24.
 *
 * The bug this module exists to prevent is a REPEAT, so the assertions that
 * matter are all about difference: different across the cycles of one run,
 * different across runs, and identical when asked the same question twice.
 * Everything here runs with no model and no UI, which is the argument for
 * building the pools before the stakes clause.
 */

import { describe, it, expect } from 'vitest';
import {
  SOUND,
  OCCASION,
  PLACE,
  comebackStyle,
  renderPressure,
} from './comebackStyle.js';
import { CYCLES_PER_CAMPAIGN } from '../config/constants.js';

const AXES = ['sound', 'occasion', 'place'];
const POOLS = { sound: SOUND, occasion: OCCASION, place: PLACE };

describe('the pools themselves', () => {
  it('outlast a campaign on every axis', () => {
    for (const axis of AXES) {
      expect(POOLS[axis].length).toBeGreaterThanOrEqual(CYCLES_PER_CAMPAIGN);
    }
  });

  it('holds no duplicates', () => {
    for (const axis of AXES) {
      expect(new Set(POOLS[axis]).size).toBe(POOLS[axis].length);
    }
  });

  /**
   * Section 21: no non-ASCII in source. These are prompt content and never
   * localized (section 19), so a smart quote here is a bug rather than a style
   * choice - and one arrived in this file's first draft as an apostrophe.
   */
  it('is ASCII, because it is model-facing English', () => {
    for (const axis of AXES) {
      for (const entry of POOLS[axis]) {
        expect(entry).toMatch(/^[\x20-\x7E]+$/);
      }
    }
  });
});

describe('the draw', () => {
  it('is deterministic in (seed, cycle)', () => {
    expect(comebackStyle(42, 1)).toEqual(comebackStyle(42, 1));
  });

  /**
   * THE POINT OF THE WHOLE MODULE.
   *
   * An independent per-cycle draw from an eight-entry pool collides about a
   * third of the time across three cycles, and a collision is precisely the
   * defect this answers. Without replacement, it cannot happen at all - so the
   * assertion is over many seeds rather than one, because "usually different"
   * and "never the same" are what separate this from the thing it replaced.
   */
  it('never repeats itself inside one campaign', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      for (const axis of AXES) {
        const seen = new Set();
        for (let cycle = 0; cycle < CYCLES_PER_CAMPAIGN; cycle += 1) {
          seen.add(comebackStyle(seed, cycle)[axis]);
        }
        expect(seen.size).toBe(CYCLES_PER_CAMPAIGN);
      }
    }
  });

  it('gives different runs different comebacks', () => {
    const first = new Set();
    for (let seed = 0; seed < 40; seed += 1) {
      first.add(JSON.stringify(comebackStyle(seed, 0)));
    }
    expect(first.size).toBeGreaterThan(10);
  });

  it('draws from the pools and nowhere else', () => {
    for (let cycle = 0; cycle < CYCLES_PER_CAMPAIGN; cycle += 1) {
      const style = comebackStyle(7, cycle);
      for (const axis of AXES) expect(POOLS[axis]).toContain(style[axis]);
    }
  });

  it('does not fall over on a cycle past the campaign', () => {
    expect(() => comebackStyle(7, 9)).not.toThrow();
    expect(comebackStyle(7, 9).sound).toBeTruthy();
  });
});

describe('what reaches the model', () => {
  /**
   * A prompt that says `{jazz, christmas, forest}` produces a room reciting
   * three nouns. The pools have to arrive as things somebody OUTSIDE the room
   * wants, so the room still has something to argue with - the same rule the
   * agenda follows.
   */
  it('is sentences, not a list of nouns', () => {
    const lines = renderPressure(comebackStyle(3, 0));
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line).toMatch(/^[A-Z].*\.$/);
      expect(line.split(' ').length).toBeGreaterThan(5);
    }
  });

  it('carries every drawn value', () => {
    const style = comebackStyle(3, 2);
    const text = renderPressure(style).join('\n');
    for (const axis of AXES) expect(text).toContain(style[axis]);
  });

  it('says nothing when there is nothing to say', () => {
    expect(renderPressure(null)).toEqual([]);
  });
});
