/**
 * Test-only: read the throwaway provider key for the opt-in live suites.
 *
 * The GAME never reads this. It takes the key from localStorage via the
 * settings modal (store/apiKey.js, CLAUDE.md section 22). This module exists so
 * `*.test.js` files can exercise the real router, and nothing outside a test
 * imports it - it uses node:fs and would not survive the browser build.
 *
 * The names in .env.local deliberately have NO `VITE_` prefix: Vite inlines
 * every VITE_* variable into the client bundle at build time.
 */

import { readFileSync } from 'node:fs';

export function readEnvLocal() {
  try {
    const raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
    const out = {};
    for (const line of raw.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}

/** The key itself is never logged, never asserted on, never printed. */
export function liveConfig() {
  const env = readEnvLocal();
  const apiKey = env.YURIAGENT_API_KEY || '';
  return {
    apiKey,
    modelId: env.YURIAGENT_MODEL_ID || 'deepseek-v4-flash',
    live: apiKey.length > 0,
  };
}
