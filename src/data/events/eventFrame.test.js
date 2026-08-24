/**
 * The per-cycle frame. PROPOSALS 24.
 *
 * `events.test.js` asserts the content is well-formed and reachable. This file
 * asserts the thing the day-three playtest found: that the second run of a
 * recurring event is not the first one again.
 *
 * Two mechanisms, tested separately because they fail separately. The stakes
 * clause is AUTHORED and could go missing from one event; the style pressure is
 * DRAWN and could collide. Only one of them is a repeat the model can talk its
 * way out of.
 */

import { describe, it, expect } from 'vitest';
import { EVENTS, EVENT_IDS, eventFor, eventFrame, recurs } from './index.js';
import { renderFrame } from '../sceneFrames.js';
import { CYCLES_PER_CAMPAIGN } from '../../config/constants.js';

const recurring = EVENT_IDS.map((id) => EVENTS[id]).filter(recurs);

describe('the stakes clause', () => {
  it('covers every cycle of every recurring event', () => {
    expect(recurring.length).toBeGreaterThan(0);
    for (const event of recurring) {
      expect(event.stakes, `${event.id} has no stakes`).toBeDefined();
      expect(event.stakes).toHaveLength(CYCLES_PER_CAMPAIGN);
      for (const line of event.stakes) {
        expect(line.length).toBeGreaterThan(40);
        // Section 21, and section 19: model-facing English, never localized.
        expect(line).toMatch(/^[\x20-\x7E]+$/);
      }
    }
  });

  /**
   * The two punctuation events fire once in a campaign, so a per-cycle clause
   * would be three lines of which two can never be read. Their absence is the
   * design, not an omission - and asserting it stops somebody "completing" the
   * table later.
   */
  it('is absent from the events that only happen once', () => {
    for (const event of EVENT_IDS.map((id) => EVENTS[id])) {
      if (!recurs(event)) expect(event.stakes).toBeUndefined();
    }
  });

  it('says something different in every cycle', () => {
    for (const event of recurring) {
      expect(new Set(event.stakes).size).toBe(CYCLES_PER_CAMPAIGN);
    }
  });
});

describe('eventFrame', () => {
  it('carries this cycle of the clause and no other', () => {
    const event = eventFor('prep', 'event_a');
    for (let cycle = 0; cycle < CYCLES_PER_CAMPAIGN; cycle += 1) {
      const frame = eventFrame(event, { cycle, seed: 5 });
      expect(frame.stakes).toBe(event.stakes[cycle]);
    }
  });

  /**
   * The concept meeting is the only event that invents rather than inherits,
   * which is why it is the only one that repeated and the only one that gets
   * the pools. Everything downstream is already constrained by what this room
   * settled.
   */
  it('gives the style pressure to the concept meeting alone', () => {
    expect(eventFrame(eventFor('prep', 'event_a'), { cycle: 0, seed: 5 }).pressure).toHaveLength(3);
    for (const slot of [
      ['prep', 'event_b'],
      ['comeback', 'event_a'],
      ['comeback', 'event_b'],
    ]) {
      expect(eventFrame(eventFor(...slot), { cycle: 0, seed: 5 }).pressure).toBeUndefined();
    }
  });

  it('leaves the authored frame alone', () => {
    const event = eventFor('prep', 'event_a');
    const frame = eventFrame(event, { cycle: 1, seed: 5 });
    expect(frame.setting).toBe(event.frame.setting);
    expect(frame.agenda).toBe(event.frame.agenda);
    // A copy, so a scene can never write back into the shipped table.
    expect(event.frame.stakes).toBeUndefined();
  });

  it('is null for a slot with nothing authored', () => {
    expect(eventFrame(null, { cycle: 0, seed: 1 })).toBeNull();
    expect(eventFrame({ id: 'x' }, { cycle: 0, seed: 1 })).toBeNull();
  });
});

/**
 * The end-to-end version, which is the assertion that actually corresponds to
 * what was reported: two concept meetings in one campaign, and the text the
 * model reads for them.
 *
 *   > Oh no she's talking same concept of 1st concept.
 *   > Oh no, the song name is same as 1st comeback, and the concept is similar.
 */
describe('two concept meetings in one campaign', () => {
  const rendered = (cycle) =>
    renderFrame(eventFrame(eventFor('prep', 'event_a'), { cycle, seed: 20260821 }));

  it('read differently on every axis the pools cover', () => {
    const seen = new Set();
    for (let cycle = 0; cycle < CYCLES_PER_CAMPAIGN; cycle += 1) seen.add(rendered(cycle));
    expect(seen.size).toBe(CYCLES_PER_CAMPAIGN);
  });

  it('still carries the agenda rules', () => {
    const text = rendered(1);
    expect(text).toMatch(/does not end until it has/);
    expect(text).toMatch(/NAME, not a position in a list/);
  });

  /**
   * The pressure has to be arguable. A block that reads as a specification
   * gets recited; one that reads as what somebody upstairs wants gets fought
   * about, which is the difference between a meeting and a memo.
   */
  it('states the pressure as pressure rather than as a decision', () => {
    const text = rendered(0);
    expect(text).toMatch(/Nobody in this room decided/);
    expect(text).toMatch(/may take it, fight it/);
  });

  it('puts the day above the movements', () => {
    const text = rendered(2);
    expect(text.indexOf('The third comeback')).toBeLessThan(text.indexOf('The day may pass through'));
  });
});
