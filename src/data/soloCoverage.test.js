/**
 * Every room on the map has something to do in it, and it is the RIGHT thing.
 *
 * Reported from play, week 1 day 2: the drink room offered nothing at all.
 * Not "nothing because somebody was standing in it" - nothing, ever, empty or
 * occupied. It turned out to be seven of the map's rooms, not one.
 *
 * The cause is the same one that made tasks bind to slots: `data/phaseMaps.js`
 * rotated the map and `data/soloActions.js` was still keyed to the location ids
 * of the pre-phase-map build. Four of its nine entries pointed at rooms that had
 * left the map, and seven rooms that had arrived on it had no entry. Section 10b
 * says "almost every room can teach you something" and in PREP two of the four
 * working rooms taught nothing and offered nothing.
 *
 * A rule that is not asserted is one that gets quietly broken later, and this
 * one was broken by a change three files away. So it is asserted here, against
 * the phase maps themselves rather than against a copy of the room list.
 */

import { describe, it, expect } from 'vitest';
import { PHASES, mapFor, rolesAt, slotAt } from './phaseMaps.js';
import { SOLO_ACTIONS, actionsFor } from './soloActions.js';
import en from '../i18n/en.js';
import zh from '../i18n/zh.js';

/** Every ordinary room the player can walk into, across all three phases. */
const REACHABLE = [
  ...new Set(
    PHASES.flatMap((phase) =>
      mapFor(phase).filter((id) => rolesAt(phase, id).includes('chat')),
    ),
  ),
];

const snoopsIn = (locationId) => actionsFor(locationId).filter((a) => a.learns);

/**
 * The two documented exceptions, and the only two.
 *
 * `dorm_player_room` is section 10b's own: there is nothing to find out about
 * anybody else in your own room. `dorm_room` is hers, reachable only as a
 * private date and only when she is home - a dark door means she is not - so
 * there is no version of it the player stands in alone. Snooping her bedroom
 * would be a different mechanic from a snoop, and a much uglier one.
 */
const NOT_WORK_ROOMS = ['dorm_player_room', 'dorm_room'];
const WORK_ROOMS = REACHABLE.filter((id) => !NOT_WORK_ROOMS.includes(id));

describe('every room on the map has something to do in it', () => {
  it('reaches more than a handful of rooms', () => {
    // Guards the guard: if `REACHABLE` ever computes to nothing, every
    // assertion below passes vacuously.
    expect(REACHABLE.length).toBeGreaterThan(8);
  });

  it.each(WORK_ROOMS)('%s offers at least one action', (locationId) => {
    expect(actionsFor(locationId).length).toBeGreaterThan(0);
  });

  /**
   * Your own room is the documented exception - there is nothing to find out
   * about anybody else in it - and it is the only one.
   */
  it.each(WORK_ROOMS)(
    '%s offers a way to learn something',
    (locationId) => {
      expect(snoopsIn(locationId).length).toBeGreaterThan(0);
    },
  );
});

/**
 * WHICH kind a room teaches is the slot's business, not a die roll.
 *
 * Yuhan's rule, and the phase maps already encoded it: "get rumor should be
 * placed and only placed in the social room". Before this, every snoop drew
 * from one pool weighted 3:1, so the rumor room taught facts and the wardrobe
 * taught rumors - and the `rumor` / `knowledge` roles in `SLOTS` were
 * decoration nothing read.
 */
describe('a room teaches what its slot says it teaches', () => {
  const kindsAt = (phase, locationId) => [
    ...new Set(snoopsIn(locationId).map((a) => a.learns)),
  ];

  it.each(PHASES)('%s: the social room is the only place rumors turn up', (phase) => {
    const rumorRooms = mapFor(phase).filter((id) =>
      kindsAt(phase, id).includes('rumor'),
    );
    expect(rumorRooms.length).toBeGreaterThan(0);
    for (const id of rumorRooms) {
      expect(rolesAt(phase, id), `${id} teaches rumors`).toContain('rumor');
    }
  });

  it.each(PHASES)('%s: a room carrying the rumor role actually teaches them', (phase) => {
    for (const id of mapFor(phase)) {
      if (!rolesAt(phase, id).includes('rumor')) continue;
      expect(kindsAt(phase, id), `${id} (${slotAt(phase, id)})`).toContain('rumor');
    }
  });

  it.each(PHASES)('%s: a room carrying the knowledge role teaches facts', (phase) => {
    for (const id of mapFor(phase)) {
      if (!rolesAt(phase, id).includes('knowledge')) continue;
      if (NOT_WORK_ROOMS.includes(id)) continue;
      expect(kindsAt(phase, id), `${id} (${slotAt(phase, id)})`).toContain('fact');
    }
  });

  /**
   * No room teaches both. Not a technical requirement - the pool code handles
   * a mixed room fine - but the point of the split is that the player learns
   * the map's grammar once, and a room that does both teaches them nothing.
   */
  it('never mixes the two in one room', () => {
    for (const [id, actions] of Object.entries(SOLO_ACTIONS)) {
      const kinds = new Set(actions.filter((a) => a.learns).map((a) => a.learns));
      expect([...kinds], id).not.toEqual(expect.arrayContaining(['fact', 'rumor']));
    }
  });

  it('names the kind rather than saying only that it learns', () => {
    for (const [id, actions] of Object.entries(SOLO_ACTIONS)) {
      for (const action of actions) {
        if (!action.learns) continue;
        expect(['fact', 'rumor'], `${id}.${action.id}`).toContain(action.learns);
      }
    }
  });
});

/**
 * And every action the player can see has words in both locales. A missing key
 * renders as the key, which is how a bare `linger_by_the_urn` reaches a screen.
 */
describe('every action is written in both languages', () => {
  const ids = Object.values(SOLO_ACTIONS).flatMap((list) => list.map((a) => a.id));

  it.each(ids)('%s has a label and a result in en and zh', (id) => {
    for (const [name, dict] of [
      ['en', en],
      ['zh', zh],
    ]) {
      expect(dict.solo?.[id], `${name}.solo.${id}`).toBeTruthy();
      expect(dict.solo?.[`${id}_result`], `${name}.solo.${id}_result`).toBeTruthy();
    }
  });
});
