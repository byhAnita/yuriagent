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
import { buildMessages, LANG_NAMES } from './promptBuilder.js';
import { RISK_STANCES } from '../systems/chips.js';

/** How many stances the model is offered to pick its three from. */
export const CHIP_FIELD_SIZE = 6;

/**
 * The stances the model may choose between this turn.
 *
 * Three rules, in order, and the order is the whole of it:
 *
 *   1. **everything the static bar is currently showing**, so a written set is
 *      a relabelling of the move the game actually dealt rather than a
 *      different move. This is what keeps the reserved risk slot alive.
 *   2. **the rest, sampled** rather than taken in array order - the field is
 *      meant to be wider than three so the model can pick the RIGHT move, and
 *      a fixed head means five of the eleven stances are never offered at all.
 *   3. capped at `CHIP_FIELD_SIZE`, because the directive is the cache miss on
 *      this call and every stance name in it is paid for on every turn.
 *
 * `rng` is optional so this stays a pure function with a deterministic default
 * - the caller has no seed to hand it, and a shuffled field does not need to
 * be reproducible, only unbiased.
 */
export function chipField(available = [], fallback = [], rng = Math.random) {
  const legal = fallback.filter((s) => available.includes(s));
  const out = [...new Set(legal)];

  const rest = available.filter((s) => !out.includes(s));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  for (const stance of rest) {
    if (out.length >= CHIP_FIELD_SIZE) break;
    out.push(stance);
  }

  return out.slice(0, CHIP_FIELD_SIZE);
}

/**
 * The instruction, appended at the tail of the current prefix.
 *
 * The constraint that matters is the last one. This call can see block 3 and
 * block 4, so it knows about jealousy the player has not detected - and a chip
 * reading "ask why she is upset about Wendy" would hand that over for free,
 * bypassing the Read her economy and the pillar it protects. The stance may be
 * informed by everything; the label may not narrate any of it.
 */
export function buildChipDirective({
  stances,
  lang = 'en',
  absentNames = [],
  addresseeName = null,
}) {
  const language = LANG_NAMES[lang] ?? LANG_NAMES.en;

  /**
   * Kept deliberately short. Measured against DeepSeek, this directive IS the
   * cache miss on the chip call - an earlier, wordier version cost 171 tokens
   * of miss and pushed the call past the beat call it is supposed to hide
   * behind. Every line here has to earn its tokens.
   */
  const lines = [
    "System note: the player's turn. Give exactly three options.",
    'One per line, nothing else: stance|what the player says, max 8 words',
    /**
     * "Choose three of" and not "once each".
     *
     * The old wording asked for `exactly three options` and then listed six
     * stances `once each`, which is a contradiction the model resolved
     * differently from turn to turn: the day-three report contains replies with
     * TWO lines and replies with SIX. Two is what the player saw and reported
     * twice as a bug - "2 live options and 1 offline option" - because the
     * third slot fell through to a bare static label beside two written ones.
     */
    `Choose three of these stances, one each: ${stances.join(', ')}.`,
    `Option text in ${language}; stance ids stay ASCII English.`,
    'Only what the player could see or hear - never her thoughts.',
    'Write what the player tries, not what happens. Never write her reply.',
  ];
  /**
   * Group scenes only, and one short line.
   *
   * The label is what the player says TO somebody. After a `turnTo` that is no
   * longer whoever last spoke, and a model with no way to know that writes the
   * next line at the wrong woman.
   */
  if (addresseeName) {
    lines.push(`The player is speaking to ${addresseeName}.`);
  }
  if (absentNames.length > 0) {
    lines.push(`Never mention ${absentNames.join(', ')}.`);
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
 * Never relabel away the bet.
 *
 * `generateChips` reserves one of its three slots for a stance outside the
 * common four, because `touch`, `invite` and `confide` are the only ones that
 * can move admissibility - a bar of warm everyday verbs is a bar on which the
 * second axis cannot move. The written set is free to be better writing; it is
 * not free to take that slot away, and for a whole campaign it did, because
 * the model was never offered a risk stance to write in the first place.
 *
 * `chipField` fixes the offering. This is the belt: if the static bar was
 * holding a risk and the model's three do not, the risk keeps its slot and
 * loses only its label. Degrading chip by chip, which is what this module
 * does everywhere else.
 */
export function keepRisk(chips, fallback = [], count = CHIPS_PER_TURN) {
  const offered = fallback.find((s) => RISK_STANCES.includes(s));
  if (!offered) return chips;
  if (chips.some((c) => RISK_STANCES.includes(c.stance))) return chips;

  // Room to simply add it - no written label has to be given up.
  if (chips.length < count) return [...chips, { stance: offered, label: null }];

  return [...chips.slice(0, count - 1), { stance: offered, label: null }];
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
  addresseeName = null,
  lang = 'en',
  count = CHIPS_PER_TURN,
  rng = Math.random,
}) {
  /**
   * Offer the model a wider field than it needs to fill. It picks three from
   * what is legal, which is how a written chip can be the RIGHT move rather
   * than a nicer label on a move the RNG happened to deal.
   *
   * THE FIELD IS BUILT, NOT SLICED, and that distinction cost the game its
   * second axis for a whole campaign. This was `available.slice(0, 6)` - the
   * head of the `STANCES` array, which is `flirt, care, casual, deflect, joke,
   * press` and is byte-identical in every scene ever played. `touch`, `invite`
   * and `confide` sit at indices 7, 6 and 10, so **the only three stances that
   * can move admissibility could never be written**, and the reserved slot
   * `generateChips` sets aside for exactly them was overwritten the moment the
   * call returned.
   *
   * Played, that is a public risk the player has to take by out-racing an API
   * call: the static bar deals `invite`, and a second later it is relabelled
   * into something warm and deniable. Third occurrence of the `markRisk`
   * shape, and the third time a deterministic slice of an ordered array stood
   * in for a choice.
   */
  const stances = chipField(available, fallback, rng);
  if (stances.length === 0) return { chips: backfill([], fallback, count), ok: false };

  let parsed = [];
  try {
    const raw = await client({
      messages: chipMessages(frame, { stances, lang, absentNames, addresseeName }),
      preset: 'chips',
    });
    parsed = parseChips(raw, { available: stances, absentNames, count });
  } catch {
    parsed = [];
  }

  return { chips: backfill(keepRisk(parsed, fallback, count), fallback, count), ok: parsed.length > 0 };
}
