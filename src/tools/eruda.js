/**
 * A console on a phone. CLAUDE.md section 3.
 *
 * The call record (`debugLog.js`) is only useful if somebody can read it, and
 * on the device this game is designed for they cannot: iOS runs WebKit under
 * every browser, so Chrome on an iPhone has no devtools and no way to type
 * `yuri.dump()`. A hand-played bug on the target platform therefore arrived
 * with no evidence attached, which is the exact problem the call record was
 * built to solve - solved on desktop only.
 *
 * Eruda is an in-page console overlay. It is the same argument as recording
 * unconditionally: a bug found by hand on a phone is found once, and asking
 * the player to reproduce it next to a laptop is asking for the one thing they
 * cannot promise.
 *
 * THREE RULES, and the first two are what keep this out of a player's way:
 *
 * 1. **It is opt-in and it is not free.** ~500KB, dynamically imported, so it
 *    is a chunk nobody downloads unless they asked for it. A static import
 *    would put it in the main bundle for everybody.
 * 2. **Asking is sticky.** `?debug=1` sets a flag and the flag survives
 *    reload, because an installed PWA opens at `start_url` and would drop a
 *    query string - the console would vanish exactly when a tester adds the
 *    game to their home screen. `?debug=0` turns it off again.
 * 3. **It never breaks the game.** Every failure path here is silent. A
 *    missing chunk, a browser that refuses it, storage that throws in a
 *    private window: the game must still be playable, because this is a
 *    diagnostic and not a feature.
 */

const FLAG = 'yuriagent_eruda_v1';
const PARAM = 'debug';

/**
 * Should the overlay load?
 *
 * Pure, and separated from the loading for exactly one reason: this is the
 * part with rules in it, and a rule that is not asserted is one that gets
 * quietly broken (section 21). The dynamic import is untestable in node; the
 * decision is not.
 *
 * @param {string} search - `location.search`
 * @param {Storage|null} storage - `localStorage`, or null where there is none
 * @returns {{ load: boolean, persist: boolean|null }} `persist` is what the
 *   caller should write back: true, false, or null for "leave it alone".
 */
export function erudaDecision(search = '', storage = null) {
  const asked = new URLSearchParams(search).get(PARAM);

  // An explicit answer in the URL always wins, and is remembered.
  if (asked === '1' || asked === 'true') return { load: true, persist: true };
  if (asked === '0' || asked === 'false') return { load: false, persist: false };

  let remembered = null;
  try {
    remembered = storage?.getItem(FLAG) ?? null;
  } catch {
    // A private window with storage disabled is not a reason to fail.
    remembered = null;
  }

  return { load: remembered === '1', persist: null };
}

/**
 * Load it, if this session asked for it.
 *
 * Awaited by nobody. `main.jsx` calls it and moves on: the game renders while
 * the chunk arrives, which is the same trade the written chips make.
 */
export async function maybeInstallEruda({
  search = globalThis.location?.search ?? '',
  storage = globalThis.localStorage ?? null,
  load = () => import('eruda'),
} = {}) {
  const { load: wanted, persist } = erudaDecision(search, storage);

  if (persist !== null) {
    try {
      storage?.setItem(FLAG, persist ? '1' : '0');
    } catch {
      // Ignored: the URL still decided this page load.
    }
  }

  if (!wanted) return false;

  try {
    const mod = await load();
    const eruda = mod?.default ?? mod;
    if (eruda?._isInit) return true;
    eruda.init();

    /**
     * One tap instead of typing `yuri.dump()` on a phone keyboard.
     *
     * Eruda snippets are buttons in the overlay. Typing a function call into
     * a 390px console with autocorrect on is exactly the friction that stops
     * a report carrying its evidence, and the dump is the whole reason this
     * is here.
     */
    eruda.get('snippets')?.add('yuri.dump()', () => {
      // eslint-disable-next-line no-console
      console.log(globalThis.yuri?.dump?.(40) ?? '[yuri] no call record on this page');
    }, 'Print the last 40 model calls, ready to paste');

    eruda.get('snippets')?.add('yuri.debug()', () => {
      // eslint-disable-next-line no-console
      console.log(globalThis.yuri?.debug?.(true) ?? '[yuri] unavailable');
    }, 'Also print every model call as it happens');

    return true;
  } catch {
    // A diagnostic that takes the game down with it is worse than no
    // diagnostic. Section 3: the game is playable in every degraded mode.
    return false;
  }
}
