/**
 * Location table.
 *
 * exposureBase  - visibility to the OUTSIDE world. Feeds scandal risk and the
 *                 admissibility gain from taking a risk in public.
 * presence      - how many other cast members can witness what happens there.
 *                 Feeds jealousy, independently of exposureBase.
 * zone          - which part of the map it lives under. The dorm is a second
 *                 step in the UI because it holds several rooms with very
 *                 different meanings.
 *
 * exposure and presence are deliberately NOT correlated. Public places raise
 * both together; the dorm is the one place that splits them - nearly invisible
 * to the outside world, and watched by everyone who lives there. That split is
 * the player's main strategic instrument. See CLAUDE.md sections 5b and 10.
 */

export const ZONES = ['company', 'out', 'dorm'];

export const LOCATIONS = {
  practice_room: {
    zone: 'company',
    exposureBase: 25,
    presence: 'group_phase',
    label: 'X Practice Room',
    note: 'Company staff pass through constantly. Never truly private.',
  },
  wardrobe: {
    zone: 'company',
    exposureBase: 20,
    presence: 'few',
    label: 'Wardrobe Room',
    note: "The assistant's own territory. Being here needs no excuse.",
  },
  corridor: {
    zone: 'company',
    exposureBase: 45,
    presence: 'random',
    label: 'X Entertainment Corridor',
    note: 'Transitional. You do not go here to find someone, you run into them.',
  },
  broadcast_studio: {
    zone: 'company',
    exposureBase: 85,
    presence: 'group_phase',
    label: 'Broadcast Studio',
    note: 'Maximum visibility. COMEBACK week only.',
  },

  drama_set: {
    zone: 'out',
    exposureBase: 65,
    presence: 'solo',
    label: 'Filming Location',
    note: 'Outside crew and press. Dramas, MVs, variety - whoever is shooting today.',
  },
  cafe: {
    zone: 'out',
    exposureBase: 60,
    presence: 'few',
    label: 'Cafe',
    note: 'Public. Phones. The classic place to be seen by the wrong person.',
  },

  // --- PREP ---------------------------------------------------------------
  drink_room: {
    zone: 'company',
    exposureBase: 30,
    presence: 'few',
    label: 'Canteen & Drink Room',
    note: 'Where staff talk. Nothing said here stays in the room for long.',
  },
  bistro: {
    zone: 'out',
    exposureBase: 60,
    presence: 'few',
    label: 'Bistro',
    note: 'Off-duty and lit for it. A table for two here is a statement.',
  },
  meeting_room: {
    zone: 'company',
    exposureBase: 35,
    presence: 'all',
    label: 'X Meeting Room',
    note: 'The label side of the building. Decisions land here before anyone is asked.',
  },

  // --- COMEBACK -----------------------------------------------------------
  makeup_room: {
    zone: 'company',
    exposureBase: 25,
    presence: 'few',
    label: 'Make-up Room',
    note: 'Mirrors and stylists. Close quarters, and nobody is ever quite alone.',
  },
  green_room: {
    zone: 'out',
    exposureBase: 55,
    presence: 'group_phase',
    label: 'Green Room',
    note: 'Other groups, other staff, a television on. Talk travels fast.',
  },
  music_bank: {
    zone: 'out',
    exposureBase: 90,
    presence: 'all',
    label: 'Music Bank Studio',
    note: 'Cameras, cables, and four hundred people. Maximum visibility.',
  },
  fan_meeting_hall: {
    zone: 'out',
    exposureBase: 88,
    presence: 'all',
    label: 'Fan Meeting Hall',
    note: 'Every phone in the room is pointed at the five of them.',
  },

  // --- REST ---------------------------------------------------------------
  photo_studio: {
    zone: 'out',
    exposureBase: 45,
    presence: 'solo',
    label: 'Photo Studio',
    note: 'A crew that does not know her, working to a shot list.',
  },
  hair_salon: {
    zone: 'out',
    exposureBase: 40,
    presence: 'few',
    label: 'Hair Salon',
    note: 'Two hours in a chair. People say things they would not say standing up.',
  },
  han_river: {
    zone: 'out',
    exposureBase: 70,
    presence: 'few',
    label: 'Han River Park',
    note: 'Open, ordinary, and full of people with cameras in their pockets.',
  },
  cruise: {
    zone: 'out',
    exposureBase: 55,
    presence: 'all',
    label: 'Company Cruise',
    note: 'Nowhere to walk off to. The whole company, on one boat, for a day.',
  },
  island: {
    zone: 'out',
    exposureBase: 50,
    presence: 'all',
    label: 'Jeju',
    note: 'Off the mainland and off the schedule. A day that will not come again.',
  },

  // --- the dorm: low outside exposure, maximum internal witness ------------
  dorm_living: {
    zone: 'dorm',
    exposureBase: 15,
    presence: 'all',
    label: 'X Dorm - Living Room',
    note: 'Invisible to the public. Visible to every single person you live with.',
  },
  dorm_kitchen: {
    zone: 'dorm',
    exposureBase: 12,
    presence: 'few',
    label: 'X Dorm - Kitchen',
    note: 'Late-night territory. Someone is always awake.',
  },
  dorm_room: {
    zone: 'dorm',
    exposureBase: 5,
    presence: 'solo',
    perMember: true,
    /** You may enter her room at the same point you may reach for her hand. */
    entryIntimacy: 50,
    label: 'X Dorm - Bedroom',
    approachWitnessed: true,
    note: 'The scene is private. The approach is not - the others see you go in.',
  },
  dorm_player_room: {
    zone: 'dorm',
    exposureBase: 5,
    presence: 'solo',
    label: 'X Dorm - Your Room',
    note: 'The only place that gives anything back.',
  },
};

/**
 * approachWitnessed: entering this location generates a witnessed event for every
 * cast member currently in dorm_living, even though the scene itself never leaks
 * outward. Private scene, public approach.
 */
export const DORM_LOCATIONS = ['dorm_living', 'dorm_kitchen', 'dorm_room', 'dorm_player_room'];

/** Where a member counts as being home for the evening. */
export const DORM_OCCUPANCY = ['dorm_living', 'dorm_kitchen', 'dorm_room'];

export function locationsInZone(zone) {
  return Object.entries(LOCATIONS)
    .filter(([, l]) => l.zone === zone)
    .map(([id]) => id);
}
