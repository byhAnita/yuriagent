/**
 * Save and load. CLAUDE.md section 15.
 *
 * Six slots in localStorage - one that writes itself at day rollover, five the
 * player writes - and everything defensive: a corrupt or half-written record
 * must yield a playable state rather than throwing, because this runs before
 * the app can render anything to explain itself.
 *
 * THREE THINGS ARE DELIBERATELY NOT IN A SAVE:
 *
 * - **`scene`.** Section 15 excludes it: a scene is ephemeral by design, so
 *   saving mid-scene would mean saving at the room door and nothing else. The
 *   game saves at day rollover, which is exactly where a scene never is.
 * - **The API key.** It lives in its own module under its own storage key
 *   (`store/apiKey.js`), so it cannot be serialised into a file that gets
 *   exported or shared (section 22).
 * - **Settings.** Device-level, not run-level. A player who switches to Chinese
 *   should stay in Chinese across a restart, and a save carried to another
 *   device should not drag somebody else's font scale with it.
 *
 * `focusId` is likewise absent because section 15 says it is DERIVED - whoever
 * currently holds the highest affection. Storing it would let it disagree with
 * the relations it is computed from.
 */

import { SAVE_KEY, DOSSIER_CAPS } from '../config/constants.js';
import { eventFor, recurs } from '../data/events/index.js';

/**
 * 4: the v2 engine. `relations` lost `strain`, `jealousy`, `criticalScenes` and
 * the stored `stage`; `intimacy` became `affection`; the dossier went from five
 * categories to three. A v1 save loads and is nonsense, which is why the number
 * moves - the merge rules below are what make it load at all.
 */
export const SCHEMA_VERSION = 4;

/**
 * Everything a run is, and nothing else.
 *
 * Written as an explicit projection rather than a spread of app state, so that
 * adding a piece of UI state to App cannot silently start persisting it - and
 * so that reading this function tells you what a save contains.
 */
export function toSave({ run, player, cast, relations, memory, canon, calendar, flags, lang, model }) {
  return {
    meta: { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), lang, model },
    run,
    player,
    cast,
    relations,
    dossier: memory?.dossier ?? {},
    ledger: memory?.ledger ?? [],
    // The third memory store (section 7). Flat, run-level, never compacted.
    canon: Array.isArray(canon) ? canon : [],
    calendar: calendar ?? {},
    flags: flags ?? {},
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Fill anything missing from defaults rather than throwing (section 15).
 *
 * The shape below is the contract. A record from an older build is missing
 * fields, a record from a newer one has extra ones, and neither is a reason to
 * refuse to load - the alternative is a player losing a nine-week campaign to
 * a field that got renamed.
 */
export function fromSave(raw, defaults) {
  if (!isObject(raw)) return null;

  return {
    meta: { schemaVersion: SCHEMA_VERSION, ...(isObject(raw.meta) ? raw.meta : {}) },
    run: { ...defaults.run, ...(isObject(raw.run) ? raw.run : {}) },
    player: { ...defaults.player, ...(isObject(raw.player) ? raw.player : {}) },
    cast: Array.isArray(raw.cast) && raw.cast.length > 0 ? raw.cast : defaults.cast,
    /**
     * Merged per member, not replaced wholesale. A cast that gained a member
     * since the save was written must not come back with `undefined` where her
     * relationship should be - every reader of `relations[id]` assumes it is
     * there.
     */
    relations: mergePerMember(defaults.relations, raw.relations),
    memory: {
      dossier: migrateDossier(mergePerMember(defaults.memory.dossier, raw.dossier)),
      ledger: Array.isArray(raw.ledger) ? raw.ledger : [],
    },
    /**
     * A save written before canon existed comes back with an empty one rather
     * than `undefined` - every reader treats it as a list.
     */
    canon: Array.isArray(raw.canon) ? raw.canon.filter(isCanonEntry) : [],
    calendar: isObject(raw.calendar) ? raw.calendar : {},
    flags: {
      firedEvents: migrateFiredEvents(raw.flags?.firedEvents),
      /**
       * `usedGestures` was here. It went with the opener sheet (Part I.10) -
       * a gesture is now one of the four written options, so "only once" is a
       * property of the writing rather than a counter. An old record still
       * carries the key and it is simply not read, which is the correct
       * treatment for a retired flag: nothing to migrate, nothing to keep.
       */
      foundRumors: Array.isArray(raw.flags?.foundRumors) ? raw.flags.foundRumors : [],
      /** Learned routines - the access half of what a snoop buys (Part I.10). */
      foundRoutines: Array.isArray(raw.flags?.foundRoutines) ? raw.flags.foundRoutines : [],
      repairUsed: isObject(raw.flags?.repairUsed) ? raw.flags.repairUsed : {},
    },
  };
}

/**
 * `firedEvents` gained a cycle, and an untouched old save would replay.
 *
 * The keys were `phase:slot`. Recurring events are now `phase:slot:cycle`, so
 * a two-part key matches nothing under the new scheme and every anchor event
 * the player already sat through would be scheduled again. That is the quiet
 * kind of break - the save loads, the run continues, and the concept meeting
 * simply happens twice.
 *
 * It is NOT "append `:0` to anything with two parts", which is what this looked
 * like before the one-off events existed. The cruise and the island are keyed
 * `phase:slot` on purpose (see `recurs`), so a blanket rewrite would corrupt
 * exactly the two keys that were already correct. The catalogue decides, which
 * also means the migration keeps working if an event's recurrence changes.
 *
 * Anything that is already three parts is left alone, so loading twice is safe.
 */
export function migrateFiredEvents(stored) {
  if (!Array.isArray(stored)) return [];

  return stored
    .filter((key) => typeof key === 'string')
    .map((key) => {
      const parts = key.split(':');
      if (parts.length !== 2) return key;
      const [phase, slot] = parts;
      return recurs(eventFor(phase, slot)) ? `${phase}:${slot}:0` : key;
    });
}

/**
 * A canon entry needs a topic and the English text the prompt reads. Anything
 * else in a stored record is somebody's hand-edited save or a half-written
 * one, and dropping it is better than letting `undefined` into block 4.
 */
function isCanonEntry(e) {
  return isObject(e) && typeof e.topic === 'string' && typeof e.text === 'string';
}

/**
 * Five dossier categories became three (Part I.10), and two of them were RENAMED.
 *
 * `known_facts` -> `facts` and `player_told_her` -> `told_her`, because those are
 * the names `agent/tiers.js` reads. `shared_moments` duplicated the ledger and
 * `open_threads` fed `strain`, so both are dropped rather than carried - a key
 * nothing reads is a key that survives forever in every save file written after
 * it stopped meaning anything.
 *
 * Renaming rather than discarding costs three lines and keeps whatever the
 * player had already learned. It also normalises FORWARD: a save from any build
 * comes back holding exactly the categories that exist now, so `DOSSIER_CAPS`
 * stays the one answer to what a dossier contains.
 */
const DOSSIER_RENAMES = { known_facts: 'facts', player_told_her: 'told_her' };

function migrateDossier(dossier) {
  const out = {};
  for (const [id, member] of Object.entries(dossier)) {
    if (!isObject(member)) continue;
    const next = {};
    for (const key of Object.keys(DOSSIER_CAPS)) next[key] = [];
    for (const [category, list] of Object.entries(member)) {
      const target = DOSSIER_RENAMES[category] ?? category;
      if (!(target in next) || !Array.isArray(list)) continue;
      next[target] = [...next[target], ...list].slice(-DOSSIER_CAPS[target]);
    }
    out[id] = next;
  }
  return out;
}

function mergePerMember(defaults, stored) {
  const out = { ...defaults };
  if (!isObject(stored)) return out;
  for (const [id, value] of Object.entries(stored)) {
    if (isObject(value) && out[id]) out[id] = { ...out[id], ...value };
    else if (isObject(value)) out[id] = value;
  }
  return out;
}

/**
 * The slot that writes itself, and the five the player writes.
 *
 * Section 15: nobody has to think about saving, and anybody who wants to can.
 * `auto` belongs to the run and is cleared by `restart`; the numbered five are
 * the player's and outlive any particular campaign.
 */
export const AUTO_SLOT = 'auto';
export const MANUAL_SLOTS = 5;
export const SLOT_IDS = [AUTO_SLOT, ...Array.from({ length: MANUAL_SLOTS }, (_, i) => String(i + 1))];

export function isSlotId(id) {
  return SLOT_IDS.includes(id);
}

/**
 * Everything under one key, as `{ slots: { [id]: record } }`.
 *
 * A record written by the single-slot build is a bare save - it has `run` at
 * the top level - and is adopted as the auto slot rather than discarded. A
 * player mid-campaign when this shipped must not lose the campaign to a
 * container shape they never asked for.
 */
function readAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (!isObject(raw)) return {};
    if (isObject(raw.slots)) return raw.slots;
    if (isObject(raw.run)) return { [AUTO_SLOT]: raw };
    return {};
  } catch {
    return {};
  }
}

function writeAll(slots) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, slots }));
    return true;
  } catch {
    // A full quota or a private window. A failed save must never take the run
    // down with it - the player would lose the thing the save was protecting.
    return false;
  }
}

/**
 * Who the run is about, derived at read time.
 *
 * Section 15 keeps `focusId` out of a save because it is DERIVED - whoever
 * holds the highest affection - and storing it would let it disagree with the
 * relations it comes from. That argument does not change just because a slot
 * list wants to display it, so it is computed here instead.
 */
function focusOf(relations) {
  if (!isObject(relations)) return null;
  let best = null;
  for (const [id, rel] of Object.entries(relations)) {
    const affection = rel?.affection ?? 0;
    if (!best || affection > best.affection) best = { id, affection };
  }
  return best && best.affection > 0 ? best : null;
}

/** The header a slot list needs, without deserialising the whole run. */
function headerOf(id, raw) {
  if (!isObject(raw)) return { id, auto: id === AUTO_SLOT, empty: true };
  const focus = focusOf(raw.relations);
  return {
    id,
    auto: id === AUTO_SLOT,
    empty: false,
    savedAt: raw.meta?.savedAt ?? null,
    lang: raw.meta?.lang ?? null,
    week: raw.run?.week ?? 0,
    day: raw.run?.day ?? 0,
    phase: raw.run?.phase ?? null,
    name: raw.player?.name ?? '',
    focusId: focus?.id ?? null,
    focusAffection: focus?.affection ?? 0,
  };
}

/** Every slot in fixed order, empty ones included - the list is the UI. */
export function listSlots() {
  const slots = readAll();
  return SLOT_IDS.map((id) => headerOf(id, slots[id]));
}

export function peekSlot(id) {
  return headerOf(id, readAll()[id]);
}

export function hasAnySave() {
  return listSlots().some((s) => !s.empty);
}

export function saveTo(id, state) {
  if (!isSlotId(id)) return false;
  return writeAll({ ...readAll(), [id]: toSave(state) });
}

export function loadFrom(id, defaults) {
  if (!isSlotId(id)) return null;
  return fromSave(readAll()[id], defaults);
}

export function deleteSlot(id) {
  if (!isSlotId(id)) return false;
  const slots = readAll();
  if (!slots[id]) return false;
  delete slots[id];
  return writeAll(slots);
}

/**
 * Drop the autosave and leave the player's own slots alone.
 *
 * Called by `restart`. The single-slot build wiped the only save there was,
 * which under six slots would mean starting a new run silently destroys five
 * campaigns the player deliberately kept.
 */
export function clearAuto() {
  return deleteSlot(AUTO_SLOT);
}
