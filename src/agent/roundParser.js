/**
 * The round parser. PROPOSALS 27.
 *
 * Replaces v1's `responseParser.js`, and the shape of the problem changed with
 * it. v1 parsed a stream of BEATS, each carrying a metadata line, and its hard
 * job was the roster rule - dropping a beat spoken by somebody not in the room.
 * A round has one speaker by construction, so that job is gone; what is left is
 * simpler and more forgiving.
 *
 * TWO HALVES, SPLIT BY A SENTINEL.
 *
 * Everything before `%%%` is prose, in the player's language, and it goes to
 * the screen as it arrives. Everything after is machine lines, ASCII English,
 * one field each.
 *
 * The split is what makes streaming free. The player is reading her line while
 * the options are still being generated, so a 2.5s round feels like 400ms - and
 * this is the reason the format is not JSON. A JSON object cannot be shown
 * until it closes, unless you parse partial objects, and at 80 words its
 * scaffolding is a fifth of the output.
 *
 * TOLERANCE IS PER LINE, NOT PER ROUND.
 *
 * Format failures are guaranteed at this model tier - v1 learned that the hard
 * way - so nothing here throws and nothing here is all-or-nothing. A malformed
 * option costs one option. A missing `sum|` costs a summary. A delta with a
 * word where a number should be is dropped and the rest of the round stands.
 * That is the whole argument against a JSON object, which fails as a unit.
 */

import { SENTINEL } from '../config/rules.js';

/** The emotions the portrait knows how to draw (CLAUDE.md section 14). */
export const EMOTIONS = ['neutral', 'happy', 'blush', 'shy', 'upset', 'surprised'];

/**
 * The separators a model actually produces, not just the one it was asked for.
 *
 * Measured live: a `zh` round in ten comes back with the options unparseable,
 * and the reason is punctuation rather than structure. A model writing Chinese
 * reaches for the full-width pipe and for the way options are DISPLAYED - `A.`
 * or `A、` - because that is what an option list looks like in Chinese prose.
 * The line is otherwise perfect.
 *
 * Accepting all of them is the same discipline as the rest of this file: format
 * failures are guaranteed at this tier, and losing four options to a full-width
 * character is the most avoidable kind of loss there is.
 */
const SEP = '[|\\uff5c.\\uff0e\\u3001\\uff1a:]';
const OPTION_LINE = new RegExp(`^([A-D])\\s*${SEP}\\s*(.+)$`);
const FIELD_LINE = new RegExp(`^([a-z_]+)\\s*${SEP}\\s*(.*)$`, 'i');
const DELTA_LINE = /^([a-z][a-z0-9_]*)\s*([+-])\s*(\d+)$/i;

/**
 * ...and the strict pair, for deciding what to DELETE from the prose half.
 *
 * Liberal in what the machine half accepts, conservative in what the prose half
 * throws away. A tolerant separator set is right for salvaging fields and wrong
 * for censoring narration - `.` and `:` appear in prose constantly, and eating
 * a line of her dialogue to catch a leaked field would be a far worse trade
 * than the one it was making.
 */
const STRICT_OPTION = /^([A-D])\s*[|｜]\s*(.+)$/;
const STRICT_FIELD = /^([a-z_]+)\s*[|｜]\s*(.*)$/i;

/**
 * The sentinel, as written rather than as specified.
 *
 * Measured live, in `zh`: about one round in six comes back with `%%`. Two
 * percent signs instead of three, on a line of its own, with a perfect machine
 * half underneath it.
 *
 * That single missing character used to cost the ENTIRE round, and in the worst
 * possible way: with no sentinel found, `splitRound` calls the whole response
 * prose, and `cleanProse` then DELETES exactly the lines it should have parsed.
 * The player got a good paragraph, no options, no emotion, and no movement -
 * and nothing on screen or in the log said why. Ruled out as a client bug first
 * by teeing the raw SSE bytes: `stream()` reassembles them byte-perfect, so the
 * model really did write two.
 *
 * Same discipline as the separator set: liberal in what the machine half
 * accepts. A line of nothing but percent signs is not something prose does.
 */
const SENTINEL_LINE = /^\s*[%％]{2,}\s*$/;

/**
 * ...and the anchor for when there is no sentinel at all.
 *
 * A line that is a single capital A-D, a pipe, and some text is not a sentence
 * anybody writes. So if the model forgot the sentinel entirely - the documented
 * one-in-ten - the option block still says where the prose ended, and the round
 * degrades to "lost a separator" instead of "lost everything after it".
 */
const OPTION_ANCHOR = /^\s*[A-D]\s*[|｜]\s*\S/;

/** Labels have to survive `zh` at fontScale 1.25 on a 390px screen. */
const OPTION_MAX = 120;

/**
 * Split a raw response into prose and machine text.
 *
 * The sentinel may not arrive at all - a truncated response, or a model that
 * forgot it. Then the whole thing is prose, which is the right failure: the
 * player reads her line and gets the fallback options, rather than reading a
 * screen of machine lines.
 */
export function splitRound(raw) {
  const text = String(raw ?? '');

  // The contract, met exactly. The common case, and the cheapest.
  const at = text.indexOf(SENTINEL);
  if (at !== -1) {
    return { prose: cleanProse(text.slice(0, at)), machine: text.slice(at + SENTINEL.length) };
  }

  /**
   * Two fallbacks, in order of how sure they are. A degraded sentinel line is
   * unambiguous - nothing else in a round is a line of percent signs - so it is
   * consumed. An option block is a boundary rather than a separator, so the line
   * that anchors it belongs to the MACHINE half and must not be eaten.
   */
  const lines = text.split('\n');
  let cut = lines.findIndex((line) => SENTINEL_LINE.test(line));
  if (cut !== -1) {
    return { prose: cleanProse(lines.slice(0, cut).join('\n')), machine: lines.slice(cut + 1).join('\n') };
  }

  cut = lines.findIndex((line) => OPTION_ANCHOR.test(line));
  if (cut !== -1) {
    return { prose: cleanProse(lines.slice(0, cut).join('\n')), machine: lines.slice(cut).join('\n') };
  }

  return { prose: cleanProse(text), machine: '' };
}

/**
 * A stray machine line must never reach the player.
 *
 * Section 9 rule 6 in v1, and it survives for the same reason: a model that has
 * just read a format contract and been told where the sentinel goes is exactly
 * the model that writes `A|...` one line early. Cheap insurance, and it only
 * ever runs on the prose half.
 */
function cleanProse(text) {
  return String(text ?? '')
    .split('\n')
    .filter((line) => !STRICT_OPTION.test(line.trim()) && !STRICT_FIELD.test(line.trim()))
    .join('\n')
    .trim();
}

/**
 * Everything the machine half carries.
 *
 * @returns {{options: string[], emotion: string|null, deltas: object,
 *            summary: string|null, canon: Array<{topic: string, text: string}>}}
 */
export function parseMachine(machine) {
  const out = { options: [], emotion: null, deltas: {}, summary: null, canon: [] };
  const seen = new Set();

  for (const rawLine of String(machine ?? '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const option = OPTION_LINE.exec(line);
    if (option) {
      // Keyed by letter rather than pushed, so a model that emits A B B D gives
      // three options instead of four - and never the same one twice.
      const letter = option[1].toUpperCase();
      if (seen.has(letter)) continue;
      const label = option[2].trim().slice(0, OPTION_MAX);
      if (!label) continue;
      seen.add(letter);
      out.options.push(label);
      continue;
    }

    const field = FIELD_LINE.exec(line);
    if (field) {
      const key = field[1].toLowerCase();
      const value = field[2].trim();
      if (key === 'emo') {
        // An unknown emotion is `neutral`, never a crash and never a blank face.
        out.emotion = EMOTIONS.includes(value) ? value : 'neutral';
      } else if (key === 'sum' && value) {
        out.summary = value;
      } else if (key === 'canon') {
        // canon|topic|text - the one field with two values.
        const cut = value.indexOf('|');
        if (cut > 0) {
          const topic = value.slice(0, cut).trim();
          const text = value.slice(cut + 1).trim();
          if (topic && text) out.canon.push({ topic, text });
        }
      }
      continue;
    }

    const delta = DELTA_LINE.exec(line);
    if (delta) {
      const [, who, sign, amount] = delta;
      const n = Number(amount);
      if (!Number.isFinite(n)) continue;
      out.deltas[who.toLowerCase()] = sign === '-' ? -n : n;
    }
  }

  return out;
}

/**
 * One response in, one round out.
 *
 * `bound` and the roster are applied by the caller, not here: this file's job
 * is to say what the model wrote, and the engine's job is to say what the world
 * allows. Keeping those apart is the whole architecture (PROPOSALS 27) - the
 * model decides what the scene means, the code decides what the world is.
 */
export function parseRound(raw) {
  const { prose, machine } = splitRound(raw);
  return { prose, ...parseMachine(machine) };
}

/** A line that begins with two or more percent signs. Never prose. */
const STREAM_CLOSE = /\n[ \t]*[%％]{2,}/;

/** Longest close marker a chunk boundary could split: `\n` plus two signs. */
const HOLD = 3;

/**
 * Where the prose stops, in a partial buffer.
 *
 * Whichever comes first: the sentinel as specified, or a line that starts with
 * two percent signs. `-1` when neither is in yet.
 */
function earliestClose(buffer) {
  const exact = buffer.indexOf(SENTINEL);
  const loose = buffer.search(STREAM_CLOSE);
  if (exact === -1) return loose;
  if (loose === -1) return exact;
  return Math.min(exact, loose);
}

/**
 * A streaming reader, for showing prose as it arrives.
 *
 * Feed it chunks; it returns the newly-readable text each time and swallows
 * everything from the sentinel onward. Once the sentinel has been seen the
 * prose is final, so a model that keeps writing cannot un-say what the player
 * has already read.
 *
 * WHAT IT EMITS IS RAW, AND `result()` IS CLEANED. That split is deliberate and
 * it is the one thing about this file worth arguing with.
 *
 * `cleanProse` works on whole lines, and a stream does not have whole lines -
 * it has half of one. Deciding whether a partial line will turn out to be a
 * leaked `emo|shy` means either holding every line back until its newline
 * arrives, which throws away most of the latency this format exists to buy, or
 * guessing, which is worse. So the stream stays raw and the caller renders
 * `result().prose` when the round completes.
 *
 * The cost is that a leaked machine line could flash on screen for a moment
 * before being replaced. Measured across ten live rounds, that happened zero
 * times - the leak `cleanProse` guards against is rare, and paying for it in
 * latency on every round to avoid a flicker on almost none is the wrong trade.
 */
export function createRoundStream() {
  let buffer = '';
  /** How much of `buffer` has already been handed to the caller. */
  let emitted = 0;
  let closed = false;

  return {
    /** @returns {string} prose text revealed by this chunk, possibly empty. */
    push(chunk) {
      buffer += String(chunk ?? '');
      if (closed) return '';

      /**
       * The degraded sentinel closes the stream too, and it has to.
       *
       * `splitRound` already salvages a `%%` round, but that runs at the END -
       * so without this the player watches four option lines and an `emo|`
       * scroll onto the screen and then vanish, roughly one round in six. A line
       * that begins with two percent signs is not prose.
       */
      const at = earliestClose(buffer);
      if (at !== -1) {
        closed = true;
        const out = buffer.slice(emitted, at);
        emitted = at;
        return out;
      }

      /**
       * Hold back a close marker's worth of tail, because a chunk boundary can
       * land inside `%%%` and half a sentinel on screen is the one artefact the
       * player would certainly notice.
       */
      const safe = buffer.length - HOLD;
      if (safe <= emitted) return '';
      const out = buffer.slice(emitted, safe);
      emitted = safe;
      return out;
    },

    /** The whole round, once the stream is done. */
    result() {
      return parseRound(buffer);
    },
  };
}
