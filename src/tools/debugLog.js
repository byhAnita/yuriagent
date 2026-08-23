/**
 * A record of what every model call actually did.
 *
 * Two facts decide most of the bugs this project has had, and neither of them
 * reaches the screen: WHICH client answered - the router or the offline writer
 * - and what the raw text was before the parser touched it. A player reporting
 * "she replied in English" can see neither, and a live harness cannot
 * reproduce a client-side path at all, which is why eight probes missed a
 * language bug that lived in `client.js`.
 *
 * Recording is unconditional; printing is opt-in. That way round on purpose: a
 * bug found by hand is found once, and asking the player to enable logging and
 * then hit it again is asking for the one thing they cannot promise. Forty
 * calls is roughly the last two scenes, which is the window a report is
 * written from.
 *
 * THE API KEY IS NEVER PART OF A RECORD. It is not in `messages` - it travels
 * as its own argument to `llmTool` - so this is mostly a matter of not being
 * clever, and `redact` is a belt on top of that. Section 22: keys are never
 * logged, never committed, and never sent anywhere but the chosen endpoint.
 * Nothing here transmits anything: the ring is in memory and `dump` returns a
 * string for the player to paste if they choose to.
 */

const DEBUG_KEY = 'yuriagent_debug_v1';

/** About two scenes. Long enough to hold the turns before a bug, short enough to paste. */
const RING = 40;
const MAX_OUT = 2000;
const MAX_TAIL = 400;

const calls = [];
let seq = 0;

/**
 * Anything shaped like a provider key, wherever it turns up.
 *
 * Defensive rather than expected. If a key ever reaches a message - a player
 * pasting one into free text, a future call that quotes a config - the record
 * must not be the thing that carries it into a bug report.
 */
const SECRETS = [/sk-[A-Za-z0-9_-]{6,}/g, /AIza[A-Za-z0-9_-]{6,}/g];

export function redact(text) {
  let out = String(text ?? '');
  for (const re of SECRETS) out = out.replace(re, '[redacted]');
  return out;
}

function clip(text, max) {
  const s = redact(text).replace(/\r/g, '');
  return s.length > max ? `${s.slice(0, max)}\n...[${s.length - max} more chars]` : s;
}

/**
 * Which language the prompt actually asked for, and whether it asked twice.
 *
 * Block 1 states it once, ~1500 tokens above the dialogue; block 4 repeats it
 * at the bottom of the frozen header for anything that is not English. A beat
 * that came back in the wrong language is a different bug depending on whether
 * both were present, so the record answers that rather than leaving it to be
 * reconstructed from a screenshot.
 */
export function languageOf(messages) {
  const all = (messages ?? []).map((m) => m?.content ?? '').join('\n');
  return {
    asked: /Write in ([A-Za-z ]+): BOTH halves/.exec(all)?.[1] ?? null,
    repeated: /## Language - /.test(all),
  };
}

/**
 * Held in memory as well as in storage, and the memory copy is the authority.
 *
 * Storage only decides whether the flag survives a reload. A player in a
 * private window - or anything running without `localStorage` - must still be
 * able to turn logging on for the session, because the moment somebody reaches
 * for this is the moment something is already going wrong.
 */
let enabled = false;

export function debugEnabled() {
  if (enabled) return true;
  try {
    return localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    // Logging is a convenience and must never throw into a turn.
    return false;
  }
}

export function setDebug(on) {
  enabled = Boolean(on);
  try {
    if (enabled) localStorage.setItem(DEBUG_KEY, '1');
    else localStorage.removeItem(DEBUG_KEY);
  } catch {
    // The session flag above still holds, and the ring records either way.
  }
  return enabled;
}

/**
 * Record one finished call.
 *
 * `source` is the whole point: `live` means the router answered, `mock` means
 * there was no key, and `fallback` means the router was tried and failed. The
 * third is invisible in play for every preset except chips, and it is the one
 * that explains a beat the player cannot account for.
 */
export function recordCall({
  preset,
  source,
  modelId = null,
  messages = [],
  out = '',
  ms = 0,
  error = null,
}) {
  const lang = languageOf(messages);
  const tail = [...messages].reverse().find((m) => m?.role === 'user')?.content ?? '';

  const entry = {
    n: (seq += 1),
    at: new Date().toISOString(),
    preset,
    source,
    modelId,
    ms: Math.round(ms),
    lang: lang.asked,
    langRepeated: lang.repeated,
    messages: messages.length,
    promptChars: messages.reduce((n, m) => n + (m?.content?.length ?? 0), 0),
    tail: clip(tail, MAX_TAIL),
    out: clip(out, MAX_OUT),
    error: error ? redact(error.message ?? String(error)) : null,
  };

  calls.push(entry);
  if (calls.length > RING) calls.shift();

  if (debugEnabled()) {
    const head = `[yuri] #${entry.n} ${entry.preset} <- ${entry.source} ${entry.ms}ms lang=${entry.lang ?? '-'}${entry.langRepeated ? '+r' : ''}`;
    // eslint-disable-next-line no-console
    console.log(head, entry.error ? `ERROR ${entry.error}` : '', `\n${entry.out}`);
  }

  return entry;
}

export function recordedCalls() {
  return calls.map((c) => ({ ...c }));
}

export function clearCalls() {
  calls.length = 0;
  seq = 0;
}

/**
 * The last `n` calls as text meant to be pasted into a bug report.
 *
 * Plain lines rather than JSON: the reader is a person, the console renders it
 * without a viewer, and select-all-copy keeps it intact.
 */
export function dumpCalls(n = 10) {
  const slice = calls.slice(-Math.max(1, n));
  if (slice.length === 0) return '[yuri] no model calls recorded yet.';

  return slice
    .map((c) =>
      [
        `--- #${c.n} ${c.preset} <- ${c.source}${c.modelId ? ` (${c.modelId})` : ''}`,
        `    ${c.at}  ${c.ms}ms  lang=${c.lang ?? '-'}${c.langRepeated ? ' +block4' : ''}  ${c.messages} msgs / ${c.promptChars} chars`,
        c.error ? `    ERROR ${c.error}` : null,
        `  > ${c.tail.replace(/\n/g, '\n    ')}`,
        `  < ${c.out.replace(/\n/g, '\n    ')}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

/**
 * Attach the console handles.
 *
 * Called once from `main.jsx`. Kept out of module scope so importing this file
 * in a test does not reach for a global, and so the app decides when the game
 * grows a debug surface rather than the import graph deciding for it.
 */
export function installDebug(target = globalThis) {
  target.yuri = {
    debug: (on = true) => {
      setDebug(on);
      return `[yuri] call logging ${on ? 'on' : 'off'}. Calls are recorded either way; yuri.dump() to read them.`;
    },
    dump: (n = 10) => dumpCalls(n),
    calls: () => recordedCalls(),
    clear: () => {
      clearCalls();
      return '[yuri] cleared.';
    },
  };
  return target.yuri;
}
