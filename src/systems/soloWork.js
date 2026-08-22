/**
 * Resolving a block spent alone. Pure.
 *
 * An empty room is not dead space: it is where an assistant does the job, and
 * where you find out things about a member who is not in the room. Every solo
 * action costs the block, so it competes with her for the same three slots a
 * day - which is the only reason it is interesting.
 *
 * Learned facts are written to `known_facts` in ENGLISH like everything else in
 * memory (CLAUDE.md section 19), and they are the same strings the knowledge
 * gifts match against, so snooping genuinely unlocks a gift.
 */

import { getSoloAction } from '../data/soloActions.js';
import { DOSSIER_CAPS } from '../config/constants.js';
import { clamp } from './rng.js';
import { phraseDiscovered } from './rumor.js';

/**
 * Who might you learn something about here, and what?
 *
 * Only members with a fact you have not already got. Once you know everything
 * learnable about someone, snooping stops offering her up - which quietly
 * pushes the player toward the members they have been neglecting.
 */
export function learnableTargets(cards, dossier, excludeIds = []) {
  const out = [];
  for (const card of cards) {
    if (excludeIds.includes(card.id)) continue;
    const known = new Set((dossier[card.id]?.known_facts ?? []).map((f) => f.toLowerCase()));
    const fresh = (card.learnableFacts ?? []).filter((f) => !known.has(f.toLowerCase()));
    if (fresh.length > 0) out.push({ card, facts: fresh });
  }
  return out;
}

/**
 * A fact is worth this many rumors when the two compete for the same block.
 *
 * The curve mostly takes care of itself: at the start of a run there are 25
 * facts and no rumors at all, because nothing has happened yet for anyone to
 * have heard about. Rumors accumulate as the player starts being seen, and by
 * the last cycle the facts are gone and rumors are all that is left. The weight
 * only tilts the middle of the run toward facts, which is where a player is
 * still building the knowledge economy and would rather have something they can
 * spend.
 */
export const FACT_WEIGHT = 3;
export const RUMOR_WEIGHT = 1;

/**
 * Everything an empty room could tell you right now.
 *
 * Two kinds. A **fact** is about a member and unlocks an opener. A **rumor** is
 * what a member has already heard about the player, and it is the only way to
 * see the jealousy layer coming without spending a `Read her` on her - section
 * 5b's `heard_about` channel has always existed and the player has never been
 * able to look at it.
 *
 * Both obey the same rule: never about somebody standing in the room.
 */
export function availableFinds({ cards, dossier, present = [], foundRumors = [] }) {
  const seen = new Set(foundRumors);
  const finds = [];

  for (const card of cards) {
    if (present.includes(card.id)) continue;

    const known = new Set((dossier[card.id]?.known_facts ?? []).map((f) => f.toLowerCase()));
    for (const fact of card.learnableFacts ?? []) {
      if (known.has(fact.toLowerCase())) continue;
      finds.push({ kind: 'fact', memberId: card.id, name: card.name, text: fact, weight: FACT_WEIGHT });
    }

    for (const heard of dossier[card.id]?.heard_about ?? []) {
      if (seen.has(heard)) continue;
      finds.push({ kind: 'rumor', memberId: card.id, name: card.name, text: heard, weight: RUMOR_WEIGHT });
    }
  }

  return finds;
}

/** Weighted pick, so facts outnumber rumors without ever excluding them. */
export function pickFind(rng, finds) {
  const total = finds.reduce((sum, f) => sum + f.weight, 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const find of finds) {
    roll -= find.weight;
    if (roll < 0) return find;
  }
  return finds[finds.length - 1];
}

/**
 * Apply one solo action.
 *
 * @param {object} args - { locationId, actionId, cards, dossier, present, rng }
 * @returns {{ playerDelta, dossierAdd, learned, ledgerKey, rest }}
 */
export function resolveSoloAction({
  locationId,
  actionId,
  cards,
  dossier,
  present = [],
  foundRumors = [],
  rng = Math.random,
}) {
  const action = getSoloAction(locationId, actionId);
  if (!action) return null;

  const playerDelta = {
    credits: action.credits ?? 0,
    competence: action.competence ?? 0,
    energy: action.energy ?? 0,
    secrecy: action.secrecy ?? 0,
  };

  let learned = null;
  let heard = null;
  const dossierAdd = [];

  if (action.learns) {
    const find = pickFind(rng, availableFinds({ cards, dossier, present, foundRumors }));

    if (find?.kind === 'fact') {
      learned = { memberId: find.memberId, name: find.name, fact: find.text };
      dossierAdd.push({ memberId: find.memberId, category: 'known_facts', text: find.text });
    } else if (find?.kind === 'rumor') {
      /**
       * What she has already heard. No dossier write: this does not change
       * anything she knows, it changes what the PLAYER knows - which is the
       * whole point, because jealousy was previously invisible until it had
       * already turned into strain.
       */
      heard = { memberId: find.memberId, name: find.name, text: find.text };
    } else {
      // Nothing left to find. The secrecy cost is not charged for a search that
      // turned up nothing - the player should not be punished for having
      // already done the work.
      playerDelta.secrecy = 0;
    }
  }

  return {
    action,
    playerDelta,
    dossierAdd,
    learned,
    heard,
    goodwill: Boolean(action.goodwill),
    rest: Boolean(action.rest),
    ledgerKey: `solo.${actionId}`,
  };
}

/**
 * The one-sentence line appended to the ledger, in English.
 *
 * Written here rather than by the model: it is bookkeeping, and the summarizer
 * call it would otherwise cost is better spent on a scene.
 */
export function soloLedgerText(result, { locationLabel, playerName = 'The player' }) {
  if (result.learned) {
    return `${playerName} was alone at ${locationLabel}, and learned that ${result.learned.name} ${result.learned.fact}.`;
  }
  if (result.heard) {
    return `${playerName} was alone at ${locationLabel}, and found out that ${phraseDiscovered(
      result.heard.name,
      result.heard.text,
    )}.`;
  }
  if (result.rest) {
    return `${playerName} slept.`;
  }
  if (result.goodwill) {
    return `${playerName} did something small for the others at ${locationLabel}.`;
  }
  return `${playerName} worked alone at ${locationLabel}.`;
}

/** Small intimacy bump to everyone who benefited from a goodwill action. */
export function goodwillTargets(cards, occupancy, locationId) {
  if (!occupancy) return [];
  return cards
    .filter((c) => occupancy[c.id]?.locationId === locationId)
    .map((c) => c.id);
}

export function applySoloPlayerDelta(player, delta) {
  return {
    ...player,
    credits: Math.max(0, player.credits + (delta.credits ?? 0)),
    competence: clamp(player.competence + (delta.competence ?? 0)),
    energy: clamp(player.energy + (delta.energy ?? 0)),
    secrecy: clamp(player.secrecy + (delta.secrecy ?? 0)),
  };
}

export { DOSSIER_CAPS };
