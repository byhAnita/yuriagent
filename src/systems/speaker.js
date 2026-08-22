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

import { INTERJECT_THRESHOLD, INTERJECT_STAKE } from '../config/constants.js';
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
 * Should anybody cut in, and who?
 *
 * A threshold rather than a probability, because the failure mode here is prose
 * and not a distribution: an interjection every turn is a scene in which nobody
 * finishes a sentence. Something has to have HAPPENED for someone to speak up.
 *
 * The threshold is a named constant and belongs to a live pass, not a harness
 * one - the same status `RISK_PAYOFF_SCALE` had before it was measured.
 */
export function pickInterjector(addresseeId, presentIds = [], context = {}) {
  const ranked = rankBystanders(addresseeId, presentIds, context);
  const top = ranked[0];
  if (!top || top.stake < INTERJECT_THRESHOLD) return null;
  return top.id;
}

/**
 * Who speaks when the player passes rather than saying anything.
 *
 * `pass` is not a skip button - it is the player letting the room breathe, so
 * somebody has to fill the silence, and the highest stake fills it whether or
 * not it clears the interjection bar. Falls back to the addressee in a room
 * with nobody else in it.
 */
export function pickOnPass(addresseeId, presentIds = [], context = {}) {
  return rankBystanders(addresseeId, presentIds, context)[0]?.id ?? addresseeId;
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
