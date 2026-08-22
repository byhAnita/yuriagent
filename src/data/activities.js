/**
 * Activity type table.
 *
 * Two layers, matching the calendar (CLAUDE.md section 10):
 *   GROUP      - activities of group X, scheduled for the whole cast at once.
 *   INDIVIDUAL - solo careers. A card declares which of these it does via
 *                activityProfile.types.
 *
 * Keeping the table here rather than on the card keeps cards portable: a card
 * built from any real group drops into any cast without touching calendar code.
 *
 * exposureBase is the visibility floor of the activity itself, before location,
 * time block and player secrecy are applied by systems/exposure.js.
 */

export const PHASES = ['prep', 'comeback', 'rest'];

/** Group X activities. Scheduled by phase for the entire cast. */
export const GROUP_ACTIVITIES = {
  group_practice:  { location: 'practice_room',    exposureBase: 25, phases: ['prep', 'comeback'] },
  vocal_recording: { location: 'practice_room',    exposureBase: 15, phases: ['prep'] },
  concept_meeting: { location: 'corridor',         exposureBase: 30, phases: ['prep'] },
  mv_shoot:        { location: 'broadcast_studio', exposureBase: 60, phases: ['prep'] },
  fitting:         { location: 'wardrobe',         exposureBase: 20, phases: ['prep', 'comeback'] },
  music_show:      { location: 'broadcast_studio', exposureBase: 90, phases: ['comeback'] },
  fan_signing:     { location: 'broadcast_studio', exposureBase: 90, phases: ['comeback'] },
  variety_taping:  { location: 'broadcast_studio', exposureBase: 80, phases: ['comeback'] },
};

/** Individual careers. Referenced by activityProfile.types on a card. */
export const SOLO_ACTIVITIES = {
  drama_shoot:    { location: 'drama_set',     exposureBase: 65, phases: ['prep', 'rest'] },
  script_reading: { location: 'drama_set',     exposureBase: 40, phases: ['prep', 'rest'] },
  solo_recording: { location: 'practice_room', exposureBase: 10, phases: ['prep', 'rest'] },
  tour_rehearsal: { location: 'practice_room', exposureBase: 20, phases: ['rest'] },
  photoshoot:     { location: 'wardrobe',      exposureBase: 55, phases: ['rest', 'prep'] },
  brand_event:    { location: 'cafe',          exposureBase: 90, phases: ['rest'] },
  makeup_work:    { location: 'wardrobe',      exposureBase: 25, phases: ['rest', 'prep'] },
  radio_host:     { location: 'broadcast_studio', exposureBase: 70, phases: ['rest'] },
};

/** Downtime. Where relationships actually move. */
export const IDLE_ACTIVITIES = {
  free:          { location: null,            exposureBase: 30, phases: ['rest'] },
  cafe_break:    { location: 'cafe',          exposureBase: 60, phases: ['rest', 'comeback'] },
  dorm_rest:     { location: 'dorm_living',   exposureBase: 15, phases: ['rest', 'comeback', 'prep'] },
  dorm_late:     { location: 'dorm_kitchen',  exposureBase: 12, phases: ['rest', 'comeback', 'prep'] },
  in_her_room:   { location: 'dorm_room',     exposureBase: 5,  phases: ['rest', 'comeback', 'prep'] },
  late_practice: { location: 'practice_room', exposureBase: 8,  phases: ['rest', 'prep'] },
};

export const ACTIVITIES = { ...GROUP_ACTIVITIES, ...SOLO_ACTIVITIES, ...IDLE_ACTIVITIES };

/**
 * What she is actually doing here, for the prompt.
 *
 * MODEL-FACING ENGLISH, never localized and never shown to the player - the
 * player-facing labels live in `i18n/` under `activity.*` (section 19). Kept in
 * its own map rather than on the table rows so the numeric columns stay
 * readable.
 *
 * This is the single biggest source of scene-to-scene variety in the game, and
 * it was missing entirely: the calendar has always known that Irene is in the
 * practice room for `group_practice`, and block 4 said only "Location: X
 * Practice Room". So the model had to invent a reason for her to be standing
 * there, every scene in that room opened the same way, and she could never say
 * the obvious natural thing - that the new choreography is giving her trouble.
 *
 * Written as a clause that completes "She is ...", present tense, no name.
 */
export const ACTIVITY_DOING = {
  // group
  group_practice: 'running the new choreography with the other four',
  vocal_recording: 'recording her parts for the title track',
  concept_meeting: 'sitting through a concept meeting for the comeback',
  mv_shoot: 'on set for the music video, between takes',
  fitting: 'being fitted for comeback stage outfits',
  music_show: 'at a music show, waiting on a stage slot',
  fan_signing: 'partway through a fansign',
  variety_taping: 'taping a variety appearance',

  // solo careers
  drama_shoot: 'shooting her drama, waiting out a setup',
  script_reading: 'working through a script for her drama',
  solo_recording: 'recording something of her own',
  tour_rehearsal: 'rehearsing for the tour',
  photoshoot: 'shooting for a magazine',
  brand_event: 'making an appearance for a brand',
  makeup_work: 'doing makeup work',
  radio_host: 'hosting her radio slot',

  // downtime
  free: 'not working, for once',
  cafe_break: 'out for coffee',
  dorm_rest: 'at the dorm with nothing scheduled',
  dorm_late: 'up late, in the kitchen',
  in_her_room: 'in her own room',
  late_practice: 'practising alone, long after she needed to be',
};

/** The clause for one activity, or null if it is not one we have words for. */
export function doingLine(activity) {
  return ACTIVITY_DOING[activity] ?? null;
}

/** Activity types that leave a member reachable for a real conversation. */
export const APPROACHABLE = new Set([
  'free', 'cafe_break', 'dorm_rest', 'dorm_late', 'in_her_room', 'late_practice',
  'fitting', 'vocal_recording', 'solo_recording', 'makeup_work', 'script_reading',
]);
