/**
 * Five-block prompt assembly. CLAUDE.md sections 8 and 9.
 *
 *   [1 system ] byte-stable for the whole run
 *   [2 ledger ] append-only
 *   [3 dossier] present members only
 *   [4 header ] roster, time, location, exposure, stats, gift note
 *   [5 turns  ] the ONLY thing that grows during a scene
 *
 * The API here enforces the freeze rule structurally rather than by convention.
 * `openScene` computes blocks 1-4 once and returns a FROZEN prefix. There is no
 * way to rebuild the prefix from a live state object mid-scene, because the
 * frame does not keep a reference to one. Turns are appended separately.
 *
 * Live meter values are client-side only during a scene. Anything genuinely new
 * mid-scene - a gift, an interruption, a Read her request - is appended at the
 * tail as its own message, never edited into the header.
 */

import { PROMPT_EXCLUDED_FIELDS } from '../data/cast.js';
import { MAX_BEATS_PER_RESPONSE, READ_HER_USES_PER_SCENE } from '../config/constants.js';
import { renderLedger, renderDossier } from './memory.js';
import { jealousyBand, sceneModifiers } from '../systems/jealousy.js';
import { resolveStage } from '../systems/relationship.js';
import { doingLine } from '../data/activities.js';
import { displayName } from '../store/playerName.js';
import { renderFrame } from '../data/sceneFrames.js';
import { renderCanon } from '../systems/canon.js';
import { cycleForWeek } from '../systems/clock.js';
import { getIdentity } from '../data/identities.js';

/** The shipped default role, so the fallback cannot drift from the table. */
const DEFAULT_PROMPT_ROLE = getIdentity().promptRole;

/**
 * What the MODEL is told the language is called.
 *
 * Deliberately not `i18n/LANG_LABELS`, which is what the PLAYER reads in the
 * settings picker and is written in the language it names. These are the names
 * used inside an English instruction, so they stay English - and they live in
 * one place because three separate copies is three places to forget a locale
 * when `ko` and `pt` land (section 19).
 */
export const LANG_NAMES = {
  en: 'English',
  zh: 'Simplified Chinese',
  ko: 'Korean',
  pt: 'Portuguese',
};

export const EMOTIONS = ['neutral', 'happy', 'blush', 'shy', 'upset', 'surprised'];

/**
 * Where the two of you stand, as a sentence rather than a number (section 8).
 *
 * This is the input that makes any reaction proportionate - a gift, a joke, a
 * hand on a shoulder. Without it the model writes every scene at the same
 * emotional distance, which is the most obvious way a generated line reads as
 * canned. Numbers are deliberately absent: a stat invites the model to narrate
 * the stat, and section 9 forbids numbers in prose.
 */
export const STANDING = {
  stranger: 'barely knows the player yet',
  colleague: 'knows the player as a colleague, and not much more',
  good_friends: 'is easy around the player, and calls it friendship',
  nameless: 'is close to the player in a way neither of them has put a name to',
  unspoken: 'knows exactly what this is. Neither of them has said it out loud',
  ours: 'is with the player, privately, and both of them know it',
  out: 'is with the player and has stopped hiding it',
  confidante: 'trusts the player completely in private and keeps a careful distance in public',
  reckless: 'is further out in the open with the player than the two of them are ready for',
};

/**
 * Being at the bottom of the map means something different before and after.
 * Same coordinates, different scene (section 5).
 */
export function standingLine(name, rel) {
  const stage = rel.stage ?? resolveStage(rel.intimacy, rel.admissibility);
  const base = STANDING[stage] ?? STANDING.colleague;
  const aftermath =
    rel.peakIntimacy >= 40 && rel.intimacy < rel.peakIntimacy - 15
      ? ' It was closer than this once, and both of them remember that.'
      : '';
  return `${name} ${base}.${aftermath}`;
}

/**
 * A card as the model sees it.
 * `origin` never appears - in fiction there is only X (section 1b).
 */
export function cardForPrompt(card, roles = []) {
  const out = {};
  for (const [k, v] of Object.entries(card)) {
    if (PROMPT_EXCLUDED_FIELDS.includes(k)) continue;
    if (v == null) continue;
    out[k] = v;
  }
  out.rolesInX = roles;
  return out;
}

function renderCard(card, roles, includeHiddenConflict) {
  const c = cardForPrompt(card, roles);
  const lines = [
    `${c.name} (id: ${c.id}) - ${roles.join(', ') || 'member'} of X`,
    `  mascot: ${c.mascot}. ${c.mascotNote ?? ''}`,
    `  public image: ${c.publicImage ?? ''}`,
    `  personality: ${c.personality ?? ''}`,
    `  speech: ${c.speechStyle ?? ''}`,
    `  the unnamed thing: ${c.queerTexture ?? ''}`,
  ];
  // hiddenConflict is only revealed from `piqued` upward (section 12).
  if (includeHiddenConflict && c.hiddenConflict) {
    lines.push(`  under neglect she: ${c.hiddenConflict}`);
  }
  return lines.filter(Boolean).join('\n');
}

/**
 * Block 1. Byte-stable for the whole run.
 *
 * Must exceed the provider cache threshold (~1024 tokens) for automatic prefix
 * caching to engage, which the full cast roster comfortably does.
 */
export function buildSystemBlock({ cards, lineup, identity, playerName, lang = 'en' }) {
  const language = LANG_NAMES[lang] ?? LANG_NAMES.en;

  // Sanitised HERE rather than trusted from the caller: this function is the
  // boundary to the model, and a name carrying a newline can forge a metadata
  // line. Doing it at the boundary means no future call site can get it wrong.
  const who = displayName(playerName);

  return [
    'You write one beat of a visual novel set inside the K-pop industry.',
    '',
    '## World',
    'The five women below are the group X, under X Entertainment. They share a dorm.',
    /**
     * The player is a young woman, and until now nothing said so.
     *
     * This is a yuri visual novel - every route in it is between two women -
     * and block 1 introduced the player by name and job and stopped. A name is
     * free text, so the model had nothing to go on, and one Chinese run in
     * three had a member refer to the player as `他`. In English it guessed
     * "He's just standing there".
     *
     * It belongs HERE, in the world, rather than in a pronoun rule fifty lines
     * down. A pronoun rule can only ever patch the symptom - the model was not
     * mistaken about a pronoun, it was mistaken about who the player is.
     */
    /**
     * The role comes from the chosen identity and is NOT fixed to the
     * assistant. The fallback is the default identity's own line rather than a
     * copy of it, so a caller that forgets to pass one gets the shipped role
     * instead of a second version of it that can drift.
     */
    `The player is ${who}, ${identity?.promptRole ?? DEFAULT_PROMPT_ROLE}.`,
    'She is a young woman, and the women in this story are who she is drawn to.',
    'Every character here is a woman.',
    'They are colleagues. Everything between them happens inside that constraint.',
    '',
    '## Cast',
    cards.map((c) => renderCard(c, lineup?.[c.id] ?? [], false)).join('\n\n'),
    '',
    /**
     * The differentiation directive.
     *
     * The cards already carry public image, personality, speech and the unnamed
     * thing, but a small model treats them as colour and writes one generic idol
     * five times over. Naming those three fields as THE differentiators, and
     * saying what the test is - the same event must read differently depending
     * on who is in the room - is what makes them load-bearing rather than
     * decorative. Section 9's roster rule stops the wrong NAME appearing; this
     * is what stops the right name sounding like everyone else.
     */
    '## CRITICAL - they are not interchangeable',
    'Public image, personality and the unnamed thing are the PRIMARY differentiators',
    'for every scene. The same event must feel distinct depending on which member is',
    'present: her voice, her body language, what she notices, what she refuses to say,',
    'and how she deflects should all follow from her card and nobody else\'s.',
    'Never flatten a member into a generic idol. If a line could have been spoken by',
    'any of the five, it is wrong - rewrite it as something only she would say.',
    'Her speech style governs sentence length, register and how much she leaves out.',
    '',
    '## How to write',
    '- 30 to 50 words per beat. Short. This is dialogue, not narration.',
    '- Actions in *asterisks*, speech in "quotes".',
    `- At most ${MAX_BEATS_PER_RESPONSE} beats per reply, separated by a blank line.`,
    '- Never narrate the player. Never decide what the player feels or says.',
    '- Never state a number, a meter, or a relationship stage in the prose.',
    '- She has her own life, her own career and her own fears. She is not waiting for you.',
    /**
     * The pronoun rule.
     *
     * Without it every line addresses a person with no name, which is the
     * flattest possible second person. With it, the first time she uses the
     * player's name is a MOMENT - and which register she reaches for is itself
     * a signal, which is the kind of thing pillar 1 asks the player to read.
     *
     * Narration stays second person because the player is the camera; only
     * speech gets the name, because only a person in the room can use one.
     */
    `- In narration, the player is "you" and "your" - never ${who}.`,
    '- In dialogue, inside quotes, she may use the player\'s name, or a nickname,',
    '  or a title. What she calls the player is her choice and it can change.',
    /**
     * The third case, which only exists in a group scene.
     *
     * One member talking to ANOTHER about the player is neither narration nor
     * being addressed, so neither rule above reaches it - and a model with no
     * gender to work from picks one. Measured: a cut-in came back with "He's
     * just standing there", about a player the game has never assigned a
     * gender and never will. The name is free text; nothing anywhere states
     * one.
     *
     * Became common today rather than being new: a second voice now speaks
     * most turns, so the case that used to arise almost never now arises
     * constantly.
     */
    /**
     * The third case, which only exists in a group scene.
     *
     * One member talking to ANOTHER about the player is neither narration nor
     * being addressed, so neither rule above reaches it - and it is where the
     * model has to reach for a pronoun. The World block above now says the
     * player is a woman, which is the fix; this says which words follow from
     * it, because a model writing Chinese will not infer `她` from an English
     * sentence about her job.
     */
    '- Speaking to another member ABOUT the player, use her name or "she".',
    '  Never a masculine pronoun, in any language.',
    '',
    '## Format contract',
    'Every beat begins with a metadata line, then the prose on the next line:',
    '',
    '@<speaker_id>|<emotion>|guard<0-100>|fluster<0-100>',
    '*action* "speech"',
    '',
    /**
     * A second example, because one beat cannot show what separates two.
     *
     * Added while chasing a suspected metadata-omission problem that turned out
     * to be a parser bug (see responseParser beat segmentation). Kept anyway:
     * measured adherence is now total, and section 9 assumes format failures at
     * this tier, so demonstrating the multi-beat shape is cheap insurance in a
     * block that is byte-stable and cached for the whole run.
     */
    'EVERY beat needs its own metadata line, including the second and third:',
    '',
    '@irene|neutral|guard58|fluster4',
    '*She does not look up from the notes.* "You are early."',
    '',
    '@irene|shy|guard47|fluster18',
    '*A pause, and then she does look up.* "That was not a complaint."',
    '',
    `Valid emotions: ${EMOTIONS.join(', ')}.`,
    '',
    /**
     * State, not movement. This is the fourth setting and the only structural
     * one; the first three all failed the same way.
     *
     * The line used to carry a DELTA, and the client had to reassemble a
     * quantity out of however many beats the model felt like writing - one to
     * three, chosen for prose reasons. No arithmetic survives that. Measured at
     * twelve live scenes each:
     *
     *   per-beat scale + sum   verbose paid: every 21-beat scene, no 7-beat one
     *   per-beat scale + mean  the bias FLIPPED: 5/6 terse paid, 1/5 verbose
     *   per-reply budget + sum verbose paid again: 6/7 verbose, 0/5 terse
     *
     * An absolute has no such problem, because the last beat of a reply IS the
     * state: three beats say precisely what one says. It also needs no budget
     * instruction at all, which removes the thing the model kept failing to do.
     *
     * Telling her opening values in block 4 is deliberate and does not break
     * section 8's invariant 2. That forbids re-injecting a REFRESHED stat block
     * mid-scene; this states the opening reading once, in the frozen header,
     * and never updates it. Without it the model has no scale to be absolute
     * on, and would anchor somewhere arbitrary.
     */
    'guard is how defensive she is right now, from 0 to 100. fluster is how much',
    'you have got to her right now, from 0 to 100.',
    'These are WHERE SHE IS, not how far she moved. Report the current reading on',
    'every beat, including when it has not changed. Her opening values are in',
    '"This scene" below; move them by a point or two when a line barely registers,',
    'and by ten or more when something really lands.',
    'Never mention either number in the prose.',
    'Report only these. Never report anything else.',
    '',
    '## Language',
    /**
     * BOTH HALVES, named with the same words the format contract uses.
     *
     * "all prose and dialogue" was not enough. Reported from a `zh` run: the
     * *action* came back in English and the "speech" in Chinese, in the same
     * beat, for two consecutive turns -
     *
     *   *She stands at the counter, watching the steam rise.* "咖啡机今天特别慢。"
     *
     * A model reading "prose and dialogue" can map both onto the quoted half
     * and leave the stage direction in the language it was instructed in. The
     * rule never used the words `action` or `speech`, which are the labels the
     * format contract three lines above puts in its head.
     *
     * Same shape of fix as the chime directive: "write one beat" did not take
     * and naming the form did. An instruction has to use the model's own words
     * for the thing it is talking about.
     */
    `Write in ${language}: BOTH halves of every beat - the *action* between`,
    'asterisks and the "speech" in quotes. Never leave the action in English.',
    'Metadata lines, speaker ids, emotion names and all field names remain ASCII English.',
  ].join('\n');
}

/**
 * What the week feels like, as a sentence rather than a label.
 *
 * The header already said "Company phase: prep", which is a word the model has
 * no reason to attach meaning to. Section 10 defines the emotional rhythm of
 * the three weeks - build, risk, repair - and it is the thing that should make
 * the same room read differently in week 1 and week 2.
 *
 * Model-facing English, never localized.
 */
export const PHASE_WEATHER = {
  prep: 'Comeback preparation. Everyone is in the building and nobody is watching from outside yet.',
  comeback:
    'Comeback week. Cameras on everything, the whole group in the same rooms, and no privacy anywhere.',
  rest: 'The quiet week between comebacks. The others have scattered to their own work.',
};

/**
 * The daily job, in words. Model-facing English; the player-facing labels are
 * in `i18n/` under `task.*`.
 */
export const TASK_CHORE = {
  prep_outfits: { owed: 'the stage outfits still need prepping', past: 'prepped the stage outfits' },
  run_schedule: { owed: "the day's schedule still needs running down", past: 'run the schedule down' },
  handle_press_kit: { owed: 'the press kit still needs handling', past: 'handled the press kit' },
  stage_check: { owed: 'the stage still needs checking', past: 'checked the stage' },
  restock_wardrobe: { owed: 'the wardrobe still needs restocking', past: 'restocked the wardrobe' },
};

/** Block 4. Rebuilt at scene start, then frozen. */
export function buildSceneHeader({
  roster,
  absent,
  week,
  day,
  block,
  phase,
  locationLabel,
  exposure,
  relations,
  player,
  giftNote,
  sceneFrame = null,
  register = null,
  canon = [],
  lang = 'en',
  crossAwareness = [],
  occupancy = {},
  task = null,
}) {
  const lines = [
    '## This scene',
    `Week ${week + 1}, day ${day + 1}, ${block}. Company phase: ${phase}.`,
    PHASE_WEATHER[phase] ?? '',
    `Location: ${locationLabel}.`,
    `Present: ${roster.map((r) => `${r.name} (${r.id})`).join(', ')}.`,
  ];

  /**
   * Why she is in this room at all.
   *
   * The calendar has always known - `occupancyAt` returns an activity for every
   * member in every block - and none of it reached the prompt, which said only
   * "Location: X Practice Room". So the model invented a reason each time, every
   * scene in a given room opened the same way, and she could never say the
   * obvious natural thing: that the new choreography is giving her trouble.
   *
   * This is the cheapest variety in the game. It changes every block, for free,
   * from data that already exists, and it is what makes the same room in week 1
   * and week 7 a different scene.
   */
  for (const r of roster) {
    const doing = doingLine(occupancy[r.id]?.activity);
    if (doing) lines.push(`${r.name} is ${doing}.`);
  }

  if (absent.length > 0) {
    lines.push(`Absent, and not in this scene at all: ${absent.map((a) => a.name).join(', ')}.`);
  }

  lines.push(
    exposure >= 60
      ? 'This is a public place. Anyone could see.'
      : exposure >= 30
        ? 'Fairly quiet, but not private.'
        : 'Private. No one is watching.',
  );

  for (const r of roster) {
    const rel = relations[r.id];
    if (!rel) continue;
    const band = jealousyBand(rel.jealousy);
    const mods = sceneModifiers(rel);

    /**
     * Her voice, said again right next to the instruction.
     *
     * All five cards live in block 1, so the model has to pick the right one
     * out of five from a system block ~1500 tokens above the thing it is being
     * asked to write. For the loud cards that works. For two adjacent ones it
     * does not: given the identical practice-room opening, Irene and Hyewon
     * came back with the same line - "You are early. The others won't be here
     * for another hour." - at 90% shared vocabulary, while Jisoo, Nana and Yeri
     * were all distinct. Both cards are perfectly well written; the model
     * collapsed the two reserved women onto the subset they share.
     *
     * Repeating one line of it here costs ~25 tokens in a block that is rebuilt
     * every scene anyway, and puts the differentiator where the writing
     * actually happens.
     */
    if (r.speechStyle) lines.push(`${r.name} speaks like this: ${r.speechStyle}`);

    lines.push(standingLine(r.name, rel));

    /**
     * Where her meters start, so an absolute reading has a scale to sit on.
     *
     * This is the one number block 4 carries, and it is deliberate. Section 8's
     * "words, not numbers" rule exists because a relationship STAT invites the
     * model to narrate the stat; this is not that. It is the opening value of a
     * reading the model is already required to emit on every beat, and section
     * 9 separately forbids either number appearing in prose.
     *
     * Nor does it break invariant 2. That forbids re-injecting a REFRESHED stat
     * block mid-scene; this states the opening reading exactly once, in the
     * frozen header, and never updates it - live values stay client-side, as
     * they always have.
     *
     * Without it the model has nothing to be absolute against and anchors
     * somewhere arbitrary, which was the whole reason the line carried deltas
     * in the first place.
     */
    const openingGuard = Math.max(0, Math.min(100, 100 - rel.intimacy + mods.guardBonus));
    lines.push(`${r.name} starts this scene at guard${openingGuard}, fluster0.`);

    if (band !== 'calm') {
      lines.push(`${r.name} is ${band} about where your attention has been lately.`);
    }
    if (mods.probes) {
      lines.push(`${r.name} wants to bring it up but will not do it directly.`);
    }
  }

  for (const note of crossAwareness) lines.push(note);

  if (player) {
    lines.push(`The player looks ${player.energy < 30 ? 'exhausted' : 'fine'}.`);
  }

  /**
   * What the player is supposed to be doing today.
   *
   * Placed last but one, right before the gift note, because it is the most
   * immediate thing in the room after what they walked in holding: the reason
   * they can be standing here at all, and the thing she is most likely to ask
   * about. A still-unfinished job is also a source of pressure she can see -
   * "shouldn't you be doing that?" is a line the model cannot write without
   * being told.
   */
  const chore = task && TASK_CHORE[task.taskId];
  if (chore) {
    lines.push(
      task.done
        ? `The player has already ${chore.past} today.`
        : `The player still owes the agency one job today: ${chore.owed}.`,
    );
  }

  if (giftNote) lines.push(giftNote);

  /**
   * A whole-day scene: the spine, then how to write it.
   *
   * Both live in block 4, which is rebuilt at every scene start anyway, so
   * neither costs anything in cache terms. The register cannot go in block 1's
   * "How to write" - that block is byte-stable for the whole run, and this
   * changes per scene.
   *
   * Last, because it is the most immediate instruction there is: everything
   * above describes the situation, and this says how to put it into words.
   */
  /**
   * What the campaign has already decided (section 7).
   *
   * Above the frame, because it is context rather than instruction: the frame
   * says what THIS day is for, and this says what world it happens in. It also
   * has to be above `## How to write this one`, which by section 8's salience
   * rule is the last thing in the block.
   *
   * Already filtered and capped by the caller. Block 4 is rebuilt at every
   * scene start, so a few lines here cost nothing in cache terms - but the
   * standing sentence is the most important line in this block and eighteen
   * world facts would drown it.
   */
  const canonText = renderCanon(canon, cycleForWeek(week));
  if (canonText) lines.push('', '## Where the cycle stands', canonText);

  const frameText = renderFrame(sceneFrame);
  if (frameText) lines.push('', '## The day', frameText);
  if (register) lines.push('', '## How to write this one', register);

  /**
   * The language directive, said again.
   *
   * It is already at the end of block 1 - and that is roughly 1500 tokens above
   * the dialogue with three English blocks in between, which is precisely the
   * distance problem section 8 documents for `speechStyle`. Measured live on a
   * `zh` run: beats came back in English, switched to Chinese for a few turns,
   * then reverted. Written chips were Chinese throughout, and their directive
   * sits right at the tail - which is the same evidence pointing the same way.
   *
   * Everything between block 1 and here is English by design (section 19 keeps
   * memory language-agnostic), so by the time the model reaches the turn it has
   * read fifteen hundred tokens of English and one sentence asking for Chinese.
   *
   * Free in cache terms: block 4 is rebuilt at every scene start anyway.
   */
  if (lang && lang !== 'en') {
    lines.push(
      '',
      `## Language - ${LANG_NAMES[lang] ?? lang}`,
      `Write every beat below in ${LANG_NAMES[lang] ?? lang} - BOTH the *action*`,
      'between asterisks and the "speech" in quotes.',
      'The notes above are in English for bookkeeping. Do not answer in English,',
      'and do not leave the action in English while translating only the speech.',
      'Metadata lines, speaker ids and emotion names stay ASCII English.',
    );
  }

  // `PHASE_WEATHER` and the activity lines can legitimately be absent.
  return lines.filter(Boolean).join('\n');
}

/**
 * Open a scene. Computes blocks 1-4 and freezes them.
 *
 * The returned frame holds STRINGS, not references to game state, which is what
 * makes the freeze rule structural: there is nothing live left to leak in.
 */
export function openScene({
  cards,
  lineup,
  identity,
  player,
  lang,
  memory,
  relations,
  scene,
}) {
  const rosterIds = scene.rosterIds;
  const roster = cards.filter((c) => rosterIds.includes(c.id));
  const absent = cards.filter((c) => !rosterIds.includes(c.id));
  const nameOf = (id) => cards.find((c) => c.id === id)?.name ?? id;

  const system = buildSystemBlock({
    cards,
    lineup,
    identity,
    playerName: player?.name,
    lang,
  });

  const ledger = `## What has happened\n${renderLedger(memory.ledger)}`;
  const dossier = `## What you know about her\n${renderDossier(memory.dossier, rosterIds, nameOf)}`;
  const header = buildSceneHeader({
    roster,
    absent,
    relations,
    player,
    lang,
    ...scene,
  });

  return Object.freeze({
    system,
    ledger,
    dossier,
    header,
    rosterIds: Object.freeze([...rosterIds]),
    focusId: scene.focusId ?? rosterIds[0],
    turns: [],
    readHerUsed: 0,
  });
}

/** Append one turn. Returns a new frame; the prefix is carried by reference. */
export function appendTurn(frame, turn) {
  return Object.freeze({ ...frame, turns: [...frame.turns, turn] });
}

/**
 * Rebuild the frozen prefix in a new language, keeping the conversation.
 *
 * The one sanctioned exception to invariant 1, and it needs its reason stated
 * because it looks exactly like the thing that rule forbids.
 *
 * Section 19 allows switching language at any time and says the run continues.
 * Section 8 freezes blocks 1-4 for the life of a scene. Both are right, and
 * together they meant an open scene kept writing in the language it opened in
 * while the chip directive - rebuilt from live settings every turn - switched
 * at once. Chinese buttons under English dialogue, which is what was reported.
 *
 * Invariant 1 exists to stop the prefix churning on EVERY turn, which is what
 * would destroy the cache economics. A language switch is a rare, deliberate
 * act by the player, and one cache miss is the correct price for a setting that
 * actually takes effect. Block 5 is carried over untouched, because losing her
 * replies to change a setting would be far worse than the bug.
 */
export function relanguage(frame, openSceneArgs) {
  let next = openScene(openSceneArgs);
  for (const turn of frame.turns) next = appendTurn(next, turn);
  return next;
}

/**
 * Something genuinely new mid-scene goes at the TAIL as its own message.
 * Never edited into the header - that would invalidate the whole prefix.
 */
export function appendSystemNote(frame, text) {
  return appendTurn(frame, { role: 'user', content: `System note: ${text}` });
}

export function requestThought(frame) {
  if (frame.readHerUsed >= READ_HER_USES_PER_SCENE) return null;
  const next = appendTurn(frame, {
    role: 'user',
    content:
      'System note: report only her private thought right now, one sentence, no metadata line, no dialogue.',
  });
  return Object.freeze({ ...next, readHerUsed: frame.readHerUsed + 1 });
}

/**
 * The messages array sent to the model.
 * Blocks 1-4 are one system message so the whole prefix hashes as one unit.
 */
export function buildMessages(frame) {
  return [
    {
      role: 'system',
      content: [frame.system, frame.ledger, frame.dossier, frame.header].join('\n\n'),
    },
    ...frame.turns,
  ];
}

/** The frozen prefix, for asserting the cache invariant. */
export function prefixOf(frame) {
  return [frame.system, frame.ledger, frame.dossier, frame.header].join('\n\n');
}
