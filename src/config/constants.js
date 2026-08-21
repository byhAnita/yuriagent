/**
 * Numeric constants. CLAUDE.md sections 5, 5b, 7, 10.
 *
 * Everything in the RELATIONSHIP and JEALOUSY blocks is a STARTING VALUE to be
 * tuned by systems/balanceSim.js in M1, not a final number.
 */

// --- memory -----------------------------------------------------------------
export const LEDGER_FULL_MAX = 6;
export const DOSSIER_CAPS = {
  known_facts: 8,
  shared_moments: 5,
  open_threads: 3,
  player_told_her: 5,
  heard_about: 4,
};

// --- relationship -----------------------------------------------------------
export const STAGE_A_MIN = {
  stranger: 0,
  colleague: 0,
  good_friends: 10,
  nameless: 20,
  unspoken: 40,
  ours: 60,
  out: 86,
};
export const RECKLESS_GAP = 20; // admissibility > intimacy + this => 'reckless'
export const PLATEAU_SLACK = 10; // admissibility < aMin - this => 'confidante'

export const STRAIN_BANDS = { stable: 0, tense: 40, rift: 60, critical: 90 };
export const STRAIN_DECAY_PER_GOOD_SCENE = 3;
export const CRITICAL_SCENES_TO_BAD_END = 2;
export const REPAIR_STRAIN_DROP = 30;

// --- jealousy ---------------------------------------------------------------
export const JEALOUSY_BANDS = { calm: 0, piqued: 25, sharp: 50, corrosive: 75 };
export const JEALOUSY_DECAY_PER_ATTENTIVE_SCENE = 5;
export const JEALOUSY_CONVERT = { jealousy: -20, intimacy: 2 };

export const EXCLUSIVITY = {
  stranger: 0.2,
  colleague: 0.4,
  good_friends: 0.7,
  nameless: 1.2,
  unspoken: 1.6,
  ours: 2.2,
  out: 2.5,
  confidante: 0.9,
  reckless: 1.8,
};

// --- exposure & rumor -------------------------------------------------------
export const RUMOR_FLOOR = 30; // below this exposure, nothing propagates
export const RUMOR_CEILING = 100;
export const WITNESS_EXPOSURE_FLOOR = 80; // group scenes clamp up to this
export const RISK_EXPOSURE_THRESHOLD = 60; // a risk action counts above this

// --- time -------------------------------------------------------------------
export const PHASES = ['prep', 'comeback', 'rest'];
export const BLOCKS = ['morning', 'afternoon', 'evening'];
export const DAYS_PER_WEEK = 7;
export const WEEKS_PER_CYCLE = 3;

// --- scene ------------------------------------------------------------------
export const READ_HER_USES_PER_SCENE = 2;
export const MAX_BEATS_PER_RESPONSE = 3;
export const MAX_INTERACTIVE_MEMBERS = 2;

// --- persistence ------------------------------------------------------------
export const SAVE_KEY = 'yuriagent_saves_v1';
export const SETTINGS_KEY = 'yuriagent_settings_v1';
