/**
 * What the label wants this time. CLAUDE.md section 10, PROPOSALS 24.
 *
 * PURE DATA plus one seeded draw. No React, no network, no model call.
 *
 * WHY THIS EXISTS
 *
 * The four recurring anchor events are a chain, and `concept_meeting` reads its
 * OWN previous answers so that a second comeback can escalate rather than start
 * from nothing. Played, that backfired exactly as hard as it could: handed the
 * concept and the title track it settled in cycle 1, cycle 2's meeting produced
 * them again.
 *
 *   > Oh no she's talking same concept of 1st concept.
 *   > Oh no, the song name is same as 1st comeback, and the concept is similar.
 *
 * Reading the previous cycle and BEING DIFFERENT FROM IT are two instructions,
 * and only one of them was ever given. The stakes clause on each event
 * (`data/events/index.js`) is the half that asks; this is the half that does not
 * have to ask.
 *
 * It is section 10's own argument about the calendar applied to content: the
 * schedule is deterministic and seeded because it is replayable, testable,
 * instant and free, and *the LLM may write a flavour label; it may never decide
 * the slot.* A comeback concept is a slot. Three dice make cycle 2 structurally
 * unable to be cycle 1, where a clause only asks it not to be.
 *
 * DRAWN WITHOUT REPLACEMENT ACROSS THE CAMPAIGN, which is the whole point and
 * the one thing an independent per-cycle draw cannot promise. Three cycles
 * drawing independently from an eight-entry pool collide about a third of the
 * time, and the failure this is here to prevent is precisely a collision. So
 * each pool is shuffled ONCE from the run seed and indexed by cycle: different
 * runs get different comebacks, and no run ever repeats itself.
 *
 * IT REACHES THE MODEL AS PRESSURE, NEVER AS THREE NOUNS. A prompt that says
 * `{jazz, christmas, forest}` produces a room reciting three nouns at each
 * other. `renderPressure` turns them into things somebody outside the room
 * wants, so the room still argues about them - the same rule `agenda` follows:
 * name what gets settled, never which way.
 *
 * MODEL-FACING ENGLISH, never localized (section 19). These are prompt content,
 * not UI strings.
 */

import { makeRng, deriveSeed } from '../systems/rng.js';
import { CYCLES_PER_CAMPAIGN } from '../config/constants.js';

/**
 * Three axes, because a concept is not one decision.
 *
 * Kept deliberately plain and combinable. "Winter, warm brass, an empty
 * seaside town" has to be a concept somebody could actually pitch, and every
 * one of the 8 x 8 x 8 combinations has to survive that - so nothing here is
 * so specific that it only works next to one entry in another pool.
 */
export const SOUND = [
  'live brass and something close to swing',
  'a stripped-back R&B groove with almost no top line',
  'hard electronic production, sequencers over drums',
  'guitars, played by people in the room, mixed loud',
  'a slow ballad built on one piano figure',
  'house tempo, four to the floor, made for a festival',
  'folk instruments and a chorus everybody can sing',
  'trap percussion under a melody that refuses to match it',
];

export const OCCASION = [
  'high summer, and the fortnight nobody works',
  'the last week of the year, with everything closing',
  'the first warm day after a long winter',
  'a night that goes on much too late',
  'coming home after being away a long time',
  'the day before something big that never gets named',
  'an anniversary the group is expected to mark',
  'the end of something, handled gracefully',
];

export const PLACE = [
  'an empty seaside town out of season',
  'a city at four in the morning',
  'a forest, filmed in real weather',
  "somebody's grandmother's house, exactly as it is",
  'a motorway and the places you stop on it',
  'a hotel that has seen better decades',
  'a studio with nothing in it but light',
  'a rooftop over a neighbourhood nobody photographs',
];

const POOLS = { sound: SOUND, occasion: OCCASION, place: PLACE };

/**
 * Every pool must outlast the campaign, or a run repeats itself and this whole
 * module has failed at the one job it has. Asserted here rather than in a test
 * as well, because the failure is silent - `undefined` renders as nothing and
 * the meeting simply loses a line.
 */
for (const [axis, pool] of Object.entries(POOLS)) {
  if (pool.length < CYCLES_PER_CAMPAIGN) {
    throw new Error(`comebackStyle: ${axis} pool is shorter than the campaign`);
  }
}

/** A real shuffle, seeded. Same Fisher-Yates as `chips.js` and `calendar.js`. */
function shuffled(rng, items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * What this cycle's comeback is being pushed toward.
 *
 * Deterministic in `(seed, cycle)`, and distinct for every cycle of a run.
 *
 * @param {number} seed - the run seed
 * @param {number} cycle - 0-based, from `cycleForWeek`
 * @returns {{ sound: string, occasion: string, place: string }}
 */
export function comebackStyle(seed, cycle) {
  const out = {};
  for (const [axis, pool] of Object.entries(POOLS)) {
    // A separate stream per axis, so adding an entry to one pool does not
    // silently reshuffle the other two on every existing seed.
    const order = shuffled(makeRng(deriveSeed(seed, `comeback:${axis}`)), pool);
    out[axis] = order[Math.abs(cycle) % order.length];
  }
  return out;
}

/**
 * The lines block 4 actually carries.
 *
 * Three sentences about what people OUTSIDE the room want, rather than three
 * labelled fields. The room can disagree with a sentence; it cannot disagree
 * with `sound: jazz`.
 */
export function renderPressure(style) {
  if (!style) return [];
  /**
   * The pool entries are long, so the sentence has to put its own words FIRST
   * and let the drawn phrase run to the full stop. "The label wants X this
   * time" drags badly once X is nine words; "This time the label wants X" does
   * not, whatever X turns out to be.
   */
  return [
    `This time the label has been pushing for ${style.sound}.`,
    `A&R keep bringing up ${style.occasion}.`,
    `Everything in the reference folder the director sent over looks like ${style.place}.`,
  ];
}
