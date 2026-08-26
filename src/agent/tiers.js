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

import { rulesBlock } from '../config/rules.js';

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
  if (entries.length === 0) return '## HISTORY\n(nothing yet)';

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
  relations = {},
  player = {},
  dossier = {},
  locationLabel = '',
  activity = null,
  week = 0,
  dayName = '',
  block = '',
  phase = '',
  roundIndex = 0,
  roundsLeft = 0,
  lastChoice = null,
  lang = 'en',
}) {
  const nameOf = (id) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return id;
    return (lang !== 'en' && card.nameLocal?.[lang]) || card.name;
  };

  const lines = [
    '## NOW',
    `Week ${week + 1}, ${dayName}, ${block}. Company phase: ${phase}.`,
    `Location: ${locationLabel}.`,
  ];

  if (activity) lines.push(activity);

  if (present.length === 0) {
    lines.push('Nobody else is here.');
  } else {
    lines.push(`Present: ${present.map((id) => `${nameOf(id)} (${id})`).join(', ')}.`);
  }

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

  lines.push('', 'Write the next round now. Prose first.');

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
