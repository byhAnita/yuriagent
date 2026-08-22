import { describe, it, expect } from 'vitest';
import { snoopCost, resolveSoloAction } from './soloWork.js';
import { actionsFor, SOLO_ACTIONS } from '../data/soloActions.js';
import { SNOOP_COST_MAX_MULTIPLIER } from '../config/constants.js';
import { getCast } from '../data/cast.js';

const cards = getCast();
const emptyDossier = Object.fromEntries(
  cards.map((c) => [c.id, { known_facts: [], heard_about: [] }]),
);

describe('snoopCost', () => {
  it('charges the plain price in an empty room', () => {
    expect(snoopCost(-5, 0)).toBe(-5);
    expect(snoopCost(-5)).toBe(-5);
  });

  it('costs more with somebody watching', () => {
    expect(Math.abs(snoopCost(-4, 1))).toBeGreaterThan(4);
    expect(Math.abs(snoopCost(-4, 3))).toBeGreaterThan(Math.abs(snoopCost(-4, 1)));
  });

  /**
   * A -1 corridor snoop with one witness must not round back to -1. If company
   * can be free, the occupied room is strictly better than the empty one - a
   * scene AND a snoop for the same block - which inverts the problem section
   * 10b exists to solve.
   */
  it('never rounds a witness back to free, even at the cheapest price', () => {
    expect(snoopCost(-1, 1)).toBeLessThan(-1);
  });

  it('is capped, so a full room is expensive rather than absurd', () => {
    const capped = Math.abs(snoopCost(-6, 20));
    expect(capped).toBeLessThanOrEqual(Math.ceil(6 * SNOOP_COST_MAX_MULTIPLIER));
  });

  it('leaves a free action free', () => {
    expect(snoopCost(0, 4)).toBe(0);
  });
});

describe('every action is offered in every room', () => {
  it('still resolves a snoop with members in the room', () => {
    const out = resolveSoloAction({
      locationId: 'wardrobe',
      actionId: 'read_fitting_notes',
      cards,
      dossier: emptyDossier,
      present: ['irene'],
      rng: () => 0.1,
    });

    expect(out).not.toBeNull();
    expect(out.learned).not.toBeNull();
  });

  it('charges more for that snoop than the same one alone', () => {
    const args = {
      locationId: 'wardrobe',
      actionId: 'read_fitting_notes',
      cards,
      dossier: emptyDossier,
      rng: () => 0.1,
    };
    const alone = resolveSoloAction({ ...args, present: [] });
    const watched = resolveSoloAction({ ...args, present: ['irene', 'nana'] });

    expect(watched.playerDelta.secrecy).toBeLessThan(alone.playerDelta.secrecy);
  });

  /**
   * The half of the balance that needed no new code: you never learn about
   * somebody standing in the room, so company shrinks the pool as well as
   * raising the price.
   */
  it('never turns up a fact about somebody in the room', () => {
    for (let i = 0; i < 40; i++) {
      const out = resolveSoloAction({
        locationId: 'wardrobe',
        actionId: 'read_fitting_notes',
        cards,
        dossier: emptyDossier,
        present: ['irene'],
        rng: () => i / 40,
      });
      expect(out.learned?.memberId).not.toBe('irene');
      expect(out.heard?.memberId).not.toBe('irene');
    }
  });

  it('does not price ordinary work by who is watching', () => {
    const args = {
      locationId: 'wardrobe',
      actionId: 'prep_fittings',
      cards,
      dossier: emptyDossier,
      rng: () => 0.1,
    };
    const alone = resolveSoloAction({ ...args, present: [] });
    const watched = resolveSoloAction({ ...args, present: ['irene', 'nana'] });

    expect(watched.playerDelta).toEqual(alone.playerDelta);
  });

  it('still charges nothing for a search that found nothing', () => {
    const known = Object.fromEntries(
      cards.map((c) => [c.id, { known_facts: [...(c.learnableFacts ?? [])], heard_about: [] }]),
    );
    const out = resolveSoloAction({
      locationId: 'wardrobe',
      actionId: 'read_fitting_notes',
      cards,
      dossier: known,
      present: ['irene', 'nana'],
      rng: () => 0.5,
    });

    expect(out.learned).toBeNull();
    expect(out.playerDelta.secrecy).toBe(0);
  });
});

describe('the snoop table', () => {
  it('gives almost every room something to find', () => {
    const rooms = Object.keys(SOLO_ACTIONS);
    const teaching = rooms.filter((id) => actionsFor(id).some((a) => a.learns));
    expect(teaching.length).toBeGreaterThanOrEqual(rooms.length - 1);
  });

  it('keeps a spread of prices, so where you go to learn is a decision', () => {
    const costs = Object.values(SOLO_ACTIONS)
      .flat()
      .filter((a) => a.learns)
      .map((a) => Math.abs(a.secrecy ?? 0));

    expect(new Set(costs).size).toBeGreaterThan(2);
  });
});
