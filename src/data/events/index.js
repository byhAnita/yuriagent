/**
 * Anchor events. CLAUDE.md sections 9 and 10.
 *
 * One per event slot on the three phase maps, six in all. Each takes a WEEKDAY
 * and the whole of it, replacing whatever the calendar would
 * otherwise have put there - the Music Bank recording genuinely is that
 * Thursday. Each fires exactly once and its site leaves the map afterwards.
 *
 * An event is not a branching node and not a script. It is the same scene
 * engine every other scene runs on, given three things an ordinary block does
 * not get:
 *
 *   1. a FRAME - a setting, the situations the day may pass through, and the
 *      business it is not allowed to leave without settling
 *   2. the `event` REGISTER - literary, sensory, room for a day to breathe
 *   3. sixteen turns instead of eight (SCENE_TURN_LIMITS.event)
 *   4. an ESTABLISHING BEAT before anyone speaks (`establishingDirective`)
 *
 * THE RULE, from `sceneFrames.js` and section 11: a movement sets the
 * SITUATION and never the OUTCOME. "The green room, and who talks to whom in
 * it" is a place. "She tells you she was scared" is a script, and section 1
 * rules out branching text adventures explicitly. Everything the engine
 * already does - standing, dossier, her voice, the meters - writes what
 * actually happens.
 *
 * AND THE OTHER HALF OF IT, which took a played event to notice: every one of
 * these days is ALSO a working day at a company, and a working day settles
 * things. `agenda` is where that lives. The rule above is why it is a separate
 * field rather than four more movements - an agenda item names WHAT the room
 * decides and never WHICH WAY, so the movements stay outcome-free and the
 * decision still belongs to the scene.
 *
 * An agenda is two to four items. Keep them things a later cycle could read
 * back: a title track, a concept, who the company pushes. "Whether she is
 * happy" is not an agenda item, it is a movement in disguise.
 *
 * All six are held in one table rather than one file each, because keeping
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
      agenda: [
        'which of the mood boards becomes the concept for this comeback',
        'which of the demos is the title track',
        'the styling the concept commits them to, and which member it asks the most of',
        'who gets the centre position for the promotion',
      ],
    },
  },

  /**
   * The second link in the chain, and the reason it exists.
   *
   * PREP carried one event slot while `comeback` and `rest` carried two, which
   * was a hole rather than a preference - and the group activity `mv_shoot` had
   * been on the calendar since M1 with no authored day behind it, so the cast
   * shot a music video every cycle that nobody ever saw.
   *
   * It is also the shortest possible demonstration of what canon is for: a
   * shoot that executes the concept the meeting chose, on a set at exposure 70,
   * two days after the room settled it.
   */
  mv_shoot: {
    id: 'mv_shoot',
    phase: 'prep',
    slot: 'event_b',
    frame: {
      setting:
        'A closed set in a warehouse dressed for the concept. Forty people who do not work ' +
        'for X, cable runs taped to the floor, and one shot being lit for an hour before ' +
        'anybody is asked to stand in it.',
      movements: [
        'the first setup, and how long everyone waits before anything is filmed',
        'her part, shot over and over until somebody is happy with it',
        'the long gap in the middle of the day when nobody is needed on set',
        'the light going, and the last setup they are going to get today',
      ],
      agenda: [
        'which member the video ends up built around, whichever way the concept pointed',
        'the one shot the whole thing gets cut around',
        'the ending pose the choreography lands on, which the stage will have to repeat',
        'what gets dropped when the shoot runs out of daylight',
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
      agenda: [
        'how the stage itself goes, live, with no way to take it back',
        'whether the show gives them a win today, and what the room does with the answer either way',
        'what the company decides about the rest of the promotion off the back of it',
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
      agenda: [
        'what the fandom has decided this cycle is about - a moment, a line, a pairing',
        'whether the company leans into that or steers away from it',
        'which member ends the day carrying the promotion, whether or not she wanted it',
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
      agenda: [
        'what the executives announce about the next cycle before the speeches end',
        'who the company has decided to push, said out loud in front of everyone',
        'what gets noticed about who spent the evening standing with whom',
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
      agenda: [
        'what the five of them decide they want the next cycle to be, with no company in the room',
        'something one of them finally says out loud that the group cannot un-hear',
        'whether they go back on the last ferry or stay',
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
