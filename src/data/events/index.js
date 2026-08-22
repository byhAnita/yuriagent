/**
 * Anchor events. CLAUDE.md sections 9 and 10.
 *
 * Five in the whole campaign, one per event slot on the three phase maps. Each
 * takes a WEEKDAY and the whole of it, replacing whatever the calendar would
 * otherwise have put there - the Music Bank recording genuinely is that
 * Thursday. Each fires exactly once and its site leaves the map afterwards.
 *
 * An event is not a branching node and not a script. It is the same scene
 * engine every other scene runs on, given three things an ordinary block does
 * not get:
 *
 *   1. a FRAME - a setting and two to four situations the day may pass through
 *   2. the `event` REGISTER - literary, sensory, room for a day to breathe
 *   3. sixteen turns instead of eight (SCENE_TURN_LIMITS.event)
 *
 * THE RULE, from `sceneFrames.js` and section 11: a movement sets the
 * SITUATION and never the OUTCOME. "The green room, and who talks to whom in
 * it" is a place. "She tells you she was scared" is a script, and section 1
 * rules out branching text adventures explicitly. Everything the engine
 * already does - standing, dossier, her voice, the meters - writes what
 * actually happens.
 *
 * All five are held in one table rather than one file each, because keeping
 * them consistent matters more than keeping them apart: they are short, they
 * are written by a person reading them top to bottom, and the failure mode of
 * authored content is drift between pieces nobody reads together.
 *
 * MODEL-FACING ENGLISH, never localized. The title and blurb the player reads
 * are separate keys under `event.*` in `i18n/` (section 19).
 *
 * WHY THE WHOLE CAST IS PRESENT AND ONLY ONE OF THEM SPEAKS
 *
 * Section 9 caps interactive scenes at two members, and section 10c retires
 * that cap only once client-side rotation ships. So an event does what a
 * crowded room already does: everybody is in `presentIds`, one member is in
 * `rosterIds`, and the parser's roster rule keeps member bleed structurally
 * impossible. That is not a compromise here, it is the point of the day -
 * choosing one of them in front of the other four, at an event where the
 * exposure floor is already high, is the loudest thing the player can do.
 */

export const EVENTS = {
  concept_meeting: {
    id: 'concept_meeting',
    phase: 'prep',
    slot: 'event_a',
    frame: {
      setting:
        'A long table in the meeting room, printouts of mood boards face down until ' +
        'somebody turns them over, coffee going cold. The concept for the comeback ' +
        'gets decided today, and everyone in the room knows it.',
      movements: [
        'the boards going up, and which one she reacts to before she can stop herself',
        'the part of the concept that asks something of her specifically',
        'an idea getting cut, and the room going carefully polite',
        'afterwards, in the corridor, once the door has shut behind everyone',
      ],
    },
  },

  music_bank: {
    id: 'music_bank',
    phase: 'comeback',
    slot: 'event_a',
    frame: {
      setting:
        'Broadcast day. A waiting room shared with two other groups, a corridor that ' +
        'never empties, three minutes of stage somewhere in the middle of fourteen ' +
        'hours, and cameras that are on whether or not anyone is looking at them.',
      movements: [
        'the long wait before anything happens, and what she does with it',
        'the run-through, and whatever goes wrong in it',
        'the three minutes themselves, from wherever the player is standing',
        'the drive back, when it is finally over and nobody has to perform',
      ],
    },
  },

  fan_meeting: {
    id: 'fan_meeting',
    phase: 'comeback',
    slot: 'event_b',
    frame: {
      setting:
        'Four hours of faces. A hall, a table, a line that does not visibly shorten, ' +
        'and the particular exhaustion of being warm to nine hundred strangers in a row.',
      movements: [
        'the first hour, when it is still genuinely fun',
        'something a fan says that lands harder than it should',
        'the last stretch, and what is left of her by then',
        'the empty hall afterwards, with the chairs still out',
      ],
    },
  },

  company_cruise: {
    id: 'company_cruise',
    phase: 'rest',
    slot: 'event_a',
    frame: {
      setting:
        'The agency has put everyone on a dinner cruise. Fairy lights, a set menu, ' +
        'executives making speeches, and the specific awkwardness of compulsory fun ' +
        'with the people you work for.',
      movements: [
        'the speeches, and what gets said across the table while they run',
        'the deck outside, which is colder and much quieter',
        'somebody from the company noticing who is standing with whom',
        'the last hour, when the boat is turning back',
      ],
    },
  },

  island_trip: {
    id: 'island_trip',
    phase: 'rest',
    slot: 'event_b',
    frame: {
      setting:
        'A day off the mainland at the end of a cycle. Ferry, rented bicycles, a ' +
        'beach nobody is filming, and the first day in nine weeks with nothing at all ' +
        'scheduled on it.',
      movements: [
        'the crossing, and how differently she holds herself once the city is gone',
        'the middle of the day, when it becomes clear nobody is coming to collect anyone',
        'the kind of talk that only happens where nobody is working',
        'the last ferry, and whether anyone wants to be on it',
      ],
    },
  },
};

export const EVENT_IDS = Object.keys(EVENTS);

/** The key `flags.firedEvents` holds, and `calendar.eventDays` filters on. */
export function eventKey(phase, slot) {
  return `${phase}:${slot}`;
}

/**
 * The event authored for this slot on this phase map, or null.
 *
 * Null is a real answer, not a failure: a phase map may carry an event slot
 * that has no content written for it yet, and the correct behaviour then is an
 * ordinary day rather than a crash. There is a test that the shipped maps have
 * no such holes.
 */
export function eventFor(phase, slot) {
  return EVENT_IDS.map((id) => EVENTS[id]).find((e) => e.phase === phase && e.slot === slot) ?? null;
}
