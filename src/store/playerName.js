/**
 * The player's name.
 *
 * `player.name` has been in the section 15 state schema since M0 and was never
 * collected or used. It reaches the model in block 1, which is the byte-stable
 * block, so it is set once at run start and never edited afterwards.
 *
 * IT IS SANITISED BECAUSE IT IS PLAYER TEXT GOING INTO A PROMPT. The specific
 * hazard is not rudeness, it is the format contract: block 1 sits above a
 * parser that reads any line beginning with '@' as a metadata line, so a name
 * containing a newline could forge one and move her meters. Stripping line
 * breaks and control characters closes that, and the length cap keeps a
 * pathological name from displacing the cast in the prompt.
 *
 * This is not localized. It is whatever the player typed, in whatever script.
 */

export const MAX_PLAYER_NAME = 24;
export const DEFAULT_PLAYER_NAME = 'the player';

/**
 * Control characters become spaces.
 *
 * Written as a code-point scan rather than a regex character class on purpose:
 * the class needs escape sequences, and an escape that gets mangled in transit
 * produces a file with literal control characters in it, which is exactly the
 * thing this function exists to remove.
 */
function stripControl(text) {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0);
    out += code < 0x20 || code === 0x7f ? ' ' : ch;
  }
  return out;
}

/**
 * Make a name safe to put in a prompt and on screen.
 *
 * Returns an empty string for anything that sanitises to nothing, so the caller
 * can decide between asking again and falling back - this module does not
 * silently invent a name.
 */
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return '';

  return collapseSpaces(stripControl(raw)).slice(0, MAX_PLAYER_NAME).trim();
}

function collapseSpaces(text) {
  return text.split(/\s+/).join(' ').trim();
}

export function isValidName(raw) {
  return sanitizeName(raw).length > 0;
}

/** What the prompt and the UI use when the player has not given one. */
export function displayName(raw) {
  return sanitizeName(raw) || DEFAULT_PLAYER_NAME;
}
