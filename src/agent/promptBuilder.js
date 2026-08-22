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

const LANG_NAMES = {
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

  return [
    'You write one beat of a visual novel set inside the K-pop industry.',
    '',
    '## World',
    'The five women below are the group X, under X Entertainment. They share a dorm.',
    `The player is ${playerName || 'the player'}, ${identity?.promptRole ?? 'an artist assistant at the agency'}.`,
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
    '',
    '## Format contract',
    'Every beat begins with a metadata line, then the prose on the next line:',
    '',
    '@<speaker_id>|<emotion>|guard<signed int>|fluster<signed int>',
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
    '@irene|neutral|guard+3|fluster+0',
    '*She does not look up from the notes.* "You are early."',
    '',
    // The two beats add up to guard -8, fluster +14: one exchange that got
    // through, shared out across the two moments it took.
    '@irene|shy|guard-11|fluster+14',
    '*A pause, and then she does look up.* "That was not a complaint."',
    '',
    `Valid emotions: ${EMOTIONS.join(', ')}.`,
    'guard is her defensiveness, fluster is how much you landed. Both are per-beat',
    'deltas from -20 to +20.',
    /**
     * The magnitudes are not decoration.
     *
     * Section 6 pays intimacy for a guard drop of 15 or more across a scene and
     * for a fluster peak of 60, and those thresholds were calibrated against
     * the offline writer. A live scene that clearly went well - she opened up,
     * teased back, and ended it blushing - moved guard by a net 1 and peaked
     * fluster at 16, because the model anchored on the two example beats rather
     * than on the stated range and reported +1 and +2 all the way through. It
     * paid nothing.
     *
     * The budget is per REPLY. That is the third setting tried and the only one
     * that holds:
     *
     * - per SCENE ("her guard should fall 15-30 in total") overshot to a
     *   55-point drop with fluster pegged at 100 by turn four, because a scene
     *   is many replies and the model cannot see how many are left.
     * - per BEAT ("a beat that gets through moves guard 5-10") made the payout
     *   depend on verbosity. Measured over twelve live scenes, the model used
     *   the small end of the range when it wrote three beats and a big number
     *   when it wrote one, so a chatty reply moved her LESS: five of six terse
     *   scenes paid and one of five verbose ones did, whichever way the client
     *   added the numbers up. No client-side aggregation can fix that, because
     *   it happens before the arithmetic.
     * - per REPLY is bounded in the way the scene budget was not. One reply is
     *   one exchange, and the model knows how many beats it is writing as it
     *   writes them, so "split this across them" is a request it can actually
     *   satisfy.
     *
     * Section 6 holds throughout: these are micro numbers, and the client alone
     * decides what a scene was worth.
     */
    'The numbers belong to the REPLY, not to each beat. Whatever this exchange',
    'moved her, split it across however many beats you write: the deltas in one',
    'reply should ADD UP to it, never repeat it in each beat.',
    'An exchange that only keeps the conversation alive adds up to 1-3. One that',
    'actually gets through moves guard by 5-10 and fluster by a similar amount.',
    'Save anything past 12 for a real breakthrough. One that lands badly moves',
    'them back the other way.',
    'Report only these. Never report anything else.',
    '',
    '## Language',
    `Write all prose and dialogue in ${language}.`,
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
