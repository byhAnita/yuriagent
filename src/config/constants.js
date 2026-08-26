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
export const RECKLESS_GAP = 20; // admissibility > affection + this => 'reckless'
export const PLATEAU_SLACK = 10; // admissibility < aMin - this => 'confidante'

/**
 * THE STRAIN AND JEALOUSY BLOCKS ARE GONE, AND SO ARE THEIR NUMBERS.
 *
 * `STRAIN_BANDS`, `STRAIN_DECAY_PER_GOOD_SCENE`, `CRITICAL_SCENES_TO_BAD_END`,
 * `REPAIR_STRAIN_DROP`, `JEALOUSY_BANDS`, `JEALOUSY_DECAY_PER_ATTENTIVE_SCENE`,
 * `JEALOUSY_CONVERT`, `JEALOUSY_GAIN_SCALE`, `EXCLUSIVITY` and
 * `DATE_JEALOUSY_FACTOR` were all tuned against a harness that no longer exists,
 * for two axes Part I.8 retires. A constant nobody reads is worse than no
 * constant: it reads as a knob, and somebody eventually turns it.
 *
 * What they measured has not gone away - it moved. A bad scene moves affection
 * down, which is the damage; a member who has heard something reacts the next
 * time she is in the room, which is the pressure. Both are the model's answer
 * now, bounded by `config/rules.js` rather than by a band table here.
 */

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
 * How long a v2 scene runs. CLAUDE.md Part I.3.
 *
 * A scene occupies one time block, so it cannot run forever - without a cap a
 * player could grind a single block indefinitely and the opportunity cost that
 * makes three blocks a day work would evaporate. The BLOCK is the unit of
 * opportunity cost, which is exactly what makes the rounds inside it free: the
 * player is not spending anything by staying, so nothing has to ration them.
 *
 * Four to six rather than a fixed five, drawn from the run seed at the door, so
 * the player cannot count down to the end of a conversation. It is the one thing
 * about a scene they are not told.
 */
export const SCENE_ROUNDS_MIN = 4;
export const SCENE_ROUNDS_MAX = 6;

/**
 * v1's turn cap. Superseded by the two above and kept only while the v1 engine
 * is still in the tree.
 */
export const SCENE_TURN_LIMIT = 8;

/**
 * A date or an authored event is a whole DAY, not a block, so it gets a longer
 * budget and a different register (proposal 13). Keeping the ordinary scene
 * terse is deliberate: section 1's first pillar is 30-50 word bursts rather
 * than 300-word narration, and a literary register everywhere would repeal it.
 * The contrast is what makes a date feel like one.
 */
export const SCENE_TURN_LIMITS = { ordinary: SCENE_TURN_LIMIT, date: 16, event: 16 };

/**
 * What each extra person in the room is worth in turns.
 *
 * Eight turns across a full cast is a turn and a half each, which is not a
 * conversation with anybody - and a group scene is the one place the player's
 * attention is genuinely being divided. Two turns per extra member takes a
 * five-member room to sixteen, which is exactly where a date and an anchor
 * event already sit, so the three arrive at the same number from different
 * directions rather than being three separate decisions.
 *
 * It does not make breadth better value than depth: five members at sixteen
 * turns is ~3 turns of attention each against a 1v1's eight. Section 5b wants
 * breadth cheap and shallow, and this keeps it that way.
 */
export const TURNS_PER_EXTRA_MEMBER = 2;

/** A conversation longer than this stops being a scene and becomes a day. */
export const SCENE_TURN_LIMIT_MAX = 16;

// --- dating (CLAUDE.md section 10) ------------------------------------------
/**
 * A public date gates on ADMISSIBILITY and a private one on INTIMACY, because
 * a private date asks how close the two of you are and a public one asks how
 * nameable it is. That falls out of the two-axis model rather than being bolted
 * onto it, and it makes the two non-substitutable: a player stuck on the
 * `confidante` plateau can get the private date easily and cannot get the
 * public one at all.
 *
 * `floor` is a hard no. `sure` is a certain yes. Between them it is a real bet,
 * which is pillar 1 - the player reads hidden state and wagers on it.
 *
 * `public.floor` sits between STAGE_A_MIN.nameless (20) and .unspoken (40): you
 * must already have taken a public risk or two, and it is reachable mid-game.
 * `private.floor` is 50, the same number as `touch` and her bedroom door, so
 * "you may go into her room" and "you may ask her to spend a day with you"
 * unlock together.
 */
export const DATE_KINDS = {
  public: { axis: 'admissibility', floor: 30, sure: 55, credits: 12 },
  private: { axis: 'affection', floor: 50, sure: 75, credits: 0 },
};

/**
 * What a scene has to achieve before it pays any affection (section 6).
 *
 * These moved when the unit of measurement did. They were 15 and 60 against a
 * meter that SUMMED every beat, so a reply carrying three beats moved it three
 * times as far as one carrying a single beat - and measured live, every
 * seven-beat scene paid nothing while every twenty-one-beat scene paid the
 * maximum, for identical player input. A turn is now the unit and its movement
 * is the mean of its beats, which is a smaller number by construction.
 *
 * Recalibrated against six live scenes on DeepSeek. Guard drops came in at
 * 0, 6, 6, -2, 15, 19 and fluster peaks at 8, 14, 22, 24, 30, 34 - so the old
 * fluster bar of 60 had become literally unreachable and that whole branch, the
 * one that pays for "you landed even though her guard held", was dead.
 *
 * NOTE the offline writer is roughly two to three times more generous per turn
 * than DeepSeek, so harness payout figures are an upper bound rather than a
 * forecast. See docs/PROPOSALS.md.
 */
export const GUARD_DROP_TO_PAY = 12;
export const FLUSTER_PEAK_TO_PAY = 30;

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

/**
 * Being nosy in front of witnesses costs more than being nosy alone.
 *
 * Every action is now offered in every room, occupied or not - being locked out
 * of a snoop because somebody walked in is agency lost for no design gain. But
 * without a price for company, the occupied room would be strictly better than
 * the empty one (a scene AND a snoop for one block), which only inverts the
 * dead-space problem section 10b exists to solve.
 *
 * The other half of the balance was already there and needs no code: you never
 * learn about somebody standing in the room, so the more members present, the
 * smaller the pool.
 */
export const SNOOP_WITNESS_PENALTY = 0.5;
export const SNOOP_COST_MAX_MULTIPLIER = 2.5;

// --- group scenes (CLAUDE.md section 10c) -----------------------------------
/**
 * A second voice has two reasons to exist, and conflating them was a bug.
 *
 * The first build had exactly one bar, priced for jealousy, and the arithmetic
 * made ordinary conversation structurally impossible: a week-1 bystander at
 * affection 10 who had said nothing for four turns scored 0.66 against a bar of
 * 1.0, so the ONLY thing that could ever produce a second voice was a jealousy
 * band. Five women in a practice room either sat in silence or sniped at each
 * other, and there was no third option anywhere in the number.
 *
 * So there are two bars now, and they answer different questions:
 *
 *   CHIME  - does somebody have something to add? Priced on silence, because a
 *            member who never speaks stops being in the room. Warm by default:
 *            these are five people who have worked together for years.
 *   CUT_IN - is somebody unsettled enough to interrupt ABOUT the player? Priced
 *            on jealousy, and gated on actually being in a jealousy band, so it
 *            stays the exception it was always described as.
 *
 * Keeping them separate is what lets the room be lively and warm without
 * making it jealous, which is the whole complaint the split came from.
 */
export const INTERJECT_THRESHOLD = 1.0;

/**
 * Which bands may cut in at all.
 *
 * `piqued` is deliberately excluded even though it scores 0.5. Section 5b calls
 * piqued an OPPORTUNITY rather than a tax - she probes, and noticing it is one
 * of the strongest affection gains in the game. Letting her interrupt about it
 * spends the moment before the player can read it.
 */
export const CUT_IN_BANDS = ['sharp', 'corrosive'];

/**
 * What makes a bystander want to speak.
 *
 * Four sources, not one. She cuts in because she is invested, because she is
 * unsettled, because she was just talked about, or because she has been
 * standing there saying nothing.
 */
export const INTERJECT_STAKE = {
  affection: 0.6,
  jealousy: { calm: 0, piqued: 0.5, sharp: 1.0, corrosive: 1.6 },
  mentioned: 0.7,
  perSilentTurn: 0.15,
};

/**
 * What makes a bystander want to join in - no jealousy term anywhere in it.
 *
 * Silence dominates, and that is what makes the room circulate on its own:
 * whoever speaks has her counter reset, so the next chime goes to somebody
 * else without any rota deciding it. Two quiet turns clears the bar exactly,
 * which scales with room size for free - a five-member room nearly always has
 * somebody at two, a two-member one alternates, and neither needed a rule.
 *
 * Being named is worth most of a turn of silence on its own, because being
 * talked about is the most natural reason in the world to speak up.
 */
export const CHIME_STAKE = {
  affection: 0.25,
  mentioned: 0.6,
  perSilentTurn: 0.45,
};

export const CHIME_THRESHOLD = 0.9;

// --- shared dorm activities (PROPOSALS 15) ----------------------------------
/**
 * What an evening spent with all of them is worth to each of them.
 *
 * Small on purpose. It is not a substitute for a scene with her - it is the one
 * thing in the dorm that costs nobody anything, which is what the place needed:
 * section 10 makes the dorm safe from scandal and dangerous for jealousy, and
 * until this existed that tension was all cost.
 *
 * Paired with no jealousy at all from a shared activity. Nobody is being
 * singled out, which is the whole point, and charging for it would put the cost
 * straight back.
 */
export const SHARED_ACTIVITY_INTIMACY = 2;

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
