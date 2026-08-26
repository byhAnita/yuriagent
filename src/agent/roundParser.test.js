/**
 * The round parser. PROPOSALS 27.
 *
 * The discipline under test is tolerance PER LINE. v1's parser could drop a
 * beat; this one may only ever drop a field, because the whole argument for a
 * line format over a JSON object is that a JSON object fails as a unit.
 */

import { describe, it, expect } from 'vitest';
import { parseRound, splitRound, createRoundStream, EMOTIONS } from './roundParser.js';
import { SENTINEL } from '../config/rules.js';

const round = (prose, machine) => `${prose}\n${SENTINEL}\n${machine}`;

const FULL = round(
  'She does not turn around. "You are early."',
  ['A|Say nothing', 'B|Ask about the run', 'C|Sit down', 'D|Leave', 'emo|shy', 'irene+2', 'mood-1', 'sum|Irene noticed you.'].join('\n'),
);

describe('the two halves', () => {
  it('splits on the sentinel and keeps the prose clean', () => {
    const out = parseRound(FULL);
    expect(out.prose).toBe('She does not turn around. "You are early."');
    expect(out.prose).not.toContain(SENTINEL);
    expect(out.options).toEqual(['Say nothing', 'Ask about the run', 'Sit down', 'Leave']);
    expect(out.emotion).toBe('shy');
    expect(out.deltas).toEqual({ irene: 2, mood: -1 });
    expect(out.summary).toBe('Irene noticed you.');
  });

  /**
   * A truncated response, or a model that forgot the sentinel. The right
   * failure is that the player reads her line and gets fallback options - not
   * that they read a screen of machine lines.
   */
  it('treats a response with no sentinel as all prose', () => {
    const out = parseRound('She looks up, and does not say anything.');
    expect(out.prose).toBe('She looks up, and does not say anything.');
    expect(out.options).toEqual([]);
  });

  /** Section 9 rule 6 survives: a machine line must never reach the player. */
  it('strips a field line that leaked above the sentinel', () => {
    const out = parseRound(round('She looks up.\nemo|shy\nStill nothing.', 'A|Wait'));
    expect(out.prose).toBe('She looks up.\nStill nothing.');
  });

  /**
   * ...but only the unambiguous ones. Prose is full of colons and full stops,
   * and eating a line of her dialogue to catch a leaked field is a far worse
   * trade than the one it would be making.
   */
  it('does not eat prose that merely contains punctuation', () => {
    const text = 'she said: it was nothing.\nAnd then. Nothing else.';
    expect(splitRound(text).prose).toBe(text);
  });
});

describe('tolerance is per line', () => {
  it('keeps the good options when one is malformed', () => {
    const out = parseRound(round('x', 'A|Stay\nB\nC|Go\nD|Wait'));
    expect(out.options).toEqual(['Stay', 'Go', 'Wait']);
  });

  it('keeps the round when the summary is missing', () => {
    const out = parseRound(round('x', 'A|Stay\nemo|happy'));
    expect(out.summary).toBeNull();
    expect(out.emotion).toBe('happy');
    expect(out.options).toEqual(['Stay']);
  });

  it('drops a delta that is not a number and keeps the rest', () => {
    const out = parseRound(round('x', 'irene+lots\nyeri-1'));
    expect(out.deltas).toEqual({ yeri: -1 });
  });

  it('falls back to neutral for an emotion it does not know', () => {
    expect(parseRound(round('x', 'emo|smouldering')).emotion).toBe('neutral');
    for (const e of EMOTIONS) expect(parseRound(round('x', `emo|${e}`)).emotion).toBe(e);
  });

  it('never returns the same option letter twice', () => {
    const out = parseRound(round('x', 'A|One\nB|Two\nB|Also two\nD|Four'));
    expect(out.options).toEqual(['One', 'Two', 'Four']);
  });

  /**
   * MEASURED LIVE: about one `zh` round in ten came back with the options
   * unparseable, and the cause was punctuation rather than structure. A model
   * writing Chinese reaches for the full-width pipe, or for the way an option
   * list is DISPLAYED - `A.` and `A、` - because that is what one looks like in
   * Chinese prose. The line is otherwise perfect, and losing four options to a
   * full-width character is the most avoidable loss there is.
   */
  it('accepts the separators a model writing Chinese actually produces', () => {
    for (const sep of ['|', '｜', '.', '．', '、', ':']) {
      const out = parseRound(round('x', `A${sep}One\nB${sep}Two`));
      expect(out.options, `separator ${JSON.stringify(sep)}`).toEqual(['One', 'Two']);
    }
  });

  it('caps an option that would break the layout', () => {
    const out = parseRound(round('x', `A|${'a'.repeat(400)}`));
    expect(out.options[0].length).toBeLessThanOrEqual(120);
  });
});

describe('canon', () => {
  it('takes a topic and a text', () => {
    const out = parseRound(round('x', 'canon|title_track|the title track is Surfin Summer'));
    expect(out.canon).toEqual([{ topic: 'title_track', text: 'the title track is Surfin Summer' }]);
  });

  it('drops a canon line with no text', () => {
    expect(parseRound(round('x', 'canon|title_track')).canon).toEqual([]);
  });
});

describe('streaming', () => {
  /**
   * The whole reason the format is not JSON: the player reads her line while
   * the options are still being written.
   */
  it('reveals prose as it arrives and stops at the sentinel', () => {
    const reader = createRoundStream();
    let shown = '';
    for (const chunk of ['She does ', 'not turn.', `\n${SENTINEL}\n`, 'A|Wait\n', 'emo|shy']) {
      shown += reader.push(chunk);
    }
    expect(shown.trim()).toBe('She does not turn.');
    expect(reader.result().options).toEqual(['Wait']);
    expect(reader.result().emotion).toBe('shy');
  });

  /**
   * The stream is raw and `result()` is cleaned, because a stream has half a
   * line rather than a line. The caller renders the cleaned prose once the
   * round completes; the flicker this allows was measured at zero rounds in
   * ten live.
   */
  it('streams raw, and cleans only at the end', () => {
    const reader = createRoundStream();
    let shown = '';
    for (const chunk of ['She looks up.\n', 'emo|shy\n', 'Nothing else.', `\n${SENTINEL}\nA|Wait`]) {
      shown += reader.push(chunk);
    }
    expect(shown).toContain('emo|shy');
    expect(reader.result().prose).toBe('She looks up.\nNothing else.');
  });

  /** A chunk boundary can land inside the sentinel, and half of one on screen
   *  is the single artefact a player would certainly notice. */
  it('never shows half a sentinel', () => {
    const reader = createRoundStream();
    let shown = '';
    for (const chunk of ['Done.', '\n%', '%', '%\n', 'A|Go']) shown += reader.push(chunk);
    expect(shown).not.toContain('%');
    expect(shown.trim()).toBe('Done.');
    expect(reader.result().options).toEqual(['Go']);
  });

  /**
   * The tail hold-back means the last couple of characters arrive only once
   * something follows them - so a caller must render `result().prose` at the
   * end rather than trusting the stream to have delivered every character.
   */
  it('gives the whole round back even when the sentinel never comes', () => {
    const reader = createRoundStream();
    for (const chunk of ['She ', 'says ', 'nothing.']) reader.push(chunk);
    expect(reader.result().prose).toBe('She says nothing.');
  });
});

/**
 * The missing percent sign. Found live, in `zh`, at about one round in six.
 *
 * `%%` instead of `%%%`, on a line of its own, with a perfect machine half
 * underneath - and it used to cost the whole round in the worst possible way.
 * With no sentinel found the response is all prose, and `cleanProse` then
 * deletes exactly the lines that should have been parsed: the player got a good
 * paragraph, no options, no emotion, no movement, and no way to tell why.
 *
 * Ruled out as a client bug first. Teeing the raw SSE bytes showed `stream()`
 * reassembling them byte-perfect, so the model really did write two.
 */
describe('a sentinel the model got slightly wrong', () => {
  const machine = ['A|first', 'B|second', 'C|third', 'D|fourth', 'sum|It happened.', 'irene+1', 'emo|shy'].join('\n');

  it.each(['%%', '%%%%', '％％％', ' %% '])('accepts %j on a line of its own', (mark) => {
    const round = parseRound(`She looks up.\n${mark}\n${machine}`);
    expect(round.prose).toBe('She looks up.');
    expect(round.options).toEqual(['first', 'second', 'third', 'fourth']);
    expect(round.emotion).toBe('shy');
    expect(round.deltas).toEqual({ irene: 1 });
    expect(round.summary).toBe('It happened.');
  });

  /** The one-in-ten case: no sentinel at all. The option block is the boundary. */
  it('falls back to the option block when there is no sentinel', () => {
    const round = parseRound(`She looks up.\n\n${machine}`);
    expect(round.prose).toBe('She looks up.');
    expect(round.options).toEqual(['first', 'second', 'third', 'fourth']);
    expect(round.emotion).toBe('shy');
  });

  /** ...and a percent sign inside a sentence is a percent sign. */
  it('does not cut prose on a percent that is part of a line', () => {
    const round = parseRound(`She says the mix is 50% there.\n%%%\n${machine}`);
    expect(round.prose).toBe('She says the mix is 50% there.');
    expect(round.options).toHaveLength(4);
  });

  it('leaves a round with no machine half alone', () => {
    const round = parseRound('She does not answer straight away.');
    expect(round.prose).toBe('She does not answer straight away.');
    expect(round.options).toEqual([]);
  });

  /**
   * The stream has to close on it too. Otherwise the player watches four
   * options and an emo line scroll onto the screen and then vanish, one round
   * in six - which is worse than the bug it replaced, because it is visible.
   */
  it('closes the stream on a degraded sentinel', () => {
    const reader = createRoundStream();
    let shown = '';
    for (const chunk of ['She looks ', 'up.\n%', '%\nA|first\nB|second\n', 'emo|shy']) {
      shown += reader.push(chunk);
    }
    expect(shown).not.toContain('A|first');
    expect(shown).not.toContain('%');
    expect(reader.result().options).toEqual(['first', 'second']);
  });

  it('still closes on the exact sentinel split across chunks', () => {
    const reader = createRoundStream();
    let shown = '';
    for (const chunk of ['She looks up.\n%', '%', '%\nA|first\n', 'emo|shy']) {
      shown += reader.push(chunk);
    }
    expect(shown.trim()).toBe('She looks up.');
    expect(reader.result().emotion).toBe('shy');
  });
});

/**
 * THE PROSE ECHOING THE OPTIONS. Found by the live harness, not by reading.
 *
 * Tier 2 renders the player's line as `> what they said`, and a five-member `zh`
 * scene imitated it: four `> "..."` lines at the foot of the prose, then the
 * same four options again after the sentinel. The player saw every option twice,
 * once as narration.
 *
 * Fixed in the parser rather than in the rules, because the contract here is
 * liberal inward and conservative outward - "a stray machine line must never
 * reach the player" does not care which machine line it was.
 */
describe('an echoed option block never reaches the player', () => {
  const echoed = [
    'She looks up from the mirror.',
    '> "So you remembered."',
    '> "I did not think you would."',
    SENTINEL,
    'A|Say you remembered',
    'B|Say nothing',
    'C|Ask about the run-through',
    'D|Leave it',
    'emo|neutral',
  ].join('\n');

  it('strips the quoted echo and keeps the narration', () => {
    const round = parseRound(echoed);
    expect(round.prose).toBe('She looks up from the mirror.');
    expect(round.prose).not.toContain('So you remembered');
    expect(round.options).toHaveLength(4);
  });

  /**
   * Only at the START of a line, and only with a space after it. A `>` inside a
   * sentence is arithmetic or an arrow, and eating a line of her dialogue to
   * catch a leaked field is the trade this parser exists to refuse.
   */
  it('leaves a > inside a sentence alone', () => {
    const round = parseRound(['The counter reads 3 > 2 on the monitor.', SENTINEL, 'A|ok'].join('\n'));
    expect(round.prose).toContain('3 > 2');
  });

  it('leaves prose that merely starts with an angle bracket glyph alone', () => {
    const round = parseRound(['>>> the cue light', SENTINEL, 'A|ok'].join('\n'));
    expect(round.prose).toContain('>>> the cue light');
  });
});
