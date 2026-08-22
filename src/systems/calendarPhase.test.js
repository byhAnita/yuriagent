import { describe, it, expect } from 'vitest';
import {
  generateWeek,
  occupancyAt,
  eventDays,
  roomRoutine,
  workDays,
  isWeekend,
  WORK_BLOCKS,
  EVENING,
} from './calendar.js';
import { PHASES, mapFor, eventSlots, resolveSlot } from '../data/phaseMaps.js';
import { LOCATIONS } from '../data/locations.js';
import { getCast } from '../data/cast.js';
import { BLOCKS, DAYS_PER_WEEK } from '../config/constants.js';

const cards = getCast();
const SEED = 'phase-seed';

describe('the event day is placed first and takes the whole day', () => {
  it('books one weekday in PREP and two in the other phases', () => {
    for (const phase of PHASES) {
      const days = eventDays({ phase, seed: SEED });
      expect(days).toHaveLength(eventSlots(phase).length);
      for (const e of days) expect(isWeekend(e.day)).toBe(false);
    }
  });

  it('never books two events on the same day', () => {
    for (const phase of PHASES) {
      const days = eventDays({ phase, seed: SEED }).map((e) => e.day);
      expect(new Set(days).size).toBe(days.length);
    }
  });

  it('drops an event once it has fired', () => {
    const fired = ['comeback:event_a'];
    const left = eventDays({ phase: 'comeback', seed: SEED, fired });
    expect(left).toHaveLength(1);
    expect(left[0].slot).toBe('event_b');
  });

  it('schedules no group or solo work on an event day', () => {
    for (const phase of PHASES) {
      const plan = generateWeek({ phase, cards, seed: SEED });
      const taken = new Set(plan.events.map((e) => e.day));

      for (const slot of plan.group) expect(taken.has(slot.day)).toBe(false);
      for (const slots of Object.values(plan.members)) {
        for (const slot of slots) expect(taken.has(slot.day)).toBe(false);
      }
    }
  });

  it('puts the whole cast at the event, all day', () => {
    const plan = generateWeek({ phase: 'comeback', cards, seed: SEED });
    const event = plan.events[0];

    for (const block of BLOCKS) {
      const occ = occupancyAt(plan, { day: event.day, block, cards, seed: SEED });
      for (const c of cards) {
        expect(occ[c.id].locationId).toBe(event.location);
        expect(occ[c.id].layer).toBe('event');
      }
    }
  });
});

/**
 * Section 10's phase table is a claim about co-presence. A flat density cannot
 * deliver it - COMEBACK is the week everyone is in the same rooms under maximum
 * visibility, and REST is the week the group layer stops entirely.
 */
describe('group density is phase-scoped', () => {
  const count = (phase) => generateWeek({ phase, cards, seed: SEED }).group.length;

  it('gives REST no group activity at all', () => {
    expect(count('rest')).toBe(0);
  });

  it('gives COMEBACK more co-presence than PREP', () => {
    expect(count('comeback')).toBeGreaterThan(count('prep'));
  });

  it('never books more group slots than there are open work blocks', () => {
    for (const phase of PHASES) {
      const plan = generateWeek({ phase, cards, seed: SEED });
      const open = (workDays().length - plan.events.length) * WORK_BLOCKS.length;
      expect(plan.group.length).toBeLessThanOrEqual(open);
    }
  });
});

/**
 * The cast gets off work. A workroom after hours is reliably empty, which is
 * what makes it a dependable fallback - and a dependable fallback is what makes
 * the unreliable options feel like a search rather than a lottery.
 */
describe('evenings are free', () => {
  it('schedules no group or solo work in an evening block', () => {
    for (const phase of PHASES) {
      const plan = generateWeek({ phase, cards, seed: SEED });
      for (const slot of plan.group) expect(slot.block).not.toBe(EVENING);
      for (const slots of Object.values(plan.members)) {
        for (const slot of slots) expect(slot.block).not.toBe(EVENING);
      }
    }
  });

  it('leaves the workrooms empty after hours on an ordinary day', () => {
    for (const phase of PHASES) {
      const plan = generateWeek({ phase, cards, seed: SEED });
      const eventDaySet = new Set(plan.events.map((e) => e.day));
      const workrooms = ['workroom_a', 'workroom_b'].map((s) => resolveSlot(phase, s));

      for (const day of workDays()) {
        if (eventDaySet.has(day)) continue;
        const occ = occupancyAt(plan, { day, block: EVENING, cards, seed: SEED });
        for (const c of cards) expect(workrooms).not.toContain(occ[c.id].locationId);
      }
    }
  });
});

describe('her room is a routine, not a die roll', () => {
  it('gives her one or two evenings a week', () => {
    for (const c of cards) {
      const nights = roomRoutine({ cardId: c.id, phase: 'prep', seed: SEED });
      expect(nights.length).toBeGreaterThanOrEqual(1);
      expect(nights.length).toBeLessThanOrEqual(2);
    }
  });

  it('is the same every time it is asked, so the player can learn it', () => {
    const a = roomRoutine({ cardId: 'irene', phase: 'prep', seed: SEED });
    const b = roomRoutine({ cardId: 'irene', phase: 'prep', seed: SEED });
    expect(a).toEqual(b);
  });

  it('sends nobody home during COMEBACK', () => {
    for (const c of cards) {
      expect(roomRoutine({ cardId: c.id, phase: 'comeback', seed: SEED })).toEqual([]);
    }
  });

  it('only ever puts her there in the evening', () => {
    const plan = generateWeek({ phase: 'rest', cards, seed: SEED });
    for (let day = 0; day < DAYS_PER_WEEK; day++) {
      for (const block of WORK_BLOCKS) {
        const occ = occupancyAt(plan, { day, block, cards, seed: SEED });
        for (const c of cards) expect(occ[c.id].layer).not.toBe('routine');
      }
    }
  });
});

/**
 * The invariant that broke when the idle pool became phase-scoped: a member has
 * to be SOMEWHERE at every moment, and a slot the phase does not fill used to
 * resolve to null and drop her off the map.
 */
describe('everyone is always somewhere on this phase map', () => {
  it('never resolves a member to a location that does not exist', () => {
    for (const phase of PHASES) {
      const plan = generateWeek({ phase, cards, seed: SEED });
      for (let day = 0; day < DAYS_PER_WEEK; day++) {
        for (const block of BLOCKS) {
          const occ = occupancyAt(plan, { day, block, cards, seed: SEED });
          for (const c of cards) {
            expect(LOCATIONS[occ[c.id].locationId], `${phase} d${day} ${block}`).toBeDefined();
          }
        }
      }
    }
  });

  it('keeps the whole cast on the reachable map, so nobody is unfindable', () => {
    for (const phase of PHASES) {
      const plan = generateWeek({ phase, cards, seed: SEED });
      const reachable = mapFor(phase);
      for (let day = 0; day < DAYS_PER_WEEK; day++) {
        for (const block of BLOCKS) {
          const occ = occupancyAt(plan, { day, block, cards, seed: SEED });
          for (const c of cards) {
            expect(reachable, `${phase} d${day} ${block}`).toContain(occ[c.id].locationId);
          }
        }
      }
    }
  });

  it('carries its own phase so a caller cannot resolve against the wrong map', () => {
    const plan = generateWeek({ phase: 'rest', cards, seed: SEED });
    expect(plan.phase).toBe('rest');
    // No phase passed: it must still resolve against REST, not a default.
    const withOut = occupancyAt(plan, { day: 0, block: EVENING, cards, seed: SEED });
    const withIn = occupancyAt(plan, { day: 0, block: EVENING, cards, seed: SEED, phase: 'rest' });
    expect(withOut).toEqual(withIn);
  });
});
