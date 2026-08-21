/**
 * Settings persistence. Device-local, never part of a save file.
 *
 * Reads are defensive: a corrupt or absent record must yield working defaults
 * rather than throwing, because this runs before the app can render anything.
 */

import { SETTINGS_KEY } from '../config/constants.js';
import { DEFAULT_THEME, DEFAULT_FONT_SCALE, THEMES, FONT_SCALES } from '../config/themes.js';

export const DEFAULT_SETTINGS = {
  theme: DEFAULT_THEME,
  fontScale: DEFAULT_FONT_SCALE,
  lang: 'en',
  reduceMotion: false,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      theme: THEMES.includes(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
      fontScale: FONT_SCALES.includes(parsed.fontScale)
        ? parsed.fontScale
        : DEFAULT_SETTINGS.fontScale,
      lang: typeof parsed.lang === 'string' ? parsed.lang : DEFAULT_SETTINGS.lang,
      reduceMotion: Boolean(parsed.reduceMotion),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or a full quota. Settings are a convenience, not state
    // the game depends on, so failing to persist them is survivable.
  }
}
