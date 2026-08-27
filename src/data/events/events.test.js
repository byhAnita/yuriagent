/**
 * The anchor events - six of them, two per phase.
 *
 * Two classes of assertion, and the second is the one that matters. The first
 * checks the content is well-formed. The second checks it is REACHABLE - the
 * calendar has been placing event days and naming event sites since M1 while
 * `data/events/` did not exist, so the whole cast spent those days standing at
 * a location `overworldFor` hides from the map. Content that exists and cannot
 * be walked into is the `markRisk` shape, and it is what this file is for.
 */

import { describe, it, expect } from 'vitest';
import { EVENTS, EVENT_IDS, eventFor, eventKey, recurs, firesInCycle } from './index.js';
import { PHASE_MAP, PHASES, eventSlots, resolveSlot, overworldFor } from '../phaseMaps.js';
import { LOCATIONS } from '../locations.js';
import { eventDays, generateWeek, occupancyAt, isWeekend } from '../../systems/calendar.js';
import { cycleForWeek, WEEKS_PER_CAMPAIGN } from '../../systems/clock.js';
import { getCast } from '../cast.js';
import { CYCLES_PER_CAMPAIGN } from '../../config/constants.js';
import en from '../../i18n/en.js';
import zh from '../../i18n/zh.js';

const cards = getCast();
const SEED = 20260823;

describe('the catalogue', () => {
  it('writes one event for every event slot on every phase map', () => {
    for (const phase of PHASES) {
      for (const slot of eventSlots(phase)) {
        const event = eventFor(phase, slot);
        expect(event, `no event authored for ${phase}:${slot}`).toBeTruthy();
        expect(event.slot).toBe(slot);
        expect(event.phase).toBe(phase);
      }
    }
  });

  /**
   * Six: two per phase. It was five while PREP had one slot, and the count is
   * asserted against the maps rather than hardcoded twice, so the next event
   * to land fails HERE with a clear reason rather than somewhere downstream.
   */
  it('writes exactly as many events as there are slots', () => {
    const slots = PHASES.flatMap((p) => eventSlots(p));
    expect(EVENT_IDS).toHaveLength(6);
    expect(slots).toHaveLength(EVENT_IDS.length);
  });

  it('puts each one at a location that exists this phase', () => {
    for (const id of EVENT_IDS) {
      const event = EVENTS[id];
      const locationId = resolveSlot(event.phase, event.slot);
      expect(locationId, id).toBeTruthy();
      expect(LOCATIONS[locationId], `${id} -> ${locationId}`).toBeTruthy();
      expect(PHASE_MAP[event.phase][event.slot]).toBe(locationId);
    }
  });

  it('never claims the same slot twice', () => {
    const keys = EVENT_IDS.map((id) => eventKey(EVENTS[id].phase, EVENTS[id].slot, 0));
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * Null is a real answer, not a failure: a phase map may carry an event slot
   * with nothing written for it, and the right behaviour then is an ordinary
   * day rather than a crash. Every authored slot is now filled - the assertion
   * above is what guarantees that - so this asks about slots that are not event
   * slots at all, which is the case the calendar actually hits.
   */
  it('answers null for a slot nobody has written for', () => {
    expect(eventFor('prep', 'workroom_a')).toBeNull();
    expect(eventFor('nonsense', 'event_a')).toBeNull();
  });
});

describe('every frame has a spine', () => {
  const frames = EVENT_IDS.map((id) => EVENTS[id].frame);

  it('sets the scene and offers two to four movements', () => {
    for (const f of frames) {
      expect(f.setting.length).toBeGreaterThan(40);
      expect(f.movements.length).toBeGreaterThanOrEqual(2);
      expect(f.movements.length).toBeLessThanOrEqual(4);
    }
  });

  /**
   * The rule from section 11, applied to events for the same reason it is
   * applied to dates: a movement sets the SITUATION and never the OUTCOME. A
   * smell test rather than a proof - it catches the obvious form, which is
   * writing her reaction into the frame.
   */
  it('never writes her reaction into a movement', () => {
    const scripted = /\bshe (takes|kisses|blushes|smiles|leans|admits|confesses|cries|says)\b/i;
    for (const f of frames) {
      for (const m of f.movements) {
        expect(scripted.test(m), `scripted movement: "${m}"`).toBe(false);
      }
    }
  });

  /** Model-facing English, like ACTIVITY_DOING and the date frames. */
  it('stays ASCII, because it is never localized', () => {
    for (const f of frames) {
      const text = [
        f.setting,
        ...f.movements,
        ...(f.agenda ?? []).flatMap((a) => [a.id, a.text]),
      ].join(' ');
      // eslint-disable-next-line no-control-regex
      expect(/^[\x20-\x7e]+$/.test(text)).toBe(true);
    }
  });

});

/**
 * The agenda. PROPOSALS 20 (b).
 *
 * The played concept meeting is the whole argument for this block existing:
 * fifteen turns that were supposed to choose a comeback concept produced a joke
 * about ear colour and a plate of food, and the ledger line for the day went to
 * the food. Nothing in the frame had said a title track gets chosen today, so
 * nothing was wrong with the model - it wrote the feelings it was asked for.
 *
 * Asserted rather than reviewed, because this is content and content drifts.
 */
describe('every event is also a working day', () => {
  const frames = EVENT_IDS.map((id) => EVENTS[id].frame);

  it('gives every one of them two to four things the day must decide', () => {
    for (const id of EVENT_IDS) {
      const { agenda } = EVENTS[id].frame;
      expect(agenda, `${id} has no agenda`).toBeTruthy();
      expect(agenda.length, id).toBeGreaterThanOrEqual(2);
      expect(agenda.length, id).toBeLessThanOrEqual(4);
    }
  });

  /**
   * An agenda item names WHAT gets settled and never WHICH WAY.
   *
   * This is the rule that keeps `agenda` compatible with section 11 rather than
   * a hole in it. "Which of the demos is the title track" is business; "the
   * ballad wins" is a script, and it would take the decision away from the
   * scene - which is the one thing the whole feature is for.
   */
  it('names what gets decided, never which way it goes', () => {
    const decided = /\b(wins|is chosen|is picked|gets picked|will be|ends up as|is decided to)\b/i;
    for (const f of frames) {
      for (const a of f.agenda) {
        expect(decided.test(a.text), `pre-decided agenda item: "${a.text}"`).toBe(false);
      }
    }
  });

  /**
   * And it must be BUSINESS, not a movement that wandered into the wrong field.
   *
   * The test for it is whether a later cycle could read the answer back: a
   * title track, a concept, a centre position are all facts about the group.
   * "How she feels about it" is not, and if the agenda fills up with those then
   * the day has quietly gone back to being atmosphere with extra bullet points.
   */
  it('is about the group and the work, not about one member feeling something', () => {
    const feeling = /\b(feels?|feeling|wants? to say|is scared|is happy|is upset)\b/i;
    for (const f of frames) {
      for (const a of f.agenda) {
        expect(feeling.test(a.text), `agenda item is a movement in disguise: "${a.text}"`).toBe(
          false,
        );
      }
    }
  });

  /**
   * Long enough to be a decision. A two-word agenda item ("the concept") gives
   * the model nothing to settle and reads as a heading.
   */
  it('writes each item as something a room could argue about', () => {
    for (const f of frames) {
      for (const a of f.agenda) expect(a.text.length, a.text).toBeGreaterThan(25);
    }
  });

  /**
   * The topic id is the primary key of `run.canon`: what a decision is recorded
   * under, what supersedes a previous cycle's answer, and what a later event
   * asks for by name. So it has to be a machine token and it has to be unique -
   * two agenda items sharing an id would silently overwrite each other.
   */
  it('gives every agenda item a unique ASCII snake_case id', () => {
    const seen = new Set();
    for (const id of EVENT_IDS) {
      for (const a of EVENTS[id].frame.agenda) {
        expect(a.id, `${id} has an agenda item with no id`).toBeTruthy();
        expect(a.id, a.id).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(seen.has(a.id), `duplicate topic id: ${a.id}`).toBe(false);
        seen.add(a.id);
      }
    }
  });

  /**
   * A recurring event reports the SAME topic ids every cycle, which is what
   * lets cycle 2's title track supersede cycle 1's instead of piling up beside
   * it. Stated as a test because ids are content and content drifts - and a
   * renamed id fails silently, by having its decision dropped.
   */
  it('keeps a recurring event topic stable, which is what supersedes', () => {
    expect(EVENTS.concept_meeting.frame.agenda.map((a) => a.id)).toContain('title_track');
    expect(EVENTS.mv_shoot.frame.agenda.map((a) => a.id)).toContain('ending_pose');
  });
});

describe('the player can be told what today is', () => {
  it('names and describes every event in every locale', () => {
    for (const bundle of [en, zh]) {
      for (const id of EVENT_IDS) {
        expect(bundle.event[id], id).toBeTruthy();
        expect(bundle.event[`${id}Blurb`], id).toBeTruthy();
      }
    }
  });
});

describe('an event day is reachable', () => {
  const plan = (phase, fired = []) =>
    generateWeek({ phase, cards, seed: SEED, week: 0, fired });

  it('lands on a weekday, never on the player s weekend', () => {
    for (const phase of PHASES) {
      for (const e of plan(phase).events) {
        expect(isWeekend(e.day), `${phase} event on day ${e.day}`).toBe(false);
      }
    }
  });

  /**
   * The bug this file exists for. `overworldFor` hides an event slot until its
   * day; the cast is standing at that site all day; so if nothing tells the map
   * which slot is live, the whole cast is unreachable and the day looks like
   * everybody vanished.
   */
  it('puts the site on the map on the day, and only on the day', () => {
    for (const phase of PHASES) {
      for (const e of plan(phase).events) {
        expect(overworldFor(phase, { eventSlot: e.slot })).toContain(e.location);
        expect(overworldFor(phase)).not.toContain(e.location);
      }
    }
  });

  it('puts the whole cast at the site for every block of that day', () => {
    const weekPlan = plan('comeback');
    const e = weekPlan.events[0];

    for (const block of ['morning', 'afternoon', 'evening']) {
      const where = occupancyAt(weekPlan, { day: e.day, block, cards, seed: SEED, week: 0 });
      for (const card of cards) {
        expect(where[card.id].locationId, `${card.id} at ${block}`).toBe(e.location);
        expect(where[card.id].layer).toBe('event');
      }
    }
  });

  it('has content behind every day it places', () => {
    for (const phase of PHASES) {
      for (const e of plan(phase).events) {
        expect(eventFor(e.phase, e.slot), `${e.phase}:${e.slot}`).toBeTruthy();
      }
    }
  });
});

describe('an event fires once in a campaign', () => {
  it('stops being scheduled once it is in fired', () => {
    const before = eventDays({ phase: 'comeback', seed: SEED, week: 0 });
    expect(before.length).toBe(2);

    const fired = [eventKey('comeback', before[0].slot, 0)];
    const after = eventDays({ phase: 'comeback', seed: SEED, week: 0, fired });

    expect(after.map((e) => e.slot)).not.toContain(before[0].slot);
    expect(after).toHaveLength(1);
  });

  it('leaves the phase with no event day once both have fired', () => {
    const cycle = 1;
    const fired = [
      eventKey('comeback', 'event_a', cycle),
      eventKey('comeback', 'event_b', cycle),
    ];
    const weekPlan = generateWeek({ phase: 'comeback', cards, seed: SEED, week: 4, fired });

    expect(weekPlan.events).toEqual([]);
    // ...and the day goes back to being an ordinary working one.
    const busy = weekPlan.group.length + Object.values(weekPlan.members).flat().length;
    expect(busy).toBeGreaterThan(0);
  });

  /**
   * FOURTEEN EVENT DAYS IN A CAMPAIGN, and the number matters as much as the
   * mechanism: an event day generates no daily task, so this count is a claim
   * about the credit economy as much as about the schedule (PROPOSALS 20).
   *
   * Played forward the way App plays it - each event marked fired on the way
   * out - because that is the only way to see the interaction between the two
   * filters.
   */
  it('plays fourteen event days across a campaign: four a cycle plus two', () => {
    let fired = [];
    const seen = [];

    for (let week = 0; week < WEEKS_PER_CAMPAIGN; week += 1) {
      const phase = PHASES[week % PHASES.length];
      for (const e of eventDays({ phase, seed: SEED, week, fired })) {
        const key = eventKey(e.phase, e.slot, cycleForWeek(week));
        seen.push(key);
        fired = [...fired, key];
      }
    }

    expect(seen).toHaveLength(14);
    // Every recurring one, once per cycle...
    for (const cycle of [0, 1, 2]) {
      for (const slot of ['event_a', 'event_b']) {
        expect(seen).toContain(`prep:${slot}:${cycle}`);
        expect(seen).toContain(`comeback:${slot}:${cycle}`);
      }
    }
    // ...and the two one-offs exactly once each, unkeyed by cycle.
    expect(seen.filter((k) => k === 'rest:event_a')).toHaveLength(1);
    expect(seen.filter((k) => k === 'rest:event_b')).toHaveLength(1);
  });

  /**
   * The guarantee the cycle key exists for, stated on its own: playing the
   * first Music Bank must not cancel the second.
   */
  it('does not let one cycle fire an event for the next one', () => {
    const fired = [eventKey('prep', 'event_a', 0)];
    const next = eventDays({ phase: 'prep', seed: SEED, week: 3, fired });
    expect(next.map((e) => e.slot).sort()).toEqual(['event_a', 'event_b']);
  });
});

/**
 * Recurrence. PROPOSALS 20, step 2.
 *
 * `cycle` is one field doing two jobs on purpose: an event that names one fires
 * once, in that cycle; an event that names none fires in all of them. A
 * `recurs: true` flag beside a `cycle` number could disagree with it, and there
 * is no sensible answer when it does.
 */
describe('four come back and two do not', () => {
  it('recurs exactly when no cycle is named', () => {
    for (const id of EVENT_IDS) {
      expect(recurs(EVENTS[id]), id).toBe(EVENTS[id].cycle == null);
    }
  });

  it('brings back the four that make a comeback cycle', () => {
    for (const id of ['concept_meeting', 'mv_shoot', 'music_bank', 'fan_meeting']) {
      expect(recurs(EVENTS[id]), id).toBe(true);
    }
  });

  /**
   * REST is the repair week, and an event day generates no daily task - so two
   * mandatory whole-cast days a cycle would cost the credit economy as well as
   * the week whose job is converting jealousy before it hardens.
   */
  it('keeps the rest week clear by making its two one-offs', () => {
    for (const id of ['company_cruise', 'island_trip']) {
      expect(recurs(EVENTS[id]), id).toBe(false);
      expect(EVENTS[id].cycle).toBeGreaterThanOrEqual(0);
      expect(EVENTS[id].cycle).toBeLessThan(CYCLES_PER_CAMPAIGN);
    }
  });

  /**
   * Its own frame says where it goes: the first day in nine weeks with nothing
   * scheduled on it, ending on a last ferry. That is the end of a campaign.
   */
  it('puts the island trip in the last cycle', () => {
    expect(EVENTS.island_trip.cycle).toBe(CYCLES_PER_CAMPAIGN - 1);
  });

  it('fires a one-off in its own cycle and no other', () => {
    for (const cycle of [0, 1, 2]) {
      expect(firesInCycle(EVENTS.company_cruise, cycle)).toBe(cycle === 1);
      expect(firesInCycle(EVENTS.island_trip, cycle)).toBe(cycle === 2);
      expect(firesInCycle(EVENTS.concept_meeting, cycle)).toBe(true);
    }
  });

  it('says no rather than throwing for a slot with nothing authored', () => {
    expect(firesInCycle(null, 0)).toBe(false);
    expect(recurs(null)).toBe(false);
  });
});

/**
 * The guard on `eventKey`, and it is not defensive programming for its own
 * sake.
 *
 * A default of 0 would let a caller that forgot to pass a cycle compile, run,
 * and quietly key every cycle's event to the same string - which is the single
 * guarantee this function exists to provide, broken silently, in the shape this
 * project keeps finding. It earned its keep immediately: it caught both stale
 * call sites the moment the signature changed, as a failing test rather than as
 * a campaign where the second Music Bank never happened.
 */
describe('eventKey will not guess a cycle', () => {
  it('throws rather than defaulting', () => {
    expect(() => eventKey('prep', 'event_a')).toThrow(/needs a cycle/);
    expect(() => eventKey('prep', 'event_a', '0')).toThrow(/needs a cycle/);
    expect(() => eventKey('prep', 'event_a', null)).toThrow(/needs a cycle/);
  });

  it('keys a recurring event by cycle and a one-off without one', () => {
    expect(eventKey('prep', 'event_a', 2)).toBe('prep:event_a:2');
    expect(eventKey('rest', 'event_a', 2)).toBe('rest:event_a');
  });

  /**
   * A slot with nothing authored for it keys WITHOUT a cycle, because
   * `recurs(null)` is false - "I do not know what this is" should not claim
   * that it comes back. The key is never consulted in practice (`eventDays`
   * drops the slot before it gets this far), so the only thing that matters
   * here is that it does not throw.
   */
  it('keys an unauthored slot rather than throwing', () => {
    expect(eventKey('prep', 'workroom_a', 0)).toBe('prep:workroom_a');
  });
});
