/**
 * API key storage. CLAUDE.md section 22.
 *
 * Device-local, never part of a save file, never logged, never sent anywhere
 * but the endpoint the player chose. Kept in its own module and its own storage
 * key so it can never be accidentally serialised alongside game state.
 */

const KEY = 'yuriagent_key_v1';

export function loadApiKey() {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveApiKey(value) {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    // Private browsing. The offline writer still works.
  }
}
