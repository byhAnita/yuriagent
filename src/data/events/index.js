/**
 * Anchor events. CLAUDE.md sections 9 and 10.
 *
 * One per event slot on the three phase maps, six in all. Each takes a WEEKDAY
 * and the whole of it, replacing whatever the calendar would otherwise have put
 * there - the Music Bank recording genuinely is that Thursday.
 *
 * FOUR OF THEM COME BACK EVERY CYCLE and two do not, which is fourteen event
 * days in a campaign from six authored ones. See `recurs` for which and why.
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
 * AND `reads` IS THE OTHER END OF THAT, which is what makes the four recurring
 * events a chain rather than four separate days:
 *
 *     concept meeting -> MV shoot -> Music Bank -> fan meeting
 *          ^                                            |
 *          +----------------- next cycle ---------------+
 *
 * It names topic ids from earlier events, and block 4 hands the day the current
 * answer for each. So the MV shoot is shooting the concept the meeting chose,
 * Music Bank is performing the ending pose the shoot landed on, and the next
 * concept meeting knows what the fandom made of all of it.
 *
 * NAMED, rather than handing over the whole of canon. A small model given
 * eighteen lines of world facts uses none of them; given "the title track is X"
 * immediately above an agenda that mentions the title track, it uses it. The
 * same argument as block 4 repeating her `speechStyle` (section 8) - proximity
 * and selection are what make a fact load-bearing rather than decorative.
 *
 * Every id here must be some event's agenda id. A `reads` entry that matches
 * nothing is a dead reference that fails silently - the line simply never
 * appears - so it is asserted.
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
    // `concept` and `title_track` are its OWN previous answers, and they matter
    // most: a second concept meeting that cannot see the first one picks the
    // same concept again and calls it a comeback.
    reads: ['concept', 'title_track', 'chart_result', 'fandom_focus', 'company_response'],
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
        { id: 'concept', text: 'which of the mood boards becomes the concept for this comeback' },
        { id: 'title_track', text: 'which of the demos is the title track' },
        { id: 'styling', text: 'the styling the concept commits them to, and which member it asks the most of' },
        { id: 'centre', text: 'who gets the centre position for the promotion' },
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
    reads: ['concept', 'title_track', 'styling', 'centre'],
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
        { id: 'video_lead', text: 'which member the video ends up built around, whichever way the concept pointed' },
        { id: 'hero_shot', text: 'the one shot the whole thing gets cut around' },
        { id: 'ending_pose', text: 'the ending pose the choreography lands on, which the stage will have to repeat' },
        { id: 'cut_for_time', text: 'what gets dropped when the shoot runs out of daylight' },
      ],
    },
  },

  music_bank: {
    id: 'music_bank',
    phase: 'comeback',
    slot: 'event_a',
    reads: ['title_track', 'ending_pose', 'video_lead', 'centre'],
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
        { id: 'stage_result', text: 'how the stage itself goes, live, with no way to take it back' },
        { id: 'chart_result', text: 'whether the show gives them a win today, and what the room does with the answer either way' },
        { id: 'promo_plan', text: 'what the company decides about the rest of the promotion off the back of it' },
      ],
    },
  },

  fan_meeting: {
    id: 'fan_meeting',
    phase: 'comeback',
    slot: 'event_b',
    reads: ['stage_result', 'chart_result', 'promo_plan', 'hero_shot'],
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
        { id: 'fandom_focus', text: 'what the fandom has decided this cycle is about - a moment, a line, a pairing' },
        { id: 'company_response', text: 'whether the company leans into that or steers away from it' },
        { id: 'promo_face', text: 'which member ends the day carrying the promotion, whether or not she wanted it' },
      ],
    },
  },

  company_cruise: {
    id: 'company_cruise',
    phase: 'rest',
    slot: 'event_a',
    // Mid-campaign: one comeback has landed, so there is something for
    // executives to make speeches about. See `recurs`.
    cycle: 1,
    reads: ['chart_result', 'promo_face', 'fandom_focus'],
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
        { id: 'next_cycle_plan', text: 'what the executives announce about the next cycle before the speeches end' },
        { id: 'company_push', text: 'who the company has decided to push, said out loud in front of everyone' },
        { id: 'who_was_noticed', text: 'what gets noticed about who spent the evening standing with whom' },
      ],
    },
  },

  island_trip: {
    id: 'island_trip',
    phase: 'rest',
    slot: 'event_b',
    // The last week of the campaign, and only there. Its own frame says so:
    // the first day in nine weeks with nothing scheduled, and a last ferry.
    cycle: 2,
    reads: ['next_cycle_plan', 'company_push', 'promo_face'],
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
        { id: 'group_intent', text: 'what the five of them decide they want the next cycle to be, with no company in the room' },
        { id: 'said_out_loud', text: 'something one of them finally says out loud that the group cannot un-hear' },
        { id: 'last_ferry', text: 'whether they go back on the last ferry or stay' },
      ],
    },
  },
};

export const EVENT_IDS = Object.keys(EVENTS);

/**
 * Does this event come back every cycle, or does it belong to one of them?
 *
 * ONE FIELD, TWO BEHAVIOURS, and no boolean: an event that names a `cycle`
 * fires once, in that cycle; an event that names none fires in all of them.
 * A `recurs: true` flag beside a `cycle` number would let the two disagree,
 * and there is no sensible answer when they do.
 *
 * The four working-cycle events recur, because a comeback cycle that decides a
 * concept, shoots it, performs it and hears back from the fandom is the loop
 * the whole game is built on, and running it once in nine weeks left cycles 2
 * and 3 with no authored beat at all.
 *
 * The cruise and the island do not, for two reasons that are both about the
 * REST week. It is the repair week - two mandatory whole-cast days out of its
 * five weekdays works against the one week whose job is converting jealousy
 * before it hardens. And an event day generates no daily task, so event days
 * are a supply line as well as a schedule: six recurring events would take 40%
 * of the working weekdays and cut credits by roughly the same, against a
 * campaign that already ends with none.
 *
 * Which cycle each one lands in is authored rather than spread by a rule,
 * because the content says where it goes. The island trip is *"the first day in
 * nine weeks with nothing at all scheduled on it"* and ends on *"the last
 * ferry, and whether anyone wants to be on it"* - that is the end of a
 * campaign and nowhere else. The cruise sits in the middle, after one comeback
 * has landed and there is something for executives to make speeches about. The
 * first rest week gets neither, which is the right shape for the week where the
 * player is still learning that a rest week is theirs.
 */
export function recurs(event) {
  return event != null && event.cycle == null;
}

/** Is this event scheduled at all in this cycle? */
export function firesInCycle(event, cycle) {
  if (!event) return false;
  return recurs(event) || event.cycle === cycle;
}

/**
 * The key `flags.firedEvents` holds, and `calendar.eventDays` filters on.
 *
 * Three parts for a recurring event and two for a one-off, which is what lets
 * one list hold both: `prep:event_a:1` is the second concept meeting, and
 * `rest:event_a` is the cruise, once, whenever it happened.
 *
 * `cycle` THROWS rather than defaulting, and that is deliberate. A default of 0
 * would let a caller that forgot to pass one compile, run, and quietly key
 * every cycle's event to the same string - which is the single guarantee this
 * function exists to provide, broken silently, in the shape this project keeps
 * finding (`markRisk` was implemented, tested, and never called). A crash in
 * the suite is the cheap version of that bug.
 */
export function eventKey(phase, slot, cycle) {
  if (!Number.isInteger(cycle)) {
    throw new TypeError(`eventKey needs a cycle: got ${cycle} for ${phase}:${slot}`);
  }
  return recurs(eventFor(phase, slot)) ? `${phase}:${slot}:${cycle}` : `${phase}:${slot}`;
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
