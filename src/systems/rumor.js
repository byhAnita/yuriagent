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
import { LOCATIONS } from '../data/locations.js';
import { jealousyGain } from './jealousy.js';
import { clamp } from './rng.js';

/**
 * Three tiers, not two, and the middle one is the one that was missing.
 *
 * `witnessed` used to fire on mere co-presence, so an afternoon in the practice
 * room where the player talked to Irene about the choreography handed the other
 * four the heaviest event in the game each. Five women who have shared a dorm
 * for years came out of every group scene resenting one another.
 *
 * But zero is wrong too. Watching the player spend every evening with Irene is
 * not nothing - it is simply not the same as watching the player reach for her.
 * So:
 *
 *   PRESENT   - she was in the room while the player spent it on somebody else.
 *               The lightest thing in the model, lighter even than hearsay,
 *               because there is nothing furtive about it: she was right there,
 *               and it was a conversation.
 *   RUMOR     - she found out afterwards. More charged than watching, because
 *               finding out is itself a small betrayal of not being told.
 *   WITNESSED - she watched the player make an overt move: a risk stance, a
 *               gift, a gesture. What a witness could DESCRIBE, which is the
 *               same test section 6 uses for what may move admissibility.
 */
export const WEIGHT_PRESENT = 0.5;
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
export function phraseRumor(subjectName, locationId) {
  /**
   * The English name, looked up here rather than taken from the caller.
   *
   * `scene.locationLabel` is what the PLAYER sees, and `App` builds it with
   * `t()` - so on a `zh` run the rumor read "you heard the player was at 练习室
   * with Irene" and that sentence went straight into `heard_about`, into block
   * 3, and into the save. Section 19's second rule is that memory is always
   * English precisely so the player can switch language mid-run without
   * corrupting history. Resolving the name from the table instead of trusting a
   * label makes that structural rather than a thing every caller must remember.
   */
  const name = LOCATIONS[locationId]?.label ?? locationId;
  return `you heard the player was at ${name} with ${subjectName}`;
}

/**
 * The same rumor, turned round to face the player.
 *
 * Everything in `heard_about` is written from HER side, because that is the
 * form it takes in her prompt - "you heard the player was at the cafe with
 * Nana". When the player is the one who finds out that she has heard it, the
 * sentence has to be re-pointed, or the ledger fills with second-person lines
 * addressed to nobody.
 */
export function phraseDiscovered(name, text) {
  const turned = String(text ?? '')
    .replace(/^you heard\b/, 'has heard')
    .replace(/^you saw\b/, 'saw')
    .replace(/^you watched\b/, 'watched');
  return `${name} ${turned}`;
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
 *   scene    - { exposure, phase, locationLabel, presentIds, locationId,
 *                singledOut, shared, collective } - `singledOut` is whether
 *                the player made an overt move toward the subject in front of
 *                the room. Without it, being present buys nobody a witnessed
 *                event. `shared` (a dorm evening) and `collective` (an anchor
 *                event) both mean nobody chose to be here, so presence alone
 *                costs nothing; `shared` additionally suppresses the witnessed
 *                branch, and `collective` deliberately does not.
 *   subject  - { id, name } the member the scene was actually with
 *   cast     - [{ id, name }]
 *   relations- { [id]: relation }
 *   rng      - () => [0,1)
 * @returns {{ rumors: Array, noticed: Array, jealousyDeltas: Object }}
 *   `noticed` is who was in the room while the player spent it on somebody
 *   else. It carries no dossier entry (section 5b) but the player is told, or
 *   the scene ends silent while three people's jealousy moves.
 */
export function propagate({ scene, subject, cast, relations, rng }) {
  const rumors = [];
  const noticed = [];
  const jealousyDeltas = {};
  const present = new Set(scene.presentIds ?? [subject.id]);

  for (const member of cast) {
    if (member.id === subject.id) continue;
    const rel = relations[member.id];
    if (!rel) continue;

    /**
     * A shared activity singles nobody out, so nobody is watching anybody.
     *
     * Without this the dorm's release valve is its own tax: five people cooking
     * together would generate four witnessed jealousy events, at the exposure
     * floor of a group scene, for an evening in which nothing happened to
     * anyone in particular. PROPOSALS 15.
     */
    if (scene.shared && present.has(member.id)) continue;

    /**
     * Nobody chose to be at the concept meeting, including the player.
     *
     * `WEIGHT_PRESENT` prices "she was in the room while the player spent the
     * block on somebody else", and that is exactly right for a practice room
     * with three of them in it: the player picked one. An ANCHOR EVENT is not
     * that. The company put all five in the room, attendance is the day, and
     * the client picks an addressee by construction - so every event ended
     * with four "she watched you give your time to Irene" lines and four
     * jealousy hits, fourteen times a campaign, for turning up to work.
     *
     * Reported five separate times in the day-three playtest, once per event
     * played: *"I didn't give Irene anything or do special interaction. Player
     * just join the special event group chat, there shouldn't be a witness."*
     *
     * Same argument `shared` already won for the dorm two rules up - collective
     * attendance is not a choice - and it takes the same exemption. Only the
     * presence tier, though: a GESTURE at an event still falls through to the
     * witnessed branch at full weight, because section 10 is explicit that
     * singling somebody out in front of the other four is the loudest act in
     * the game. The event stays the highest-stakes room there is; it just
     * stops charging admission.
     */
    if (scene.collective && present.has(member.id) && !scene.singledOut) continue;

    /**
     * She was in the room, and nothing happened that she could name.
     *
     * A small amount of pressure and NO dossier entry. `heard_about` is for
     * things she found out; she does not need a note reminding her she was
     * standing there. Writing one every group scene would also flush the
     * four-entry FIFO of anything that actually mattered.
     *
     * `singledOut` is set by the turn loop when the player makes an overt move
     * toward one member in front of the others: a risk stance, a gift, or a
     * gesture. Below that bar this is what a group scene costs.
     */
    if (present.has(member.id) && !scene.singledOut) {
      jealousyDeltas[member.id] = jealousyGain(WEIGHT_PRESENT, rel);
      /**
       * Reported separately from `rumors`, and still writes no dossier entry.
       *
       * The two rules are not in tension, they answer different questions.
       * `heard_about` is what SHE knows and a note every group scene saying she
       * was in the room would flush its four-entry FIFO of anything that
       * mattered. This is what the PLAYER is told at scene exit, and without it
       * a 1v1 in an occupied room ends completely silent while three people's
       * jealousy moves - which is how it was reported: "missing witness info
       * displayed in ending of the scene".
       */
      noticed.push({ memberId: member.id, subjectId: subject.id, subjectName: subject.name });
      continue;
    }

    /**
     * Present in the room, and the player made a move.
     *
     * Section 5b's claim that a group scene is the highest-risk,
     * highest-reward place in the game is untouched - this is still the
     * loudest single act available, at five times the weight of simply being
     * in the room together. It now requires an act.
     */
    if (present.has(member.id)) {
      const exposure = Math.max(scene.exposure, WITNESS_EXPOSURE_FLOOR);
      rumors.push({
        memberId: member.id,
        text: phraseWitnessed(subject.name),
        kind: 'witnessed',
        subjectId: subject.id,
        subjectName: subject.name,
        locationId: scene.locationId,
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
        kind: 'approach',
        subjectId: subject.id,
        subjectName: subject.name,
        locationId: scene.locationId,
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
        text: phraseRumor(subject.name, scene.locationId),
        kind: 'heard',
        subjectId: subject.id,
        subjectName: subject.name,
        locationId: scene.locationId,
        witnessed: false,
        exposure: scene.exposure,
      });
      jealousyDeltas[member.id] = jealousyGain(WEIGHT_RUMOR, rel);
    }
  }

  return { rumors, noticed, jealousyDeltas };
}
