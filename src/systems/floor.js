/**
 * Who has the floor this round. Pure. CLAUDE.md Part I.3, section 10c.
 *
 * ONE VOICE A ROUND, and the room moves between rounds rather than inside them.
 *
 * The first version of this gave the floor to two - a primary plus one cut-in -
 * and it worked: measured live, a five-member room went from five paragraphs a
 * round to two, and all four others got a line each across four rounds. What it
 * did not fix is that a round was still a paragraph of somebody plus a paragraph
 * of somebody else, and the player still had to answer every one of them.
 *
 *   > ~1 character per round ... increase the number of round/scene gives the
 *   > feeling of group chat. The player don't need to choose option each round
 *   > and gives back the skip button
 *
 * So a round is one person saying one thing, a scene is more of them, and the
 * player may let a round pass. That is closer to how a room of five actually
 * sounds, and it is the second time this has been asked for - the same request
 * is in the v1 report, about a member continuing across several turns.
 *
 * WHY THIS IS THE CODE'S DECISION AND NOT THE MODEL'S. I.1 splits it as *the
 * model decides what the scene MEANS, the code decides what the world IS* - and
 * who is standing in the room, and which of them the player is turned to, is
 * world state. It is the same call as placement and exposure. What they say, how
 * they take it, and what it moves stays entirely the model's.
 *
 * THE CHAIN, and it is still a chain rather than a rota:
 *
 *   1. the player TAPPED somebody       -> she has the floor, full stop
 *   2. nobody tapped                    -> the weighted draw below
 *   3. nothing has happened yet         -> the first of the roster
 *
 * A ROTA WAS THE FIRST DESIGN AND IT DID NOT SURVIVE ONE QUESTION (10c): A
 * speaks, the player responds, and then it is B's turn - who was the player
 * talking to? A turn order has no answer. The addressee does, and it is sticky,
 * so the common case costs no taps at all.
 */

import { AFFECTION_PULL, CONTINUITY_PULL, FLOOR_FLOOR, MAX_STREAK } from '../config/constants.js';

/**
 * How the room decides who speaks next, when the player has not said.
 *
 * **Silence dominates**, and that is the load-bearing part. It is unbounded -
 * a member who has not spoken for four rounds carries a 4 - while every other
 * term is capped, so the room always circulates eventually no matter how the
 * other weights fall. Section 10c's chime rule reached the same shape from the
 * other direction, and for the same reason: a speaker's counter resets, so the
 * next draw goes somewhere else without anything as rigid as an order.
 *
 * **Affection is a mild tilt.** The woman who likes you most seeking you out is
 * a true fact about a room and a good feedback loop for a route - but it is
 * capped at `AFFECTION_PULL` (2 at affection 100), which is worth two rounds of
 * silence and no more. Strong affection weighting recreates exactly the defect
 * the first hand test reported: one member takes over and every round is her.
 *
 * **Continuity is a bonus that silence overtakes.** Somebody who just spoke
 * carries `CONTINUITY_PULL`, so she tends to get a second round - which is what
 * makes a member continue rather than a room ping-pong - and by the third the
 * quiet ones outweigh her.
 *
 * **And a hard cap on top of all of it.** Nobody speaks more than `MAX_STREAK`
 * rounds running unless the player asked for her by name. That is the belt: the
 * weights above are a distribution and a distribution can always roll badly,
 * and rolling badly here looks exactly like the bug this replaced.
 */
export function speakerWeights(floor, { roster = [], relations = {} } = {}) {
  const out = {};
  for (const id of roster) {
    const silence = floor.silence[id] ?? 0;
    const streak = floor.streak[id] ?? 0;

    // The belt. Tapping her overrides this - see `nextSpeaker`.
    if (streak >= MAX_STREAK) continue;

    const affection = Math.max(0, Math.min(100, relations[id]?.affection ?? 0));
    out[id] =
      FLOOR_FLOOR +
      silence +
      (affection / 100) * AFFECTION_PULL +
      (id === floor.lastSpeakerId ? CONTINUITY_PULL : 0);
  }
  return out;
}

export function newFloor(rosterIds = []) {
  return {
    /** Who the player is turned to. Null until they tap somebody. */
    addresseeId: null,
    /** Who held the floor last round. */
    lastSpeakerId: null,
    /** Rounds since each member last spoke. The dominant term in the draw. */
    silence: Object.fromEntries(rosterIds.map((id) => [id, 0])),
    /** How many rounds running she has held it. The cap reads this. */
    streak: Object.fromEntries(rosterIds.map((id) => [id, 0])),
  };
}

/**
 * The player turns to somebody. One tap, and it sticks.
 *
 * Sticky is the point: the commonest thing a player does is keep talking to the
 * same person, and that has to cost nothing. Changing costs one tap, which is
 * what the first hand test asked for - the alternative was typing free text to
 * reach anybody the model had stopped writing options for.
 *
 * A tap also CLEARS THE STREAK CAP for her. Asking for somebody by name is an
 * instruction, and a rule about pacing must never refuse one.
 */
export function turnTo(floor, memberId) {
  if (!memberId || !(memberId in floor.silence)) return floor;
  if (floor.addresseeId === memberId) return floor;
  return { ...floor, addresseeId: memberId };
}

/**
 * Who speaks this round, and in what posture.
 *
 * @returns {{ primary: string|null, mode: 'answers'|'continues'|'cuts_in' }}
 *
 * `mode` is what makes one voice read as a room rather than as a queue, and it
 * costs six tokens in a block that is rebuilt anyway:
 *
 * | | |
 * |---|---|
 * | `answers`  | the player spoke to her, and she is answering |
 * | `continues`| she had the floor and still has it - she keeps going |
 * | `cuts_in`  | somebody else takes it, unprompted. The interruption |
 *
 * v1 spent a whole extra model call per round on interjections. This is the
 * same event, written by the round that was happening anyway.
 */
export function nextSpeaker(
  floor,
  { roster = [], relations = {}, spoke = false, rng = Math.random } = {},
) {
  if (roster.length === 0) return { primary: null, mode: 'answers', changed: false };

  const inRoom = (id) => (id && roster.includes(id) ? id : null);

  /**
   * A TAP OUTRANKS EVERYTHING, including the streak cap. The player asked for
   * her by name; a pacing rule that overrides that is a pacing rule deciding
   * who the player is allowed to talk to.
   */
  /**
   * `changed` rides along because the PROSE needs it, not because the floor
   * does. Found live: round 8 of a five-member scene handed the floor to
   * somebody new and the model wrote her as 她 throughout, so the player had no
   * way to tell who was talking. Good writing uses a pronoun for whoever is
   * already the subject - which is exactly wrong at the moment the subject
   * changes, and only the code knows that it did.
   */
  const withChange = (primary, mode) => ({
    primary,
    mode,
    changed: primary !== floor.lastSpeakerId,
  });

  const tapped = inRoom(floor.addresseeId);
  if (tapped) {
    return withChange(tapped, tapped === floor.lastSpeakerId && !spoke ? 'continues' : 'answers');
  }

  if (!floor.lastSpeakerId) return withChange(roster[0], 'answers');

  const weights = speakerWeights(floor, { roster, relations });
  const ids = Object.keys(weights);

  /**
   * Everybody is capped out - which happens in a two-member room where one of
   * them has held the floor for `MAX_STREAK`. The cap yields rather than
   * returning nobody: a round with no speaker is a dead screen.
   */
  const pool = ids.length > 0 ? ids : roster;
  const total = pool.reduce((sum, id) => sum + (weights[id] ?? FLOOR_FLOOR), 0);

  let roll = rng() * total;
  let primary = pool[pool.length - 1];
  for (const id of pool) {
    roll -= weights[id] ?? FLOOR_FLOOR;
    if (roll < 0) {
      primary = id;
      break;
    }
  }

  /**
   * The posture falls out of what happened rather than being chosen. She kept
   * the floor and the player said nothing: she is continuing. Somebody new took
   * it and the player did not ask for her: she cut in.
   */
  if (primary === floor.lastSpeakerId) {
    return withChange(primary, spoke ? 'answers' : 'continues');
  }
  return withChange(primary, spoke ? 'answers' : 'cuts_in');
}

/**
 * Record who had the floor, and age everybody else.
 *
 * The two counters are the whole pacing mechanism, so they move here and
 * nowhere else. `silence` grows for everyone who did not speak and resets for
 * the one who did; `streak` is its mirror and exists only for the cap.
 */
export function noteSpoke(floor, { primary = null } = {}) {
  const silence = {};
  const streak = {};
  for (const id of Object.keys(floor.silence)) {
    const spoke = id === primary;
    silence[id] = spoke ? 0 : (floor.silence[id] ?? 0) + 1;
    streak[id] = spoke ? (floor.streak[id] ?? 0) + 1 : 0;
  }

  return { ...floor, silence, streak, lastSpeakerId: primary ?? floor.lastSpeakerId };
}

/**
 * Who the player is talking to, for everything outside the scene.
 *
 * `propagate` needs it: a scene's SUBJECT is whoever the player spent it on, and
 * reading `presentIds[0]` instead is what produced "I chose Yeri to have a 1v1
 * chat, while witness is herself" - Nana was subject by array position, so Yeri
 * was listed as a witness of her own scene.
 *
 * The TAP wins here even more clearly than in the draw. Who the player chose to
 * spend the scene on is a question about intent, and a member who happened to
 * take the last round does not change the answer.
 */
export function addresseeOf(floor, { roster = [] } = {}) {
  const inRoom = (id) => (id && roster.includes(id) ? id : null);
  return inRoom(floor.addresseeId) ?? inRoom(floor.lastSpeakerId) ?? roster[0] ?? null;
}
