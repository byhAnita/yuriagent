/**
 * What the dorm is for. PROPOSALS 15.
 *
 * Section 10 makes the dorm safe from scandal and dangerous for jealousy:
 * nearly invisible outside, watched by everyone who lives there. That is a
 * good tension and it was **all cost.** Nothing in the dorm spent time with the
 * whole cast at once, so every dorm visit was a choice of one member in front
 * of four, priced accordingly - the place the cast actually lives was the place
 * it was most expensive to be.
 *
 * A shared activity is the release valve, and three rules make it one:
 *
 * 1. **No 1v1 is offered in these rooms.** That is the rule, not a limitation.
 *    Removing the option is what turns the dorm from a trap into somewhere the
 *    pressure comes off.
 * 2. **No jealousy.** Nobody is being singled out, which is the whole point,
 *    and charging for it would put the cost straight back.
 * 3. **A small affection gain for everyone present.** The dorm needs one thing
 *    that is unambiguously restorative, or the tension it carries has nowhere
 *    to go.
 *
 * Why cooking and a film specifically: they are CONCRETE, and concrete is what
 * makes them read differently from a work scene. "What is in the fridge" and
 * "this film is terrible" are topics five people can actually have, and
 * neither is available anywhere else on the map - every other location produces
 * conversation about the job.
 *
 * MODEL-FACING ENGLISH, never localized, like every other scene frame. The
 * labels the player reads are `shared.*` keys in `i18n/`.
 */

/**
 * Deliberately terrible, deliberately specific, and deliberately not real.
 *
 * A named real film would date the game and drag in things it has no opinion
 * about; a generic "a film" gives the model nothing to be funny about. Section
 * 22 keeps the setting fictional anyway.
 */
export const FILMS = [
  'a romance nobody chose and nobody is willing to be the one to turn off',
  'a horror film that is far more frightening than the box promised',
  'a three-hour historical epic somebody swore was only ninety minutes',
  'a cooking documentary that is making everyone hungrier by the minute',
  'a disaster movie with a plot that stopped making sense in the first hour',
  'an animated film half of them have loved since they were nine',
];

export const SHARED_ACTIVITIES = {
  dorm_kitchen: {
    id: 'cook_together',
    locationId: 'dorm_kitchen',
    frame: {
      setting:
        'The dorm kitchen after a day of work, too many people for the floor space, ' +
        'whatever is in the fridge, and nobody in any hurry.',
      movements: [
        'working out what can actually be made from what is in there',
        'the part where somebody is doing it wrong and is told so',
        'eating it standing up, because nobody has laid the table',
        'the washing up, and who quietly ends up doing it',
      ],
    },
  },

  dorm_living: {
    id: 'watch_a_film',
    locationId: 'dorm_living',
    frame: {
      setting:
        'The living room with the lights off, one sofa, more people than it seats, ' +
        'and {film} on.',
      movements: [
        'the opening twenty minutes, and the running commentary over them',
        'somebody explaining the plot to somebody who stopped following it',
        'the quiet stretch in the middle where the room stops talking',
        'the credits, and nobody moving yet',
      ],
    },
  },
};

/**
 * The shared activity this room offers, or null.
 *
 * Only the two shared dorm rooms have one. `dorm_room` is hers and
 * `dorm_player_room` is yours - neither is a place the group ends up.
 */
export function sharedActivityFor(locationId) {
  return SHARED_ACTIVITIES[locationId] ?? null;
}

/**
 * The frame, with tonight's film chosen.
 *
 * Seeded, so the same evening in the same run always shows the same film - a
 * film that changes when the player backs out of a modal is a film nobody is
 * watching.
 */
export function sharedFrame(activity, rng = Math.random) {
  if (!activity) return null;
  const film = FILMS[Math.floor(rng() * FILMS.length)] ?? FILMS[0];
  return {
    ...activity.frame,
    setting: activity.frame.setting.replace('{film}', film),
  };
}
