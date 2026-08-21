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

const LANG_NAMES = {
  en: 'English',
  zh: 'Simplified Chinese',
  ko: 'Korean',
  pt: 'Portuguese',
};

export const EMOTIONS = ['neutral', 'happy', 'blush', 'shy', 'upset', 'surprised'];

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
    `Valid emotions: ${EMOTIONS.join(', ')}.`,
    'guard is her defensiveness, fluster is how much you landed. Both are per-beat',
    'deltas, roughly -20 to +20. Report only these. Never report anything else.',
    '',
    '## Language',
    `Write all prose and dialogue in ${language}.`,
    'Metadata lines, speaker ids, emotion names and all field names remain ASCII English.',
  ].join('\n');
}

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
}) {
  const lines = [
    '## This scene',
    `Week ${week + 1}, day ${day + 1}, ${block}. Company phase: ${phase}.`,
    `Location: ${locationLabel}.`,
    `Present: ${roster.map((r) => `${r.name} (${r.id})`).join(', ')}.`,
  ];

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
  if (giftNote) lines.push(giftNote);

  return lines.join('\n');
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
