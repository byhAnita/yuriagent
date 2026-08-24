import { describe, it, expect } from 'vitest';
import {
  ROLES,
  REQUIRED_ROLES,
  SLOTS,
  CONSTANT_SLOTS,
  PHASE_MAP,
  PHASES,
  resolveSlot,
  mapFor,
  slotAt,
  rolesAt,
  hasRole,
  locationForRole,
  locationsForRole,
  eventSlots,
} from './phaseMaps.js';
import { LOCATIONS } from './locations.js';

describe('the slot template', () => {
  it('points every slot at a location that exists', () => {
    for (const phase of PHASES) {
      for (const [slot, id] of Object.entries(PHASE_MAP[phase])) {
        expect(SLOTS[slot], `${phase}.${slot} is not a declared slot`).toBeDefined();
        expect(LOCATIONS[id], `${phase}.${slot} -> ${id} is not a location`).toBeDefined();
      }
    }
  });

  it('points every constant slot at a location that exists', () => {
    for (const [slot, s] of Object.entries(CONSTANT_SLOTS)) {
      expect(LOCATIONS[s.location], `${slot} -> ${s.location}`).toBeDefined();
    }
  });

  it('declares only known roles', () => {
    const all = [...Object.values(SLOTS), ...Object.values(CONSTANT_SLOTS)];
    for (const slot of all) {
      for (const role of slot.roles) expect(ROLES).toContain(role);
    }
  });
});

/**
 * The rule that makes the template worth having. Section 21: a design rule that
 * is not asserted is one that gets quietly broken later, and "COMEBACK has no
 * rumor room" is exactly the kind of hole that survives a content edit.
 */
describe('every phase carries every required role', () => {
  for (const phase of PHASES) {
    for (const role of REQUIRED_ROLES) {
      it(`${phase} has somewhere to ${role}`, () => {
        expect(locationForRole(phase, role), `${phase} is missing ${role}`).toBeTruthy();
      });
    }
  }

  it('offers a private date and a rest spot in every phase, via the dorm', () => {
    for (const phase of PHASES) {
      expect(locationForRole(phase, 'private_date')).toBe('dorm_room');
      expect(locationForRole(phase, 'rest')).toBe('dorm_player_room');
    }
  });
});

/**
 * Do not let the location list outgrow the cast. Five members across three
 * blocks means at most five occupied locations at any moment, so a map much
 * larger than that is mostly empty rooms - which is solo work, and good, but it
 * dilutes the chance of finding anyone into a search problem.
 */
describe('map size', () => {
  it('keeps every phase inside the ceiling', () => {
    for (const phase of PHASES) {
      expect(mapFor(phase).length).toBeLessThanOrEqual(12);
    }
  });

  it('gives REST the widest map, because the cast scatters', () => {
    expect(mapFor('rest').length).toBeGreaterThanOrEqual(mapFor('prep').length);
  });

  it('has no duplicate locations inside one phase', () => {
    for (const phase of PHASES) {
      const ids = Object.values(PHASE_MAP[phase]);
      expect(new Set(ids).size, `${phase} points two slots at one room`).toBe(ids.length);
    }
  });
});

describe('resolveSlot', () => {
  it('resolves a rotating slot per phase', () => {
    expect(resolveSlot('prep', 'workroom_b')).toBe('wardrobe');
    expect(resolveSlot('comeback', 'workroom_b')).toBe('makeup_room');
    expect(resolveSlot('rest', 'workroom_b')).toBe('photo_studio');
  });

  it('resolves a constant slot the same way in every phase', () => {
    for (const phase of PHASES) expect(resolveSlot(phase, 'her_room')).toBe('dorm_room');
  });

  it('returns null for a slot this phase does not fill', () => {
    // PREP grew an `event_b` when the MV shoot landed, so the example here had
    // to move. `solo_site_b` is REST-only and is now the one that is genuinely
    // unfilled - the assertion is about the null, not about which slot it is.
    expect(resolveSlot('prep', 'solo_site_b')).toBeNull();
    expect(resolveSlot('comeback', 'solo_site_b')).toBeNull();
  });

  it('returns null for junk rather than throwing', () => {
    expect(resolveSlot('prep', 'nowhere')).toBeNull();
    expect(resolveSlot('nophase', 'venue')).toBeNull();
  });
});

describe('slotAt and rolesAt', () => {
  it('finds the slot a location fills this phase', () => {
    expect(slotAt('prep', 'bistro')).toBe('venue');
    expect(slotAt('comeback', 'cafe')).toBe('venue');
  });

  it('returns null for a location that is off the map this phase', () => {
    expect(slotAt('comeback', 'bistro')).toBeNull();
    expect(slotAt('prep', 'music_bank')).toBeNull();
  });

  it('gives the venue its roles wherever the venue happens to be', () => {
    expect(rolesAt('prep', 'bistro')).toEqual(rolesAt('comeback', 'cafe'));
    expect(hasRole('prep', 'bistro', 'public_date')).toBe(true);
    expect(hasRole('comeback', 'cafe', 'parttime')).toBe(true);
  });

  it('gives an off-map location no roles at all', () => {
    expect(rolesAt('prep', 'music_bank')).toEqual([]);
    expect(hasRole('prep', 'music_bank', 'chat')).toBe(false);
  });

  it('never lets an ordinary room carry the event role', () => {
    for (const phase of PHASES) {
      for (const id of locationsForRole(phase, 'chat')) {
        expect(hasRole(phase, id, 'event'), `${phase}:${id}`).toBe(false);
      }
    }
  });
});

describe('event sites', () => {
  /**
   * Two each, everywhere. PREP had one until the MV shoot landed, and that was
   * a hole rather than a preference - the concept meeting had nothing to hand
   * off to, so the cycle chain (PROPOSALS 20) had no second link.
   */
  it('gives every phase two', () => {
    for (const phase of PHASES) {
      expect(eventSlots(phase), phase).toEqual(['event_a', 'event_b']);
    }
  });

  it('never places more events than there are weekdays to spend', () => {
    for (const phase of PHASES) expect(eventSlots(phase).length).toBeLessThanOrEqual(2);
  });

  it('puts every event site somewhere the whole cast can be', () => {
    for (const phase of PHASES) {
      for (const slot of eventSlots(phase)) {
        expect(LOCATIONS[resolveSlot(phase, slot)].presence).toBe('all');
      }
    }
  });
});
