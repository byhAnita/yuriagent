/**
 * Ledger and dossier. CLAUDE.md section 7.
 *
 * The ledger is APPEND-ONLY and compacts IN PLACE. When the number of full
 * entries exceeds LEDGER_FULL_MAX, older entries are mutated from `full` to
 * `summary` where they sit. Never reorder, never delete - the rendered prefix
 * has to stay byte-identical between scenes or every cache hit is lost.
 *
 * The dossier is what makes memory visible instead of invisible plumbing. It is
 * slot-capped per category, and it is the ONLY channel by which one member
 * knows anything about another member's scene (via `heard_about`).
 *
 * Everything written here is ENGLISH regardless of UI language (section 19), so
 * the player can switch language mid-run without corrupting history.
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

/** FIFO drops the oldest; LRU moves a repeat to the end instead of duplicating. */
const FIFO_CATEGORIES = new Set(['open_threads', 'heard_about']);

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

/** Remove a resolved open thread. Matched loosely - the model paraphrases. */
export function resolveThread(dossier, memberId, text) {
  const member = dossier[memberId];
  if (!member) return dossier;
  const needle = String(text ?? '')
    .trim()
    .toLowerCase();
  if (!needle) return dossier;

  return {
    ...dossier,
    [memberId]: {
      ...member,
      open_threads: member.open_threads.filter((t) => {
        const text = entryText(t).toLowerCase();
        return !text.includes(needle) && !needle.includes(text);
      }),
    },
  };
}

/**
 * Prompt block 3, scoped to the roster.
 *
 * An absent member's facts are simply not here. That is the cheapest defence
 * against member bleed, and it is why this function takes a roster rather than
 * rendering the whole dossier.
 */
export function renderDossier(dossier, rosterIds, nameOf = (id) => id) {
  const sections = [];

  for (const id of rosterIds) {
    const member = dossier[id];
    if (!member) continue;

    const lines = [];
    for (const category of DOSSIER_CATEGORIES) {
      const items = member[category] ?? [];
      if (items.length === 0) continue;
      // Block 3 sees the English and only the English. The display half of an
      // entry never reaches a prompt - that is the whole point of splitting it.
      lines.push(`  ${category}: ${items.map((i) => `"${entryText(i)}"`).join('; ')}`);
    }
    if (lines.length === 0) continue;

    sections.push(`${nameOf(id)}:\n${lines.join('\n')}`);
  }

  return sections.length === 0 ? 'Nothing learned about her yet.' : sections.join('\n\n');
}

/** Unresolved threads cost strain at cycle end (section 7). */
export function countOpenThreads(dossier, memberId) {
  return dossier[memberId]?.open_threads?.length ?? 0;
}

/** Apply what the scene-exit summarizer returned. */
export function commitSummary(memory, { entry, dossierAdd = [], dossierResolve = [] }) {
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
  for (const res of dossierResolve) {
    if (!res?.memberId) continue;
    dossier = resolveThread(dossier, res.memberId, res.text);
  }

  return { ledger: entry ? appendLedger(memory.ledger, entry) : memory.ledger, dossier };
}
