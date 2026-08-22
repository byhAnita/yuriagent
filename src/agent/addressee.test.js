import { describe, it, expect } from 'vitest';
import { beginScene, turnTo, newMeters } from './sceneEngine.js';
import { newRelation } from '../systems/relationship.js';
import { getCast } from '../data/cast.js';

const cards = getCast();
const relations = Object.fromEntries(
  cards.map((c, i) => [c.id, { ...newRelation(5), intimacy: 20 + i * 15 }]),
);

const memory = { ledger: [], dossier: {} };

function open(rosterIds, focusId) {
  return beginScene({
    cards,
    lineup: {},
    identity: {},
    player: { name: 'Yuhan', secrecy: 70, energy: 80 },
    lang: 'en',
    memory,
    relations,
    scene: {
      locationId: 'practice_room',
      block: 'evening',
      phase: 'prep',
      rosterIds,
      focusId,
      locationLabel: 'X Practice Room',
    },
  });
}

describe('a scene knows who the player is talking to', () => {
  it('opens on the member the player came to see', () => {
    expect(open(['irene'], 'irene').addresseeId).toBe('irene');
  });

  it('changes nothing about a one-member room', () => {
    const s = open(['irene'], 'irene');
    expect(s.addresseeId).toBe(s.focusId);
    expect(s.witnessIds).toEqual([]);
  });

  it('honours the requested focus even in a crowded room', () => {
    expect(open(['irene', 'nana', 'jisoo'], 'nana').addresseeId).toBe('nana');
  });
});

describe('turnTo', () => {
  it('moves the addressee and the focus together', () => {
    const s = turnTo(open(['irene', 'nana'], 'irene'), 'nana', relations);
    expect(s.addresseeId).toBe('nana');
    expect(s.focusId).toBe('nana');
  });

  /** Mirrors the parser roster rule: you cannot turn to somebody not there. */
  it('refuses to turn to somebody who is not in the room', () => {
    const s = open(['irene', 'nana'], 'irene');
    expect(turnTo(s, 'wendy', relations)).toBe(s);
  });

  it('is a no-op when turning to whoever you are already facing', () => {
    const s = open(['irene', 'nana'], 'irene');
    expect(turnTo(s, 'irene', relations)).toBe(s);
  });

  /**
   * guard and fluster are per-member READINGS. Carrying Irene's guard over to
   * Nana would hand the player a number they never earned from her.
   */
  it('gives the new member her own meters, not the last one\'s', () => {
    const before = open(['irene', 'nana'], 'irene');
    const warmed = { ...before, meters: { ...before.meters, guard: 5, fluster: 90 } };
    const after = turnTo(warmed, 'nana', relations);

    expect(after.meters.guard).not.toBe(5);
    expect(after.meters).toEqual(newMeters(relations.nana));
  });

  it('remembers where the conversation stood when you turn back', () => {
    const start = open(['irene', 'nana'], 'irene');
    const warmed = { ...start, meters: { ...start.meters, guard: 12, flusterPeak: 44 } };

    const away = turnTo(warmed, 'nana', relations);
    const back = turnTo(away, 'irene', relations);

    expect(back.meters.guard).toBe(12);
    expect(back.meters.flusterPeak).toBe(44);
  });
});

/**
 * Section 5b, and the half that was missing until now: a gesture in a room with
 * other people in it is witnessed, so it counts as a public act whatever the
 * street can see.
 */
describe('the room decides whether a gesture is public', () => {
  it('leaves a private room private when she is alone', () => {
    const alone = open(['irene'], 'irene');
    expect(alone.riskExposure).toBe(alone.exposure);
  });

  it('lifts the same room to witnessed tier when others are there', () => {
    const crowded = open(['irene', 'nana', 'jisoo'], 'irene');
    expect(crowded.riskExposure).toBeGreaterThan(crowded.exposure);
    expect(crowded.witnessIds).toEqual(['nana', 'jisoo']);
  });
});
