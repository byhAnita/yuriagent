/**
 * What a whole-day scene is about. CLAUDE.md section 10, proposal 13.
 *
 * MODEL-FACING ENGLISH, never localized and never shown to the player - the
 * same rule as `ACTIVITY_DOING`. The player-facing labels live in `i18n/`.
 *
 * An ordinary slot chat is one block and eight turns. A date or an authored
 * event is a whole DAY at sixteen, and at that length a scene with nothing to
 * aim at wanders. The fix is not a longer instruction, it is giving the scene
 * somewhere to go.
 *
 * A frame carries:
 *   setting   - one or two sensory sentences the opening beat can start from
 *   movements - two to four situations the scene MAY pass through, in order
 *   agenda    - two to four things the day MUST decide, each `{ id, text }`.
 *               Optional; events only. The id is what a decision is recorded
 *               under (`systems/canon.js`), which is why a bare string is not
 *               enough: cycle 2's title track has to supersede cycle 1's, and a
 *               later event has to be able to ask for one by name.
 *
 * THE RULE, unchanged from section 11: a movement may set the SITUATION and
 * never the OUTCOME. "The walk back, and how long it takes" is a place. "She
 * takes your hand on the walk back" is a script, and section 1 rules out
 * branching text adventures explicitly. Everything the engine already does -
 * standing, dossier, her voice, the meters - still writes what happens.
 *
 * WHY `agenda` IS A SEPARATE FIELD AND NOT MORE MOVEMENTS
 *
 * Because the rule above is right and the concept meeting still came out as
 * small talk. Read what its movements actually asked for: the boards going up
 * and which one she reacts to, the part of the concept that asks something of
 * her, an idea getting cut and the room going carefully polite. Every one of
 * them is an emotional situation, and NOT ONE OF THEM SAYS A TITLE TRACK GETS
 * CHOSEN TODAY. The model was asked for feelings in a meeting room and it
 * delivered feelings in a meeting room - fifteen turns that produced a joke
 * about ear colour and a plate of food, with the ledger line for the whole day
 * going to the food.
 *
 * That is a content bug wearing the costume of a model failure. So `agenda`
 * names the BUSINESS - what the room is not allowed to leave without settling -
 * and it is a separate field precisely so that the movements stay free of
 * outcomes and the rule survives intact. An agenda item says what gets decided,
 * never which way it goes; which way it goes is the scene's job, the same as
 * everything else here.
 *
 * Adapted from rv-simulator's `specialEvents.js`, which frames a scene as
 * setup -> beat -> constraint in a sentence or two. The thing deliberately not
 * carried over is its habit of naming the payoff ("player thinks: I want to
 * hold onto this moment forever"). At one-scene length with no relationship
 * model underneath, stating the feeling works. At whole-day length with a real
 * one, the payoff has to be earned by the scene rather than announced by the
 * frame.
 */

/**
 * The register a scene is played in.
 *
 * Keeping `ordinary` terse is deliberate. Section 1's first pillar is 30-50
 * word bursts rather than 300-word narration, and applying a literary register
 * everywhere would quietly repeal it. The CONTRAST is the feature: the game
 * changes how it writes when the day is hers, and the player feels that without
 * being told.
 */
export const REGISTERS = {
  ordinary: null,
  date: [
    'Literary and sensory. Sight, sound, touch, smell.',
    'Open with one or two sentences that establish the atmosphere before anyone speaks.',
    'This is a whole day, not a snatched conversation. Let it breathe.',
  ].join('\n'),
  /**
   * An event no longer asks for atmosphere at the top, because it already got
   * it: `establishingDirective` writes the room as its own beat before anybody
   * speaks (PROPOSALS 20 (a)). Leaving the line in made the first two beats of
   * every anchor event both open by describing the room, which is the padding
   * that makes generated prose read as generated.
   *
   * So the register spends those words on the thing an event actually needs
   * and a date does not: it is a working day at a company, in front of other
   * people, and it has business to get through.
   */
  event: [
    'Literary and sensory. Sight, sound, touch, smell.',
    'The room has already been established. Carry that atmosphere rather than describing it again.',
    'Several people are here and the day belongs to the company, not to anyone in it.',
    'It is also a working day with things to settle, so let the work happen in the room.',
  ].join('\n'),
};

/** Public-date frames, keyed by the venue the phase happens to be using. */
export const DATE_FRAMES = {
  bistro: {
    setting:
      'A corner table at a small bistro, the window fogged from the inside, ' +
      'a waiter who does not recognise her and a room that might.',
    movements: [
      'arriving, and deciding where to sit - which seat faces the room',
      'the meal, and what she does not say about work',
      'the walk back afterwards, and how long the two of you take over it',
    ],
  },
  cafe: {
    setting:
      'A cafe in the middle of a comeback week, too bright, too public, ' +
      'and full of phones that are not pointed at her yet.',
    movements: [
      'ordering, and how much of her face she leaves uncovered',
      'the long middle of the afternoon, once the queue thins out',
      'the moment somebody looks twice, and what each of you does about it',
    ],
  },
  han_river: {
    setting:
      'The river path on an off day, wide open, wind off the water, ' +
      'joggers and couples and nobody in a hurry.',
    movements: [
      'the walk out, with the whole afternoon still ahead',
      'stopping somewhere - a bench, a convenience store, the bridge',
      'the light going, and whether either of you suggests heading back',
    ],
  },
};

/**
 * The private date. One frame, because it is the same room in every phase and
 * the room is the point.
 */
export const PRIVATE_DATE_FRAME = {
  setting:
    'Her own room, door shut, the rest of the dorm audible through it. ' +
    'A whole day with nowhere either of you has to be.',
  movements: [
    'the first hour, and how the two of you fill a day with no schedule in it',
    'something of hers that the player has not seen before',
    'the afternoon going quiet, and how close the two of you end up sitting',
    'the others coming home, and the door still shut',
  ],
};

/** The frame for a date, or null if the venue has none authored yet. */
export function dateFrame(kind, locationId) {
  if (kind === 'private') return PRIVATE_DATE_FRAME;
  return DATE_FRAMES[locationId] ?? null;
}

/**
 * Render a frame for block 4.
 *
 * Movements are offered, never ordered - "may" and "in any order you like" are
 * doing real work. A model handed a numbered list will march through it, and a
 * scene that marches is the branching text adventure section 1 rules out.
 *
 * The agenda is the opposite and says so in the opposite words: these are not
 * offered, the day does not end until they are settled, and the last line of it
 * exists because a room told to decide four things will otherwise agree
 * pleasantly about all four.
 */
export function renderFrame(frame) {
  if (!frame) return null;

  const lines = [
    frame.setting,
    '',
    'The day may pass through any of these, in any order, or none of them:',
    ...frame.movements.map((m) => `- ${m}`),
    '',
    'These are situations, not instructions. What actually happens between the',
    'two of you is hers to decide, from who she is and where the two of you stand.',
  ];

  if (frame.agenda?.length) {
    lines.push(
      '',
      'This is not only a mood. The day is here to settle these, and it does not end until it has:',
      ...frame.agenda.map((a) => `- ${a.text}`),
      '',
      'Say what actually gets decided, in plain words, as it happens. Nothing here',
      'has to go anyone\'s way, and a room where all of it does is a room where',
      'nothing was at stake.',
    );
  }

  return lines.join('\n');
}
