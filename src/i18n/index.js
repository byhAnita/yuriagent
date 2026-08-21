/**
 * i18n. CLAUDE.md section 19.
 *
 * UI strings only. Generated prose is localized by the model via the language
 * directive in prompt block 1 - these two paths never mix. Ledger and dossier
 * entries are always English regardless of the value here.
 *
 * `ko` and `pt` are v2. They resolve to `en` until their files exist, so a
 * stored preference for them degrades instead of crashing.
 */

import en from './en.js';
import zh from './zh.js';

const BUNDLES = { en, zh };

export const LANGS = ['en', 'zh'];
export const PLANNED_LANGS = ['ko', 'pt'];

export const LANG_LABELS = {
  en: 'English',
  zh: '中文',
  ko: '한국어',
  pt: 'Portugues',
};

/**
 * Resolve a dotted key against the active bundle.
 * Falls back to English, then to the key itself, so a missing string shows up
 * as a visible key in the UI rather than as `undefined` or a blank space.
 */
export function makeT(lang) {
  const bundle = BUNDLES[lang] ?? BUNDLES.en;
  return function t(path) {
    const walk = (obj) => path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
    const hit = walk(bundle);
    if (typeof hit === 'string') return hit;
    const fallback = walk(BUNDLES.en);
    return typeof fallback === 'string' ? fallback : path;
  };
}
