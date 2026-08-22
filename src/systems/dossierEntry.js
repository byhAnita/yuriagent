/**
 * The shape of one dossier entry. Pure. PROPOSALS 14.
 *
 * An entry used to be a bare string, and that string was doing two jobs at
 * once: it was the English the model reads in block 3, and it was the only
 * thing the UI had to print. Those cannot be the same string - section 19
 * keeps memory English so a language switch cannot corrupt history, which
 * means the UI was structurally guaranteed to print English into a Chinese
 * run.
 *
 * So an entry is an object. `text` is the English half and nothing about it
 * changes; everything else on the object is for the player - the `factId` a
 * snoop awarded it under, or the shape of the rumor behind it.
 *
 * This lives in `systems/` rather than beside the rest of memory because
 * `economy.js` reads dossier entries too, and section 4 puts the dependency
 * arrow from `agent/` to `systems/` and never the other way.
 */

/**
 * Normalise either shape into an entry, or null if there is nothing there.
 *
 * A bare string is still accepted because that is what the summarizer
 * produces: it writes prose in its own words and has no id to offer.
 */
export function toEntry(entry) {
  if (entry && typeof entry === 'object') {
    const text = String(entry.text ?? '').trim();
    return text ? { ...entry, text } : null;
  }
  const text = String(entry ?? '').trim();
  return text ? { text } : null;
}

/**
 * The English out of an entry of either shape.
 *
 * Every reader goes through this rather than through `.text`, which is what
 * makes the old shape harmless: a test that seeds a dossier with plain
 * strings, and a summarizer response, both keep working with no migration.
 */
export function entryText(entry) {
  return typeof entry === 'string' ? entry : (entry?.text ?? '');
}

/** The fact id an entry was awarded under, if it came from a snoop. */
export function entryFactId(entry) {
  return typeof entry === 'object' ? (entry?.factId ?? null) : null;
}
