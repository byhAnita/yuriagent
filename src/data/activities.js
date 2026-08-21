/**
 * Activity type table.
 *
 * A character card declares which activity types she performs (activityProfile.types).
 * calendar.js turns those into concrete solo schedule slots for each week phase.
 * Keeping the table here rather than on the card keeps cards portable across casts:
 * a card from any group can be dropped into any playthrough.
 *
 * exposureBase feeds systems/exposure.js. It is the visibility floor of the activity
 * itself, before location, time block and player secrecy are applied.
 * See CLAUDE.md sections 5b and 10.
 */

export const PHASES = ['prep', 'peak', 'recovery'];

export const ACTIVITIES = {
  // --- studio / preparation, low visibility -------------------------------
  vocal_recording:   { location: 'recording_studio', exposureBase: 10, phases: ['prep', 'peak'] },
  solo_recording:    { location: 'recording_studio', exposureBase: 10, phases: ['prep'] },
  dance_practice:    { location: 'dance_studio',     exposureBase: 15, phases: ['prep', 'peak'] },
  choreo_session:    { location: 'dance_studio',     exposureBase: 15, phases: ['prep'] },
  group_practice:    { location: 'practice_room',    exposureBase: 20, phases: ['prep', 'peak'] },
  script_reading:    { location: 'meeting_room',     exposureBase: 20, phases: ['prep'] },
  fitting:           { location: 'wardrobe',         exposureBase: 15, phases: ['prep'] },
  tour_rehearsal:    { location: 'rehearsal_hall',   exposureBase: 20, phases: ['prep', 'peak'] },

  // --- public output, high visibility -------------------------------------
  music_show:        { location: 'broadcast_studio', exposureBase: 85, phases: ['peak'] },
  radio_host:        { location: 'radio_station',    exposureBase: 70, phases: ['peak', 'recovery'] },
  variety_taping:    { location: 'variety_studio',   exposureBase: 80, phases: ['peak'] },
  drama_shoot:       { location: 'drama_set',        exposureBase: 65, phases: ['peak', 'prep'] },
  photoshoot:        { location: 'photo_studio',     exposureBase: 55, phases: ['peak'] },
  brand_event:       { location: 'event_hall',       exposureBase: 90, phases: ['peak'] },
  showcase:          { location: 'event_hall',       exposureBase: 95, phases: ['peak'] },
  fan_signing:       { location: 'event_hall',       exposureBase: 90, phases: ['peak'] },

  // --- downtime, where relationships actually move -------------------------
  free:              { location: null,               exposureBase: 30, phases: ['recovery'] },
  cafe_break:        { location: 'cafe',             exposureBase: 60, phases: ['recovery', 'peak'] },
  dorm_rest:         { location: 'dorm',             exposureBase: 10, phases: ['recovery'] },
  late_practice:     { location: 'practice_room',    exposureBase: 8,  phases: ['recovery', 'prep'] },
};

/** Activity types that leave a member reachable for a real conversation. */
export const APPROACHABLE = new Set([
  'free', 'cafe_break', 'dorm_rest', 'late_practice',
  'fitting', 'vocal_recording', 'solo_recording', 'dance_practice',
]);
