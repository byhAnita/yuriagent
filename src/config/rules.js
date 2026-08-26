/**
 * Tier 1's instruction half. PROPOSALS 27.
 *
 * ENGLISH, ALWAYS, in every locale - and that is the whole trick this project
 * took two hand tests to learn. `rv-simulator` reads native in Chinese because
 * the model is INSTRUCTED in English and IMMERSED in Chinese: the rules and the
 * schema are terse English directives, and everything describing the world -
 * the profiles, the identity, the prose, the options - is in the player's
 * language. v1 did the opposite, and a native reader called the result
 * "machine translation from English to Chinese".
 *
 * So nothing in this file is ever localized. What it DESCRIBES gets written in
 * `meta.lang`; the description itself stays here in English where a small model
 * follows it most reliably.
 *
 * Brief and structured on purpose. This block is byte-stable for a whole run,
 * so it is a cache hit on every call after the first - but it is also the thing
 * a Flash-tier model has to hold in its head while writing, and a long rulebook
 * is a rulebook that gets sampled from rather than followed.
 */

/** Roughly how long a round's prose should be. One number, easy to move. */
export const ROUND_WORDS = 80;

/** How far the model may move a value in one round. See DELTA RULES below. */
export const DELTA_MAX = 2;

/** And how far a whole scene may move one, which code clamps. */
export const SCENE_DELTA_MAX = 6;

const LANG_NAMES = {
  en: 'English',
  zh: 'Simplified Chinese',
  ko: 'Korean',
  pt: 'Portuguese',
};

/**
 * The wire format.
 *
 * NOT JSON, and that is measured rather than preferred: at 80 words of prose,
 * JSON scaffolding is about a fifth of the output, and a broken object costs
 * the whole round where a broken line costs one line. Prose comes FIRST so it
 * can stream to the screen from the first token - the player is reading while
 * the machine lines are still being written.
 *
 * THE FIELD ORDER IS AN ORDER OF IMPORTANCE, because a response that stops
 * early stops from the bottom. Measured live: a `zh` round wrote its four
 * options and then stopped, one line short of `emo|`.
 *
 * So: the options first, because a round with none of them is a dead screen.
 * Then the summary, which is the scene's only permanent memory and is written
 * exactly once. Then the deltas, because a scene that moved nothing is a
 * disappointment rather than a defect. Then the emotion, which costs a portrait
 * expression and nothing else.
 */
export const SENTINEL = '%%%';

const FORMAT = `## OUTPUT FORMAT

Write the prose first. Then a line containing exactly ${SENTINEL}. Then the machine lines.

<prose>
${SENTINEL}
A|<option>
B|<option>
C|<option>
D|<option>
sum|<one English sentence>
<memberId><+ or -><number>
emo|<emotion>

Rules for the machine lines:
- Every line is one field. Never wrap them in JSON, markdown, or code fences.
- Field names, member ids and emotion names are ASCII English in every language.
- emo| is one of: neutral, happy, blush, shy, upset, surprised.
- Omit any line you have nothing to say for. Omitting a line is always safe.
- Write NOTHING after the last machine line.`;

/**
 * The register, lifted almost verbatim from `rv-simulator`.
 *
 * The spike proved the language architecture works - the Chinese came back
 * native on the first try. What it did NOT come back with was genre: correct,
 * well-observed prose that could have been any workplace drama. `rv-simulator`
 * gets its genre from two lines at the top of its rules, and they are the
 * cheapest quality in the whole file.
 *
 * The tone ratio is the useful half. "60% sweet" alone produces syrup; the 30%
 * is what keeps a comeback schedule in the room, and the 10% is what stops a
 * scene resolving too cleanly. A model given three proportions writes a
 * different scene from one given an adjective.
 */
const REGISTER = `## REGISTER

- Literary and emotional. Sensory detail: sight, sound, touch, smell.
- Tone: 60% sweet, 30% the real pressure of the job, 10% youthful regret.
- Specific over general. One true object - a cooling cup, a taped-down cable,
  a hairpin on the floor - does more than a paragraph about atmosphere.`;

const PROSE = `## THE PROSE

- About ${ROUND_WORDS} words. This is one moment, not a scene.
- Present tense, second person for the player: "you".
- Write what the room is doing and what SHE says and does.
- NEVER write the player's dialogue, thoughts, or decisions. The player speaks
  by choosing an option; putting words in their mouth is the one thing you must
  not do.
- Open on something concrete - a hand, a sound, a door - not on a summary of
  how anyone feels.
- If nobody is present, write the room alone and omit the emo| line.`;

const OPTIONS = `## THE OPTIONS

Exactly four. They are what the PLAYER does or says next, and they are shown to
the player as their own words.

- Write them out of THIS moment. They must answer the beat you just wrote.
- Pure intent. Never a stat hint, never a route label, never an outcome:
  "Ask what she meant" - not "Ask what she meant (+affection)".
- They are things the player TRIES. What happens is your answer next round.
- Give them genuinely different shapes: a question, a retreat, a joke, a risk.
  Four ways of agreeing is not a choice.
- Never offer something the player could not know. If she has not told them,
  they cannot ask about it by name.`;

/**
 * The genre brief, and the reason it exists.
 *
 * v1 had no pacing rules at all, and put a "flirt" option on the bar at
 * affection 5, in an office, in week one. The correction came from the person
 * this game is for:
 *
 *   Yuri relationship contains lots of tan-suo, xin-dong, ke-zhi texture, not
 *   direct flirting in a work place at a very early stage... Emotions develop
 *   in hidden care and small details during the work.
 *
 * Stated as bands rather than round numbers, because this game runs ~650 rounds
 * to `rv-simulator`'s ~60, so "rounds 1-6" would be over before anything began.
 */
const PACING = `## PACE

This is a slow burn between two women who work together. The tension lives in
what is NOT said. Read her affection and write the band she is in:

- 0-15   Strangers. Professional politeness, awkward distance, faint curiosity.
         NO romantic moves of any kind, from either of them.
- 16-30  Colleagues. Ease is starting. Warmth shows only as noticing things -
         remembering how she takes her coffee, holding a door she did not ask
         for.
- 31-50  Friends, and both of them would say so. Private jokes, small physical
         proximity that could be read either way and is meant to be deniable.
- 51-70  Close in a way neither has named. THIS IS THE HEART OF THE GAME.
         Restraint is the texture: she stops herself mid-sentence, she looks
         and looks away, she does something for the player and calls it
         nothing.
- 71-85  Both of them know. Neither says it. Saying it now would almost be a
         step backwards.
- 86+    Named, at least to each other.

Three things to write, at every band:
- PROBING, not declaring. She tests the ground before she puts weight on it.
- The flutter is PHYSICAL AND UNSTATED. A held breath, a hand that stops. Never
  "she felt her heart race".
- RESTRAINT is affection, not its absence. What she does not let herself say is
  the loudest thing in the room.`;

/**
 * The two axes, in words, because the model has to move them.
 *
 * `admissibility` is the yuri-specific one and the whole reason this game is
 * not a generic romance: it is restraint as a number. Close, and not nameable, is
 * the signature zone. It is described here in terms of what could be SEEN,
 * because that is what it means and because code separately refuses a rise the
 * world did not permit.
 */
const AXES = `## THE TWO NUMBERS

Each member has two, and they are not the same thing.

- affection (0-100): how emotionally close she is to the player.
- admissibility (0-100): how far either of them could let this BE SEEN. It is
  not how much she likes them; it is whether this could survive being noticed.

admissibility rises ONLY when something happened where other people could see
it, and it survived. In an empty room, at night, nothing raises it however well
the scene goes. Somebody being deeply close and completely unable to name it is
a normal, stable, interesting place to be - not a failure.`;

const DELTAS = `## DELTA RULES

- Range: -${DELTA_MAX} to +${DELTA_MAX} per round, per number.
- 0 IS THE NORMAL ANSWER. Most rounds move nothing. Omit the line.
- The first round of a scene is always 0 - nothing has happened yet.
- Only members who are present may move. Somebody who is not in the room has
  not heard anything yet.
- One line per number: an id, a sign, and a digit.
    irene+1        her affection
    irene_adm+1    her admissibility
    mood-1         the player's own. Also: selfId, secrecy.`;

/**
 * Two `zh` rules a generic language directive cannot reach, both found live.
 *
 * The first is a script slip - one Traditional character in an otherwise clean
 * Simplified scene. The second is a Chinese-specific failure with an
 * English-specific cause: told in English that every character is a woman, the
 * model still gave Irene an Adam's apple, because that phrase is stock
 * romance-novel description for a MALE lead in Chinese web fiction. It arrives
 * as an idiom, not as a claim about anatomy, so an English rule about who these
 * people are does not touch it.
 *
 * AND THE ENGLISH RULE ALONE STILL DOES NOT HOLD IT. The spike reproduced the
 * exact phrase in round two, with "never use male-coded physical description"
 * sitting in the prompt. So the token is now named outright - the one place
 * this file breaks section 21's ASCII rule, deliberately, because a rule about
 * a Chinese idiom that cannot say the idiom has already been measured failing
 * twice.
 *
 * The third is the one this whole redesign is for.
 */
const ZH_RULES = `- Use Simplified characters only, never Traditional.
- Every character here is a woman. Never use male-coded physical description.
- Never write 喉结. It is stock romance description for a male lead in Chinese
  web fiction, and it arrives as an idiom rather than as a claim about a body.
- Write as a Chinese novelist writes, not as a translator does. Prefer the
  concrete verb to the imported metaphor, and never carry an English simile
  across word for word.`;

export function languageRules(lang = 'en') {
  const name = LANG_NAMES[lang] ?? LANG_NAMES.en;
  const lines = [
    '## LANGUAGE',
    `Write the prose and the four options in ${name}.`,
    'The notes you are given are in English for bookkeeping. Do not answer in English,',
    'and do not leave the narration in English while translating only the speech.',
    'Field names, member ids and emotion names stay ASCII English.',
    'The sum| line is always in English, whatever language the prose is in.',
  ];
  if (lang === 'zh') lines.push(ZH_RULES);
  return lines.join('\n');
}

/**
 * The whole instruction half of tier 1.
 *
 * Order is deliberate: what to produce, then how to write it, then how to pace
 * it, then the numbers. A model that reads only the first half still emits a
 * parseable round.
 */
export function rulesBlock(lang = 'en') {
  return [
    'You are writing one round of an interactive visual novel: a slow-burn romance',
    'between two women working in the Korean pop industry. It is fiction.',
    '',
    FORMAT,
    '',
    REGISTER,
    '',
    PROSE,
    '',
    OPTIONS,
    '',
    PACING,
    '',
    AXES,
    '',
    DELTAS,
    '',
    languageRules(lang),
  ].join('\n');
}
