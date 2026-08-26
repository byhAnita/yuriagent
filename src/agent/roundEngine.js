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
import { SCENE_ROUNDS_MIN, SCENE_ROUNDS_MAX, ENERGY_PER_READ } from '../config/constants.js';
import { makeRng, deriveSeed } from '../systems/rng.js';
import { newFloor, turnTo, nextSpeaker, noteSpoke, addresseeOf } from '../systems/floor.js';

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
    /**
     * Did the player make an overt move toward her, in front of anybody else?
     *
     * Set by `runRound` when a `note` goes in - handing something over, or
     * bringing up something she once let slip - which are the only two acts in
     * v2 that a witness could DESCRIBE. It decides whether the other women in
     * the room end the scene with something in `heard_about` or merely having
     * been there (`systems/rumor.js`).
     *
     * PASSED, NEVER INFERRED. Section 5b records what happens otherwise: the v1 loop
     * read the same flag off `Boolean(note)` at a time when the only thing that
     * appended a note was an opener, then a closing directive arrived eight
     * weeks later as one more note and quietly made every group scene in the
     * game end witnessed. The number was right; the question was wrong. Here the
     * only note that exists IS a gesture - but that is a fact about today, so
     * the flag is a field rather than a test.
     */
    gestured: false,

    /**
     * WHO HAS THE FLOOR. `systems/floor.js`, and see its header for the chain.
     *
     * On the ROSTER, not on the room. A 1v1 in an occupied practice room has one
     * voice and three witnesses: standing there requires no lines (section 5b),
     * and passing the room in here is exactly what put Nana into a scene the
     * player opened with Yeri.
     */
    floor: newFloor(scene.roster ?? scene.present ?? []),

    /**
     * Seeded on the scene, so a reloaded save circulates the room the same way
     * it was going to. Every round after the first is a weighted draw, so this
     * is consumed once per round and must not be touched by anything else.
     */
    floorRng: makeRng(deriveSeed(seed, `floor:${scene.id}`)),

    /**
     * Who spoke in the round now on screen. DECIDED ONCE, IN `runRound`, and
     * stored - never recomputed on demand.
     *
     * `floorRng` is a stateful generator, so a `speakers(session)` helper the UI
     * could call would consume a draw on every render and quietly desync the
     * room from the prompt. Deciding it once per round and keeping the answer is
     * the only version of this that cannot drift.
     */
    turn: { primary: null, mode: 'answers' },
  };
}

/**
 * The player turns to somebody. Costs no round and makes no call.
 *
 * Sticky, so the common case - keeping the same conversation going - costs
 * nothing at all, and changing costs one tap. Before this the only way to reach
 * a member the model had stopped writing options for was to type free text,
 * which is what the report called out.
 */
export function turnToMember(session, memberId) {
  return { ...session, floor: turnTo(session.floor, memberId) };
}

/** Everyone who may speak here, which in a 1v1 is one of the people present. */
export function rosterOf(session) {
  return session.scene.roster ?? session.scene.present ?? [];
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
export async function runRound(
  session,
  { client, choice = null, note = null, skip = false, onChunk, onTurn } = {},
) {
  const first = roundCount(session.pool) === 0;

  // The player's line belongs to the round it answered, not to this one.
  let pool = choice ? recordChoice(session.pool, choice) : session.pool;

  /**
   * DID THE PLAYER SAY ANYTHING? The floor reads this and so does the tail.
   *
   * A skip is not the absence of a move - it is the player letting the room
   * carry it, which is section 10c's `pass` under a different name, and it
   * spends a round like everything else. What it changes is the POSTURE of the
   * round that follows: nobody was answered, so whoever takes the floor is
   * either continuing or cutting in.
   */
  const spoke = Boolean(choice || note);

  const left = Math.max(0, session.total - roundCount(pool) - 1);
  const last = session.leaving || left === 0;

  /**
   * WHO SPEAKS. Decided here and nowhere else, once per round.
   *
   * The draw happens before the call, so the answer is fixed for this round and
   * the same object goes into the prompt, onto the screen and into the silence
   * counters. Recomputing it anywhere else would consume a second draw off a
   * stateful generator and let the three disagree.
   */
  const roster = rosterOf(session);
  const turn = nextSpeaker(session.floor, {
    roster,
    relations: session.relations,
    spoke,
    rng: session.floorRng,
  });

  /**
   * ...AND THE CALLER IS TOLD BEFORE THE REQUEST GOES OUT.
   *
   * `session.turn` only lands when the promise resolves, so the screen drew the
   * PREVIOUS speaker for the whole of the stream. Reported:
   *
   *   > when primary character changed for next round, the next round lines
   *   > start streaming while the portrait is still last round speaker until
   *   > streaming finish.
   *
   * Which is the worst possible moment to be wrong: her name is over the
   * dialogue box while somebody else's words arrive under it, for the three or
   * four seconds the player spends reading them.
   *
   * The decision is already made at this point - it has to be, the prompt is
   * built from it - so this costs nothing and cannot disagree with what the
   * model was asked. Same shape as `onChunk`: a synchronous callback, fired
   * once, before anything can await.
   */
  onTurn?.(turn);

  const tier3 = buildTier3({
    cards: session.cards,
    present: session.scene.present ?? [],
    /**
     * Who may speak, which is not who is in the room. A 1v1 in an occupied
     * practice room has one voice and three witnesses.
     */
    roster,
    speaking: turn,
    relations: session.relations,
    player: session.player,
    dossier: session.dossier,
    locationLabel: session.scene.locationLabel,
    activity: session.scene.activity,
    week: session.scene.week,
    day: session.scene.day,
    block: session.scene.block,
    phase: session.scene.phase,
    roundIndex: roundCount(pool),
    roundsLeft: last ? 0 : left,
    lastChoice: choice,
    /** The player let the round pass. The tail says so; it is not silence. */
    skipped: skip && !spoke,
    owed: session.scene.owed ?? null,
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
      gestured: session.gestured || Boolean(note),
      /**
       * The room ages AFTER the round, not before it. Whoever had the floor is
       * back to zero and everybody else is one round quieter, which is what
       * hands the next second voice to somebody new without a rota.
       */
      floor: noteSpoke(session.floor, { primary: turn.primary }),
      turn,
      ended: last,
    },
    round: { ...round, refused, last },
  };
}

/**
 * Read her. CLAUDE.md Part I.2.
 *
 * The one thing that survives from v1's first pillar, with a different job. The
 * values are on screen now, so there is nothing left to conceal EXCEPT what she
 * is not saying - and that is where the tension moved. It returns her unspoken
 * thought rather than a number.
 *
 * It costs no round and appends nothing to the pool. The request is ephemeral:
 * it branches off the prefix that just streamed, so it is a near-total cache hit
 * (~30 output tokens), and committing it would put a system note between two
 * rounds and cost the prefix on every round after.
 *
 * IT COSTS ENERGY, AND THE RATION IS NOT THE CALLER'S ANY MORE.
 *
 * It used to be: `RoundStage` held a per-scene allowance of two and the engine
 * charged nothing. Two problems with that, and the second is why this moved.
 * An allowance that resets at every door never accumulates into a decision - and
 * `session.player` is the only copy of energy the scene has, so a caller
 * spending it would be writing state the engine owns and hands back at
 * `endScene`. One number, one owner, the same rule the `affection` rename bought.
 *
 * Refuses rather than going negative, so the action can never strand the player
 * at zero. Returns the session either way; a refusal simply carries no thought.
 */
export function canReadHer(session) {
  return (
    (session.scene.present ?? []).length > 0 &&
    (session.player?.energy ?? 0) >= ENERGY_PER_READ
  );
}

export async function readHer(session, { client } = {}) {
  const who = (session.scene.present ?? [])[0];
  if (!who || !canReadHer(session)) return { session, thought: null, refused: true };

  const card = session.cards.find((c) => c.id === who);
  const name = (session.lang !== 'en' && card?.nameLocal?.[session.lang]) || card?.name || who;

  /**
   * The same two messages the round call opens with, then a different third.
   * That is what makes this cheap - tier 1 and tier 2 are byte-identical to the
   * request that just streamed, so only the ask is a miss.
   */
  const raw = await client({
    messages: buildMessages({
      tier1: session.tier1,
      tier2: buildTier2(poolEntries(session.pool)),
      tier3: [
        '## READ HER',
        `In one sentence, what is ${name} thinking right now and not saying?`,
        'Her thought only. No prose, no options, no machine lines, no sentinel.',
        'Write it in the same language as the prose above.',
      ].join('\n'),
    }),
    preset: 'thought',
  });

  /**
   * Charged on the ANSWER, not on the ask.
   *
   * A failed call is not a look inside her head, and a provider that is down
   * must not also drain the day. Same rule the date bill follows: she turned you
   * down, you did not buy her dinner.
   */
  const thought = parseRound(raw).prose || null;
  if (!thought) return { session, thought: null, refused: false };

  return {
    session: {
      ...session,
      player: {
        ...session.player,
        energy: Math.max(0, (session.player?.energy ?? 0) - ENERGY_PER_READ),
      },
    },
    thought,
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
  const fallback = `Week ${scene.week + 1}, day ${scene.day + 1}, ${scene.block}: time at ${scene.locationLabel}.`;

  return {
    pool: closePool(session.pool, { summary: session.summary ?? fallback }),
    relations: session.relations,
    player: session.player,
    canon: session.canon,
    exposure: session.exposure,
    /** For `systems/rumor.js`: did anybody watching have something to describe? */
    gestured: session.gestured,
    /**
     * WHO THE SCENE WAS ABOUT, which is not `presentIds[0]`.
     *
     * `propagate` prices a scene against a SUBJECT - the member the player spent
     * it on - and everybody else against her. Reading the first id in the room
     * instead is what produced *"I chose Yeri to have a 1v1 chat, while witness
     * is herself"*: Nana was subject by array position, so Yeri was filed as a
     * witness of her own scene and the affection landed on the wrong row.
     *
     * The floor already knows. It is the same answer the prompt was built from,
     * which is the point of it being one function.
     */
    addresseeId: addresseeOf(session.floor, { roster: rosterOf(session) }),
    summary: session.summary ?? fallback,
  };
}
