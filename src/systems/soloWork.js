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
import { clamp, pick } from './rng.js';

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
  const dossierAdd = [];

  if (action.learns) {
    const targets = learnableTargets(cards, dossier, present);
    if (targets.length > 0) {
      const target = pick(rng, targets);
      const fact = pick(rng, target.facts);
      learned = { memberId: target.card.id, name: target.card.name, fact };
      dossierAdd.push({ memberId: target.card.id, category: 'known_facts', text: fact });
    } else {
      // Nothing left to learn here. The secrecy cost is not charged for a
      // search that turned up nothing - the player should not be punished for
      // having already done the work.
      playerDelta.secrecy = 0;
    }
  }

  return {
    action,
    playerDelta,
    dossierAdd,
    learned,
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
