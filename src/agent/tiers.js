/**
 * Prompt assembly, in three tiers. PROPOSALS 27.
 *
 * Replaces v1's five-block `promptBuilder.js`. The names come from
 * `rv-simulator`, which frees the word "block" for the clock, and the split is
 * chosen for one property:
 *
 *   TIER 1  static   rules, profiles, identity   100% cache hit after round 1
 *   TIER 2  ledger   append-only history         hit except on a collapse
 *   TIER 3  tail     values, place, time         always a miss, kept small
 *
 * THE RULE THAT MAKES IT WORK: nothing volatile may appear above tier 3.
 * Affection, mood, who is in the room, what time it is - all of it lives in the
 * tail and nowhere else. Put one live number in tier 1 or 2 and every round
 * after it is a full miss, which is how a 96%-cache design becomes a 30% one
 * without anybody noticing.
 *
 * AND THE LANGUAGE SPLIT, which is the thing v1 got backwards. The model is
 * INSTRUCTED in English (`config/rules.js`) and IMMERSED in the player's
 * language: profiles, identity, the ledger's recent full text, the prose and
 * the options are all `meta.lang`. Only the rules and the one-sentence
 * summaries stay English. v1 wrote everything but the prose in English and a
 * native reader called the result machine translation.
 */

import { rulesBlock, SENTINEL } from '../config/rules.js';

/**
 * Her card as the model reads it, in the player's language.
 *
 * `profileLocal[lang]` is the authored version and is preferred wholesale; the
 * English card fields are the fallback, which is what a custom card written
 * offline in one language gets. Falling back per FIELD rather than per card is
 * deliberate - a card that has a Chinese personality and no Chinese speech
 * style should still use the Chinese personality.
 *
 * `origin` is never included. In fiction there is no Red Velvet; there is X.
 */
export function renderProfile(card, lang = 'en', roles = []) {
  const local = card.profileLocal?.[lang] ?? {};
  const pick = (key) => local[key] ?? card[key] ?? '';

  const name = (lang !== 'en' && card.nameLocal?.[lang]) || card.name;
  const lines = [
    `${name} (id: ${card.id})${roles.length ? ` - ${roles.join(', ')}` : ''}`,
    pick('publicImage'),
    pick('personality'),
    pick('speechStyle'),
    pick('queerTexture'),
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * Tier 1. Byte-stable for the whole run.
 *
 * Every romanceable member is in here, not just the ones in the room - the
 * roster changes constantly and tier 1 may not. Who is actually present is a
 * tail fact.
 */
export function buildTier1({ cards = [], lineup = {}, identity, playerName = '', lang = 'en' }) {
  const who = String(playerName ?? '').replace(/[\n\r|]/g, ' ').trim() || 'the player';

  return [
    rulesBlock(lang),
    '',
    '## THE WORLD',
    'The five women below are the girl group X, under X Entertainment. They share a dorm.',
    'Every character in this story is a woman, including the player.',
    '',
    `## THE PLAYER`,
    `${who} - ${identity?.promptRole ?? 'an artist assistant'} at the agency.`,
    /**
     * The identity paragraph, in the player's language.
     *
     * One clause was never enough: a model told only "an artist assistant"
     * invents the job, and every scene opens with the same vague hovering. The
     * paragraph gives it three typical days to draw on, and - the part that
     * matters here - what the job costs.
     */
    identity?.prompt?.[lang] ?? identity?.prompt?.en ?? '',
    'Refer to the player as "you" in narration. Members may use her name when they speak.',
    '',
    '## THE MEMBERS',
    cards.map((c) => renderProfile(c, lang, lineup[c.id] ?? [])).join('\n\n'),
  ].join('\n');
}

/**
 * Tier 2. Append-only, and that is the whole of its job.
 *
 * `entries` are the stepped window: older ones collapsed to a one-sentence
 * English summary, the newest few kept as full text in the player's language.
 * They are never reordered and never rewritten, so the token prefix stays
 * byte-identical from one round to the next.
 */
export function buildTier2(entries = []) {
  /**
   * The empty pool is the HEADER ALONE, not a placeholder sentence.
   *
   * A `(nothing yet)` line reads well and is the one thing in this file that
   * cannot be here: it makes the first round's tier 2 something the second
   * round's is NOT a continuation of, so the very first append is a full miss
   * instead of the cheapest one in the run. The tail already says it is the
   * first round of the scene, so nothing is lost by saying nothing.
   */
  const lines = ['## HISTORY'];
  for (const e of entries) {
    if (e.type === 'summary') {
      lines.push(`S${e.id}: ${e.summary}`);
    } else {
      lines.push('', `=== ${e.id} ===`, e.text, e.choice ? `> ${e.choice}` : '');
    }
  }
  return lines.filter((l) => l !== undefined).join('\n');
}

/**
 * Weekday names for the PROMPT, and therefore English in every locale (section
 * 19). `i18n/` has the player's version and the two never meet: `agent/` does
 * not import `i18n/`, because one is a UI string and the other is an
 * instruction. Day 0 is Monday, matching `systems/calendar.js`.
 */
const PROMPT_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * Tier 3. Always a cache miss, so it stays short.
 *
 * Everything here changes: where, when, who, and what every number currently
 * is. The place and the time are in it because the model has to know what room
 * it is writing - v1 carried this and it is what let one practice room open
 * three different ways under three different activities, for about forty
 * tokens in a block that was being rebuilt anyway.
 */
export function buildTier3({
  cards = [],
  present = [],
  /**
   * Who may SPEAK, which is not who is in the room. In a 1v1 the roster is one
   * and everybody else present is a witness (section 5b). Defaults to `present`
   * so an ad-hoc caller gets the old behaviour rather than a silent room.
   */
  roster = present,
  /** `{ primary, second }` from `systems/floor.js`. Null outside a scene. */
  speaking = null,
  relations = {},
  player = {},
  dossier = {},
  locationLabel = '',
  activity = null,
  week = 0,
  day = 0,
  block = '',
  phase = '',
  roundIndex = 0,
  roundsLeft = 0,
  lastChoice = null,
  /** The player let the round pass rather than answering. Not the same as null. */
  skipped = false,
  /**
   * What the player still owes the agency today, or null. Model-facing English,
   * composed by `systems/tasks.js` - see `chorePhrase`.
   */
  owed = null,
  /**
   * WHAT TODAY IS, for the three kinds of scene that are a whole day rather
   * than a block: an anchor event, a date, or a shared dorm evening.
   * Model-facing English, already rendered by `data/sceneFrames.js`, or null
   * for the ordinary case - which is most of them.
   */
  frame = null,
  /**
   * The work happening, on the one round of a physical event that gets it.
   * `roundEngine` decides which round; `data/events/index.js` writes the line.
   */
  work = null,
  /**
   * What the campaign has settled, rendered by `systems/canon.js`. An ordinary
   * scene carries the current cycle; an event carries the topics it reads.
   */
  canon = null,
  note = null,
  lang = 'en',
}) {
  const nameOf = (id) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return id;
    return (lang !== 'en' && card.nameLocal?.[lang]) || card.name;
  };

  const lines = [
    '## NOW',
    `Week ${week + 1}, ${PROMPT_DAYS[day] ?? PROMPT_DAYS[0]}, ${block}. Company phase: ${phase}.`,
    `Location: ${locationLabel}.`,
  ];

  if (activity) lines.push(activity);

  if (present.length === 0) {
    lines.push('Nobody else is here.');
  } else {
    lines.push(`Present: ${present.map((id) => `${nameOf(id)} (${id})`).join(', ')}.`);

    /**
     * ...AND WHO IS NOT, WHICH IS THE HALF THAT WAS MISSING.
     *
     * Reported from play: a bistro scene with Nana and Yeri in it opened on
     * Irene's line and by the third round Irene had walked in with coffee. She
     * was two locations away.
     *
     * Not a model failure - a missing premise, the third instance in this file's
     * history. Tier 2 carries the previous scene's prose in the player's
     * language, that scene was entirely about Irene, and nothing anywhere said
     * she is not here. The model continued the only thread it could see.
     *
     * v1's block 4 named absent members as absent and this is that line coming
     * back. It is the cheapest of section 9's three separation layers and the
     * only one v2 kept none of - the parser's roster rule cannot help, because
     * there are no per-beat speaker ids to check against any more.
     */
    const away = cards.map((c) => c.id).filter((id) => !present.includes(id));
    if (away.length > 0) {
      lines.push(`Not here, and cannot appear: ${away.map(nameOf).join(', ')}.`);
    }

    /**
     * WHO HAS THE FLOOR. `systems/floor.js` decides; this states it.
     *
     * Without it the model wrote every member in the room every round, so a
     * five-member scene ran five paragraphs - and having written everybody, it
     * aimed all four options at whoever the player had answered last. Both
     * halves of that report are the same missing sentence.
     *
     * The second voice is named as an interruption rather than as a turn,
     * because that is what makes it read as a room rather than a queue - and it
     * costs nothing, where v1 spent a whole extra call per round on it.
     */
    if (speaking?.primary) {
      const who = `${nameOf(speaking.primary)} (${speaking.primary})`;

      /**
       * ONE VOICE, AND THE POSTURE IS WHAT MAKES IT A ROOM.
       *
       * `mode` costs six tokens and is the difference between a queue and a
       * conversation: she is answering the player, she is carrying on because
       * nobody stopped her, or she has taken the floor off somebody else. v1
       * spent a whole extra call per round on that last one.
       */
      const posture =
        speaking.mode === 'continues'
          ? `${who} still has the floor. Nobody answered her, so she carries on - a second thought, or the thing she did not say first time.`
          : speaking.mode === 'cuts_in'
            ? `${who} takes the floor, unasked. She is cutting in on what was going on - answer it or ignore it, but she does not wait to be invited.`
            : `${who} has the player's attention. She answers.`;

      lines.push('', '## WHO SPEAKS', posture, 'Write HER and nobody else. One voice this round.');

      /**
       * NAME HER, BECAUSE THE SUBJECT JUST CHANGED.
       *
       * Found by the live harness rather than by reading: a round handed the
       * floor to somebody new and came back written entirely in the third
       * person - 她 did this, 她 said that - which is what good prose does for
       * a subject already established, and exactly wrong on the round it stops
       * being the same subject. The player had no way to tell who was talking.
       *
       * Only on a change. Telling the model to name her every round would
       * produce a paragraph that says her name three times, which is worse
       * writing than the problem.
       */
      if (speaking.changed) {
        lines.push('Name her in the first sentence - the player cannot see who took the floor.');
      }

      const silent = roster.filter((id) => id !== speaking.primary);
      if (silent.length > 0) {
        lines.push(`Nobody else speaks this round: ${silent.map(nameOf).join(', ')}.`);
      }
      /**
       * A witness is in the room and has no lines (section 5b). Said outright
       * because "present" and "may speak" are different lists and the model has
       * no way to tell them apart - which is what put Nana into a scene the
       * player opened one-to-one with Yeri.
       */
      const watching = present.filter((id) => !roster.includes(id));
      if (watching.length > 0) {
        const who = watching.map(nameOf).join(', ');
        lines.push(
          watching.length === 1
            ? `${who} is in the room and does not speak - the player is not here for her.`
            : `${who} are in the room and do not speak - the player is not here for them.`,
        );
      }
    }
  }

  /**
   * THE DAY, WHEN THERE IS ONE. Part I; sections 10 and 11.
   *
   * Three separate places computed a frame and handed it over, and nothing read
   * any of them: `onShared` set `sceneFrame`, `askOut` set `date`, `onEnter` set
   * `event` - while `renderFrame`, `dateFrame` and `eventFrame` were imported by
   * nobody at all. Three more instances of this project's signature defect, and
   * the first ones found by reading the source rather than by playing.
   *
   * What it buys is the thing a whole-day scene has no other way to get. An
   * ordinary block is a room the model can see from `activity` alone; a date is
   * a whole afternoon with nothing to aim at, and section 10 measured what that
   * produces - a concept meeting that settled nothing and spent its one ledger
   * line on a plate of food. The setting gives the day somewhere to open, the
   * movements give it somewhere to go, and the agenda names what it is not
   * allowed to leave without.
   *
   * IT IS PAID EVERY ROUND, which is the honest cost of tier 3 being where
   * volatile things live. v1 froze this in block 4 and paid it once a scene;
   * here it is a couple of hundred tokens of miss on every round of a framed
   * scene. It cannot move up: tier 2 is append-only for the whole RUN, so a
   * per-scene string at its head would invalidate the entire ledger prefix at
   * every door - which is a far worse trade than paying for the frame. Framed
   * scenes are the minority, and this is the tier that is allowed to change.
   */
  if (frame) lines.push('', '## THE DAY', frame);

  /**
   * ...and on one round of a day that DOES something, the work itself.
   *
   * Passed only on the round `roundEngine` picks, because only the engine can
   * see the budget - the same argument that put v1's closing directive there.
   * Every round would be worse than none: a scene where something is always
   * being reset is a scene where nothing is.
   */
  if (work) lines.push('', work);

  lines.push('', '## VALUES');
  for (const id of present) {
    const rel = relations[id];
    if (!rel) continue;
    lines.push(`${id}: affection ${Math.round(rel.affection)}, admissibility ${Math.round(rel.admissibility)}`);
  }
  lines.push(
    `player: selfId ${Math.round(player.selfId ?? 0)}, mood ${Math.round(player.mood ?? 50)}, secrecy ${Math.round(player.secrecy ?? 70)}`,
  );

  /**
   * Only present members' facts, which is the cheapest defence there is
   * against writing somebody who is not in the room. An absent member's
   * dossier is simply not in the prompt.
   */
  const known = [];
  for (const id of present) {
    const d = dossier[id];
    if (!d) continue;
    const facts = (d.facts ?? []).map((f) => (typeof f === 'string' ? f : f.text));
    const told = (d.told_her ?? []).map((f) => (typeof f === 'string' ? f : f.text));
    const heard = (d.heard_about ?? []).map((f) => (typeof f === 'string' ? f : f.text));
    if (facts.length) known.push(`${id} - the player knows: ${facts.join('; ')}`);
    if (told.length) known.push(`${id} - she knows about the player: ${told.join('; ')}`);
    if (heard.length) known.push(`${id} - she has heard: ${heard.join('; ')}`);
  }
  if (known.length) lines.push('', '## WHAT IS KNOWN', ...known);

  /**
   * WHAT THE CAMPAIGN HAS SETTLED. Section 7.
   *
   * `systems/canon.js` has been complete and tested since M5 - written by the
   * event's exit call, shown in the handbook, persisted at schemaVersion 3 - and
   * the one thing it exists for never happened: nothing ever put it in a prompt.
   * So the group chose a title track, the player could read about it in a menu,
   * and no member ever mentioned it again. That is precisely the failure pillar
   * 4 forbids - memory that shows in plumbing rather than in mechanics.
   *
   * Two or three lines of the current cycle on an ordinary block is the half
   * that makes it visible: Irene bringing up the comeback in a wardrobe on a
   * Tuesday costs nothing a framed scene was not already paying. An event gets
   * the topics its `reads` field names, which is what lets a second concept
   * meeting escalate instead of starting from nothing.
   *
   * Capped and superseded upstream (`canonForCycle`), so this renders what it is
   * handed and never decides what fits.
   */
  if (canon) lines.push('', '## WHAT THE CAMPAIGN HAS SETTLED', canon);

  /**
   * WHY THIS SCENE IS NOT THE LAST ONE, second half.
   *
   * `activity` above says what she is doing here; this says what the PLAYER is
   * supposed to be doing instead of standing in the room talking to her. Both
   * existed in state for six milestones and neither reached the model, so the
   * same wardrobe on a Tuesday in week 1 and in week 7 opened identically.
   *
   * It matters more than it looks after Part I.8. `failTask` no longer writes a
   * per-member number when a missed job lands on somebody, so this line is the
   * ONLY way a member can know the outfits are not ready - and her saying so, in
   * her own words, in the room, is a better consequence than the eight strain it
   * replaces. Forty tokens in a block that is rebuilt every round anyway.
   */
  if (owed) lines.push('', owed);

  lines.push(
    '',
    '## THIS ROUND',
    roundIndex === 0
      ? 'This is the first round of the scene. Move no numbers.'
      : `Round ${roundIndex + 1} of this scene, ${roundsLeft} left.`,
  );
  if (roundsLeft === 0 && roundIndex > 0) {
    lines.push('This is the LAST round. Land the scene, and write the sum| line.');
  }
  if (lastChoice) lines.push('', `The player chose: ${lastChoice}`);

  /**
   * THE PLAYER SAID NOTHING, ON PURPOSE.
   *
   * Stated rather than left as an absent line, because an absent line is
   * ambiguous - the model cannot tell "the player did not speak" from "the
   * player's move was not recorded", and it will write around the gap by having
   * her ask a question into it. Section 10c's `pass` is the same move: letting
   * the room breathe is a choice, and it should read as one.
   */
  if (skipped) {
    lines.push(
      '',
      'The player says nothing and lets the room carry it. They are still here, still listening - this is attention, not absence. Do not have anyone ask whether they are alright.',
    );
  }

  /**
   * A note is something the player DID that no option covers: handing her a
   * coffee, bringing up a thing she once let slip. It goes last, because it is
   * the most immediate thing in the room and because tier 3 is ordered by
   * immediacy - the same rule v1's block 4 followed for the gift note.
   */
  if (note) lines.push('', note);

  /**
   * THE FORMAT, SAID AGAIN, AT THE TAIL.
   *
   * It is already in tier 1 - and tier 1 is roughly two thousand tokens above
   * the generation, which is exactly the distance section 8 measured flattening
   * two adjacent cards onto each other. Measured here on a live `zh` scene: one
   * round in four came back as four paragraphs of very good prose and NO machine
   * block at all, and the round after it wrote the options and stopped before
   * `emo|`. The model was not disobeying the contract; it had stopped being able
   * to see it.
   *
   * Twelve tokens, in a block that is rebuilt every round anyway, so it is free
   * in cache terms - the same trade that put `speechStyle` in v1's block 4.
   */
  lines.push(
    '',
    `Write the next round now: the prose, then a line of exactly ${SENTINEL}, then the machine lines.`,
    'The four options are not optional. Never stop before them.',
  );

  return lines.join('\n');
}

/** The three messages, in order. */
export function buildMessages({ tier1, tier2, tier3 }) {
  return [
    { role: 'system', content: tier1 },
    { role: 'user', content: tier2 },
    { role: 'user', content: tier3 },
  ];
}
