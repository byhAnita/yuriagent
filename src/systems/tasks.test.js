import { describe, it, expect } from 'vitest';
import { TASKS, generateDayTask, canAttempt } from './tasks.js';
import { SLOTS, PHASES, resolveSlot, hasRole, mapFor } from '../data/phaseMaps.js';
import { workDays } from './calendar.js';

const identity = { taskPool: Object.keys(TASKS) };
const args = { identity, seed: 'task-seed', week: 0 };

/**
 * The bug this file exists to prevent.
 *
 * Tasks used to name a location id. Three of the five pointed at `corridor` or
 * `broadcast_studio` - neither of which is an ordinary room in every phase once
 * the map rotates - so the phase-map work would have shipped a daily objective
 * the player could not reach, on a majority of days, with nothing failing.
 */
describe('a task names a slot, not a room', () => {
  it('declares a slot and never a bare location', () => {
    for (const [id, task] of Object.entries(TASKS)) {
      expect(SLOTS[task.slot], `${id} names an undeclared slot`).toBeDefined();
      expect(task.location, `${id} still hardcodes a location`).toBeUndefined();
    }
  });

  it('only ever uses a slot that can carry a task', () => {
    for (const [id, task] of Object.entries(TASKS)) {
      for (const phase of PHASES) {
        const where = resolveSlot(phase, task.slot);
        if (!where) continue;
        expect(hasRole(phase, where, 'task'), `${id} in ${phase} lands on ${where}`).toBe(true);
      }
    }
  });

  it('resolves the same task to a different room in each phase', () => {
    const where = (phase) => resolveSlot(phase, TASKS.prep_outfits.slot);
    expect(where('prep')).toBe('wardrobe');
    expect(where('comeback')).toBe('makeup_room');
    expect(where('rest')).toBe('photo_studio');
  });
});

describe('generateDayTask', () => {
  it('always lands somewhere on this phase reachable map', () => {
    for (const phase of PHASES) {
      const reachable = mapFor(phase);
      for (const day of workDays()) {
        const task = generateDayTask({ ...args, phase, day });
        expect(task.location, `${phase} day ${day}: ${task.taskId}`).toBeTruthy();
        expect(reachable).toContain(task.location);
      }
    }
  });

  it('gives no task at the weekend', () => {
    expect(generateDayTask({ ...args, phase: 'prep', day: 5 })).toBeNull();
    expect(generateDayTask({ ...args, phase: 'prep', day: 6 })).toBeNull();
  });

  it('is deterministic for the same seed and moment', () => {
    const a = generateDayTask({ ...args, phase: 'prep', day: 1 });
    const b = generateDayTask({ ...args, phase: 'prep', day: 1 });
    expect(a).toEqual(b);
  });

  it('never offers a task whose slot this phase does not fill', () => {
    // A pool of one unplaceable task must not produce an unreachable objective.
    const only = { taskPool: ['handle_press_kit'] };
    for (const phase of PHASES) {
      const task = generateDayTask({ ...args, identity: only, phase, day: 0 });
      expect(mapFor(phase)).toContain(task.location);
    }
  });
});

describe('canAttempt', () => {
  it('only lets the task be discharged where it lives', () => {
    const task = generateDayTask({ ...args, phase: 'prep', day: 0 });
    expect(canAttempt(task, task.location)).toBe(true);
    expect(canAttempt(task, 'dorm_player_room')).toBe(false);
  });

  it('is false with no task at all', () => {
    expect(canAttempt(null, 'wardrobe')).toBe(false);
  });
});
