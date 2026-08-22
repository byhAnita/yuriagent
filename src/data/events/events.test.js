/**
 * The five anchor events.
 *
 * Two classes of assertion, and the second is the one that matters. The first
 * checks the content is well-formed. The second checks it is REACHABLE - the
 * calendar has been placing event days and naming event sites since M1 while
 * `data/events/` did not exist, so the whole cast spent those days standing at
 * a location `overworldFor` hides from the map. Content that exists and cannot
 * be walked into is the `markRisk` shape, and it is what this file is for.
 */

import { describe, it, expect } from 'vitest';
import { EVENTS, EVENT_IDS, eventFor, eventKey } from './index.js';
import { PHASE_MAP, PHASES, eventSlots, resolveSlot, overworldFor } from '../phaseMaps.js';
import { LOCATIONS } from '../locations.js';
import { eventDays, generateWeek, occupancyAt, isWeekend } from '../../systems/calendar.js';
import { getCast } from '../cast.js';
import { SCENE_TURN_LIMITS } from '../../config/constants.js';
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

  it('is exactly five, which is what section 10 promises', () => {
    const slots = PHASES.flatMap((p) => eventSlots(p));
    expect(EVENT_IDS).toHaveLength(5);
    expect(slots).toHaveLength(5);
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
    const keys = EVENT_IDS.map((id) => eventKey(EVENTS[id].phase, EVENTS[id].slot));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('answers null for a slot nobody has written for', () => {
    expect(eventFor('prep', 'event_b')).toBeNull();
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
      const text = [f.setting, ...f.movements].join(' ');
      // eslint-disable-next-line no-control-regex
      expect(/^[\x20-\x7e]+$/.test(text)).toBe(true);
    }
  });

  it('is long enough to be worth sixteen turns', () => {
    expect(SCENE_TURN_LIMITS.event).toBeGreaterThan(SCENE_TURN_LIMITS.ordinary);
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

    const fired = [eventKey('comeback', before[0].slot)];
    const after = eventDays({ phase: 'comeback', seed: SEED, week: 0, fired });

    expect(after.map((e) => e.slot)).not.toContain(before[0].slot);
    expect(after).toHaveLength(1);
  });

  /**
   * `fired` persists across cycles rather than resetting with the phase, which
   * is what makes it five events in the campaign and not five per cycle.
   */
  it('leaves the phase with no event day once both have fired', () => {
    const fired = ['comeback:event_a', 'comeback:event_b'];
    const weekPlan = generateWeek({ phase: 'comeback', cards, seed: SEED, week: 3, fired });

    expect(weekPlan.events).toEqual([]);
    // ...and the day goes back to being an ordinary working one.
    const busy = weekPlan.group.length + Object.values(weekPlan.members).flat().length;
    expect(busy).toBeGreaterThan(0);
  });
});
