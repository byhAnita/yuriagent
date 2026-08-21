/**
 * Deterministic two-layer calendar. CLAUDE.md section 10.
 *
 * No LLM call. Hand-authored slot templates per phase, filled by a seeded RNG,
 * so a week is replayable, testable, instant, and can be shown to the player in
 * full before they commit a block. Opportunity cost only bites when it is
 * visible. The model may write a flavour label; it never decides a slot.
 *
 * Two layers:
 *   group   - all of X at once, driven by the comeback cycle
 *   members - individual careers, driven by each card's activityProfile
 *
 * WEEKENDS ARE FREE. No group slot, no solo slot, no daily task on day 5 or 6.
 * Everyone is at the dorm or out, which makes the weekend the only time the
 * whole cast is reachable and unscheduled - the relationship engine's own
 * playground, and where event anchors are placed.
 */

import { GROUP_ACTIVITIES, SOLO_ACTIVITIES, IDLE_ACTIVITIES } from '../data/activities.js';
import { BLOCKS, DAYS_PER_WEEK } from '../config/constants.js';
import { makeRng, deriveSeed, pick } from './rng.js';

/** Day 0 is Monday. */
export const WEEKEND_DAYS = [5, 6];
export const DAY_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function isWeekend(day) {
  return WEEKEND_DAYS.includes(day);
}

export function workDays() {
  return Array.from({ length: DAYS_PER_WEEK }, (_, d) => d).filter((d) => !isWeekend(d));
}

/** How many group slots a phase wants per work day. */
const GROUP_DENSITY = { prep: 2, comeback: 2, rest: 0 };

/** How many solo slots a member gets per work day. */
const SOLO_DENSITY = { prep: 1, comeback: 0, rest: 2 };

/** Where an unscheduled member is, on a weekday. */
const WEEKDAY_IDLE = ['dorm_living', 'dorm_kitchen', 'practice_room', 'cafe'];

/** Where she is at the weekend. No working spaces. */
const WEEKEND_IDLE = ['dorm_living', 'dorm_kitchen', 'dorm_room', 'cafe'];

const IDLE_BY_LOCATION = Object.fromEntries(
  Object.entries(IDLE_ACTIVITIES).map(([id, a]) => [a.location, id]),
);

function activitiesFor(pool, phase) {
  return Object.entries(pool)
    .filter(([, a]) => a.phases.includes(phase))
    .map(([id]) => id);
}

/**
 * Build one week.
 *
 * @param {object} args - { phase, cards, seed, week }
 * @returns {{ group: Array, members: Object }}
 */
export function generateWeek({ phase, cards, seed, week = 0 }) {
  const group = [];
  const members = Object.fromEntries(cards.map((c) => [c.id, []]));

  // --- group layer --------------------------------------------------------
  const groupPool = activitiesFor(GROUP_ACTIVITIES, phase);
  const groupRng = makeRng(deriveSeed(seed, `group:${phase}:${week}`));

  if (groupPool.length > 0) {
    for (const day of workDays()) {
      const slots = GROUP_DENSITY[phase] ?? 0;
      const blocks = [...BLOCKS].sort(() => groupRng() - 0.5).slice(0, slots);
      for (const block of blocks) {
        const activity = pick(groupRng, groupPool);
        group.push({ day, block, activity, location: GROUP_ACTIVITIES[activity].location });
      }
    }
  }

  const groupBusy = new Set(group.map((s) => `${s.day}:${s.block}`));

  // --- solo layer ---------------------------------------------------------
  for (const card of cards) {
    const rng = makeRng(deriveSeed(seed, `solo:${card.id}:${phase}:${week}`));
    const pool = (card.activityProfile?.types ?? []).filter((t) =>
      SOLO_ACTIVITIES[t]?.phases.includes(phase),
    );
    if (pool.length === 0) continue;

    for (const day of workDays()) {
      let placed = 0;
      const want = SOLO_DENSITY[phase] ?? 0;
      for (const block of [...BLOCKS].sort(() => rng() - 0.5)) {
        if (placed >= want) break;
        // The group always wins the slot - a comeback outranks a drama shoot.
        if (groupBusy.has(`${day}:${block}`)) continue;
        const activity = pick(rng, pool);
        members[card.id].push({
          day,
          block,
          activity,
          location: SOLO_ACTIVITIES[activity].location,
        });
        placed++;
      }
    }
  }

  return { group, members };
}

/**
 * Where everyone is at a given moment.
 *
 * Resolution order: group slot, then her own solo slot, then a deterministic
 * idle location. This is what makes the map a search rather than a menu - she
 * is at the radio station on Wednesday afternoon whether you look or not.
 *
 * @returns {{ [memberId]: { locationId, activity, layer } }}
 */
export function occupancyAt(weekPlan, { day, block, cards, seed, week = 0 }) {
  const out = {};
  const groupSlot = weekPlan.group.find((s) => s.day === day && s.block === block);

  for (const card of cards) {
    if (groupSlot) {
      out[card.id] = {
        locationId: groupSlot.location,
        activity: groupSlot.activity,
        layer: 'group',
      };
      continue;
    }

    const solo = weekPlan.members[card.id]?.find((s) => s.day === day && s.block === block);
    if (solo) {
      out[card.id] = { locationId: solo.location, activity: solo.activity, layer: 'solo' };
      continue;
    }

    // Idle. Deterministic per member and moment so the map is stable when the
    // player leaves a room and comes back.
    const rng = makeRng(deriveSeed(seed, `idle:${card.id}:${week}:${day}:${block}`));
    const pool = isWeekend(day) ? WEEKEND_IDLE : WEEKDAY_IDLE;
    const locationId = pick(rng, pool);
    out[card.id] = {
      locationId,
      activity: IDLE_BY_LOCATION[locationId] ?? 'free',
      layer: 'idle',
    };
  }

  return out;
}

/**
 * Blocks with nothing scheduled for anyone - the weekend.
 * Event anchors are placed here so they never collide with a comeback.
 */
export function eventWindows(week = 0) {
  const windows = [];
  for (const day of WEEKEND_DAYS) {
    for (const block of BLOCKS) windows.push({ week, day, block });
  }
  return windows;
}

/** Everything the player needs to see the week at a glance. */
export function summarizeWeek(weekPlan, cards) {
  return Array.from({ length: DAYS_PER_WEEK }, (_, day) => ({
    day,
    name: DAY_NAMES[day],
    weekend: isWeekend(day),
    group: weekPlan.group.filter((s) => s.day === day),
    solo: Object.fromEntries(
      cards.map((c) => [c.id, (weekPlan.members[c.id] ?? []).filter((s) => s.day === day)]),
    ),
  }));
}
