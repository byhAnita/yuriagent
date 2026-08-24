/**
 * What the campaign has decided. CLAUDE.md section 7.
 *
 * The third memory store, and it exists because the other two cannot hold a
 * decision. `dossier` is per member and scoped to the room, which is the wrong
 * shape - everybody in X knows what the group chose. `ledger` is chronology
 * that compacts and eventually drops, and it spends its one sentence on
 * whatever the scene was emotionally about. The played evidence is unambiguous:
 * fifteen turns of a meeting that picks a comeback concept produced a ledger
 * line about a plate of food.
 *
 * | store  | question                  | compacts? |
 * |--------|---------------------------|-----------|
 * | ledger | what happened, in order   | yes       |
 * | dossier| what she knows about you  | yes       |
 * | canon  | what the group decided    | NEVER     |
 *
 * STORAGE AND INJECTION ARE SEPARATE, and that is the whole reason this file is
 * short. Storage is complete and permanent - it is what the player reads in the
 * handbook. Injection is filtered and capped at a few lines of block 4. Only
 * the ledger has to fit inside a prompt, so only the ledger needs a compaction
 * rule; asking "what happens when canon fills up" is asking a question the
 * split has already answered.
 *
 * Pure, like everything else in `systems/`: no React, no model, no I/O.
 */

/** Cap on a single decision, so one runaway string cannot own block 4. */
export const CANON_TEXT_MAX = 140;

/** How many lines of canon a scene header may carry (section 8, salience). */
export const CANON_INJECT_MAX = 6;

export function newCanon() {
  return [];
}

/** The topic ids an event is allowed to report, from its own agenda. */
export function agendaIds(frame) {
  return (frame?.agenda ?? []).map((a) => a.id).filter(Boolean);
}

/**
 * Turn what the model returned into entries, or drop it.
 *
 * THE RULE, and it is section 9's roster rule in a new place:
 *
 *   > A decision whose topic is not in this event's agenda is dropped entirely.
 *
 * It is here rather than in the prompt for the same reason the roster rule is:
 * prompting alone will not hold it. A model asked what a room decided will
 * happily report a decision the room never reached, and that is the
 * `learnableFacts` problem again - a fact awarded for nothing is worse than a
 * fact never awarded, because it hands the player something they did not earn.
 *
 * A topic the day never reached is simply absent. No filler, no placeholder;
 * the only consequence is that a later event reads one line fewer.
 *
 * Two texts per entry, and this is not symmetry for its own sake. `text` is
 * English because all memory is (section 19 rule 2), so a language switch
 * mid-run cannot corrupt it. `display` is what the player reads in the
 * handbook, and without it a `zh` player would read their own campaign's
 * decisions in English. Section 12 made exactly this mistake once with
 * `learnableFacts`; this is the same fix.
 */
export function parseDecisions(raw, frame) {
  const allowed = new Set(agendaIds(frame));
  if (allowed.size === 0) return [];

  const seen = new Set();
  const out = [];

  for (const d of Array.isArray(raw) ? raw : []) {
    if (!d || typeof d !== 'object') continue;

    const topic = String(d.topic ?? '').trim();
    if (!allowed.has(topic) || seen.has(topic)) continue;

    const text = String(d.text ?? '').trim().slice(0, CANON_TEXT_MAX);
    if (!text) continue;

    seen.add(topic);
    out.push({
      topic,
      text,
      // Degrades to the English rather than to a blank, the same way the
      // summarizer's `display` does: the wrong language beats nothing on screen.
      display: String(d.display ?? d.text ?? '').trim().slice(0, CANON_TEXT_MAX),
    });
  }

  return out;
}

/**
 * Append. Never replace, never reorder, never drop.
 *
 * Superseding is an INJECTION concern (see `latestByTopic`), not a storage one.
 * Cycle 2's title track does not delete cycle 1's - the handbook should be able
 * to show a campaign that changed its mind, and a store that quietly rewrites
 * its own history is the ledger's compaction rule leaking somewhere it was
 * explicitly kept out of.
 */
export function addDecisions(canon, decisions, { cycle, phase, slot }) {
  if (!decisions || decisions.length === 0) return canon;
  return [...canon, ...decisions.map((d) => ({ ...d, cycle, phase, slot }))];
}

/**
 * The current answer for each topic: the last one recorded wins.
 *
 * Order is preserved from storage, so the result reads chronologically and a
 * topic settled twice appears where it was settled MOST RECENTLY rather than
 * where it first came up. That is the right reading for a prompt - what is
 * true now, in the order it became true.
 */
export function latestByTopic(canon) {
  const byTopic = new Map();
  for (const entry of canon ?? []) {
    /**
     * DELETE BEFORE SET, which is not a flourish.
     *
     * `Map.set` on an existing key keeps the ORIGINAL insertion position, so a
     * topic settled again in a later cycle would keep its old place in the
     * list - and `canonForCycle` caps by taking the tail, so the freshest
     * decision in the campaign could be the one trimmed away. Deleting first
     * moves it to the end, where "most recently settled" belongs.
     */
    byTopic.delete(entry.topic);
    byTopic.set(entry.topic, entry);
  }
  return [...byTopic.values()];
}

/**
 * What block 4 carries for an ordinary scene: this cycle, briefly.
 *
 * Ordinary scenes get canon at all because that is where most of the value is.
 * Irene mentioning the title track in a wardrobe on a Tuesday is pillar 4 -
 * memory that shows in the scene rather than in plumbing - and block 4 is
 * rebuilt at every scene start anyway, so it is free in cache terms.
 *
 * Capped, and the cap is not arbitrary. Block 4 is ordered by immediacy
 * (section 8) and its most important line is the standing sentence, the one
 * that makes every reaction proportionate. Eighteen world facts would drown it.
 * The most RECENT are kept, because a decision made yesterday is the one the
 * room is still talking about.
 */
export function canonForCycle(canon, cycle, limit = CANON_INJECT_MAX) {
  return latestByTopic((canon ?? []).filter((e) => e.cycle === cycle)).slice(-limit);
}

/**
 * Render for block 4. Model-facing English, never localized.
 *
 * Returns null rather than an empty heading when there is nothing to say - a
 * campaign in its first week has decided nothing, and a section that says so is
 * worse than no section.
 */
export function renderCanon(entries) {
  if (!entries || entries.length === 0) return null;
  return entries.map((e) => `- ${e.text}`).join('\n');
}
