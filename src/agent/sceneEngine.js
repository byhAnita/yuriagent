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

import {
  openScene,
  appendTurn,
  appendSystemNote,
  requestThought,
  buildMessages,
  LANG_NAMES,
} from './promptBuilder.js';
import { createStreamParser, parseResponse } from './responseParser.js';
import { parseSummary, buildSummarizerMessages, toCommit } from './summarizer.js';
import { parseDecisions } from '../systems/canon.js';
import { commitSummary, entryText } from './memory.js';
import { cardFacts } from '../data/facts.js';
import { sceneExposure, witnessedExposure } from '../systems/exposure.js';
import { jealousyBand, sceneModifiers, convert, decay, addJealousy, unaddressedStrain } from '../systems/jealousy.js';
import { applySceneOutcome } from '../systems/relationship.js';
import { propagate } from '../systems/rumor.js';
import { isRiskStance, RISK_STANCES } from '../systems/chips.js';
import { allowsSecondVoice } from '../systems/dialogue.js';
import {
  openingAddressee,
  setAddressee,
  pickSecondVoice,
  pickOnPass,
  trackSilence,
  mentionedIn,
} from '../systems/speaker.js';
import {
  RISK_EXPOSURE_THRESHOLD,
  GUARD_DROP_TO_PAY,
  FLUSTER_PEAK_TO_PAY,
  SHARED_ACTIVITY_INTIMACY,
} from '../config/constants.js';
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

/**
 * Walk the beats of one reply in order, and let each one say where she is.
 *
 * This is what makes beat count stop mattering. An absolute reading REPLACES
 * the meter, so the last beat of a reply is the state and a reply written in
 * three moments says exactly what one written in a single moment says. Every
 * previous scheme had the client reassembling a quantity from an unknown number
 * of pieces, and none of them survived contact with a real model: summing made
 * a chatty reply worth three times a terse one, averaging flipped that bias,
 * and asking the model to budget across its own beats did not take either.
 *
 * A signed reading still moves the meter the old way, because section 9 assumes
 * format failures rather than forbidding them - and because the offline writer
 * still speaks deltas, so both paths run in every test.
 *
 * `flusterPeak` is still a high-water mark. It has to be: the pillar is that
 * you landed, and a reply that flusters her and then lets her recover inside
 * the same turn still landed.
 */
export function applyBeatToMeters(meters, beats) {
  let guard = meters.guard;
  let fluster = meters.fluster;
  let peak = meters.flusterPeak;

  for (const beat of beats ?? []) {
    guard = clamp(beat.guardIsAbsolute ? beat.guard : guard + (beat.guard ?? 0));
    fluster = clamp(beat.flusterIsAbsolute ? beat.fluster : fluster + (beat.fluster ?? 0));
    peak = Math.max(peak, fluster);
  }

  return { ...meters, guard, fluster, flusterPeak: peak };
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

  /**
   * Who else is standing there.
   *
   * `witnessIds` is anybody in the room the player is NOT addressing. Turning
   * to one member in front of the others is itself the gesture - nobody has to
   * touch anyone for the rest of them to have watched the player choose - so
   * their presence lifts the exposure a risk is judged at, per section 5b.
   *
   * Kept separate from `exposure` because the two answer different questions:
   * `exposure` is what the outside world can see, and drives scandal and rumor
   * propagation; `riskExposure` is what the room can see, and decides whether
   * an overt move counts as one.
   */
  /**
   * `presentIds` is not `rosterIds`, and conflating them is a mistake I made
   * writing this the first time.
   *
   * `rosterIds` is who may SPEAK - the parser accepts them, block 3 carries
   * their dossiers, and section 9 caps it at two until group scenes ship.
   * `presentIds` is who is in the ROOM. Standing there watching requires no
   * lines, so a member can witness without being interactive, and the cap on
   * one has nothing to do with the other.
   *
   * Taking witnesses from the roster made this whole mechanic wait on group
   * scenes for no reason. It does not have to.
   */
  const presentIds = scene.presentIds ?? scene.rosterIds ?? [];
  const witnessIds = presentIds.filter((id) => id !== focusId);
  const riskExposure = witnessedExposure(exposure, witnessIds.length);

  return {
    frame,
    exposure,
    riskExposure,
    witnessIds,
    focusId,
    /**
     * Who the player is talking to. Section 10c.
     *
     * In a one-member room this is just the member and nothing about the turn
     * loop changes. It exists here now, before there is any UI for it, because
     * the addressee is also what proposal 11's interaction control targets -
     * building the room screen without it means building it twice.
     */
    addresseeId: openingAddressee(scene.rosterIds ?? [], { relations }, focusId),
    silentTurns: {},
    /** Who was named in the last thing said, for the interjection stake. */
    mentioned: [],
    meters: newMeters(relations[focusId]),
    beats: [],
  };
}

/**
 * Turn to somebody else in the room.
 *
 * Her meters come with her: `guard` and `fluster` are per-member readings and
 * carrying Irene's guard over to Nana would hand the player a number they never
 * earned. Anything already accumulated for the member being left is kept, so
 * turning back to her resumes where the conversation actually stood.
 */
/**
 * Is this a group scene?
 *
 * The test is the SPEAKING roster and not the room. Two members standing
 * somewhere while the player talks to one of them is an ordinary witnessed
 * scene (section 5b); a group scene is one where more than one of them may
 * answer, which is what changes the prompt and adds the second call.
 */
export function isGroupScene(session) {
  return allowsSecondVoice((session.frame?.rosterIds ?? []).length);
}

export function turnTo(session, nextId, relations) {
  const rosterIds = session.frame?.rosterIds ?? [];
  const addresseeId = setAddressee(session.addresseeId, nextId, rosterIds);
  if (addresseeId === session.addresseeId) return session;

  const kept = { ...(session.metersByMember ?? {}), [session.addresseeId]: session.meters };

  return {
    ...session,
    addresseeId,
    focusId: addresseeId,
    metersByMember: kept,
    meters: kept[addresseeId] ?? newMeters(relations[addresseeId]),
  };
}

/**
 * Run one turn.
 *
 * @param {object} session
 * @param {object} args - { stance, text, client, onBeat }
 */
export async function runTurn(
  session,
  {
    stance,
    text,
    note = null,
    gesture = false,
    client,
    onBeat = () => {},
    speakerId = null,
    cast = [],
  },
) {
  const said = stance ? `[${stance}] ${text ?? ''}`.trim() : (text ?? '');

  /**
   * In a group scene the player's turn says WHO it is aimed at.
   *
   * Without it the model picks a speaker out of a roster of five, and the
   * parser cannot help - every one of them is rostered, so every one of them
   * is accepted. The addressee is not a hint to the model, it is what the
   * player actually did (proposal 12: turning to someone IS the act), so it
   * belongs in block 5 as part of the turn rather than in a system note.
   *
   * A one-member scene writes nothing extra, so nothing about an ordinary
   * turn - or its cache behaviour - changes.
   */
  const answers = speakerId ?? session.addresseeId;
  const to = isGroupScene(session) ? nameOf(cast, answers) : null;
  const content = to && said ? `(to ${to}) ${said}`.trim() : said;

  /**
   * The player handed something over, or brought something up.
   *
   * It arrives as a system note at the tail rather than in the frozen header,
   * which is section 8's invariant 3 - new information mid-scene is appended,
   * never edited into block 4. The note is self-describing (economy.js writes
   * it) so it needs no directive after it: her job every turn is to write the
   * next beat, and this is the thing to write it about.
   *
   * A note with no words after it is a complete turn on its own. That is the
   * player handing it over and saying nothing, which is a real way to do it.
   */
  let frame = session.frame;
  if (note) frame = appendSystemNote(frame, note);
  if (content) frame = appendTurn(frame, { role: 'user', content });

  /**
   * An overt move made while visible is the bet the whole second axis runs on.
   * This is the only thing that sets `riskTaken`, and until it existed the flag
   * was never true in play: admissibility stayed at 0 for entire campaigns and
   * every route plateaued at `confidante`.
   */
  const risked = isRiskStance(stance, session.riskExposure ?? session.exposure);

  /**
   * Did the player visibly choose one of them, in front of the others?
   *
   * Not the same question as `riskTaken`, and the difference matters twice
   * over. `riskTaken` asks whether the OUTSIDE world could see it, so it needs
   * `exposure`; this asks whether the ROOM saw the player pick somebody, which
   * has nothing to do with how public the room is - handing Nana a hand warmer
   * in an empty wardrobe is still the other three watching you choose her.
   *
   * Sticky for the scene, because you cannot un-do it later in the same room.
   *
   * `gesture` is PASSED, never inferred from the presence of a note. It used
   * to read `Boolean(note)`, which was true while an opener was the only thing
   * that appended one - and then the closing directive arrived, went out as a
   * system note on the last turn of every scene, and made every group scene in
   * the game end with four witnessed jealousy events for a conversation. A
   * note is a transport; what a scene costs may not be read off which
   * transport it happened to use (section 5b).
   */
  const singledOut =
    session.singledOut || RISK_STANCES.includes(stance) || Boolean(gesture);

  const ctx = { rosterIds: frame.rosterIds, focusId: answers ?? session.focusId };
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

  const meters = applyBeatToMeters(session.meters, beats);
  const spoke = beats.at(-1)?.speaker ?? answers;

  return {
    ...session,
    frame,
    beats: [...session.beats, ...beats],
    meters: risked ? { ...meters, riskTaken: true } : meters,
    singledOut,
    /**
     * Two inputs the interjection stake runs on, both updated here because
     * this is the only place that knows what was just said.
     */
    silentTurns: trackSilence(session.silentTurns, frame.rosterIds ?? [], spoke),
    mentioned: mentionedIn(beats.map((b) => b.text).join(' '), cast),
  };
}

/**
 * Her display name, for a line the model reads.
 *
 * Falls back to the id, which is wrong-looking on purpose: a lowercase machine
 * token appearing in prose is section 9's rule being broken visibly rather
 * than a caller silently forgetting to pass the cast.
 */
function nameOf(cast, id) {
  return cast.find((c) => c.id === id)?.name ?? id;
}

/**
 * The prompt shape that lets somebody who was not asked speak up.
 *
 * Deliberately says what she is cutting into and does NOT say why she is
 * doing it. Handing the model a reason ("you are jealous") makes it narrate
 * the reason, which is the same mistake section 8 forbids for relationship
 * stats - the state is already in blocks 3 and 4, and her own card is what
 * decides how somebody like her interrupts.
 */
export function interjectionDirective(name, addresseeName) {
  return (
    `write ONE beat for ${name} only - a single metadata line and what follows ` +
    `it, no second metadata line. ${addresseeName} and the player were ` +
    'talking and she cuts in - she has been standing right there. Her metadata ' +
    `line must name ${name}. Do not write anyone else.`
  );
}

/**
 * The other reason somebody speaks, and the one that was missing.
 *
 * A room where the only way in is resentment is a room full of resentment. The
 * cast have shared a dorm and a stage for years, so the ordinary reason to
 * speak up is having something to add about what is being discussed - and that
 * is what this asks for.
 *
 * It names the TOPIC and not the player, which is the whole difference from the
 * cut-in above. The cut-in is about who the player is paying attention to; this
 * is about the choreography.
 *
 * Like the cut-in, it does not say why she is speaking or how she feels about
 * it. Her card decides that. What it does say is that this is easy company,
 * because without it a model handed "another member speaks" at a scene carrying
 * jealousy in block 3 will reliably write the jealousy.
 */
export function chimeDirective(name, addresseeName) {
  return (
    `write ONE beat for ${name} only - a single metadata line and what follows ` +
    `it, no second metadata line. She joins in on what ${addresseeName} and ` +
    'the player are talking about - agreeing, adding something, teasing, or ' +
    'taking it somewhere else. These are people who have worked together for ' +
    `years and this is easy company. Her metadata line must name ${name}. ` +
    'Do not write anyone else.'
  );
}

export function secondVoiceDirective(kind, name, addresseeName) {
  return kind === 'cut_in'
    ? interjectionDirective(name, addresseeName)
    : chimeDirective(name, addresseeName);
}

/**
 * A second, optional call: somebody in the room takes it upon herself.
 *
 * This is the whole feature. Without it the addressee always answers and a
 * group scene is a 1v1 with spectators; with a rota instead of it, nobody is
 * talking to anybody. Who cuts in is `systems/speaker.js` reading state the
 * game already tracks - jealousy band, intimacy, whether she was just named,
 * how long she has said nothing - so the room writes itself.
 *
 * Two registers, and which one fires is `speaker.js`'s call. A `chime` is
 * somebody joining in on the topic and is the common case; a `cut_in` is
 * somebody unsettled about where the player's attention has been, and is
 * gated on an actual jealousy band so it stays rare. Returns the session
 * unchanged when the room has nothing to add, which is a real outcome - two
 * people finishing an exchange uninterrupted is how a conversation is meant
 * to sound some of the time.
 */
export async function interject(session, { client, relations, cards = [], onBeat = () => {} }) {
  if (!isGroupScene(session)) return { session, interjectorId: null, kind: null };

  const presentIds = session.frame.rosterIds ?? [];
  const context = {
    relations,
    mentioned: session.mentioned ?? [],
    silentTurns: session.silentTurns ?? {},
  };
  const second = pickSecondVoice(session.addresseeId, presentIds, context);
  if (!second) return { session, interjectorId: null, kind: null };

  const { id: interjectorId, kind } = second;
  const name = cards.find((c) => c.id === interjectorId)?.name ?? interjectorId;
  const addresseeName = cards.find((c) => c.id === session.addresseeId)?.name ?? session.addresseeId;

  let frame = appendSystemNote(session.frame, secondVoiceDirective(kind, name, addresseeName));

  const parser = createStreamParser({ rosterIds: frame.rosterIds, focusId: interjectorId });
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

  /**
   * Her beat does NOT move the addressee's meters.
   *
   * `guard` and `fluster` are per-member readings, and letting Nana's beat
   * move Irene's guard would hand the player a number they never earned - the
   * same reason `turnTo` carries meters per member.
   */
  const kept = { ...(session.metersByMember ?? {}) };
  kept[interjectorId] = applyBeatToMeters(
    kept[interjectorId] ?? newMeters(relations[interjectorId]),
    beats,
  );

  return {
    session: {
      ...session,
      frame,
      beats: [...session.beats, ...beats],
      metersByMember: kept,
      silentTurns: trackSilence(session.silentTurns, presentIds, interjectorId),
      mentioned: mentionedIn(beats.map((b) => b.text).join(' '), cards),
    },
    interjectorId,
    kind,
  };
}

/**
 * Who fills the silence when the player passes.
 *
 * `pass` is not a skip button - it is the player letting the room breathe, so
 * the highest stake speaks whether or not she clears the interjection bar.
 */
export function speakerOnPass(session, relations) {
  return pickOnPass(session.addresseeId, session.frame?.rosterIds ?? [], {
    relations,
    mentioned: session.mentioned ?? [],
    silentTurns: session.silentTurns ?? {},
  });
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

/**
 * How a scene starts.
 *
 * Not a fake player action. The first beat belongs to her - the player has done
 * nothing yet except arrive.
 *
 * There used to be a second form of this for arriving with a gift, because the
 * opener was chosen at the door in a modal before the scene existed. That is
 * gone: an opener is a move the player makes DURING the scene now, so the
 * opening beat has exactly one shape again. See `runTurn`'s `note`.
 *
 * The reason it moved is worth keeping. Choosing at the door meant betting
 * blind - in a group scene the player picked who to hand something to before
 * seeing who was in the room - and it meant every gift landed as the first
 * thing that happened, so the scene could never be ABOUT anything before it
 * became about the gift. Handing something over three turns into a
 * conversation is both the natural moment and the more interesting one: the
 * topic turns, which is what a real gesture does.
 */
export const OPENING_PLAIN =
  'System note: write her opening beat - what she does in the moment she notices the player has walked in. Nothing has been said yet.';

/**
 * The opening beat, in the player's language.
 *
 * THE ONE TURN THAT NEEDS TO BE TOLD. Block 5 is empty here and nowhere else:
 * every later turn has her last beat and the player's line sitting immediately
 * above the generation, so the model continues in the language it can see. On
 * turn one there is nothing to continue - everything above block 5 is English
 * by design (section 19 keeps memory language-agnostic), and the last thing it
 * reads is this instruction.
 *
 * Reproduced in play, `zh`, opening an anchor event: an English action with
 * Chinese speech in the same beat, then perfectly Chinese for the rest of the
 * scene once there was Chinese above it. An event is the worst case because
 * block 4 also carries `## The day` and `## How to write this one`, adding
 * English right before the turn.
 *
 * Block 4's `## Language` reminder does not reach this - it sits above the
 * frame, the register, and this directive.
 */
export function openingDirective(lang = 'en') {
  if (!lang || lang === 'en') return OPENING_PLAIN;
  const language = LANG_NAMES[lang] ?? lang;
  return (
    `${OPENING_PLAIN} Write it in ${language} - BOTH the *action* between ` +
    'asterisks and the "speech" in quotes. The metadata line stays ASCII English.'
  );
}

/**
 * The establishing beat, for a day that belongs to the company.
 *
 * `openingDirective` asks for one member's beat - what she does in the moment
 * she notices the player has walked in. That is exactly right for a wardrobe on
 * a Tuesday and wrong for a room the whole cast is already sitting in for a
 * stated purpose. Reported after a played concept meeting: "not distinguishable
 * from ordinary group chat". Nothing had established that the day was anything.
 *
 * So an event gets one paragraph of room first, and only then the ordinary
 * loop. Deliberately narrow:
 *
 * - EVENTS ONLY. A date's opening atmosphere is hers and the `date` register
 *   already asks her to open with it. An ordinary block gets nothing, because
 *   pillar 1 is 30-50 word bursts and the CONTRAST is the whole point - a game
 *   that establishes every room has stopped establishing anything.
 * - ABOUT FORTY WORDS. Not rv-simulator's 350-450 of narration per round; that
 *   is the story generator this project stopped being.
 * - ITS OWN CALL, so nothing about the contract in section 9 changes and the
 *   parser's roster rule - the one hard guarantee against member bleed - is not
 *   asked to grow a case for prose with no speaker. The client knows this beat
 *   is narration because the client is the one that asked for it.
 *
 * IT CARRIES THE LANGUAGE, and this is the trap rather than a nicety. This call
 * is now the one with an empty block 5, so it inherits the exact condition that
 * produced the language split (see `openingDirective`) - an event was already
 * that bug's worst case. The opening beat that follows is no longer the first
 * generation of the scene and has this paragraph's prose sitting above it,
 * which is the condition under which the model reliably continues in the right
 * language.
 */
export const ESTABLISH_PLAIN =
  'before anyone speaks, write one short paragraph that establishes this room - what it looks ' +
  'and sounds like right now, who is in it, and what this day is here to do. About forty words. ' +
  'Nobody speaks yet: no dialogue, no quotation marks, no metadata line, and do not write ' +
  "anyone's beat.";

export function establishingDirective(lang = 'en') {
  if (!lang || lang === 'en') return ESTABLISH_PLAIN;
  const language = LANG_NAMES[lang] ?? lang;
  return `${ESTABLISH_PLAIN} Write it in ${language}.`;
}

/**
 * A metadata line must never reach the player (section 9, rule 6).
 *
 * This call is unparsed by design, so the one rule the parser would have
 * enforced for free has to be enforced here instead. A model that has just read
 * a format contract in block 1 and been told not to use it is precisely the
 * model that uses it anyway.
 */
function stripMeta(text) {
  return String(text ?? '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('@'))
    .join('\n')
    .trim();
}

/**
 * Run it. Returns the session with both halves appended, and the prose.
 *
 * A failure returns the session untouched and no text - an event that opens
 * without its establishing paragraph is a slightly flatter event, and section 3
 * has no room for a diagnostic-grade flourish that can take the scene down.
 */
export async function establish(session, { client, lang = 'en' }) {
  const frame = appendSystemNote(session.frame, establishingDirective(lang));

  let raw;
  try {
    raw = await client({ messages: buildMessages(frame), preset: 'establish' });
  } catch {
    return { session, text: null };
  }

  const text = stripMeta(raw);
  if (!text) return { session, text: null };

  return {
    session: { ...session, frame: appendTurn(frame, { role: 'assistant', content: raw }) },
    text,
  };
}

/**
 * And how it ends.
 *
 * Reported from play: a scene ran out of turns mid-thought - she opened the
 * door again, said "对了。" and the block ended on the notice. The player was
 * about to hear something and instead read "this block is over".
 *
 * The model cannot pace a scene it cannot see the end of. It does not know how
 * many turns are left, and section 6 already established that telling it a
 * per-scene budget makes it worse rather than better: handed a budget it
 * overshot badly, because a scene is many replies and it cannot track its own
 * position in one.
 *
 * What it CAN do is answer "this is the last one". So the client says so, once,
 * on the turn that is actually last - which is a thing the client knows exactly
 * and the model cannot infer. Cheap, precise, and it needs no budget.
 *
 * It deliberately does not script the parting. What she says on the way out is
 * hers, and how she says goodbye at `colleague` and at `unspoken` are different
 * scenes - the same argument as section 11's generated gift reaction.
 */
export const CLOSING_NOTE =
  'this is the last exchange before the player has to go. Let her land it rather ' +
  'than open something new - a parting, in whatever way somebody like her parts.';

/**
 * A day with business on it does not get to end without doing the business.
 *
 * The other half of `agenda` (see `data/sceneFrames.js`). Block 4 says what the
 * room is here to settle, and sixteen turns later the model has read a great
 * deal of conversation since - so the last turn says it again, at the only
 * moment where "before this ends" is a fact rather than a guess. The client is
 * the only thing that knows which turn is last, which is the same argument
 * `CLOSING_NOTE` is built on.
 *
 * Deliberately does not name the items again. They are in block 4, and
 * repeating four bullet points into the tail of a scene invites the model to
 * work through them as a list on the final turn instead of having settled them
 * across the day.
 */
export const CLOSING_SETTLES =
  'Before the room breaks up, it settles what it came to settle: say plainly what ' +
  'was decided today, and let it be something the group will still be living with ' +
  'next week.';

export function closingDirective({ settles = false } = {}) {
  return settles ? `${CLOSING_NOTE} ${CLOSING_SETTLES}` : CLOSING_NOTE;
}

/** Mark that the player deliberately took a risk while visible. */
export function markRisk(session) {
  return { ...session, meters: { ...session.meters, riskTaken: true } };
}

/**
 * What one survived public risk is worth, and why it grows.
 *
 * A flat 3-6 inverted the incentive at the worst possible moment.
 * `STAGE_A_MIN` raises the admissibility requirement in 20-point steps as
 * intimacy crosses each tier, so the bar to get off the `confidante` plateau is
 * 10 at intimacy 60, 30 at 75 and 50 at 90 - while the payout stayed the same
 * size. Two campaigns on one seed, differing only in how far intimacy ran:
 *
 *   intimacy 54-69, admissibility 0-12  -> two good endings
 *   intimacy 71-77, admissibility 12-23 -> none
 *
 * The run that got CLOSER to her did worse, because the same admissibility that
 * clears the `nameless` bar is eighteen short of the `unspoken` one. Getting
 * closer was buying a worse ending.
 *
 * Scaling the payout with intimacy is the fix that is also the truer statement:
 * being seen with someone you are obviously close to says more than being seen
 * with a colleague, so it moves the needle further. The failure branch is
 * deliberately NOT scaled - the punishment for a public risk gone wrong is
 * already 10-20 strain, and doubling it at high intimacy would hand back the
 * problem in the other direction.
 */
export const RISK_PAYOFF_SCALE = 1.2;

export function riskPayoff(intimacy, rng) {
  const base = 3 + Math.floor(rng() * 4);
  return Math.round(base * (1 + (intimacy / 100) * RISK_PAYOFF_SCALE));
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
  if (guardDrop >= GUARD_DROP_TO_PAY) delta.intimacy += 2 + Math.floor(rng() * 3);
  if (meters.flusterPeak >= FLUSTER_PEAK_TO_PAY) delta.intimacy += 1 + Math.floor(rng() * 3);

  if (meters.riskTaken && (session.riskExposure ?? exposure) >= RISK_EXPOSURE_THRESHOLD) {
    const survives = rng() < 0.35 + (rel.intimacy / 100) * 0.4;
    if (survives) delta.admissibility += riskPayoff(rel.intimacy, rng);
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

  /**
   * What she could still let slip, in the card's own words.
   *
   * Only for members actually in the room, and only facts the player does not
   * already have - the same scoping rule block 3 uses. See `learnableNote`.
   */
  const learnable = rosterIds
    .map((id) => {
      const card = cards.find((c) => c.id === id);
      const known = new Set(
        (memory.dossier[id]?.known_facts ?? []).map((f) => entryText(f).toLowerCase()),
      );
      // The card's own English, which is what the checklist asks the model to
      // reuse verbatim. The player's language never enters block 5.
      const facts = cardFacts(card)
        .map((f) => f.en)
        .filter((f) => !known.has(f.toLowerCase()));
      return { name: card?.name ?? id, facts };
    })
    .filter((x) => x.facts.length > 0);

  let parsed;
  try {
    const raw = await client({
      messages: buildSummarizerMessages(session.frame, buildMessages, {
        learnable,
        lang: scene.lang,
        // Only an anchor event has one, so an ordinary scene's request is
        // byte-for-byte what it was.
        agenda: scene.sceneFrame?.agenda ?? [],
      }),
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
  const { rumors, noticed, jealousyDeltas } = propagate({
    scene: {
      exposure: session.exposure,
      phase: scene.phase,
      locationId: scene.locationId,
      locationLabel: scene.locationLabel,
      presentIds: scene.presentIds ?? rosterIds,
      dormWitnessIds: scene.dormWitnessIds ?? [],
      shared: Boolean(scene.shared),
      /**
       * An anchor event: everyone is here because the company said so.
       *
       * Derived from `scene.event` rather than passed separately, because
       * "is this an anchor event" already has one answer and a second flag
       * that could disagree with it is a bug waiting to be written.
       */
      collective: Boolean(scene.event),
      /**
       * Whether anything happened that the room could name. Set by the turn
       * loop on a risk stance or an opener; without it, co-presence alone
       * buys nobody a witnessed jealousy event (see `rumor.js`).
       */
      singledOut: Boolean(session.singledOut),
    },
    subject: { id: subject.id, name: subject.name },
    cast: cards,
    relations: nextRelations,
    rng,
  });

  for (const [id, amount] of Object.entries(jealousyDeltas)) {
    nextRelations[id] = addJealousy(nextRelations[id], amount);
  }

  /**
   * An evening with all of them is worth something to all of them.
   *
   * Applied to everyone present EXCEPT the focus, who has already been paid by
   * `computeDeltas` for the scene itself - paying her twice would make the
   * shared activity the strongest move in the dorm rather than the gentlest.
   */
  if (scene.shared) {
    for (const id of scene.presentIds ?? rosterIds) {
      if (id === session.focusId || !nextRelations[id]) continue;
      nextRelations[id] = applySceneOutcome(nextRelations[id], {
        intimacy: SHARED_ACTIVITY_INTIMACY,
        good: true,
      });
    }
  }

  let finalMemory = nextMemory;
  for (const rumor of rumors) {
    finalMemory = commitSummary(finalMemory, {
      entry: null,
      /**
       * The whole rumor, not just its sentence.
       *
       * `rumor.js` produces `kind`, `subjectName` and `locationId` and the
       * aftermath screen already renders from them - but the dossier kept only
       * the English, so the one other screen that shows a rumor (the snoop
       * find, section 10b) had nothing to print but English. Carrying the
       * shape costs nothing and localizes both.
       */
      dossierAdd: [{ ...rumor, memberId: rumor.memberId, category: 'heard_about', text: rumor.text }],
    });
  }

  /**
   * What the day settled, if it was a day that settles things.
   *
   * Validated here rather than in the caller, against this event's own agenda:
   * a topic that is not on it is dropped entirely (`systems/canon.js`), which
   * is section 9's roster rule in a new place and for the same reason. An
   * ordinary scene has no agenda, so this is always empty for one.
   *
   * The caller appends it with the cycle it happened in. This function has no
   * business knowing what a cycle is.
   */
  const decisions = parseDecisions(parsed.decisions, scene.sceneFrame);

  // Block 5 is discarded by simply not carrying the frame forward.
  return {
    memory: finalMemory,
    relations: nextRelations,
    delta,
    rumors,
    noticed,
    decisions,
    summary: parsed,
  };
}

export { parseResponse };
