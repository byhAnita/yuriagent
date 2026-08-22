/**
 * Tolerant streaming parser. CLAUDE.md section 9.
 *
 * Format failures are GUARANTEED at this model tier, so every rule here is a
 * fallback rather than a validation. The parser never throws and never shows a
 * raw metadata line to the player.
 *
 * Rule 3 is the important one: a beat whose speaker is not in the scene roster
 * is DROPPED ENTIRELY. That is the hard guarantee against member bleed, and it
 * is the only one of the three defence layers that does not depend on the model
 * cooperating.
 */

import { EMOTIONS } from './promptBuilder.js';

const META = /^@\s*([a-z0-9_]+)\s*\|\s*([a-z_]+)\s*\|?\s*guard\s*([+-]?\d+)?\s*\|?\s*fluster\s*([+-]?\d+)?/i;

/** A looser pass for when the model drops a pipe or reorders the fields. */
const META_LOOSE = /^@\s*([a-z0-9_]+)/i;
const GUARD = /guard\s*([+-]?\d+)/i;
const FLUSTER = /fluster\s*([+-]?\d+)/i;

const DELTA_LIMIT = 40;

function clampDelta(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-DELTA_LIMIT, Math.min(DELTA_LIMIT, n));
}

function normalizeEmotion(raw) {
  const e = String(raw ?? '').toLowerCase();
  return EMOTIONS.includes(e) ? e : 'neutral';
}

/**
 * Parse one metadata line. Returns null when the line is not metadata at all,
 * which is how prose gets distinguished from a header.
 */
export function parseMetaLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('@')) return null;

  const strict = META.exec(trimmed);
  if (strict) {
    return {
      speaker: strict[1].toLowerCase(),
      emotion: normalizeEmotion(strict[2]),
      guard: clampDelta(strict[3]),
      fluster: clampDelta(strict[4]),
    };
  }

  const loose = META_LOOSE.exec(trimmed);
  if (!loose) return null;

  const parts = trimmed.split('|');
  const emotionGuess = parts[1]?.trim();

  return {
    speaker: loose[1].toLowerCase(),
    emotion: normalizeEmotion(emotionGuess),
    guard: clampDelta(GUARD.exec(trimmed)?.[1]),
    fluster: clampDelta(FLUSTER.exec(trimmed)?.[1]),
  };
}

/**
 * Parse a whole response into beats.
 *
 * @param {string} text
 * @param {object} ctx - { rosterIds, focusId }
 * @returns {{ beats: Array, dropped: Array, malformed: boolean }}
 */
export function parseResponse(text, { rosterIds = [], focusId = null } = {}) {
  const raw = String(text ?? '');
  const roster = new Set(rosterIds);
  const fallbackSpeaker = focusId ?? rosterIds[0] ?? null;

  /**
   * A blank line only starts a new beat when a metadata line follows it.
   *
   * Splitting on any blank line was wrong, and a live run caught it: the model
   * writes an action paragraph, a blank line, then the speech - which is one
   * beat, and exactly the shape section 9 asks for. That was being torn in two,
   * and the orphaned half carried no emotion and no deltas, so roughly half of
   * all beats moved nothing at all. Prose never begins with '@'; a beat always
   * does.
   */
  const chunks = raw.split(/\n\s*\n(?=\s*@)/);
  const beats = [];
  const dropped = [];
  let sawMeta = false;

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    const meta = parseMetaLine(lines[0] ?? '');

    if (!meta) {
      // Rule 1: no metadata anywhere -> the whole thing is prose from focus.
      const prose = chunk.trim();
      if (prose) beats.push({ speaker: fallbackSpeaker, emotion: null, guard: 0, fluster: 0, text: prose, inferred: true });
      continue;
    }

    sawMeta = true;
    const prose = lines.slice(1).join('\n').trim();

    // Rule 3: off-roster speakers are dropped entirely. Not remapped - dropped.
    if (!roster.has(meta.speaker)) {
      dropped.push({ ...meta, text: prose, reason: 'off-roster' });
      continue;
    }

    if (!prose) continue;
    beats.push({ ...meta, text: prose, inferred: false });
  }

  // Rule 1, strict reading: if nothing parsed as metadata, no state should move.
  if (!sawMeta) {
    return {
      beats: beats.map((b) => ({ ...b, emotion: null, guard: 0, fluster: 0 })),
      dropped,
      malformed: true,
    };
  }

  return {
    beats: beats.map((b) => ({ ...b, emotion: b.emotion ?? 'neutral' })),
    dropped,
    malformed: false,
  };
}

/** Aggregate meter movement for the scene engine. */
export function totalDeltas(beats) {
  return beats.reduce(
    (acc, b) => ({ guard: acc.guard + (b.guard ?? 0), fluster: acc.fluster + (b.fluster ?? 0) }),
    { guard: 0, fluster: 0 },
  );
}

/**
 * What one TURN moved, which is not the sum of its beats.
 *
 * A reply carries one to three beats and the model picks how many as a
 * stylistic choice, not as a measure of how far the conversation got. It does
 * not shrink its per-beat numbers when it writes more of them - measured, the
 * per-beat magnitude is much the same either way - so summing made a chatty
 * reply worth three times a terse one for identical player input.
 *
 * Six live scenes with the same seven turns and the same stances:
 *
 *   7 beats  -> guard drop  9, fluster peak 23  -> paid nothing
 *   7 beats  -> guard drop  0, fluster peak 23  -> paid nothing
 *   21 beats -> guard drop 25, fluster peak 80  -> paid the maximum
 *
 * Averaging makes a turn a turn. Three beats in one reply are one exchange
 * described in three moments, so the mean is the truer reading of where her
 * guard now is - and the scene's payout tracks what the player did rather than
 * how many paragraphs came back.
 *
 * The cost is real and accepted: genuine progression WITHIN a reply is
 * flattened. That is the smaller error, because the model has no notion of
 * budgeting a total across however many beats it is about to write.
 */
export function turnDeltas(beats) {
  if (!beats || beats.length === 0) return { guard: 0, fluster: 0 };
  const { guard, fluster } = totalDeltas(beats);
  return {
    guard: Math.round(guard / beats.length),
    fluster: Math.round(fluster / beats.length),
  };
}

/**
 * Incremental parser for streaming.
 *
 * Emits a beat as soon as its blank-line terminator arrives, so the portrait
 * reacts on the metadata line while the prose is still coming in.
 */
export function createStreamParser(ctx = {}) {
  let buffer = '';
  const emitted = [];
  const dropped = [];

  return {
    /** @returns {Array} beats completed by this chunk */
    push(chunk) {
      buffer += chunk;
      const out = [];

      // Same rule as parseResponse: only a blank line that introduces another
      // metadata line completes the beat in front of it. The final beat has no
      // successor, so it is flushed by end().
      let idx;
      while ((idx = buffer.search(/\n\s*\n(?=\s*@)/)) !== -1) {
        const piece = buffer.slice(0, idx);
        buffer = buffer.slice(idx).replace(/^\n\s*\n/, '');
        const { beats, dropped: d } = parseResponse(piece, ctx);
        out.push(...beats);
        dropped.push(...d);
      }

      emitted.push(...out);
      return out;
    },

    /** Flush the tail and report the whole response. */
    end() {
      const out = [];
      if (buffer.trim()) {
        const { beats, dropped: d } = parseResponse(buffer, ctx);
        out.push(...beats);
        dropped.push(...d);
        buffer = '';
      }
      emitted.push(...out);
      return { beats: emitted, dropped, tail: out };
    },

    /** The metadata line must never reach the player. */
    get pending() {
      return buffer;
    },
  };
}
