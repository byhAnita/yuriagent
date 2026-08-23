/**
 * Save and load. CLAUDE.md section 15.
 *
 * One slot, localStorage, and everything defensive: a corrupt or half-written
 * record must yield a playable state rather than throwing, because this runs
 * before the app can render anything to explain itself.
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
 * currently holds the highest intimacy. Storing it would let it disagree with
 * the relations it is computed from.
 */

import { SAVE_KEY } from '../config/constants.js';

export const SCHEMA_VERSION = 1;

/**
 * Everything a run is, and nothing else.
 *
 * Written as an explicit projection rather than a spread of app state, so that
 * adding a piece of UI state to App cannot silently start persisting it - and
 * so that reading this function tells you what a save contains.
 */
export function toSave({ run, player, cast, relations, memory, calendar, flags, lang, model }) {
  return {
    meta: { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), lang, model },
    run,
    player,
    cast,
    relations,
    dossier: memory?.dossier ?? {},
    ledger: memory?.ledger ?? [],
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
      dossier: mergePerMember(defaults.memory.dossier, raw.dossier),
      ledger: Array.isArray(raw.ledger) ? raw.ledger : [],
    },
    calendar: isObject(raw.calendar) ? raw.calendar : {},
    flags: {
      firedEvents: Array.isArray(raw.flags?.firedEvents) ? raw.flags.firedEvents : [],
      usedGestures: Array.isArray(raw.flags?.usedGestures) ? raw.flags.usedGestures : [],
      foundRumors: Array.isArray(raw.flags?.foundRumors) ? raw.flags.foundRumors : [],
      repairUsed: isObject(raw.flags?.repairUsed) ? raw.flags.repairUsed : {},
    },
  };
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

export function hasSave() {
  try {
    return Boolean(localStorage.getItem(SAVE_KEY));
  } catch {
    return false;
  }
}

/** The header a continue button needs, without deserialising the whole run. */
export function peek() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (!isObject(raw)) return null;
    return {
      savedAt: raw.meta?.savedAt ?? null,
      week: raw.run?.week ?? 0,
      day: raw.run?.day ?? 0,
      name: raw.player?.name ?? '',
    };
  } catch {
    return null;
  }
}

export function save(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave(state)));
    return true;
  } catch {
    // A full quota or a private window. A failed save must never take the run
    // down with it - the player would lose the thing the save was protecting.
    return false;
  }
}

export function load(defaults) {
  try {
    return fromSave(JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'), defaults);
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do. A save that cannot be cleared is a stale continue button,
    // not a broken game.
  }
}
