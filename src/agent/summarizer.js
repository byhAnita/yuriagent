/**
 * Scene-exit call. CLAUDE.md section 7.
 *
 * One call at the door does two jobs: a plot sentence for the ledger, and the
 * dossier extractions that make memory visible. It does NOT report macro
 * deltas - those are computed by systems/relationship.js from accumulated turn
 * metadata, because that is one fewer thing for a small model to get wrong.
 *
 * Everything it writes is ENGLISH regardless of UI language (section 19).
 *
 * Parsing uses the rv-simulator 4-level fallback: direct parse, strip markdown,
 * regex field extraction, safe defaults. It must never crash a scene exit -
 * losing a summary is survivable, losing the run is not.
 */

import { DOSSIER_CATEGORIES } from './memory.js';

/**
 * Two summaries, and they are not the same sentence.
 *
 * `summary` is MEMORY and stays English whatever the scene was written in -
 * section 19 rule 2, so the player can switch language mid-run without
 * corrupting history and one card library serves every locale.
 *
 * `display` is for the PLAYER and is written in the language they are playing
 * in. Without it the aftermath screen printed the memory line, which put an
 * English sentence at the end of every Chinese scene. Costs about twenty output
 * tokens on a call that already exists.
 */
export function summarizerInstruction(lang = 'en') {
  const base = SUMMARIZER_INSTRUCTION;
  if (!lang || lang === 'en') return base;
  return `${base}
"display" is the same sentence written for the player, in ${lang}. Never English.`;
}

export const SUMMARIZER_INSTRUCTION = [
  'The scene has ended. Return JSON only, no prose, no markdown fence.',
  '',
  '{',
  '  "summary": "one sentence, under 120 characters, past tense, ENGLISH",',
  '  "display": "the same sentence, in the language the scene was written in",',
  '  "dossier_add": [{ "memberId": "id", "category": "known_facts", "text": "short fact" }],',
  '  "dossier_resolve": [{ "memberId": "id", "text": "the thread that got answered" }]',
  '}',
  '',
  `Valid categories: ${DOSSIER_CATEGORIES.join(', ')}.`,
  'Write the summary and every dossier entry in ENGLISH, whatever language the',
  'scene was in. Facts are written from her side: "hates cold hands", not',
  '"the player learned that she hates cold hands".',
  'At most 2 dossier_add entries. Add nothing if nothing was actually revealed.',
].join('\n');

/** Level 2: the model wrapped its JSON in a fence anyway. */
function stripFence(text) {
  return String(text ?? '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

/** Level 3: pull the fields out with regex when the object will not parse. */
function extractByRegex(text) {
  const summary = /"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text)?.[1];
  const adds = [];

  const addBlock = /"dossier_add"\s*:\s*\[([\s\S]*?)\]/.exec(text)?.[1] ?? '';
  const entry = /\{[^{}]*\}/g;
  let m;
  while ((m = entry.exec(addBlock)) !== null) {
    const memberId = /"memberId"\s*:\s*"([^"]+)"/.exec(m[0])?.[1];
    const category = /"category"\s*:\s*"([^"]+)"/.exec(m[0])?.[1];
    const value = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(m[0])?.[1];
    if (memberId && category && value) adds.push({ memberId, category, text: value });
  }

  return summary || adds.length > 0 ? { summary, dossier_add: adds } : null;
}

function sanitize(parsed, { rosterIds = [] } = {}) {
  const roster = new Set(rosterIds);

  const clean = (list, withCategory) =>
    (Array.isArray(list) ? list : [])
      .filter((e) => e && typeof e === 'object')
      .filter((e) => roster.has(e.memberId))
      .filter((e) => !withCategory || DOSSIER_CATEGORIES.includes(e.category))
      .map((e) => ({
        memberId: e.memberId,
        ...(withCategory ? { category: e.category } : {}),
        text: String(e.text ?? '').trim().slice(0, 160),
      }))
      .filter((e) => e.text.length > 0);

  return {
    summary: String(parsed?.summary ?? '').trim().slice(0, 200),
    // Falls back to the English one rather than showing nothing: a missing
    // display line should degrade to the wrong language, never to a blank.
    display: String(parsed?.display ?? parsed?.summary ?? '').trim().slice(0, 200),
    dossierAdd: clean(parsed?.dossier_add, true).slice(0, 3),
    dossierResolve: clean(parsed?.dossier_resolve, false).slice(0, 3),
  };
}

/**
 * Four-level fallback. Never throws.
 *
 * @param {string} raw
 * @param {object} ctx - { rosterIds, fallbackSummary }
 */
export function parseSummary(raw, ctx = {}) {
  const text = String(raw ?? '');

  // 1. direct
  try {
    return { ...sanitize(JSON.parse(text), ctx), level: 1 };
  } catch {
    /* fall through */
  }

  // 2. strip markdown fence
  try {
    return { ...sanitize(JSON.parse(stripFence(text)), ctx), level: 2 };
  } catch {
    /* fall through */
  }

  // 3. regex field extraction
  const extracted = extractByRegex(text);
  if (extracted) return { ...sanitize(extracted, ctx), level: 3 };

  // 4. safe defaults - the run continues with a generic ledger line
  return {
    summary: ctx.fallbackSummary ?? 'They spent time together.',
    dossierAdd: [],
    dossierResolve: [],
    level: 4,
  };
}

/**
 * Build the summarizer request.
 *
 * Appended at the TAIL of the open frame, so the whole scene prefix is still a
 * cache hit and the miss is only this instruction (~40 tokens, section 8).
 */
export function buildSummarizerMessages(frame, buildMessages, { learnable = [], lang = 'en' } = {}) {
  return [
    ...buildMessages(frame),
    { role: 'user', content: summarizerInstruction(lang) + learnableNote(learnable) },
  ];
}

/**
 * The card's own wording, offered as a checklist.
 *
 * Section 11 draws the knowledge economy as `dialogue -> dossier fact ->
 * unlocks a specific opener`, and the dialogue arm of it did not work. Openers
 * match `requires` needles against dossier text, and the summarizer wrote
 * whatever phrasing it liked - a live scene where Irene talked about practising
 * alone produced "values trust earned in private, not public", which is a fine
 * memory and matches no opener that exists. So every opener in the game was
 * reachable only by snooping, and talking to her taught the player nothing they
 * could spend. Two thirds of the loop in that diagram was decoration.
 *
 * Handing over the exact strings costs ~40 tokens on one call per scene and
 * makes conversation a real second path into the economy. It is a checklist,
 * not an instruction to fish: the model is told to use the wording ONLY if the
 * thing actually came up, because a fact awarded for nothing is worse than a
 * fact never awarded - it hands over an opener the player did not earn.
 */
export function learnableNote(learnable) {
  if (!learnable || learnable.length === 0) return '';
  const lines = learnable.flatMap(({ name, facts }) =>
    (facts ?? []).map((f) => `- ${name}: ${f}`),
  );
  if (lines.length === 0) return '';

  return [
    '',
    '',
    'If any of these came up in the scene - she said it, showed it, or it was',
    'plainly true of her here - add it as a known_facts entry using THIS exact',
    'wording. If it did not come up, do not add it. Do not steer future scenes',
    'toward them.',
    ...lines,
  ].join('\n');
}

/** Turn a parsed summary into the shape memory.commitSummary expects. */
export function toCommit(parsed, { week, day, block, id }) {
  return {
    entry: { id, week, day, block, text: parsed.summary, summary: parsed.summary },
    dossierAdd: parsed.dossierAdd,
    dossierResolve: parsed.dossierResolve,
  };
}
