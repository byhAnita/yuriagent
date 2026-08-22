/**
 * Written chips. CLAUDE.md section 6.
 *
 * The label on a chip is written for this moment; the STANCE underneath is
 * whatever `systems/chips.js` decided. That split is the whole design - the
 * writing can improve without any mechanic moving, and the model cannot unlock
 * `touch` by asking for it, because a stance that is not already legal is
 * simply dropped here.
 *
 * Nothing in this module is ever awaited by the UI. The static set is already
 * on screen; this replaces it if and when it arrives.
 */

import { CHIPS_PER_TURN, MAX_CHIP_LABEL } from '../config/constants.js';
import { buildMessages } from './promptBuilder.js';

const LANG_NAMES = {
  en: 'English',
  zh: 'Simplified Chinese',
  ko: 'Korean',
  pt: 'Portuguese',
};

/**
 * The instruction, appended at the tail of the current prefix.
 *
 * The constraint that matters is the last one. This call can see block 3 and
 * block 4, so it knows about jealousy the player has not detected - and a chip
 * reading "ask why she is upset about Wendy" would hand that over for free,
 * bypassing the Read her economy and the pillar it protects. The stance may be
 * informed by everything; the label may not narrate any of it.
 */
export function buildChipDirective({ stances, lang = 'en', absentNames = [] }) {
  const language = LANG_NAMES[lang] ?? LANG_NAMES.en;
  const lines = [
    'System note: it is the player\'s turn. Offer exactly three things the player could do right now.',
    '',
    'One per line, nothing else:',
    'stance|what the player says or does, at most eight words',
    '',
    `Use only these stances, once each: ${stances.join(', ')}.`,
    `Write the player's side in ${language}. Stance ids stay in ASCII English.`,
    '',
    'Rules:',
    '- Write only what the player could have seen or heard. Never her private',
    '  thoughts, never anything she has not shown you.',
    '- An option is what the player TRIES. Never write what happens next.',
    '- The player speaks for themselves. Do not write her reply.',
  ];
  if (absentNames.length > 0) {
    lines.push(`- Do not mention ${absentNames.join(' or ')}. They are not here.`);
  }
  return lines.join('\n');
}

/**
 * The messages for the chip call.
 *
 * Returns MESSAGES, not a frame, and deliberately so. A chip request that gets
 * appended to block 5 would fill the transcript with chip requests and move the
 * prefix for every later turn (section 6). Handing back an array makes that
 * mistake impossible rather than merely discouraged.
 */
export function chipMessages(frame, opts) {
  return [...buildMessages(frame), { role: 'user', content: buildChipDirective(opts) }];
}

function cleanLabel(raw) {
  // Trim BEFORE stripping quotes: ` "like this"` starts with a space, so a
  // leading-anchored strip would miss the quote and leave it on screen.
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'*]+/, '')
    .replace(/["'*]+$/, '')
    .trim();
}

/**
 * Parse and validate. Format failures are guaranteed at this model tier, so
 * every rule here drops the offending chip rather than the whole response.
 */
export function parseChips(raw, { available = [], absentNames = [], count = CHIPS_PER_TURN } = {}) {
  const out = [];
  const seen = new Set();

  for (const line of String(raw ?? '').split('\n')) {
    if (out.length >= count) break;

    // Tolerate fences, bullets and numbering the way the summarizer does.
    const cleaned = line.replace(/^[\s>*\-\d.)`]+/, '').trim();
    const at = cleaned.indexOf('|');
    if (at < 0) continue;

    const stance = cleaned.slice(0, at).trim().toLowerCase();
    const label = cleanLabel(cleaned.slice(at + 1));

    if (!available.includes(stance) || seen.has(stance)) continue;
    if (!label || label.length > MAX_CHIP_LABEL) continue;

    // The roster rule, mirrored from the response parser: a chip may not name
    // someone who is not in the room, because the player has not seen them.
    const lower = label.toLowerCase();
    if (absentNames.some((n) => lower.includes(String(n).toLowerCase()))) continue;

    seen.add(stance);
    out.push({ stance, label });
  }

  return out;
}

/**
 * Fill a short result out to `count` from the set already on screen.
 *
 * Partial failure keeps whatever survived - degrading chip by chip beats
 * throwing away two good options because the third was malformed. The filler
 * comes from the chips the player is currently looking at rather than a fresh
 * roll, so a partial swap moves as few buttons as it possibly can.
 */
export function backfill(chips, fallback = [], count = CHIPS_PER_TURN) {
  const out = [...chips];
  const taken = new Set(out.map((c) => c.stance));

  for (const stance of fallback) {
    if (out.length >= count) break;
    if (taken.has(stance)) continue;
    taken.add(stance);
    out.push({ stance, label: null });
  }

  return out.slice(0, count);
}

/**
 * One chip call. Returns the written set, backfilled to full length.
 *
 * Throws nothing: a failed call returns the deterministic set, which is a
 * complete input system on its own. The caller decides whether to keep
 * spending a request on this (section 6).
 */
export async function writeChips({
  frame,
  client,
  available,
  fallback = [],
  absentNames = [],
  lang = 'en',
  count = CHIPS_PER_TURN,
}) {
  /**
   * Offer the model a wider field than it needs to fill. It picks three from
   * what is legal, which is how a written chip can be the RIGHT move rather
   * than a nicer label on a move the RNG happened to deal.
   */
  const stances = available.slice(0, 6);
  if (stances.length === 0) return { chips: backfill([], fallback, count), ok: false };

  let parsed = [];
  try {
    const raw = await client({
      messages: chipMessages(frame, { stances, lang, absentNames }),
      preset: 'chips',
    });
    parsed = parseChips(raw, { available: stances, absentNames, count });
  } catch {
    parsed = [];
  }

  return { chips: backfill(parsed, fallback, count), ok: parsed.length > 0 };
}
