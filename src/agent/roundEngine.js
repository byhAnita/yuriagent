/**
 * The round loop. CLAUDE.md Part I.3.
 *
 * Replaces v1's `sceneEngine.js`, and it is a fraction of the size for one
 * reason: v1 had to decide what a turn was WORTH. It priced a stance, tracked
 * two volatile meters, ran a second call to write the chips, ran a third to
 * interject, and a fourth to summarise. All of that was code authoring the
 * scene, and Part I hands it back:
 *
 *   THE MODEL DECIDES WHAT THE SCENE MEANS. THE CODE DECIDES WHAT THE WORLD IS.
 *
 * So this file sequences and constrains, and nothing else. It knows where the
 * player is, who is in the room, how visible it is, and when the scene runs out
 * of rounds. It never decides what a round was worth.
 *
 * ONE CALL PER ROUND. The prose and the four options come out of the same call,
 * which is the whole saving over v1's ~18-25 calls a scene. Never split the
 * machine fields into a second request: that is exactly what `writeChips` was,
 * ~500 extra calls a campaign, and it abandons the shared prefix that makes the
 * first one cheap.
 */

import { buildTier1, buildTier2, buildTier3, buildMessages } from './tiers.js';
import { createRoundStream, parseRound } from './roundParser.js';
import {
  newPool,
  openScene as openPool,
  appendRound,
  recordChoice,
  closeScene as closePool,
  poolEntries,
  roundCount,
} from './pool.js';
import { applyDeltas, newBudget } from '../systems/values.js';
import { sceneExposure } from '../systems/exposure.js';
import { SCENE_ROUNDS_MIN, SCENE_ROUNDS_MAX } from '../config/constants.js';
import { makeRng, deriveSeed } from '../systems/rng.js';

/**
 * Open a scene.
 *
 * Tier 1 is built here rather than cached by the caller because it is
 * byte-stable by construction - same cards, same identity, same language - so
 * rebuilding it costs a string concatenation and buys one less thing for a
 * caller to get wrong.
 *
 * `exposure` is computed ONCE, at the door, and frozen for the scene. It is the
 * world's opinion of how visible this was, and it must not change underneath a
 * round the player has already committed to.
 */
export function beginScene({
  cards = [],
  lineup = {},
  identity,
  player = {},
  relations = {},
  dossier = {},
  lang = 'en',
  pool = newPool(),
  seed = 1,
  scene,
}) {
  const exposure = sceneExposure({
    locationId: scene.locationId,
    block: scene.block,
    phase: scene.phase,
    secrecy: player.secrecy ?? 70,
    identity,
  });

  /**
   * How long this one runs. Seeded on the scene rather than drawn fresh, so a
   * reloaded save plays the same scene it was in the middle of.
   */
  const rng = makeRng(deriveSeed(seed, `scene:${scene.id}`));
  const total =
    SCENE_ROUNDS_MIN + Math.floor(rng() * (SCENE_ROUNDS_MAX - SCENE_ROUNDS_MIN + 1));

  return {
    tier1: buildTier1({ cards, lineup, identity, playerName: player.name, lang }),
    cards,
    lang,
    scene,
    exposure,
    total,
    /** Set by `leave`. The next round is the last one, and it asks for a summary. */
    leaving: false,
    ended: false,
    pool: openPool(pool, { id: scene.id, label: scene.locationLabel }),
    relations,
    player,
    dossier,
    budget: newBudget(),
    /** The last `sum|` the model offered, whichever round it arrived on. */
    summary: null,
    canon: [],
  };
}

/** How many rounds are still to come, the scene's own count included. */
export function roundsLeft(session) {
  if (session.ended) return 0;
  if (session.leaving) return 0;
  return Math.max(0, session.total - roundCount(session.pool));
}

/** True once the block is spent and the only control left is the door. */
export function isOver(session) {
  return session.ended || roundsLeft(session) === 0;
}

/**
 * Forfeit the rest of the scene.
 *
 * The block is already paid, so leaving early buys nothing except the time - and
 * that is the point. Part I.3 makes the block the unit of opportunity cost
 * precisely so the rounds inside it need no ration of their own.
 */
export function leave(session) {
  return { ...session, leaving: true };
}

/**
 * Run one round.
 *
 * @param {object} session
 * @param {object} ctx
 * @param {Function} ctx.client   - `({messages, preset, onChunk}) => Promise<string>`
 * @param {string?}  ctx.choice   - what the player picked in answer to the LAST round
 * @param {string?}  ctx.note     - a system note: the player handed something over
 * @param {Function?} ctx.onChunk - prose, as it streams
 * @returns {Promise<{session: object, round: object}>}
 */
export async function runRound(session, { client, choice = null, note = null, onChunk } = {}) {
  const first = roundCount(session.pool) === 0;

  // The player's line belongs to the round it answered, not to this one.
  let pool = choice ? recordChoice(session.pool, choice) : session.pool;

  const left = Math.max(0, session.total - roundCount(pool) - 1);
  const last = session.leaving || left === 0;

  const tier3 = buildTier3({
    cards: session.cards,
    present: session.scene.present ?? [],
    relations: session.relations,
    player: session.player,
    dossier: session.dossier,
    locationLabel: session.scene.locationLabel,
    activity: session.scene.activity,
    week: session.scene.week,
    dayName: session.scene.dayName,
    block: session.scene.block,
    phase: session.scene.phase,
    roundIndex: roundCount(pool),
    roundsLeft: last ? 0 : left,
    lastChoice: choice,
    note,
    lang: session.lang,
  });

  const messages = buildMessages({
    tier1: session.tier1,
    tier2: buildTier2(poolEntries(pool)),
    tier3,
  });

  /**
   * Streamed, and the reader emits RAW. A stream has half a line rather than a
   * line, so holding text back until its newline arrives would throw away most
   * of the latency this wire format exists to buy. The caller renders
   * `round.prose` when the round completes.
   */
  const reader = onChunk ? createRoundStream() : null;
  const raw = await client({
    messages,
    preset: 'round',
    onChunk: reader
      ? (chunk) => {
          const shown = reader.push(chunk);
          if (shown) onChunk(shown);
        }
      : undefined,
  });

  /**
   * Parsed from the returned text, never from the reader's buffer. The reader
   * exists to put prose on screen early; the client is what guarantees the whole
   * response, including a mock or a fallback that never streamed a chunk.
   */
  const round = parseRound(raw);

  const { relations, player, refused } = applyDeltas({
    relations: session.relations,
    player: session.player,
    deltas: round.deltas,
    present: session.scene.present ?? [],
    exposure: session.exposure,
    budget: session.budget,
    first,
  });

  pool = appendRound(pool, { text: round.prose });

  return {
    session: {
      ...session,
      pool,
      relations,
      player,
      summary: round.summary ?? session.summary,
      canon: round.canon.length ? [...session.canon, ...round.canon] : session.canon,
      ended: last,
    },
    round: { ...round, refused, last },
  };
}

/**
 * Close the scene and hand back what the world keeps.
 *
 * The summary is whichever `sum|` the model offered - normally the last round's,
 * because that is the only round asked for one. A scene the player walked out
 * of has none, and gets a line composed in code instead: bookkeeping is
 * bookkeeping, and spending a model call on it is the trade section 10b already
 * refused for solo actions.
 */
export function endScene(session) {
  const { scene } = session;
  const fallback = `Week ${scene.week + 1}, ${scene.dayName} ${scene.block}: time at ${scene.locationLabel}.`;

  return {
    pool: closePool(session.pool, { summary: session.summary ?? fallback }),
    relations: session.relations,
    player: session.player,
    canon: session.canon,
    exposure: session.exposure,
    summary: session.summary ?? fallback,
  };
}
