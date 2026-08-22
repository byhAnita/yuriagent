/**
 * The map is a template of role slots, filled differently each phase.
 * CLAUDE.md section 10.
 *
 * The shape is constant for the whole campaign - the player learns the grammar
 * once - while the contents turn over with the phase. A role is carried by the
 * SLOT, not by the location, and one slot can carry several roles.
 *
 * An earlier draft capped the map as "eight to ten locations per phase", which
 * is a number somebody has to remember. Slots make the same constraint
 * structural: you cannot add an eleventh room without adding a slot, and a slot
 * has to justify itself by carrying a role nothing else carries.
 *
 * NOTHING ELSE MAY HARDCODE A LOCATION ID WHERE A ROLE IS MEANT. Tasks name a
 * slot; activities name a slot. Both resolve through here. Binding to a
 * location id does not survive the map rotating - three of the five shipped
 * tasks pointed at `corridor` or `broadcast_studio`, and neither exists as an
 * ordinary room once PREP gives way to COMEBACK.
 */

/**
 * chat          - members can be here, so a scene can happen
 * task          - a daily objective can be discharged here
 * knowledge     - snooping can turn up a learnable fact
 * rumor         - the room where talk circulates
 * public_date   - a weekend date that everybody hears about
 * private_date  - a weekend date nobody sees
 * parttime      - a shift, for credits
 * rest          - the only place that gives energy back
 * event         - an authored whole-day scene fires here, once per cycle
 */
export const ROLES = [
  'chat',
  'task',
  'knowledge',
  'rumor',
  'public_date',
  'private_date',
  'parttime',
  'rest',
  'event',
];

/**
 * Roles that every phase must offer, asserted in phaseMaps.test.js.
 *
 * `private_date` and `rest` are not here because they live on the constant
 * dorm slots and cannot go missing. `event` is not here either - a phase is
 * allowed one event site or two.
 */
export const REQUIRED_ROLES = ['chat', 'task', 'knowledge', 'rumor', 'public_date', 'parttime'];

/** The rotating slots. Their contents change with the phase. */
export const SLOTS = {
  workroom_a: { roles: ['chat', 'task', 'knowledge'] },
  workroom_b: { roles: ['chat', 'task', 'knowledge'] },
  solo_site: { roles: ['chat', 'task', 'knowledge'] },
  solo_site_b: { roles: ['chat', 'knowledge'] },
  social: { roles: ['chat', 'rumor'] },
  venue: { roles: ['chat', 'public_date', 'parttime', 'knowledge'] },
  event_a: { roles: ['event'] },
  event_b: { roles: ['event'] },
};

/**
 * The constant slots. Same location in every phase, because the dorm does not
 * move with the comeback cycle.
 */
export const CONSTANT_SLOTS = {
  dorm_shared: { roles: ['chat', 'knowledge'], location: 'dorm_living' },
  dorm_kitchen: { roles: ['chat', 'knowledge'], location: 'dorm_kitchen' },
  her_room: { roles: ['chat', 'private_date'], location: 'dorm_room' },
  your_room: { roles: ['rest'], location: 'dorm_player_room' },
};

/**
 * phase -> slot -> location id.
 *
 * REST keeps workrooms and gains a second solo site because the solo layer
 * resumes fully that week (section 10) and the group layer stops entirely.
 * They are individual-career sites rather than company ones.
 */
export const PHASE_MAP = {
  prep: {
    workroom_a: 'practice_room',
    workroom_b: 'wardrobe',
    solo_site: 'drama_set',
    social: 'drink_room',
    venue: 'bistro',
    event_a: 'meeting_room',
  },
  comeback: {
    workroom_a: 'broadcast_studio',
    workroom_b: 'makeup_room',
    solo_site: 'drama_set',
    social: 'green_room',
    venue: 'cafe',
    event_a: 'music_bank',
    event_b: 'fan_meeting_hall',
  },
  rest: {
    workroom_a: 'practice_room',
    workroom_b: 'photo_studio',
    solo_site: 'drama_set',
    solo_site_b: 'broadcast_studio',
    social: 'hair_salon',
    venue: 'han_river',
    event_a: 'cruise',
    event_b: 'island',
  },
};

export const PHASES = Object.keys(PHASE_MAP);

/** Where a slot points this phase, or null if the phase does not fill it. */
export function resolveSlot(phase, slot) {
  if (CONSTANT_SLOTS[slot]) return CONSTANT_SLOTS[slot].location;
  return PHASE_MAP[phase]?.[slot] ?? null;
}

/** Every location reachable this phase, rotating slots then constant ones. */
export function mapFor(phase) {
  const rotating = Object.values(PHASE_MAP[phase] ?? {});
  const constant = Object.values(CONSTANT_SLOTS).map((s) => s.location);
  return [...new Set([...rotating, ...constant])];
}

/** Which slot a location fills this phase, or null if it is off the map. */
export function slotAt(phase, locationId) {
  const constant = Object.entries(CONSTANT_SLOTS).find(([, s]) => s.location === locationId);
  if (constant) return constant[0];

  const rotating = Object.entries(PHASE_MAP[phase] ?? {}).find(([, id]) => id === locationId);
  return rotating ? rotating[0] : null;
}

/** What you can do here this phase. Empty if the location is off the map. */
export function rolesAt(phase, locationId) {
  const slot = slotAt(phase, locationId);
  if (!slot) return [];
  return (SLOTS[slot] ?? CONSTANT_SLOTS[slot])?.roles ?? [];
}

export function hasRole(phase, locationId, role) {
  return rolesAt(phase, locationId).includes(role);
}

/** The location carrying a role this phase. Slot order decides ties. */
export function locationForRole(phase, role) {
  for (const [slot, id] of Object.entries(PHASE_MAP[phase] ?? {})) {
    if (SLOTS[slot]?.roles.includes(role)) return id;
  }
  for (const [, s] of Object.entries(CONSTANT_SLOTS)) {
    if (s.roles.includes(role)) return s.location;
  }
  return null;
}

/** Every location carrying a role this phase. */
export function locationsForRole(phase, role) {
  const out = [];
  for (const [slot, id] of Object.entries(PHASE_MAP[phase] ?? {})) {
    if (SLOTS[slot]?.roles.includes(role)) out.push(id);
  }
  for (const [, s] of Object.entries(CONSTANT_SLOTS)) {
    if (s.roles.includes(role)) out.push(s.location);
  }
  return [...new Set(out)];
}

/** The event sites this phase, in firing order. */
export function eventSlots(phase) {
  return ['event_a', 'event_b'].filter((slot) => PHASE_MAP[phase]?.[slot]);
}
