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
 * Assembly order for a weekday week: the AUTHORED EVENT DAY is placed first and
 * consumes its whole day, then group activity, then solo activity. Everything
 * resolves through `data/phaseMaps.js` - nothing here may name a location id,
 * because the room a slot points at changes with the phase.
 *
 * WEEKENDS ARE FREE. No group slot, no solo slot, no daily task on day 5 or 6.
 * Everyone is at the dorm or out, which makes the weekend the only time the
 * whole cast is reachable and unscheduled - the relationship engine's own
 * playground, and where dating lives.
 *
 * EVENINGS ARE FREE TOO. The cast leaves the workrooms after hours and turns up
 * at the dorm, at the venue, or in her own room. A workroom is therefore
 * reliably empty in the evening, which is the point: the player can still work
 * overtime there, and a dependable fallback is what makes the unreliable
 * options feel like a search rather than a lottery.
 */

import { GROUP_ACTIVITIES, SOLO_ACTIVITIES, IDLE_ACTIVITIES } from '../data/activities.js';
import { resolveSlot, eventSlots } from '../data/phaseMaps.js';
import { eventFor, eventKey, firesInCycle } from '../data/events/index.js';
import { cycleForWeek } from './clock.js';
import { BLOCKS, DAYS_PER_WEEK } from '../config/constants.js';
import { makeRng, deriveSeed, pick } from './rng.js';

/** Day 0 is Monday. */
export const WEEKEND_DAYS = [5, 6];
export const DAY_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Work happens before dinner. The evening belongs to whoever is off duty. */
export const WORK_BLOCKS = ['morning', 'afternoon'];
export const EVENING = 'evening';

export function isWeekend(day) {
  return WEEKEND_DAYS.includes(day);
}

export function workDays() {
  return Array.from({ length: DAYS_PER_WEEK }, (_, d) => d).filter((d) => !isWeekend(d));
}

/**
 * Group slots per WEEK, not per day.
 *
 * Phase-scoped because section 10's phase table is a claim about co-presence,
 * and a flat density cannot deliver it: COMEBACK is the week everyone is in the
 * same rooms under maximum visibility, and three slots does not make a pressure
 * cooker. REST has none at all - the group layer stops and the cast scatters.
 */
const GROUP_SLOTS_PER_WEEK = { prep: 4, comeback: 5, rest: 0 };

/** Solo slots per member per week. The mirror image of the group layer. */
const SOLO_SLOTS_PER_WEEK = { prep: 3, comeback: 1, rest: 6 };

/** Where an off-duty member turns up, by slot. Resolved through the phase map. */
const WEEKDAY_IDLE_SLOTS = ['social', 'dorm_shared', 'venue'];
const EVENING_IDLE_SLOTS = ['dorm_shared', 'dorm_kitchen', 'venue'];
const WEEKEND_IDLE_SLOTS = ['dorm_shared', 'dorm_kitchen', 'venue', 'social'];

/** Where she is when nothing else resolves. She is always somewhere. */
const IDLE_FALLBACK = 'dorm_living';

/** What she is nominally doing when she is idle in a given slot. */
const SLOT_IDLE_ACTIVITY = {
  dorm_shared: 'dorm_rest',
  dorm_kitchen: 'dorm_late',
  her_room: 'in_her_room',
  venue: 'cafe_break',
  social: 'cafe_break',
};

const IDLE_BY_LOCATION = Object.fromEntries(
  Object.entries(IDLE_ACTIVITIES)
    .filter(([, a]) => a.location)
    .map(([id, a]) => [a.location, id]),
);

/**
 * Where an activity happens THIS phase. The slot decides; the location on the
 * activity is only the fallback for a slot the phase does not fill.
 */
function activityLocation(activity, phase) {
  return resolveSlot(phase, activity.slot) ?? activity.location;
}

function activitiesFor(pool, phase) {
  return Object.entries(pool)
    .filter(([, a]) => a.phases.includes(phase))
    .map(([id]) => id);
}

/** Deterministic shuffle. Array.sort with a random comparator is not one. */
function shuffled(rng, items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Which weekdays the authored events take, and where.
 *
 * Placed FIRST, because an event replaces a scheduled day rather than dodging
 * one - the Music Bank recording genuinely is that Thursday. This reversed
 * during the M5 design pass; events used to be pencilled into weekend blocks on
 * the grounds that nothing was scheduled there, which had it backwards and cost
 * the player their own two days.
 *
 * TWO FILTERS, and they are different questions. `firesInCycle` asks whether
 * this event belongs to this cycle at all - the cruise is cycle 1 and nowhere
 * else - and `fired` asks whether it has already happened. Only the second one
 * used to exist, so a one-off event would have been scheduled in cycle 0 and
 * every cycle after it until somebody played it.
 *
 * The CYCLE IS DERIVED from the week rather than passed in. Every caller would
 * otherwise have to compute the same `Math.floor(week / 3)` and one of them
 * would eventually not, which is this project's most reliable bug: two correct
 * halves and a missing join.
 */
export function eventDays({ phase, seed, week = 0, fired = [] }) {
  const cycle = cycleForWeek(week);
  const all = eventSlots(phase);
  if (all.length === 0) return [];

  /**
   * DEAL THE DAYS FIRST, THEN FILTER. Never the other way round.
   *
   * This function used to filter the slots and then take that many days off the
   * shuffle, so a slot's day depended on how many slots were still unfired -
   * and firing one MOVED the other. Measured: `event_a` Tuesday and `event_b`
   * Friday, until `event_a` fired, at which point `event_b` was Tuesday.
   *
   * In play that meant the second event of a phase was scheduled for a day that
   * had already gone, every time, so it never fired at all: **the fan meeting
   * was unreachable once Music Bank had been played, and the island trip once
   * the cruise had.** Shipped, and never seen, because PREP was the only phase
   * anybody had hand-tested and it had one slot - there was nothing to move.
   *
   * The harness could not see it either, for a reason worth keeping: it did not
   * consume the rest of an event day, so it was still standing in the same
   * "today" when the plan reshuffled and simply walked into the relocated event
   * a block later. One bug hid the other, and fixing the harness in step 1 is
   * what uncovered this one.
   *
   * A day now belongs to a SLOT, decided before anything is filtered, so what
   * has already happened cannot move what has not.
   */
  const rng = makeRng(deriveSeed(seed, `events:${phase}:${week}`));
  const days = shuffled(rng, workDays()).slice(0, all.length);

  return all
    .map((slot, i) => ({
      day: days[i],
      slot,
      location: resolveSlot(phase, slot),
      phase,
    }))
    .filter(({ slot }) => {
      const event = eventFor(phase, slot);
      return firesInCycle(event, cycle) && !fired.includes(eventKey(phase, slot, cycle));
    });
}

/**
 * Build one week.
 *
 * @param {object} args - { phase, cards, seed, week, fired }
 * @returns {{ group: Array, members: Object, events: Array }}
 */
export function generateWeek({ phase, cards, seed, week = 0, fired = [] }) {
  const group = [];
  const members = Object.fromEntries(cards.map((c) => [c.id, []]));

  // --- events first: they take the whole day ------------------------------
  const events = eventDays({ phase, seed, week, fired });
  const eventDaySet = new Set(events.map((e) => e.day));
  const openDays = workDays().filter((d) => !eventDaySet.has(d));

  // --- group layer --------------------------------------------------------
  const groupPool = activitiesFor(GROUP_ACTIVITIES, phase);
  const groupRng = makeRng(deriveSeed(seed, `group:${phase}:${week}`));

  if (groupPool.length > 0) {
    const openSlots = shuffled(
      groupRng,
      openDays.flatMap((day) => WORK_BLOCKS.map((block) => ({ day, block }))),
    );
    for (const { day, block } of openSlots.slice(0, GROUP_SLOTS_PER_WEEK[phase] ?? 0)) {
      const activity = pick(groupRng, groupPool);
      group.push({
        day,
        block,
        activity,
        location: activityLocation(GROUP_ACTIVITIES[activity], phase),
      });
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

    const want = SOLO_SLOTS_PER_WEEK[phase] ?? 0;
    const openSlots = shuffled(
      rng,
      openDays.flatMap((day) => WORK_BLOCKS.map((block) => ({ day, block }))),
      // The group always wins the slot - a comeback outranks a drama shoot.
    ).filter(({ day, block }) => !groupBusy.has(`${day}:${block}`));

    for (const { day, block } of openSlots.slice(0, want)) {
      const activity = pick(rng, pool);
      members[card.id].push({
        day,
        block,
        activity,
        location: activityLocation(SOLO_ACTIVITIES[activity], phase),
      });
    }
  }

  // The plan carries its own phase so occupancyAt cannot be called against the
  // wrong map. Passing it separately at every call site is a bug waiting to be
  // written, and it silently resolves every slot to null when it happens.
  return { phase, group, members, events };
}

/**
 * Which evenings she spends in her own room.
 *
 * Fixed by the seed and stable for the cycle, NOT rolled per block. Section 10
 * has promised since M1 that routines are learnable, and a random presence is a
 * lucky knock rather than something a player can find out and use. A routine is
 * something snooping can reveal, which is what finally gives the knowledge
 * economy something to buy besides objects: access.
 *
 * Never during COMEBACK - she is not home that week.
 */
export function roomRoutine({ cardId, phase, seed, week = 0 }) {
  if (phase === 'comeback') return [];

  const rng = makeRng(deriveSeed(seed, `routine:${cardId}:${phase}:${week}`));
  const nights = 1 + Math.floor(rng() * 2);
  return shuffled(
    rng,
    Array.from({ length: DAYS_PER_WEEK }, (_, d) => d),
  )
    .slice(0, nights)
    .sort((a, b) => a - b);
}

function idleSlotsFor(day, block) {
  if (isWeekend(day)) return WEEKEND_IDLE_SLOTS;
  return block === EVENING ? EVENING_IDLE_SLOTS : WEEKDAY_IDLE_SLOTS;
}

/**
 * Where everyone is at a given moment.
 *
 * Resolution order: the event day, then a group slot, then her own solo slot,
 * then her room if tonight is one of her evenings, then a deterministic idle
 * location. This is what makes the map a search rather than a menu - she is at
 * the radio station on Wednesday afternoon whether you look or not.
 *
 * @returns {{ [memberId]: { locationId, activity, layer } }}
 */
export function occupancyAt(weekPlan, { day, block, cards, seed, week = 0, phase }) {
  const out = {};
  const activePhase = phase ?? weekPlan.phase ?? 'prep';

  const event = (weekPlan.events ?? []).find((e) => e.day === day);
  const groupSlot = weekPlan.group.find((s) => s.day === day && s.block === block);

  for (const card of cards) {
    if (event) {
      out[card.id] = { locationId: event.location, activity: 'event', layer: 'event' };
      continue;
    }

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

    // Her own room, on the evenings that are hers. A closed door with a light
    // under it is the whole point - the player can learn which nights these are.
    const routine = roomRoutine({ cardId: card.id, phase: activePhase, seed, week });
    if (block === EVENING && routine.includes(day)) {
      out[card.id] = {
        locationId: resolveSlot(activePhase, 'her_room'),
        activity: SLOT_IDLE_ACTIVITY.her_room,
        layer: 'routine',
      };
      continue;
    }

    // Idle. Deterministic per member and moment so the map is stable when the
    // player leaves a room and comes back.
    //
    // The fallback is not decoration: a member must be SOMEWHERE at every
    // moment, and a slot the phase does not fill would otherwise resolve to
    // null and drop her off the map entirely.
    const rng = makeRng(deriveSeed(seed, `idle:${card.id}:${week}:${day}:${block}`));
    const slot = pick(rng, idleSlotsFor(day, block));
    const locationId = resolveSlot(activePhase, slot) ?? IDLE_FALLBACK;
    out[card.id] = {
      locationId,
      activity: SLOT_IDLE_ACTIVITY[slot] ?? IDLE_BY_LOCATION[locationId] ?? 'free',
      layer: 'idle',
    };
  }

  return out;
}

/**
 * Blocks the player owns outright - the weekend.
 *
 * These are where DATING lives, not where event anchors go. See eventDays().
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
    event: (weekPlan.events ?? []).find((e) => e.day === day) ?? null,
    group: weekPlan.group.filter((s) => s.day === day),
    solo: Object.fromEntries(
      cards.map((c) => [c.id, (weekPlan.members[c.id] ?? []).filter((s) => s.day === day)]),
    ),
  }));
}
