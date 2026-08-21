/**
 * The turn loop. CLAUDE.md sections 6, 7, 8.
 *
 * Owns the lifecycle of one scene: open the frame, run turns against it, close
 * it and commit. It is the only module that touches both the prompt pipeline
 * and the pure systems, and it is deliberately thin - the systems decide what
 * things mean, this just sequences them.
 *
 * The engine takes its model client as a parameter. That is what lets the whole
 * pipeline be exercised in a console harness with no network and no key.
 */

import { openScene, appendTurn, appendSystemNote, requestThought, buildMessages } from './promptBuilder.js';
import { createStreamParser, parseResponse, totalDeltas } from './responseParser.js';
import { parseSummary, buildSummarizerMessages, toCommit } from './summarizer.js';
import { commitSummary } from './memory.js';
import { sceneExposure } from '../systems/exposure.js';
import { jealousyBand, sceneModifiers, convert, decay, addJealousy, unaddressedStrain } from '../systems/jealousy.js';
import { applySceneOutcome } from '../systems/relationship.js';
import { propagate } from '../systems/rumor.js';
import { RISK_EXPOSURE_THRESHOLD } from '../config/constants.js';
import { clamp } from '../systems/rng.js';

/**
 * Scene meters are VOLATILE and client-side only.
 * They are never re-injected into the prompt while the scene is open.
 */
export function newMeters(rel) {
  const { guardBonus } = sceneModifiers(rel);
  return {
    guard: clamp(100 - rel.intimacy + guardBonus),
    guardStart: clamp(100 - rel.intimacy + guardBonus),
    fluster: 0,
    flusterPeak: 0,
    riskTaken: false,
  };
}

export function applyBeatToMeters(meters, beats) {
  const { guard, fluster } = totalDeltas(beats);
  const next = {
    ...meters,
    guard: clamp(meters.guard + guard),
    fluster: clamp(meters.fluster + fluster),
  };
  next.flusterPeak = Math.max(next.flusterPeak, next.fluster);
  return next;
}

/**
 * Open a scene. Blocks 1-4 are computed once here and frozen.
 */
export function beginScene({ cards, lineup, identity, player, lang, memory, relations, scene }) {
  const exposure = sceneExposure({
    locationId: scene.locationId,
    block: scene.block,
    phase: scene.phase,
    secrecy: player?.secrecy ?? 70,
    identity,
  });

  const focusId = scene.focusId ?? scene.rosterIds[0];
  const frame = openScene({
    cards,
    lineup,
    identity,
    player,
    lang,
    memory,
    relations,
    scene: { ...scene, exposure },
  });

  return {
    frame,
    exposure,
    focusId,
    meters: newMeters(relations[focusId]),
    beats: [],
  };
}

/**
 * Run one turn.
 *
 * @param {object} session
 * @param {object} args - { stance, text, client, onBeat }
 */
export async function runTurn(session, { stance, text, client, onBeat = () => {} }) {
  const content = stance ? `[${stance}] ${text ?? ''}`.trim() : (text ?? '');
  let frame = appendTurn(session.frame, { role: 'user', content });

  const ctx = { rosterIds: frame.rosterIds, focusId: session.focusId };
  const parser = createStreamParser(ctx);

  const raw = await client({
    messages: buildMessages(frame),
    preset: 'turn',
    onChunk: (chunk) => {
      for (const beat of parser.push(chunk)) onBeat(beat);
    },
  });

  const { tail, beats } = parser.end();
  for (const beat of tail) onBeat(beat);

  frame = appendTurn(frame, { role: 'assistant', content: raw });

  return {
    ...session,
    frame,
    beats: [...session.beats, ...beats],
    meters: applyBeatToMeters(session.meters, beats),
  };
}

/** Read her. Costs a use, returns a thought only, never moves state. */
export async function readHer(session, { client }) {
  const frame = requestThought(session.frame);
  if (!frame) return { session, thought: null };

  const raw = await client({ messages: buildMessages(frame), preset: 'thought' });
  return {
    session: { ...session, frame: appendTurn(frame, { role: 'assistant', content: raw }) },
    thought: String(raw ?? '').trim(),
  };
}

export function openWithGift(session, note) {
  return { ...session, frame: appendSystemNote(session.frame, note) };
}

/**
 * How a scene starts.
 *
 * Not a fake player action. The first beat belongs to her - the player has done
 * nothing yet except arrive, and if they arrived holding something, that is
 * what she responds to before anything else.
 */
export const OPENING_WITH_GIFT =
  'System note: write her opening beat. It is her reaction to what she has just been handed, and to the person holding it. Nothing else has been said yet.';

export const OPENING_PLAIN =
  'System note: write her opening beat - what she does in the moment she notices the player has walked in. Nothing has been said yet.';

export function openingDirective(hasGift) {
  return hasGift ? OPENING_WITH_GIFT : OPENING_PLAIN;
}

/** Mark that the player deliberately took a risk while visible. */
export function markRisk(session) {
  return { ...session, meters: { ...session.meters, riskTaken: true } };
}

/**
 * Micro to macro. CLAUDE.md section 6.
 *
 * Computed HERE from accumulated meter movement, never reported by the model.
 */
export function computeDeltas(session, rel, rng) {
  const { meters, exposure } = session;
  const delta = { intimacy: 0, admissibility: 0, strain: 0, good: false };

  const guardDrop = meters.guardStart - meters.guard;
  if (guardDrop >= 15) delta.intimacy += 2 + Math.floor(rng() * 3);
  if (meters.flusterPeak >= 60) delta.intimacy += 1 + Math.floor(rng() * 3);

  if (meters.riskTaken && exposure >= RISK_EXPOSURE_THRESHOLD) {
    const survives = rng() < 0.35 + (rel.intimacy / 100) * 0.4;
    if (survives) delta.admissibility += 3 + Math.floor(rng() * 4);
    else delta.strain += 10 + Math.floor(rng() * 11);
  }

  if (rel.stage === 'reckless') delta.strain += 5;
  delta.strain += unaddressedStrain(rel);
  delta.good = delta.intimacy > 0 && delta.strain === 0;

  return delta;
}

/**
 * Close the scene.
 *
 * 1. one summarizer call
 * 2. commit to ledger and dossier
 * 3. apply macro deltas from accumulated turn metadata
 * 4. propagate rumors to everyone who was not there
 * 5. discard block 5
 */
export async function endScene(session, { client, memory, relations, cards, scene, rng }) {
  const rosterIds = [...session.frame.rosterIds];

  let parsed;
  try {
    const raw = await client({
      messages: buildSummarizerMessages(session.frame, buildMessages),
      preset: 'summarize',
    });
    parsed = parseSummary(raw, { rosterIds });
  } catch {
    // A failed summarizer call must not cost the player the scene.
    parsed = parseSummary(null, { rosterIds });
  }

  const nextMemory = commitSummary(
    memory,
    toCommit(parsed, { week: scene.week, day: scene.day, block: scene.block, id: scene.id }),
  );

  const nextRelations = { ...relations };
  const focusRel = nextRelations[session.focusId];
  const delta = computeDeltas(session, focusRel, rng);

  nextRelations[session.focusId] = applySceneOutcome(focusRel, delta);
  nextRelations[session.focusId] =
    jealousyBand(nextRelations[session.focusId].jealousy) === 'piqued'
      ? convert(nextRelations[session.focusId])
      : decay(nextRelations[session.focusId]);

  const subject = cards.find((c) => c.id === session.focusId);
  const { rumors, jealousyDeltas } = propagate({
    scene: {
      exposure: session.exposure,
      phase: scene.phase,
      locationId: scene.locationId,
      locationLabel: scene.locationLabel,
      presentIds: rosterIds,
      dormWitnessIds: scene.dormWitnessIds ?? [],
    },
    subject: { id: subject.id, name: subject.name },
    cast: cards,
    relations: nextRelations,
    rng,
  });

  for (const [id, amount] of Object.entries(jealousyDeltas)) {
    nextRelations[id] = addJealousy(nextRelations[id], amount);
  }

  let finalMemory = nextMemory;
  for (const rumor of rumors) {
    finalMemory = commitSummary(finalMemory, {
      entry: null,
      dossierAdd: [{ memberId: rumor.memberId, category: 'heard_about', text: rumor.text }],
    });
  }

  // Block 5 is discarded by simply not carrying the frame forward.
  return { memory: finalMemory, relations: nextRelations, delta, rumors, summary: parsed };
}

export { parseResponse };
