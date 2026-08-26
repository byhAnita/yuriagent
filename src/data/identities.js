/**
 * Who the player is. CLAUDE.md section 13.
 *
 * MVP ships `assistant` and nothing else. The other three are here as DATA
 * rather than as a comment because section 2 requires every v2 feature to have
 * its interface stubbed now: adding an identity later has to be content, not a
 * refactor. So the picker is real, it reads this table, and it renders three
 * rows it will not let you choose.
 *
 * Two things this table deliberately does NOT carry:
 *
 * - a display name. Section 21 puts every player-facing string through i18n,
 *   and an identity is not a portable file the way a character card is, so
 *   there is no reason to duplicate the mechanism. Labels are `identity.<id>`.
 * - a list of location ids. The old inline one named `backstage`, `van` and
 *   `cafeteria`, none of which have ever existed - dead data survives because
 *   nothing reads it. An identity names ROLE SLOTS, resolved per phase, for
 *   the same reason tasks and activities do (section 10).
 */

/**
 * @typedef {object} Identity
 * @property {string} id
 * @property {boolean} available   - false means the picker shows it, disabled
 * @property {string} promptRole   - one clause, model-facing English fallback
 * @property {object} [prompt]     - per-locale paragraph the model actually reads
 * @property {string[]} slots      - role slots this identity has business in
 * @property {string[]} taskPool   - keys into systems/tasks.js TASKS
 * @property {object} startStats   - competence / energy / secrecy / credits
 * @property {object} exposureModifier - per LOCATION id; see the note below
 */

/**
 * `exposureModifier` stays keyed by location id rather than by slot.
 *
 * It is the one place where naming the instance is right: the assistant's
 * advantage in the wardrobe is that it is a fitting room she is used to seeing
 * staff in, and that does not transfer to the recording studio just because
 * both are workroom B. `sceneExposure` looks it up by location id, so an entry
 * that names a room absent from the current phase map simply does not apply -
 * which is the correct behaviour, not a hole.
 */

/** @type {Record<string, Identity>} */
export const IDENTITIES = {
  assistant: {
    id: 'assistant',
    available: true,
    promptRole: 'an artist assistant of X Entertainment',
    /**
     * The identity as the MODEL reads it, in the player's language.
     *
     * `promptRole` is one clause and it was never enough: a model told only
     * "an artist assistant" invents the job, so every scene opened with the
     * same vague hovering. `rv-simulator` gives its identities a paragraph -
     * what the job is, three typical days, and what it costs - and that
     * paragraph is most of why its scenes have specific things happening in
     * them.
     *
     * The last clause is the important one for this game. *Any ambiguity could
     * be read as misconduct* is the `admissibility` axis stated as a fact
     * about the workplace rather than as a number, and it is the reason
     * restraint here is professional as well as personal.
     *
     * Locale, like the character profiles - the model is instructed in English
     * and immersed in the player's language (PROPOSALS 27).
     */
    prompt: {
      en: "You are X's new staff member - assistant and road manager. You run the group's music show schedules, coordinate hair and make-up, and look after them backstage. Typical days: bringing milk tea for the whole team on a practice room visit and catching one of them off guard with it; driving somebody back to the dorm late after a schedule, and being there for the version of her that only comes out in a car at 2am; checking on her backstage at a music show and making sure she actually eats. Your advantage is access to who they are with the cameras off. Your disadvantage is that the workplace boundary is explicit, and anything ambiguous could be read as misconduct.",
      zh: "你是 X 新任的 Staff（助理兼经纪），负责组合的打歌行程、妆发协调，以及在后台照顾她们。典型的一天：去练习室探班，给全组带奶茶，她们有点意外，也有点受宠若惊；深夜行程结束后开车送她回宿舍，接住她只有在凌晨两点的车里才会露出来的那一面；打歌后台看一眼她的状态，盯着她把饭吃完。优势：你能接触到镜头关掉之后的她们。劣势：职场边界写得很清楚，任何暧昧都可能被认定为失职。",
    },
    slots: ['workroom_a', 'workroom_b', 'solo_site', 'social', 'venue'],
    taskPool: [
      'prep_outfits',
      'run_schedule',
      'handle_press_kit',
      'stage_check',
      'restock_wardrobe',
    ],
    startStats: { competence: 20, energy: 90, secrecy: 70, credits: 6 },
    exposureModifier: { wardrobe: -10, cafe: 10 },
  },

  manager: {
    id: 'manager',
    available: false,
    promptRole: 'the group manager of X Entertainment',
    slots: ['workroom_a', 'workroom_b', 'solo_site', 'social', 'venue', 'event_a'],
    taskPool: ['run_schedule', 'handle_press_kit', 'stage_check'],
    startStats: { competence: 45, energy: 80, secrecy: 55, credits: 14 },
    exposureModifier: { broadcast_studio: -10, cafe: 15 },
  },

  producer: {
    id: 'producer',
    available: false,
    promptRole: 'a producer of X Entertainment',
    slots: ['workroom_a', 'workroom_b', 'social'],
    taskPool: ['stage_check', 'run_schedule'],
    startStats: { competence: 55, energy: 75, secrecy: 60, credits: 20 },
    exposureModifier: { practice_room: -10 },
  },

  idol: {
    id: 'idol',
    available: false,
    promptRole: 'the sixth member of X, under X Entertainment',
    slots: ['workroom_a', 'workroom_b', 'solo_site', 'social', 'venue'],
    taskPool: ['stage_check', 'prep_outfits'],
    startStats: { competence: 30, energy: 70, secrecy: 35, credits: 8 },
    exposureModifier: { broadcast_studio: 20, dorm_living: -5 },
  },
};

export const DEFAULT_IDENTITY = 'assistant';

export const IDENTITY_IDS = Object.keys(IDENTITIES);

/** Ids the player may actually start a run as. */
export function playableIdentities() {
  return IDENTITY_IDS.filter((id) => IDENTITIES[id].available);
}

/**
 * Never throws and never returns something unplayable.
 *
 * This runs off a stored preference and off the start screen's own state, and
 * a bad id there should drop the player into the assistant rather than into a
 * blank screen.
 */
export function getIdentity(id = DEFAULT_IDENTITY) {
  const found = IDENTITIES[id];
  return found?.available ? found : IDENTITIES[DEFAULT_IDENTITY];
}
