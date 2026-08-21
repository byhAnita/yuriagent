/**
 * Location table.
 *
 * exposureBase  - visibility to the OUTSIDE world. Feeds scandal risk and the
 *                 admissibility gain from taking a risk in public.
 * presence      - how many other cast members can witness what happens here.
 *                 Feeds jealousy, independently of exposureBase.
 *
 * The two are deliberately NOT correlated. Public places raise both together;
 * the dorm is the one place that splits them - nearly invisible to the outside
 * world, and watched by everyone who lives there. That split is the player's
 * main strategic instrument. See CLAUDE.md sections 5b and 10.
 */

export const LOCATIONS = {
  practice_room: {
    exposureBase: 25,
    presence: 'group_phase',   // full cast during PREP and COMEBACK, empty otherwise
    label: 'X Practice Room',
    note: 'Company staff pass through constantly. Never truly private.',
  },
  wardrobe: {
    exposureBase: 20,
    presence: 'few',
    label: 'Wardrobe Room',
    note: "The assistant's own territory. Being here needs no excuse.",
  },
  corridor: {
    exposureBase: 45,
    presence: 'random',
    label: 'X Entertainment Corridor',
    note: 'Transitional. You do not go here to find someone, you run into them.',
  },
  drama_set: {
    exposureBase: 65,
    presence: 'solo',
    label: 'Drama Filming Location',
    note: 'Outside crew and press. Only the member shooting that day is here.',
  },
  cafe: {
    exposureBase: 60,
    presence: 'few',
    label: 'Cafe',
    note: 'Public. Phones. The classic place to be seen by the wrong person.',
  },
  broadcast_studio: {
    exposureBase: 85,
    presence: 'group_phase',
    label: 'Broadcast Studio',
    note: 'Maximum visibility. COMEBACK week only.',
  },

  // --- the dorm: low outside exposure, maximum internal witness ------------
  dorm_living: {
    exposureBase: 15,
    presence: 'all',
    label: 'X Dorm - Living Room',
    note: 'Invisible to the public. Visible to every single person you live with.',
  },
  dorm_kitchen: {
    exposureBase: 12,
    presence: 'few',
    label: 'X Dorm - Kitchen',
    note: 'Late-night territory. Someone is always awake.',
  },
  dorm_room: {
    exposureBase: 5,
    presence: 'solo',
    perMember: true,
    label: 'X Dorm - Bedroom',
    approachWitnessed: true,
    note: 'The scene is private. The approach is not - the others see you go in.',
  },
};

/**
 * approachWitnessed: entering this location generates a witnessed event for every
 * cast member currently in dorm_living, even though the scene itself never leaks
 * outward. Private scene, public approach.
 */
export const DORM_LOCATIONS = ['dorm_living', 'dorm_kitchen', 'dorm_room'];
