/**
 * Ledger and dossier. CLAUDE.md section 7.
 *
 * The ledger is APPEND-ONLY and compacts IN PLACE. When the number of full
 * entries exceeds LEDGER_FULL_MAX, older entries are mutated from `full` to
 * `summary` where they sit. Never reorder, never delete - the rendered prefix
 * has to stay byte-identical between scenes or every cache hit is lost.
 *
 * The dossier is what makes memory visible instead of invisible plumbing. Three
 * categories, one per real question (Part I.10), and it is the ONLY channel by
 * which one member knows anything about another member's scene (`heard_about`).
 *
 * Everything written here is ENGLISH, and that rule survives Part I.6 repealing
 * v1's "memory is always English" - what was repealed is the LEDGER's recent
 * entries, which are prose the model continues from and now stay in the locale.
 * A dossier entry is a fact the model reads and never quotes, so English keeps
 * it comparable against a needle and a card without costing the prose anything.
 */

import { LEDGER_FULL_MAX, DOSSIER_CAPS } from '../config/constants.js';
import { toEntry, entryText } from '../systems/dossierEntry.js';

/**
 * Re-exported so that "how is a dossier entry shaped" has one obvious answer
 * next to the rest of memory. The definition lives in `systems/` because
 * `economy.js` reads entries too and section 4 forbids systems -> agent.
 */
export { toEntry, entryText };

export const DOSSIER_CATEGORIES = Object.keys(DOSSIER_CAPS);

/**
 * FIFO drops the oldest; LRU moves a repeat to the end instead of duplicating.
 *
 * `heard_about` is the one FIFO category, and it is FIFO because repetition
 * there is the information: hearing the same thing about the player twice is
 * not the same event as hearing it once.
 */
const FIFO_CATEGORIES = new Set(['heard_about']);

export function newDossier() {
  return Object.fromEntries(DOSSIER_CATEGORIES.map((k) => [k, []]));
}

export function newMemory(castIds = []) {
  return {
    ledger: [],
    dossier: Object.fromEntries(castIds.map((id) => [id, newDossier()])),
  };
}

// --- ledger ----------------------------------------------------------------

/**
 * Append one scene summary, compacting older entries in place if needed.
 * Returns a NEW array; the entries themselves are replaced, not reordered.
 */
export function appendLedger(ledger, entry) {
  const next = [...ledger];
  const fullCount = next.filter((e) => e.type === 'full').length;

  if (fullCount >= LEDGER_FULL_MAX) {
    // Collapse everything currently full. One miss now buys many hits after.
    for (let i = 0; i < next.length; i++) {
      if (next[i].type === 'full') {
        next[i] = { ...next[i], type: 'summary', text: next[i].summary ?? next[i].text };
      }
    }
  }

  next.push({
    id: entry.id ?? `s${next.length}`,
    week: entry.week ?? 0,
    day: entry.day ?? 0,
    block: entry.block ?? 'morning',
    type: 'full',
    text: entry.text ?? '',
    summary: entry.summary ?? entry.text ?? '',
  });

  return next;
}

/** Deterministic rendering. This string is prompt block 2. */
export function renderLedger(ledger) {
  if (ledger.length === 0) return 'Nothing has happened yet.';
  return ledger
    .map((e) => `[w${e.week} d${e.day} ${e.block}] ${e.type === 'full' ? e.text : e.summary}`)
    .join('\n');
}

/** True when the next append will collapse older entries, costing one miss. */
export function willCompact(ledger) {
  return ledger.filter((e) => e.type === 'full').length >= LEDGER_FULL_MAX;
}

// --- dossier ---------------------------------------------------------------

function capped(list, category) {
  const cap = DOSSIER_CAPS[category];
  return list.length > cap ? list.slice(list.length - cap) : list;
}

/**
 * Add one entry to one category for one member.
 *
 * LRU categories move a repeated fact to the end rather than storing it twice,
 * which matters because the summarizer will paraphrase the same fact often.
 */
export function addDossierEntry(dossier, memberId, category, entry) {
  if (!DOSSIER_CAPS[category]) throw new Error(`Unknown dossier category: ${category}`);
  const clean = toEntry(entry);
  if (!clean) return dossier;

  const member = dossier[memberId] ?? newDossier();
  const existing = member[category] ?? [];

  /**
   * Deduped on the English, not on the id.
   *
   * A fact can arrive twice by two different routes - snooped, with an id, and
   * then mentioned in a scene, where the summarizer paraphrases it and has no
   * id to offer. Matching on text catches both; matching on id would let the
   * paraphrase in as a second copy of something she already told you.
   */
  const key = clean.text.toLowerCase();
  const deduped = FIFO_CATEGORIES.has(category)
    ? existing
    : existing.filter((e) => entryText(e).toLowerCase() !== key);

  return {
    ...dossier,
    [memberId]: { ...member, [category]: capped([...deduped, clean], category) },
  };
}

/**
 * THERE IS NO `renderDossier` HERE ANY MORE, AND THAT IS THE POINT.
 *
 * v1 had one: this module rendered prompt block 3 and `promptBuilder` pasted it
 * in. v2's `agent/tiers.js` writes the tail itself, which is correct - tier 3 is
 * one block ordered by immediacy and the dossier is three lines inside it, not a
 * section that can be composed somewhere else and dropped in.
 *
 * Keeping both is what let them drift onto different category names for an
 * entire milestone without a single test failing, because the dead one was the
 * one every test called. Two answers to "how does the dossier reach the model"
 * is one too many.
 *
 * `resolveThread` and `countOpenThreads` went with `open_threads`, which existed
 * only to feed `strain`.
 */

/** Apply what the scene-exit summarizer returned. */
export function commitSummary(memory, { entry, dossierAdd = [] }) {
  let dossier = memory.dossier;

  for (const add of dossierAdd) {
    if (!add?.memberId || !add?.category) continue;
    /**
     * The whole instruction becomes the entry, minus its routing.
     *
     * Passing `add.text` alone silently dropped everything else on it - the
     * `factId` a snoop awarded, the shape of a rumor - so the split that
     * PROPOSALS 14 is about died one line before it landed. The two fields
     * that say WHERE the entry goes are the only ones removed.
     */
    const { memberId, category, ...entry } = add;
    dossier = addDossierEntry(dossier, memberId, category, entry);
  }

  return { ledger: entry ? appendLedger(memory.ledger, entry) : memory.ledger, dossier };
}
