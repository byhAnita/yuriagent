import { describe, it, expect } from 'vitest';
import {
  generateWeek,
  occupancyAt,
  eventWindows,
  summarizeWeek,
  isWeekend,
  workDays,
  WEEKEND_DAYS,
} from './calendar.js';
import { generateDayTask } from './tasks.js';
import { getCast } from '../data/cast.js';
import { LOCATIONS } from '../data/locations.js';
import { BLOCKS, DAYS_PER_WEEK } from '../config/constants.js';

const cards = getCast();
const SEED = 20260821;

describe('the weekend is protected', () => {
  it('names Saturday and Sunday', () => {
    expect(WEEKEND_DAYS).toEqual([5, 6]);
    expect(isWeekend(4)).toBe(false);
    expect(isWeekend(5)).toBe(true);
    expect(isWeekend(6)).toBe(true);
    expect(workDays()).toEqual([0, 1, 2, 3, 4]);
  });

  it('schedules no group activity at the weekend, in any phase', () => {
    for (const phase of ['prep', 'comeback', 'rest']) {
      const plan = generateWeek({ phase, cards, seed: SEED });
      expect(plan.group.every((s) => !isWeekend(s.day))).toBe(true);
    }
  });

  it('schedules no solo activity at the weekend, in any phase', () => {
    for (const phase of ['prep', 'comeback', 'rest']) {
      const plan = generateWeek({ phase, cards, seed: SEED });
      for (const slots of Object.values(plan.members)) {
        expect(slots.every((s) => !isWeekend(s.day))).toBe(true);
      }
    }
  });

  it('assigns no daily task at the weekend', () => {
    const identity = { taskPool: ['prep_outfits', 'run_schedule'] };
    for (const day of [5, 6]) {
      expect(generateDayTask({ identity, day, phase: 'prep', seed: SEED })).toBeNull();
    }
    for (const day of [0, 1, 2, 3, 4]) {
      expect(generateDayTask({ identity, day, phase: 'prep', seed: SEED })).not.toBeNull();
    }
  });

  it('puts everyone somewhere non-working at the weekend', () => {
    const plan = generateWeek({ phase: 'comeback', cards, seed: SEED });
    const working = ['practice_room', 'broadcast_studio', 'drama_set', 'wardrobe', 'corridor'];

    for (const day of WEEKEND_DAYS) {
      for (const block of BLOCKS) {
        const occ = occupancyAt(plan, { day, block, cards, seed: SEED });
        for (const [, where] of Object.entries(occ)) {
          expect(where.layer).toBe('idle');
          expect(working).not.toContain(where.locationId);
        }
      }
    }
  });

  it('leaves every weekend block free for an event anchor', () => {
    const windows = eventWindows(0);
    expect(windows).toHaveLength(WEEKEND_DAYS.length * BLOCKS.length);
    expect(windows.every((w) => isWeekend(w.day))).toBe(true);
  });
});

describe('generateWeek', () => {
  it('is deterministic for a seed and non-deterministic across seeds', () => {
    const a = generateWeek({ phase: 'prep', cards, seed: 1 });
    const b = generateWeek({ phase: 'prep', cards, seed: 1 });
    const c = generateWeek({ phase: 'prep', cards, seed: 2 });
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('gives rest week no group activity at all', () => {
    expect(generateWeek({ phase: 'rest', cards, seed: SEED }).group).toHaveLength(0);
  });

  it('suspends solo work during comeback and resumes it in rest', () => {
    const comeback = generateWeek({ phase: 'comeback', cards, seed: SEED });
    const rest = generateWeek({ phase: 'rest', cards, seed: SEED });
    const count = (p) => Object.values(p.members).flat().length;
    expect(count(comeback)).toBe(0);
    expect(count(rest)).toBeGreaterThan(count(comeback));
  });

  it('never double-books a member against a group slot', () => {
    const plan = generateWeek({ phase: 'prep', cards, seed: SEED });
    const groupSlots = new Set(plan.group.map((s) => `${s.day}:${s.block}`));
    for (const slots of Object.values(plan.members)) {
      for (const s of slots) expect(groupSlots.has(`${s.day}:${s.block}`)).toBe(false);
    }
  });

  it('only ever emits locations that exist', () => {
    for (const phase of ['prep', 'comeback', 'rest']) {
      const plan = generateWeek({ phase, cards, seed: SEED });
      const all = [...plan.group, ...Object.values(plan.members).flat()];
      for (const s of all) expect(LOCATIONS[s.location]).toBeDefined();
    }
  });
});

describe('occupancyAt', () => {
  it('puts the whole cast together during a group slot', () => {
    const plan = generateWeek({ phase: 'comeback', cards, seed: SEED });
    const slot = plan.group[0];
    const occ = occupancyAt(plan, { ...slot, cards, seed: SEED });
    for (const c of cards) {
      expect(occ[c.id].locationId).toBe(slot.location);
      expect(occ[c.id].layer).toBe('group');
    }
  });

  it('is stable when the player leaves a room and comes back', () => {
    const plan = generateWeek({ phase: 'rest', cards, seed: SEED });
    const args = { day: 5, block: 'evening', cards, seed: SEED };
    expect(occupancyAt(plan, args)).toEqual(occupancyAt(plan, args));
  });

  it('places every member somewhere at every moment', () => {
    const plan = generateWeek({ phase: 'prep', cards, seed: SEED });
    for (let day = 0; day < DAYS_PER_WEEK; day++) {
      for (const block of BLOCKS) {
        const occ = occupancyAt(plan, { day, block, cards, seed: SEED });
        expect(Object.keys(occ)).toHaveLength(cards.length);
        for (const c of cards) expect(LOCATIONS[occ[c.id].locationId]).toBeDefined();
      }
    }
  });

  it('scatters the cast during rest week rather than pooling them', () => {
    const plan = generateWeek({ phase: 'rest', cards, seed: SEED });
    const seen = new Set();
    for (let day = 0; day < 5; day++) {
      for (const block of BLOCKS) {
        const occ = occupancyAt(plan, { day, block, cards, seed: SEED });
        for (const c of cards) seen.add(occ[c.id].locationId);
      }
    }
    expect(seen.size).toBeGreaterThan(2);
  });
});

describe('summarizeWeek', () => {
  it('marks the weekend for the calendar UI', () => {
    const plan = generateWeek({ phase: 'prep', cards, seed: SEED });
    const week = summarizeWeek(plan, cards);
    expect(week).toHaveLength(DAYS_PER_WEEK);
    expect(week.filter((d) => d.weekend).map((d) => d.name)).toEqual(['sat', 'sun']);
    for (const d of week.filter((x) => x.weekend)) {
      expect(d.group).toHaveLength(0);
      expect(Object.values(d.solo).flat()).toHaveLength(0);
    }
  });
});
