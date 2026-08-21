/**
 * Theme registry. CLAUDE.md section 20.
 *
 * Token VALUES live in src/index.css under [data-theme]. This module only holds
 * the list the settings UI iterates, plus the runtime computation for `bloom`,
 * which is the one theme whose colours come from game state rather than CSS.
 */

export const THEMES = ['night', 'day', 'dusk', 'bloom'];
export const DEFAULT_THEME = 'night';

export const FONT_SCALES = [0.875, 1, 1.125, 1.25];
export const DEFAULT_FONT_SCALE = 1;

/**
 * Apply settings to the document root. Called on boot and on every change.
 *
 * @param {object} settings           - { theme, fontScale, reduceMotion }
 * @param {object|null} focusPalette  - { base, accent } from the focus member's
 *                                      card; only consumed by the bloom theme.
 */
export function applyTheme(settings, focusPalette = null) {
  const root = document.documentElement;
  const theme = THEMES.includes(settings.theme) ? settings.theme : DEFAULT_THEME;

  root.setAttribute('data-theme', theme);
  root.setAttribute('data-reduce-motion', String(Boolean(settings.reduceMotion)));
  root.style.setProperty('--font-scale', String(settings.fontScale ?? DEFAULT_FONT_SCALE));

  if (theme === 'bloom' && focusPalette) {
    root.style.setProperty('--bloom-base', focusPalette.base);
    root.style.setProperty('--bloom-accent', focusPalette.accent);
  } else {
    root.style.removeProperty('--bloom-base');
    root.style.removeProperty('--bloom-accent');
  }
}
