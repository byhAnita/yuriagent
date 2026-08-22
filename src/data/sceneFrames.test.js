import { describe, it, expect } from 'vitest';
import {
  REGISTERS,
  DATE_FRAMES,
  PRIVATE_DATE_FRAME,
  dateFrame,
  renderFrame,
} from './sceneFrames.js';
import { PHASES, locationsForRole } from './phaseMaps.js';
import { SCENE_TURN_LIMITS } from '../config/constants.js';

describe('every public venue has a frame', () => {
  it('covers the venue of every phase, so no date opens on nothing', () => {
    for (const phase of PHASES) {
      for (const id of locationsForRole(phase, 'public_date')) {
        expect(DATE_FRAMES[id], `${phase} venue ${id} has no frame`).toBeDefined();
      }
    }
  });

  it('gives the private date one frame, because it is the same room every phase', () => {
    expect(dateFrame('private', 'dorm_room')).toBe(PRIVATE_DATE_FRAME);
    expect(dateFrame('private', null)).toBe(PRIVATE_DATE_FRAME);
  });

  it('returns null rather than throwing for a venue with nothing authored', () => {
    expect(dateFrame('public', 'practice_room')).toBeNull();
  });
});

describe('a frame has a spine', () => {
  const frames = [...Object.values(DATE_FRAMES), PRIVATE_DATE_FRAME];

  it('gives every frame a setting and two to four movements', () => {
    for (const f of frames) {
      expect(f.setting.length).toBeGreaterThan(20);
      expect(f.movements.length).toBeGreaterThanOrEqual(2);
      expect(f.movements.length).toBeLessThanOrEqual(4);
    }
  });

  /**
   * The rule from section 11, and the one most likely to be broken by a content
   * edit: a movement sets the SITUATION, never the OUTCOME. "The walk back, and
   * how long it takes" is a place. "She takes your hand on the walk back" is a
   * branch, which section 1 rules out.
   *
   * This is a smell test rather than a proof - it catches the obvious form of
   * the mistake, which is writing her reaction into the frame.
   */
  it('never writes her reaction into a movement', () => {
    const scripted = /\bshe (takes|kisses|blushes|smiles|leans|admits|confesses|cries|says)\b/i;
    for (const f of frames) {
      for (const m of f.movements) {
        expect(scripted.test(m), `scripted movement: "${m}"`).toBe(false);
      }
    }
  });
});

describe('renderFrame', () => {
  const text = renderFrame(PRIVATE_DATE_FRAME);

  it('offers the movements rather than ordering them', () => {
    expect(text).toContain('may pass through any of these, in any order, or none');
  });

  it('says outright that the outcome is not the frame to decide', () => {
    expect(text).toContain('These are situations, not instructions');
  });

  it('never numbers the movements - a numbered list gets marched through', () => {
    expect(text).not.toMatch(/^\s*1[.)]/m);
  });

  it('returns null for no frame rather than an empty block', () => {
    expect(renderFrame(null)).toBeNull();
  });
});

describe('registers', () => {
  it('leaves the ordinary scene terse, per pillar 1', () => {
    expect(REGISTERS.ordinary).toBeNull();
  });

  it('gives a date and an event a literary register', () => {
    for (const kind of ['date', 'event']) {
      expect(REGISTERS[kind]).toContain('Literary and sensory');
      expect(REGISTERS[kind]).toContain('atmosphere');
    }
  });

  it('gives a whole-day scene a longer budget than a block', () => {
    expect(SCENE_TURN_LIMITS.date).toBeGreaterThan(SCENE_TURN_LIMITS.ordinary);
    expect(SCENE_TURN_LIMITS.event).toBeGreaterThan(SCENE_TURN_LIMITS.ordinary);
  });
});
