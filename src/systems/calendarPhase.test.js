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
import { eventFor, eventKey, firesInCycle } from '../data/events/index.js';
import { LOCATIONS } from '../data/locations.js';
import { getCast } from '../data/cast.js';
import { BLOCKS, DAYS_PER_WEEK } from '../config/constants.js';

const cards = getCast();
const SEED = 'phase-seed';

describe('the event day is placed first and takes the whole day', () => {
  /**
   * Week 0 is cycle 0, and REST's two are authored for cycles 1 and 2 - so the
   * first rest week books nothing, which is deliberate (PROPOSALS 20: the rest
   * week is the repair week). The count is derived from what actually fires
   * rather than from `eventSlots`, because those are now different questions.
   */
  it('books a weekday for every event that fires this cycle', () => {
    for (const phase of PHASES) {
      const firing = eventSlots(phase).filter((slot) => firesInCycle(eventFor(phase, slot), 0));
      const days = eventDays({ phase, seed: SEED });
      expect(days, phase).toHaveLength(firing.length);
      for (const e of days) expect(isWeekend(e.day)).toBe(false);
    }
  });

  /**
   * The four working-cycle events come back; the cruise and the island do not.
   * Six events in the catalogue, fourteen event days in a campaign.
   */
  it('brings the working-cycle events back every cycle', () => {
    for (const cycle of [0, 1, 2]) {
      const week = cycle * PHASES.length;
      expect(eventDays({ phase: 'prep', seed: SEED, week }).map((e) => e.slot).sort()).toEqual([
        'event_a',
        'event_b',
      ]);
      expect(eventDays({ phase: 'comeback', seed: SEED, week: week + 1 }).map((e) => e.slot).sort())
        .toEqual(['event_a', 'event_b']);
    }
  });

  it('places each one-off in the cycle it was authored for, and nowhere else', () => {
    const restSlotsIn = (cycle) =>
      eventDays({ phase: 'rest', seed: SEED, week: cycle * PHASES.length + 2 }).map((e) => e.slot);

    expect(restSlotsIn(0)).toEqual([]);
    expect(restSlotsIn(1)).toEqual(['event_a']); // the cruise
    expect(restSlotsIn(2)).toEqual(['event_b']); // the island, in the last week
  });

  it('never books two events on the same day', () => {
    for (const phase of PHASES) {
      const days = eventDays({ phase, seed: SEED }).map((e) => e.day);
      expect(new Set(days).size).toBe(days.length);
    }
  });

  it('drops an event once it has fired', () => {
    const fired = [eventKey('comeback', 'event_a', 0)];
    const left = eventDays({ phase: 'comeback', seed: SEED, week: 1, fired });
    expect(left).toHaveLength(1);
    expect(left[0].slot).toBe('event_b');
  });

  /**
   * The point of keying by cycle: playing the first Music Bank must not cancel
   * the second one. This is the assertion the whole step exists for.
   */
  it('drops it only for the cycle it fired in', () => {
    const fired = [eventKey('comeback', 'event_a', 0)];
    const nextCycle = eventDays({ phase: 'comeback', seed: SEED, week: 4, fired });
    expect(nextCycle.map((e) => e.slot).sort()).toEqual(['event_a', 'event_b']);
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

/**
 * A SHIPPED BUG, found in step 2 of PROPOSALS 20 and fixed there.
 *
 * `eventDays` filtered the slots and then took that many days off the shuffle,
 * so a slot's day depended on how many slots were still unfired - and firing
 * one MOVED the other onto the day the first had just used. Since an event
 * consumes its whole day, that day is always in the past by the time anyone
 * looks again, so the second event of a phase silently never fired:
 *
 *   the fan meeting was unreachable once Music Bank had been played,
 *   and the island trip once the cruise had.
 *
 * Nobody saw it because PREP was the only phase hand-tested and it had one
 * slot, and because the harness did not consume the rest of an event day - it
 * was still standing in the same "today" when the plan reshuffled, and walked
 * into the relocated event a block later. One bug hid the other.
 */
describe('firing one event does not move the other', () => {
  it('keeps every remaining event on the day it was already on', () => {
    for (const phase of PHASES) {
      for (const week of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
        const before = eventDays({ phase, seed: SEED, week });
        if (before.length < 2) continue;

        const cycle = Math.floor(week / PHASES.length);
        const fired = [eventKey(phase, before[0].slot, cycle)];
        const after = eventDays({ phase, seed: SEED, week, fired });

        expect(after).toHaveLength(before.length - 1);
        for (const e of after) {
          const was = before.find((b) => b.slot === e.slot);
          expect(e.day, `${phase} w${week} ${e.slot} moved`).toBe(was.day);
        }
      }
    }
  });

  /**
   * The consequence, stated as the thing the player actually cares about:
   * play the first event of a phase and the second is still ahead of you.
   */
  it('leaves the second event on a day that has not happened yet', () => {
    const week = 1; // a comeback week, two events
    const [first, second] = eventDays({ phase: 'comeback', seed: SEED, week });
    const earlier = first.day < second.day ? first : second;
    const later = first.day < second.day ? second : first;

    const fired = [eventKey('comeback', earlier.slot, 0)];
    const left = eventDays({ phase: 'comeback', seed: SEED, week, fired });

    expect(left).toHaveLength(1);
    expect(left[0].slot).toBe(later.slot);
    expect(left[0].day).toBeGreaterThan(earlier.day);
  });
});
