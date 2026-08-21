/**
 * Awareness propagation. CLAUDE.md section 5b.
 *
 * A member cannot be jealous about something she does not know about. Rather
 * than making everyone omniscient, awareness falls out of the exposure value the
 * scene already computed - which is what gives exposure its third job and makes
 * privacy safe-but-stagnant while visibility is real-but-contested.
 *
 * The rumor is always phrased from HER point of view, never as a transcript.
 * That is the one channel by which one member learns anything about another
 * member's scene, and it is what keeps prompt block 3 roster-scoped.
 */

import { RUMOR_FLOOR, WITNESS_EXPOSURE_FLOOR } from '../config/constants.js';
import { approachIsWitnessed } from './exposure.js';
import { jealousyGain } from './jealousy.js';
import { clamp } from './rng.js';

/** Direct observation is worth far more than hearsay. */
export const WEIGHT_RUMOR = 1;
export const WEIGHT_WITNESSED = 2.5;

/**
 * How likely an absent member is to be in a position to hear about it.
 * COMEBACK week collapses the distance between everyone.
 */
export function proximity(phase, sameBuilding = true) {
  if (phase === 'comeback') return 1;
  return sameBuilding ? 0.75 : 0.4;
}

/** p(she learns of it). Nothing propagates below the floor. */
export function rumorProbability(exposure, prox) {
  if (exposure <= RUMOR_FLOOR) return 0;
  return clamp(((exposure - RUMOR_FLOOR) / (100 - RUMOR_FLOOR)) * prox, 0, 1);
}

/**
 * From her point of view, never as a transcript.
 * Written in English regardless of UI language (section 19).
 */
export function phraseRumor(subjectName, locationLabel) {
  return `you heard the player was at ${locationLabel} with ${subjectName}`;
}

export function phraseWitnessed(subjectName) {
  return `you saw the player with ${subjectName}, in front of you`;
}

export function phraseApproach(subjectName) {
  return `you watched the player go into ${subjectName}'s room and close the door`;
}

/**
 * Resolve what every absent member learns at scene exit.
 *
 * Deterministic given `rng`, so a seeded run replays identically and balanceSim
 * can hold the dice fixed while coefficients move.
 *
 * @param {object} args
 *   scene    - { exposure, phase, locationLabel, presentIds, locationId }
 *   subject  - { id, name } the member the scene was actually with
 *   cast     - [{ id, name }]
 *   relations- { [id]: relation }
 *   rng      - () => [0,1)
 * @returns {{ rumors: Array, jealousyDeltas: Object }}
 */
export function propagate({ scene, subject, cast, relations, rng }) {
  const rumors = [];
  const jealousyDeltas = {};
  const present = new Set(scene.presentIds ?? [subject.id]);

  for (const member of cast) {
    if (member.id === subject.id) continue;
    const rel = relations[member.id];
    if (!rel) continue;

    // Present in the room: direct observation, no roll.
    if (present.has(member.id)) {
      const exposure = Math.max(scene.exposure, WITNESS_EXPOSURE_FLOOR);
      rumors.push({
        memberId: member.id,
        text: phraseWitnessed(subject.name),
        witnessed: true,
        exposure,
      });
      jealousyDeltas[member.id] = jealousyGain(WEIGHT_WITNESSED, rel);
      continue;
    }

    // Watched you walk in, even though the scene itself never leaked.
    if (approachIsWitnessed(scene.locationId) && scene.dormWitnessIds?.includes(member.id)) {
      rumors.push({
        memberId: member.id,
        text: phraseApproach(subject.name),
        witnessed: true,
        exposure: WITNESS_EXPOSURE_FLOOR,
      });
      jealousyDeltas[member.id] = jealousyGain(WEIGHT_WITNESSED, rel);
      continue;
    }

    // Otherwise it has to travel.
    const p = rumorProbability(scene.exposure, proximity(scene.phase));
    if (p > 0 && rng() < p) {
      rumors.push({
        memberId: member.id,
        text: phraseRumor(subject.name, scene.locationLabel),
        witnessed: false,
        exposure: scene.exposure,
      });
      jealousyDeltas[member.id] = jealousyGain(WEIGHT_RUMOR, rel);
    }
  }

  return { rumors, jealousyDeltas };
}
