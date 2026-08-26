/**
 * Who has the floor this round. Pure. CLAUDE.md Part I.3, section 10c.
 *
 * v2 shipped without this and the scene did the obvious wrong thing: every
 * member in the room got a line every round, so a five-member scene was five
 * paragraphs long, and once the player answered one of them the model wrote all
 * four following options at that same woman. Reported from play:
 *
 *   > if player choose interact to Irene's option in 1st round, then options of
 *   > following round tend to be all different interactions to Irene ... the
 *   > player has to type manually if they want to change a character
 *
 * Both halves of that are one cause. **Nothing told the model who had the
 * floor**, so it defaulted to everybody, and with everybody in play it followed
 * the thread the player had just pulled. Giving it two names fixes the length
 * and the tunnel at the same time.
 *
 * WHY THIS IS THE CODE'S DECISION AND NOT THE MODEL'S. I.1 splits it as *the
 * model decides what the scene MEANS, the code decides what the world IS* - and
 * who is standing in the room, and which of them the player is turned to, is
 * world state. It is the same call as placement and exposure. What they SAY,
 * how they take it, and what it moves stays entirely the model's.
 *
 * THE CHAIN, WHICH IS THE WHOLE MODULE. Three steps, in order, no branches:
 *
 *   1. the player TAPPED somebody      -> she is primary
 *   2. nobody tapped                   -> whoever spoke last keeps the floor
 *   3. nothing has happened yet        -> the first of the roster
 *
 * Then one more voice: whoever has been **silent longest**. That is section
 * 10c's chime rule with the jealousy term removed, and it is what makes a room
 * circulate without anything as rigid as a rota - a speaker's counter resets, so
 * the next second voice is somebody else, and two quiet rounds is enough to come
 * round again in any size of room. No rule had to be written for room size.
 *
 * A ROTA WAS THE FIRST DESIGN AND IT DID NOT SURVIVE ONE QUESTION (10c): A
 * speaks, the player responds, and then it is B's turn - who was the player
 * talking to? A turn order has no answer. The addressee does, and it is sticky,
 * so the common case costs no taps at all.
 */

/**
 * Ties are broken by the RNG, never by position.
 *
 * Everyone starts silent at 0, so the first round of every scene is a tie
 * across the whole room - and this project has shipped a deterministic index
 * standing in for a choice three separate times (`sort(() => rng() - 0.5)`,
 * `available.slice(0, 6)`, `presentIds[0]`). Each time the symptom was that one
 * element of an array got picked forever and nobody could see why.
 */
function pickLongestSilent(candidates, silence, rng) {
  if (candidates.length === 0) return null;

  const best = candidates.reduce((max, id) => Math.max(max, silence[id] ?? 0), -Infinity);
  const tied = candidates.filter((id) => (silence[id] ?? 0) === best);
  return tied[Math.floor(rng() * tied.length) % tied.length];
}

export function newFloor(rosterIds = []) {
  return {
    /** Who the player is turned to. Null until they tap somebody. */
    addresseeId: null,
    /** Who held the floor last round. Continuity, when nobody has tapped. */
    lastSpeakerId: null,
    /** Rounds since each member last spoke. The only counter here. */
    silence: Object.fromEntries(rosterIds.map((id) => [id, 0])),
  };
}

/**
 * The player turns to somebody. One tap, and it sticks.
 *
 * Sticky is the point: the commonest thing a player does is keep talking to the
 * same person, and that has to cost nothing. Changing costs one tap, which is
 * what the report asked for - the alternative was typing free text to reach
 * anybody the model had stopped writing options for.
 */
export function turnTo(floor, memberId) {
  if (!memberId || !(memberId in floor.silence)) return floor;
  if (floor.addresseeId === memberId) return floor;
  return { ...floor, addresseeId: memberId };
}

/**
 * Who speaks this round.
 *
 * @returns {{ primary: string|null, second: string|null }}
 *
 * `primary` answers the player. `second` is the one who cuts in, and tier 3 says
 * so in those words - an interruption is a thing the model WRITES, not a second
 * call. v1 spent one extra request per round on interjections; this costs
 * nothing, because it is six tokens in a block that is rebuilt anyway.
 */
export function speakersFor(floor, { roster = [], rng = Math.random } = {}) {
  if (roster.length === 0) return { primary: null, second: null };

  const inRoom = (id) => (id && roster.includes(id) ? id : null);

  /**
   * The chain, and it is deliberately three `??` rather than an if-tree. Every
   * step is a fallback for the one above having no answer yet, and the order is
   * the design: an explicit choice beats continuity, and continuity beats the
   * arbitrary pick that only ever applies to round one.
   */
  const primary = inRoom(floor.addresseeId) ?? inRoom(floor.lastSpeakerId) ?? roster[0];

  const second = pickLongestSilent(
    roster.filter((id) => id !== primary),
    floor.silence,
    rng,
  );

  return { primary, second };
}

/**
 * Record who actually had the floor, and age everybody else.
 *
 * The silence counter is the whole rotation mechanism, so it is bumped here and
 * nowhere else. `lastSpeakerId` takes the primary rather than the second: the
 * one who cut in did not take the floor, she borrowed it, and letting her keep
 * it would mean an interruption silently redirects the conversation the player
 * is having.
 */
export function noteSpoke(floor, { primary = null, second = null } = {}) {
  const spoke = new Set([primary, second].filter(Boolean));
  const silence = {};
  for (const id of Object.keys(floor.silence)) {
    silence[id] = spoke.has(id) ? 0 : (floor.silence[id] ?? 0) + 1;
  }

  return { ...floor, silence, lastSpeakerId: primary ?? floor.lastSpeakerId };
}

/**
 * Who the player is talking to, for everything outside the scene.
 *
 * `propagate` needs it: a scene's SUBJECT is whoever the player spent it on, and
 * reading `presentIds[0]` instead is what produced "I chose Yeri to have a 1v1
 * chat, while witness is herself" - Nana was subject by array position, so Yeri
 * was listed as a witness of her own scene and took the wrong tier.
 */
export function addresseeOf(floor, { roster = [] } = {}) {
  return speakersFor(floor, { roster, rng: () => 0 }).primary;
}
