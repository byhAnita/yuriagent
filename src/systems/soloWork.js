/**
 * Resolving a block spent alone. Pure.
 *
 * An empty room is not dead space: it is where an assistant does the job, and
 * where you find out things about a member who is not in the room. Every solo
 * action costs the block, so it competes with her for the same three slots a
 * day - which is the only reason it is interesting.
 *
 * Learned facts are written to `facts` in ENGLISH like everything else in
 * memory (CLAUDE.md section 19), and they are the same strings the knowledge
 * gifts match against, so snooping genuinely unlocks a gift.
 *
 * The find ALSO carries what the player needs to read it - a `factId`, or the
 * shape of the rumor behind it. The English is for the model and the structure
 * is for the screen; a find that carried only the English guaranteed English
 * on a Chinese snoop screen (PROPOSALS 14).
 */

import { getSoloAction } from '../data/soloActions.js';
import {
  DOSSIER_CAPS,
  SNOOP_WITNESS_PENALTY,
  SNOOP_COST_MAX_MULTIPLIER,
} from '../config/constants.js';
import { clamp } from './rng.js';
import { phraseDiscovered } from './rumor.js';
import { roomRoutine, DAY_NAMES } from './calendar.js';
import { cardFacts } from '../data/facts.js';
import { entryText } from './dossierEntry.js';

/**
 * Who might you learn something about here, and what?
 *
 * Only members with a fact you have not already got. Once you know everything
 * learnable about someone, snooping stops offering her up - which quietly
 * pushes the player toward the members they have been neglecting.
 */
/**
 * What she has already told you, as lowercased English.
 *
 * Matched on text rather than on id because a fact can arrive by either route:
 * snooped, carrying an id, or mentioned in a scene, where the summarizer
 * paraphrases it and has no id to give. Only the English is common to both.
 */
function knownTexts(memberDossier) {
  return new Set((memberDossier?.facts ?? []).map((f) => entryText(f).toLowerCase()));
}

export function learnableTargets(cards, dossier, excludeIds = []) {
  const out = [];
  for (const card of cards) {
    if (excludeIds.includes(card.id)) continue;
    const known = knownTexts(dossier[card.id]);
    const fresh = cardFacts(card).filter((f) => !known.has(f.en.toLowerCase()));
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
 * ...and a ROUTINE, which is the prize section 10 has wanted since M1.
 *
 *   > a fact that tells you where she will be is more interesting than one that
 *   > tells you what to purchase.
 *
 * It never arrived, for two reasons that both went away this milestone. Gifts
 * were the only thing a fact could buy, so knowledge WAS purchasing (Part I.10
 * ends that); and the map showed occupancy, so where she is was free. The map
 * shows occupancy again after the I.11 reversal - but a routine and a map answer
 * two different questions, and that distinction is exactly what keeps this
 * worth finding:
 *
 *   **the map says where she is NOW. A routine says where she will be on an
 *   evening nobody has reached yet.**
 *
 * The week grid shows scheduled WORK slots and never idle ones, so which
 * evenings she spends in her own room is not on any screen the player can read.
 * `roomRoutine` has fixed those evenings from the seed since M1 precisely so
 * they could be learned rather than knocked on.
 *
 * Weighted between the two: rarer than a fact because there are five of them
 * against twenty-five, and dearer than a rumor because it is a plan rather than
 * a warning. It expires with the week it was drawn for, which is honest - what
 * the player bought is this week's access, not a permanent key.
 */
export const ROUTINE_WEIGHT = 2;

/**
 * One learned routine, as a key the player's own knowledge list holds.
 *
 * Player-side like `foundRumors`, and for the same reason: knowing when she is
 * home changes what the PLAYER knows, not anything she knows. It never touches
 * her dossier and it never reaches a prompt.
 */
export function routineKey({ memberId, phase, week = 0 }) {
  return `${memberId}:${phase}:${week}`;
}

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
/**
 * @param {string|null} kind - 'fact', 'rumor', or null for both.
 *
 * A room teaches ONE of the two, decided by its slot on the phase map:
 * `social` carries `rumor`, the workrooms and the venue carry `knowledge`.
 * `data/phaseMaps.js` has said so since phase maps shipped and nothing read
 * it, so every snoop drew from one 3:1-weighted pool and the role table was
 * decoration. Null is still accepted because a caller with no room in hand
 * (the balance harness) legitimately wants the whole pool.
 */
export function availableFinds({
  cards,
  dossier,
  present = [],
  foundRumors = [],
  /**
   * Routines already learned, and the week they would be about. Absent, the
   * routine find is simply never offered - a caller with no clock in hand (the
   * balance harness) cannot ask about a specific week and should not be handed
   * one at random.
   */
  foundRoutines = [],
  phase = null,
  week = 0,
  seed = null,
  kind = null,
}) {
  const seen = new Set(foundRumors);
  const knownRoutines = new Set(foundRoutines);
  const finds = [];
  const wants = (k) => kind === null || kind === k;

  for (const card of cards) {
    if (present.includes(card.id)) continue;

    const known = wants('fact') ? knownTexts(dossier[card.id]) : null;
    for (const fact of wants('fact') ? cardFacts(card) : []) {
      if (known.has(fact.en.toLowerCase())) continue;
      finds.push({
        kind: 'fact',
        memberId: card.id,
        name: card.name,
        factId: fact.id,
        text: fact.en,
        weight: FACT_WEIGHT,
      });
    }

    /**
     * Which evenings she is home. Filed under `fact` because a routine is about
     * HER, and section 10b's rule for which room teaches what is exactly that:
     * a rumor is what people say about you, so you hear it where people talk; a
     * fact is about her, so you find it where her work is.
     *
     * Nothing to learn during COMEBACK - `roomRoutine` returns no evenings that
     * week because she is not home, and "she is never home this week" is
     * already on the phase table every player can read.
     */
    if (wants('fact') && phase && seed !== null) {
      const key = routineKey({ memberId: card.id, phase, week });
      const nights = knownRoutines.has(key)
        ? []
        : roomRoutine({ cardId: card.id, phase, seed, week });

      if (nights.length > 0) {
        finds.push({
          kind: 'routine',
          memberId: card.id,
          name: card.name,
          routineKey: key,
          nights,
          text: `${card.name} is in her own room on ${nights.map((d) => DAY_NAMES[d]).join(' and ')} evenings this week`,
          weight: ROUTINE_WEIGHT,
        });
      }
    }

    for (const heard of wants('rumor') ? (dossier[card.id]?.heard_about ?? []) : []) {
      const text = entryText(heard);
      if (seen.has(text)) continue;
      /**
       * The rumor's own shape travels with it.
       *
       * `rumor.js` already produces `kind`, `subjectName` and `locationId`,
       * and the aftermath screen already renders from them rather than from
       * the English - this is the same data reaching the other screen that
       * needed it. Spreading the entry keeps whatever it carries.
       */
      const shape = typeof heard === 'object' ? heard : {};
      finds.push({
        ...shape,
        /**
         * TWO fields called `kind` meet here and they mean different things.
         *
         * A find's kind is fact-or-rumor; a rumor's own kind is
         * heard/witnessed/approach and picks the sentence template. Spreading
         * the entry over the find silently overwrote the first with the
         * second, which sent every rumor find down the "nothing here" branch -
         * so the whole rumor half of snooping switched itself off. Renaming it
         * on the way in is the fix; `kind` below is the authoritative one.
         */
        rumorKind: shape.kind ?? 'heard',
        kind: 'rumor',
        memberId: card.id,
        name: card.name,
        text,
        weight: RUMOR_WEIGHT,
      });
    }
  }

  return finds;
}

/**
 * What a snoop costs in secrecy, once you count who is watching.
 *
 * `base` is negative, so this makes it more negative. Rounded away from zero so
 * a witness always costs something: a -1 corridor snoop with one other person
 * in it must not round back to -1 and make company free.
 */
export function snoopCost(base, witnesses = 0) {
  if (!base || witnesses <= 0) return base ?? 0;
  const multiplier = Math.min(
    SNOOP_COST_MAX_MULTIPLIER,
    1 + SNOOP_WITNESS_PENALTY * witnesses,
  );
  return -Math.ceil(Math.abs(base) * multiplier);
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
  foundRoutines = [],
  phase = null,
  week = 0,
  seed = null,
  rng = Math.random,
}) {
  const action = getSoloAction(locationId, actionId);
  if (!action) return null;

  const playerDelta = {
    credits: action.credits ?? 0,
    competence: action.competence ?? 0,
    energy: action.energy ?? 0,
    // Only the snoop is priced by company. Restocking a wardrobe in front of
    // somebody is not indiscreet; reading her fitting notes in front of her
    // bandmates is.
    secrecy: action.learns ? snoopCost(action.secrecy ?? 0, present.length) : (action.secrecy ?? 0),
  };

  let learned = null;
  let heard = null;
  let routine = null;
  const dossierAdd = [];

  if (action.learns) {
    // The room decides WHICH kind. `true` is the pre-slot shape and still
    // means "either", so an old save or an ad-hoc caller cannot break.
    const kind = typeof action.learns === 'string' ? action.learns : null;
    const find = pickFind(
      rng,
      availableFinds({
        cards,
        dossier,
        present,
        foundRumors,
        foundRoutines,
        phase,
        week,
        seed,
        kind,
      }),
    );

    if (find?.kind === 'routine') {
      /**
       * ACCESS, not an object. No dossier write and nothing reaches a prompt -
       * she does not know the player found out which evenings she is home, and
       * telling the model would be handing it a fact about the player's plans
       * rather than about her.
       */
      routine = {
        memberId: find.memberId,
        name: find.name,
        routineKey: find.routineKey,
        nights: find.nights,
        text: find.text,
      };
    } else if (find?.kind === 'fact') {
      learned = { memberId: find.memberId, name: find.name, factId: find.factId, fact: find.text };
      // The id goes into the dossier with the text, which is what lets the
      // opener match exactly and the snoop screen print the right language.
      dossierAdd.push({
        memberId: find.memberId,
        category: 'facts',
        factId: find.factId,
        text: find.text,
      });
    } else if (find?.kind === 'rumor') {
      /**
       * What she has already heard. No dossier write: this does not change
       * anything she knows, it changes what the PLAYER knows - which is the
       * whole point, because jealousy was previously invisible until it had
       * already turned into strain.
       */
      // Everything the find carried, so the screen can render the sentence
      // rather than echo the English one memory keeps (PROPOSALS 14).
      const { weight: _weight, ...shape } = find;
      heard = { ...shape, memberId: find.memberId, name: find.name, text: find.text };
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
    routine,
    goodwill: Boolean(action.goodwill),
    dish: Boolean(action.dish),
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
  if (result.routine) {
    return `${playerName} was alone at ${locationLabel}, and worked out that ${result.routine.text}.`;
  }
  if (result.rest) {
    return `${playerName} slept.`;
  }
  if (result.dish) {
    return `${playerName} cooked something, and put it aside for later.`;
  }
  if (result.goodwill) {
    return `${playerName} did something small for the others at ${locationLabel}.`;
  }
  return `${playerName} worked alone at ${locationLabel}.`;
}

/** Small affection bump to everyone who benefited from a goodwill action. */
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
