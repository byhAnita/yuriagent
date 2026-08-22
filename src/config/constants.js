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

/**
 * Scale factor on jealousy gain.
 *
 * Found by balanceSim: the raw formula (weight * intimacy/100 * exclusivity)
 * tops out near 2.5, while the bands sit at 25/50/75 and decay is 5 per
 * attentive scene. Unscaled, jealousy could never reach even `piqued` and the
 * whole pressure system was inert - a competent spread player hit the balance
 * ending 31.8% of the time. The shape of the formula was right; the scale was
 * not.
 */
export const JEALOUSY_GAIN_SCALE = 6;

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

/**
 * A campaign is several comeback cycles, not one.
 *
 * Found by balanceSim: a single 3-week cycle is 63 blocks, which is ~12 scenes
 * per member across five routes - not enough to move any of them out of
 * drift_end. One cycle is a fine length for a single devoted route and far too
 * short for the multi-route game. See docs/PROGRESS.md.
 */
export const CYCLES_PER_CAMPAIGN = 3;

// --- scene ------------------------------------------------------------------
export const READ_HER_USES_PER_SCENE = 2;
export const MAX_BEATS_PER_RESPONSE = 3;
export const MAX_INTERACTIVE_MEMBERS = 2;

/**
 * A scene occupies one time block, so it cannot run forever. Past this many
 * turns the block ends on its own and the day moves. Without it a player could
 * grind a single block indefinitely and the opportunity cost that makes the
 * three-blocks-a-day structure work would evaporate.
 */
export const SCENE_TURN_LIMIT = 8;

// --- written chips (section 6) ----------------------------------------------
export const CHIPS_PER_TURN = 3;

/**
 * A written label longer than this means the model ignored the contract and
 * wrote prose. Short ones are clamped to two lines in the UI instead of being
 * rejected - throwing away a good chip for being four characters over is worse
 * than letting it wrap.
 */
export const MAX_CHIP_LABEL = 64;

/**
 * Consecutive chip-writer failures before the scene gives up on it. Two is
 * enough to tell a bad response from a bad connection, and giving up costs the
 * player nothing: chips.js is a complete input system on its own.
 */
export const CHIP_FAILURES_BEFORE_GIVING_UP = 2;

/**
 * ...and how many turns it stays given up for.
 *
 * Measured against a busy provider, a chip call that normally takes 1.4s took
 * 8.1s. A latch that switched the writer off for the rest of the scene turned a
 * two-minute slow patch into eight turns of plain stance names, which is what
 * "after one round it was hardcoded for the whole conversation" looked like
 * from the outside. A cooldown costs a few turns instead of all of them.
 */
export const CHIP_COOLDOWN_TURNS = 3;

/** Every block spent costs this; Read her costs one on top. */
export const ENERGY_PER_BLOCK = 6;
export const ENERGY_PER_READ = 1;
/**
 * Overnight no longer covers a full day of blocks. Tuned so three scenes with
 * Read her runs slightly negative, which is what makes spending a block in your
 * own room a real decision rather than a formality.
 */
export const ENERGY_RESTORED_OVERNIGHT = 24;

/**
 * Secrecy comes back a point a day, toward the identity's baseline and never
 * past it.
 *
 * Without it secrecy is a one-way ratchet: snooping costs 1-7 and nothing
 * restored it, so a measured campaign hit 0 in week 3 of 9 and stayed pinned
 * there. Below the floor a snoop is free - which silently switches off the one
 * cost that makes the knowledge economy a decision - and exposure carries a
 * flat +21 forever, so the practice room stops being private.
 */
export const SECRECY_RECOVERED_OVERNIGHT = 1;

// --- openers (section 11) ---------------------------------------------------
/**
 * A knowledge fact can be spent two ways: on an object, or on saying something.
 *
 * The gesture is free, so it has to be weaker AND single-use, or credits stop
 * meaning anything and the shop turns into decoration. Once is also the honest
 * limit in fiction: asking after her ankle the first time is attention, and
 * asking every scene is a script.
 */
export const GESTURE_EFFECT = 3;

// --- model requests ---------------------------------------------------------
/**
 * Nothing may hang forever.
 *
 * A stalled request used to freeze a scene permanently: the turn never
 * resolves, so `pending` stays true and the chips stay disabled, `busy` stays
 * true so even Leave is blocked, `withRetry` never fires because nothing ever
 * rejects, and the offline fallback in client.js never gets its chance. A dead
 * socket looked exactly like a dead game.
 */
export const REQUEST_TIMEOUT_MS = 45000;

/**
 * A stream is allowed to be slow, but not silent. Measured beat calls finish in
 * 1.4-2.8s, so twelve seconds without a single token means the connection is
 * gone rather than the model thinking.
 */
export const STREAM_STALL_MS = 12000;

// --- persistence ------------------------------------------------------------
export const SAVE_KEY = 'yuriagent_saves_v1';
export const SETTINGS_KEY = 'yuriagent_settings_v1';
