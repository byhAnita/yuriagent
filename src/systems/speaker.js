/**
 * Who talks next. CLAUDE.md section 10c, proposal 12. PURE.
 *
 * The first design was a rota - pick a member, she speaks, the player answers,
 * rotate - and it does not survive the obvious question: A speaks, the player
 * responds, and then it is B's turn. WHO WAS THE PLAYER TALKING TO? A turn
 * order has no answer, because a conversation is not a queue.
 *
 * The primitive instead:
 *
 *   The player always has a current ADDRESSEE. Whoever the player addresses
 *   speaks next. It defaults to whoever last spoke, and one tap changes it.
 *
 * That answers who is being talked to, who answers, and whether the player
 * chooses - and because the addressee is STICKY, the common case costs no extra
 * taps. A gift is one way of addressing someone (proposal 11) and a chip is
 * another: one verb, two surfaces.
 *
 * On its own that collapses a group scene into a 1v1 with spectators, so the
 * un-addressed need a way in. Not a rota - an INTERJECTION, taken by whoever
 * has the biggest stake in what just happened. That is not randomness: Nana
 * cuts in because she is at `sharp` jealousy and the player just turned to
 * Irene. The room writes itself out of state the game already tracks, which is
 * what a group scene should be and what a rota structurally cannot be.
 *
 * No model call anywhere in this file. It decides WHO; the prompt decides what.
 */

import {
  INTERJECT_THRESHOLD,
  INTERJECT_STAKE,
  CUT_IN_BANDS,
  CHIME_STAKE,
  CHIME_THRESHOLD,
} from '../config/constants.js';
import { jealousyBand } from './jealousy.js';

/**
 * How much she has at stake in the conversation happening in front of her.
 *
 * Deliberately not a single axis. A member interjects because she is invested
 * (intimacy), because she is unsettled (jealousy), because she was just talked
 * about, or because she has been standing there saying nothing - and the last
 * one matters most for how a scene reads, since a member who never speaks stops
 * being in the room at all.
 */
export function stakeOf(memberId, { relations = {}, mentioned = [], silentTurns = {} } = {}) {
  const rel = relations[memberId];
  if (!rel) return 0;

  const invested = (rel.intimacy ?? 0) / 100;
  const unsettled = INTERJECT_STAKE.jealousy[jealousyBand(rel.jealousy ?? 0)] ?? 0;
  const named = mentioned.includes(memberId) ? INTERJECT_STAKE.mentioned : 0;
  const ignored = Math.min(silentTurns[memberId] ?? 0, 4) * INTERJECT_STAKE.perSilentTurn;

  return invested * INTERJECT_STAKE.intimacy + unsettled + named + ignored;
}

/**
 * Rank everyone in the room who is not being addressed.
 * Highest stake first; ties broken by id so the result is deterministic.
 */
export function rankBystanders(addresseeId, presentIds = [], context = {}) {
  return presentIds
    .filter((id) => id !== addresseeId)
    .map((id) => ({ id, stake: stakeOf(id, context) }))
    .sort((a, b) => b.stake - a.stake || (a.id < b.id ? -1 : 1));
}

/**
 * Should anybody cut in ABOUT THE PLAYER, and who?
 *
 * Gated on the jealousy band and not only on the score, which is the change
 * that makes this the exception it was always described as. Before it, the
 * jealousy term was simply the largest number in the formula and a cut-in was
 * the only second voice the arithmetic could ever produce.
 */
export function pickInterjector(addresseeId, presentIds = [], context = {}) {
  const { relations = {} } = context;
  const unsettled = (id) => CUT_IN_BANDS.includes(jealousyBand(relations[id]?.jealousy ?? 0));

  const top = rankBystanders(addresseeId, presentIds, context).filter((b) => unsettled(b.id))[0];
  if (!top || top.stake < INTERJECT_THRESHOLD) return null;
  return top.id;
}

/**
 * How much she has to ADD - as distinct from how much she has to resent.
 *
 * No jealousy term, on purpose. This is five people who have shared a dorm and
 * a stage for years talking about the choreography, and the reason somebody
 * joins in is that she has been quiet, or that she was just named, not that she
 * is upset with anybody.
 */
export function chimeStake(memberId, { relations = {}, mentioned = [], silentTurns = {} } = {}) {
  const rel = relations[memberId];
  if (!rel) return 0;

  const invested = ((rel.intimacy ?? 0) / 100) * CHIME_STAKE.intimacy;
  const named = mentioned.includes(memberId) ? CHIME_STAKE.mentioned : 0;

  /**
   * UNCAPPED, unlike `stakeOf`, and that is not an oversight.
   *
   * `stakeOf` clamps silence at four turns so it cannot drown the jealousy
   * term it sits beside. Here silence IS the term, and the clamp turned out to
   * silence somebody completely: a live pass at five members over eight turns
   * had Irene speak nine times, three others three, two and three - and Yeri
   * NOT ONCE. With four bystanders and one speaking per turn, three of them
   * sit at the cap permanently, so the sort falls through to the id tie-break
   * and the alphabetically-last member can never get ahead. She was frozen out
   * by `Math.min`.
   *
   * Uncapped, whoever has waited longest always wins, which is the circulating
   * room this whole formula exists to produce. The counters stay small in
   * practice because somebody speaks nearly every turn.
   */
  const quiet = (silentTurns[memberId] ?? 0) * CHIME_STAKE.perSilentTurn;

  return invested + named + quiet;
}

/**
 * Who, if anyone, speaks second - and in which of the two registers.
 *
 * Order matters and is not arbitrary: a member who is genuinely unsettled cuts
 * in INSTEAD of chiming, because the same beat cannot be both warm and pointed
 * and the sharper one is the rarer, more interesting event. Everything else
 * falls through to a chime.
 *
 * Returns `null` when the room has nothing to add, which is a real outcome and
 * not a failure - two people finishing an exchange without a third voice is
 * how a conversation is supposed to sound some of the time.
 */
export function pickSecondVoice(addresseeId, presentIds = [], context = {}) {
  const cutIn = pickInterjector(addresseeId, presentIds, context);
  if (cutIn) return { id: cutIn, kind: 'cut_in' };

  const top = presentIds
    .filter((id) => id !== addresseeId)
    .map((id) => ({ id, stake: chimeStake(id, context) }))
    .sort((a, b) => b.stake - a.stake || (a.id < b.id ? -1 : 1))[0];

  if (!top || top.stake < CHIME_THRESHOLD) return null;
  return { id: top.id, kind: 'chime' };
}

/**
 * Who speaks when the player passes rather than saying anything.
 *
 * `pass` is not a skip button - it is the player letting the room breathe, so
 * somebody fills the silence whether or not she clears either bar.
 *
 * Ranked by CHIME stake, not by the jealousy-weighted one. The player stepping
 * back is the most ordinary moment in a group scene and it should hand the
 * floor to whoever has been quiet, not to whoever is most upset - ranking it
 * by resentment is how "let the room carry it" turned into "let the room have
 * a go at you". Somebody genuinely at `sharp` still takes it, because jealousy
 * also drives the silence counter she has been sitting on.
 */
export function pickOnPass(addresseeId, presentIds = [], context = {}) {
  const others = presentIds.filter((id) => id !== addresseeId);
  if (others.length === 0) return addresseeId;

  return others
    .map((id) => ({ id, stake: chimeStake(id, context) }))
    .sort((a, b) => b.stake - a.stake || (a.id < b.id ? -1 : 1))[0].id;
}

/**
 * Move the addressee.
 *
 * Refuses anyone who is not in the room, which mirrors the parser roster rule
 * and the chip-label rule: you cannot turn to somebody who is not there.
 */
export function setAddressee(current, nextId, presentIds = []) {
  return presentIds.includes(nextId) ? nextId : current;
}

/**
 * Who the player is talking to at the start of a scene.
 *
 * The member the player came to see, if the caller says; otherwise whoever has
 * most at stake, which makes a group scene open on the person it is about.
 */
export function openingAddressee(presentIds = [], context = {}, preferredId = null) {
  if (preferredId && presentIds.includes(preferredId)) return preferredId;
  if (presentIds.length <= 1) return presentIds[0] ?? null;

  return presentIds
    .map((id) => ({ id, stake: stakeOf(id, context) }))
    .sort((a, b) => b.stake - a.stake || (a.id < b.id ? -1 : 1))[0].id;
}

/**
 * Who got named in what was just said.
 *
 * The cheapest of the four stake sources and the one that makes a room feel
 * like a room: being talked about is a reason to speak up. Matched on the
 * display name because that is what the model writes - it never sees an id.
 *
 * Word-boundary matched rather than `includes`, or "Yeri" would fire on any
 * word containing it and a member whose name is a substring of another's would
 * be permanently mentioned.
 */
export function mentionedIn(text, cast = []) {
  const haystack = String(text ?? '');
  return cast
    .filter(({ name }) => name && new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(haystack))
    .map(({ id }) => id);
}

function escapeRe(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, (ch) => `\\${ch}`);
}

/** Bump the silence counter for everyone who did not speak this turn. */
export function trackSilence(silentTurns = {}, presentIds = [], spokeId) {
  const next = {};
  for (const id of presentIds) next[id] = id === spokeId ? 0 : (silentTurns[id] ?? 0) + 1;
  return next;
}
