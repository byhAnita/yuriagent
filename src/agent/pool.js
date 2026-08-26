/**
 * The memory pool. CLAUDE.md Part I.5.
 *
 * Replaces v1's `memory.js` ledger and `summarizer.js` call, and the shape is
 * lifted from `rv-simulator/src/agent/memoryPool.js` - which has been played for
 * months and is the reason this project stopped inventing its own.
 *
 * THE STEPPED WINDOW
 *
 * A handful of recent scenes are kept as FULL TEXT in the player's language.
 * When one more closes, the ones already full collapse - in place - to their
 * one-sentence English summaries. They are never reordered and never deleted,
 * so the rendered prefix stays byte-identical from one round to the next and
 * tier 2 is a cache hit on every call except the one that collapses.
 *
 * WHY A SCENE AND NOT A ROUND
 *
 * `HISTORY_FULL_MAX` counts scenes, and the arithmetic is what settles it.
 * `rv-simulator` keeps three story rounds of 350-450 words - about 1200 words of
 * recent full text. A round here is ~80 words and a scene is 4-6 of them, so
 * three scenes is the same 1200 words. Counting rounds instead would keep half a
 * conversation and cut it mid-sentence.
 *
 * It is also the only granularity the wire format can summarise. Only the last
 * round of a scene emits `sum|` (Part I.5), so a scene is the smallest thing
 * that HAS a summary to collapse to.
 *
 * WHAT IS IN WHICH LANGUAGE
 *
 * `text` is the player's language, because that is what the model continues from
 * and writing Chinese out of an English brief is what produced the
 * translationese this whole redesign is for. `summary` is English, because it is
 * bookkeeping and because the summaries are what survive longest.
 */

/** How many closed scenes keep their full text. Three, and see the header. */
export const HISTORY_FULL_MAX = 3;

/** A pool with nothing in it yet. */
export function newPool() {
  return { closed: [], current: null };
}

/**
 * Start a scene. Anything already open is closed without a summary first, which
 * is what a player quitting to the day screen mid-scene produces.
 */
export function openScene(pool, { id, label = '' } = {}) {
  const base = pool.current ? closeScene(pool, {}) : pool;
  return {
    ...base,
    current: { id: id ?? `s${base.closed.length + 1}`, label, rounds: [] },
  };
}

/**
 * Append one finished round: her prose, and what the player chose in answer.
 *
 * The choice is stored beside the prose rather than as its own entry because
 * that is what it is - the player's line, answering the round above it. Rendered
 * as `> ...`, it is the only trace of the player's own voice in the history.
 */
export function appendRound(pool, { text, choice = null } = {}) {
  if (!pool.current) return pool;
  const clean = String(text ?? '').trim();
  if (!clean) return pool;

  return {
    ...pool,
    current: {
      ...pool.current,
      rounds: [...pool.current.rounds, { text: clean, choice: choice ? String(choice).trim() : null }],
    },
  };
}

/**
 * Write the player's line onto the round it answers.
 *
 * The choice is not known when the round is appended - the model writes her
 * line, and only then does the player pick a reply to it - so it is patched onto
 * the newest entry afterwards. That is the one place this file is not strictly
 * append-only, and it is free: the newest round is the cache miss already, and
 * everything before it is untouched.
 */
export function recordChoice(pool, choice) {
  const clean = String(choice ?? '').trim();
  if (!pool.current || pool.current.rounds.length === 0 || !clean) return pool;

  const rounds = [...pool.current.rounds];
  rounds[rounds.length - 1] = { ...rounds[rounds.length - 1], choice: clean };
  return { ...pool, current: { ...pool.current, rounds } };
}

/** How many rounds the open scene has run. The engine's own round counter. */
export function roundCount(pool) {
  return pool.current?.rounds.length ?? 0;
}

/**
 * Close the open scene, and collapse older ones if this makes one too many.
 *
 * A scene with no summary still closes and still collapses - it just collapses
 * to a placeholder rather than to a sentence. That is the right failure: a model
 * that forgot `sum|` costs one line of history, and the alternative is a scene
 * that stays full forever and quietly breaks the window.
 */
export function closeScene(pool, { summary = null } = {}) {
  if (!pool.current) return pool;

  const scene = {
    id: pool.current.id,
    label: pool.current.label,
    type: 'full',
    rounds: pool.current.rounds,
    summary: String(summary ?? '').trim() || `Time passed at ${pool.current.label || 'work'}.`,
  };

  const closed = [...pool.closed, scene];
  const fullCount = closed.filter((s) => s.type === 'full').length;

  if (fullCount > HISTORY_FULL_MAX) {
    /**
     * Collapse everything that is currently full EXCEPT the one just added.
     *
     * All at once rather than one at a time, which is `rv-simulator`'s own
     * choice and the cheaper one: a rolling window pays a partial miss every
     * scene, and a stepped one pays a full miss every fourth and a total hit
     * the rest of the time. The prefix is what is being bought, and a prefix
     * that shifts a little every scene is worth nothing.
     */
    for (let i = 0; i < closed.length - 1; i += 1) {
      if (closed[i].type === 'full') closed[i] = { ...closed[i], type: 'summary', rounds: [] };
    }
  }

  return { closed, current: null };
}

/**
 * A block that was not a conversation - solo work, a snoop, a chore.
 *
 * It lands as an already-collapsed entry: one English sentence, permanently.
 * That is right twice over. There is no full text to keep, because nobody said
 * anything; and it must not consume one of the three full slots, or an afternoon
 * of tidying the wardrobe would push a scene with her out of the window.
 *
 * Composed in code, never by the model. Section 10b: spending a model call on
 * "you restocked the wardrobe" is waste, and these have to be instant because
 * they are the filler between scenes.
 */
export function noteScene(pool, { id, summary } = {}) {
  const clean = String(summary ?? '').trim();
  if (!clean) return pool;

  const base = pool.current ? closeScene(pool, {}) : pool;
  return {
    ...base,
    closed: [
      ...base.closed,
      { id: id ?? `n${base.closed.length + 1}`, label: '', type: 'summary', rounds: [], summary: clean },
    ],
  };
}

/**
 * The pool as tier 2 wants it: a flat list, oldest first.
 *
 * `tiers.buildTier2` owns how an entry is rendered and this owns which entries
 * exist. Keeping those apart is why the window policy can change without
 * touching a prompt string.
 *
 * The open scene's rounds are included, which is the whole reason tier 2 rather
 * than tier 3 carries the conversation: appending a round leaves everything
 * before it byte-identical, so only the newest round is ever a miss. Putting the
 * scene in the tail instead would re-send the whole conversation every round.
 */
export function poolEntries(pool) {
  const out = [];

  for (const scene of pool.closed) {
    if (scene.type === 'summary') {
      out.push({ id: scene.id, type: 'summary', summary: scene.summary });
      continue;
    }
    scene.rounds.forEach((r, i) => {
      out.push({ id: `${scene.id}.${i + 1}`, type: 'full', text: r.text, choice: r.choice });
    });
  }

  if (pool.current) {
    pool.current.rounds.forEach((r, i) => {
      out.push({ id: `${pool.current.id}.${i + 1}`, type: 'full', text: r.text, choice: r.choice });
    });
  }

  return out;
}

/** For saving. The pool is plain data, so this is here for symmetry and intent. */
export function toSave(pool) {
  return { closed: pool.closed, current: pool.current };
}

/** And back, tolerantly - an old or truncated save loads as an empty pool. */
export function fromSave(raw) {
  if (!raw || !Array.isArray(raw.closed)) return newPool();
  return {
    closed: raw.closed.filter(Boolean).map((s) => ({
      id: s.id ?? '?',
      label: s.label ?? '',
      type: s.type === 'summary' ? 'summary' : 'full',
      rounds: Array.isArray(s.rounds) ? s.rounds : [],
      summary: s.summary ?? '',
    })),
    current: null,
  };
}
