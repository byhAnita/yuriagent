/**
 * The offline writer's Chinese, and all that is left of it.
 *
 * Section 3 makes playing without an API key a supported mode, and section 19
 * keeps the two locales strictly apart - so the mock needs a `zh` half or a
 * Chinese player gets English whenever a live call fails and falls through.
 *
 * v1 had seven tables here, one per thing the engine asked a model for: a beat
 * per stance, the player's side of a written chip, an opening beat per gift
 * tier, an establishing paragraph, a summary. v2 asks one question per round and
 * one more for `Read her`, so the rounds live in `mockRound.js` beside their
 * English counterparts and this is the only table with nowhere else to be.
 */

/** `Read her` - her unspoken thought, which is the only hidden state left. */
export const THOUGHTS_ZH = [
  '她在想，你有没有注意到她的手在抖。',
  '她在数这栋楼里还剩下几个人。',
  '她正在决定，此刻不要说出那句想说的话。',
  '她知道这看上去像什么，而她没有走开。',
];
