/**
 * Written chips. CLAUDE.md section 6.
 *
 * Every rule here exists because the alternative is worse than the plain stance
 * names it replaces: an unlockable stance, a chip that hands over her hidden
 * state, or a bar that goes empty waiting on a model.
 */

import { describe, it, expect } from 'vitest';
import {
  parseChips,
  backfill,
  buildChipDirective,
  chipMessages,
  writeChips,
  chipField,
  keepRisk,
  CHIP_FIELD_SIZE,
} from './chipWriter.js';
import { buildMessages } from './promptBuilder.js';
import { beginScene, runTurn, openingDirective } from './sceneEngine.js';
import { availableStances, STANCES, RISK_STANCES } from '../systems/chips.js';
import { newRelation } from '../systems/relationship.js';
import { makeRng } from '../systems/rng.js';
import { newMemory } from './memory.js';
import { createMockClient } from '../tools/mockClient.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { MAX_CHIP_LABEL } from '../config/constants.js';

const cards = getCast();
const castIds = cards.map((c) => c.id);
const rel = (over = {}) => ({ ...newRelation(40), ...over });

const setup = () => ({
  cards,
  lineup: buildLineup(cards),
  identity: { promptRole: 'an artist assistant' },
  player: { name: 'You', energy: 80, secrecy: 70, credits: 10 },
  lang: 'en',
  memory: newMemory(castIds),
  relations: Object.fromEntries(castIds.map((id) => [id, newRelation(40)])),
  scene: {
    id: 's1',
    rosterIds: ['irene'],
    focusId: 'irene',
    week: 0,
    day: 1,
    block: 'evening',
    phase: 'prep',
    locationId: 'practice_room',
    locationLabel: 'X Practice Room',
  },
});

describe('parsing is tolerant, validation is not', () => {
  const available = ['flirt', 'care', 'deflect'];

  it('reads the contract', () => {
    const out = parseChips(
      'flirt|You are enjoying this\ncare|I am not going anywhere\ndeflect|So. The schedule.',
      { available },
    );
    expect(out).toEqual([
      { stance: 'flirt', label: 'You are enjoying this' },
      { stance: 'care', label: 'I am not going anywhere' },
      { stance: 'deflect', label: 'So. The schedule.' },
    ]);
  });

  it('survives fences, bullets, numbering and stray quotes', () => {
    const out = parseChips(
      '```\n1. flirt | "You are enjoying this"\n- care|  I am not going anywhere  \n```',
      { available },
    );
    expect(out).toHaveLength(2);
    expect(out[0].label).toBe('You are enjoying this');
    expect(out[1].label).toBe('I am not going anywhere');
  });

  /**
   * The one rule that cannot be relaxed. chips.js decides what is legal; a
   * stance that is not already available is not a suggestion, it is a lock the
   * model is trying to open.
   */
  it('drops a stance that is not currently legal', () => {
    const locked = availableStances(rel({ intimacy: 20 }), {});
    expect(locked.available).not.toContain('touch');

    const out = parseChips('touch|Reach for her hand\nflirt|You are enjoying this', {
      available: locked.available,
    });
    expect(out.map((c) => c.stance)).toEqual(['flirt']);
  });

  /**
   * `seduce` is not in `STANCES` and never has been. The name matters: this
   * test used to say `flirt`, which was invented at the time and has since
   * become a real stance - so the assertion quietly stopped testing anything
   * the moment the vocabulary grew. Pick something the game will not adopt.
   */
  it('drops an invented stance', () => {
    expect(parseChips('seduce|Say something reckless', { available })).toEqual([]);
    expect(STANCES).not.toContain('seduce');
  });

  it('deduplicates stances', () => {
    const out = parseChips('flirt|One\nflirt|Two\ncare|Three', { available });
    expect(out.map((c) => c.stance)).toEqual(['flirt', 'care']);
  });

  it('drops a label that is prose rather than an option', () => {
    const long = 'x'.repeat(MAX_CHIP_LABEL + 1);
    expect(parseChips(`flirt|${long}`, { available })).toEqual([]);
  });

  it('drops an empty label', () => {
    expect(parseChips('flirt|   \ncare|Fine', { available })).toHaveLength(1);
  });

  it('ignores a line with no metadata at all', () => {
    expect(parseChips('Here are three options for you!', { available })).toEqual([]);
  });

  /**
   * The roster rule from section 9, mirrored. The player has not seen Wendy, so
   * a chip may not mention her - that would leak a rumor she never voiced.
   */
  it('drops a label naming someone who is not in the scene', () => {
    const out = parseChips('flirt|Ask about Wendy again\ncare|I am here', {
      available,
      absentNames: ['Wendy', 'Yeri'],
    });
    expect(out.map((c) => c.stance)).toEqual(['care']);
  });
});

describe('failure degrades chip by chip', () => {
  it('backfills a short result instead of discarding it', () => {
    const written = [{ stance: 'flirt', label: 'You are enjoying this' }];
    const out = backfill(written, ['care', 'deflect', 'joke']);

    expect(out).toHaveLength(3);
    expect(out[0]).toEqual(written[0]);
    expect(out.slice(1).every((c) => c.label === null)).toBe(true);
  });

  /**
   * The filler comes from what is already on the bar, so a partial swap moves
   * as few buttons as it can rather than dealing a fresh hand.
   */
  it('fills from the set already on screen', () => {
    const out = backfill([{ stance: 'flirt', label: 'Say that again' }], ['deflect', 'retreat']);
    expect(out.map((c) => c.stance)).toEqual(['flirt', 'deflect', 'retreat']);
  });

  it('never repeats a stance across written and backfilled', () => {
    const out = backfill(
      [{ stance: 'deflect', label: 'So. The schedule.' }],
      ['deflect', 'joke', 'retreat'],
    );
    expect(new Set(out.map((c) => c.stance)).size).toBe(out.length);
    expect(out).toHaveLength(3);
  });

  it('a totally unusable response leaves the static set standing', async () => {
    const dead = async () => 'I am sorry, I cannot help with that.';
    const { chips, ok } = await writeChips({
      frame: { rosterIds: ['irene'] },
      client: dead,
      available: ['flirt', 'care', 'deflect'],
      fallback: ['flirt', 'care', 'deflect'],
    });

    expect(ok).toBe(false);
    expect(chips).toHaveLength(3);
    expect(chips.every((c) => c.label === null)).toBe(true);
  });

  it('a thrown call is not an exception the scene has to handle', async () => {
    const boom = async () => {
      throw new Error('429');
    };
    await expect(
      writeChips({
        frame: { rosterIds: ['irene'] },
        client: boom,
        available: ['flirt', 'care'],
        fallback: ['flirt', 'care'],
      }),
    ).resolves.toMatchObject({ ok: false });
  });
});

describe('the directive says what may not be written', () => {
  const directive = buildChipDirective({
    stances: ['flirt', 'care', 'deflect'],
    lang: 'zh',
    absentNames: ['Wendy'],
  });

  it('names only the legal stances', () => {
    expect(directive).toContain('flirt, care, deflect');
  });

  it('localizes the prose and keeps the ids ASCII', () => {
    expect(directive).toContain('Simplified Chinese');
    expect(directive).toContain('ASCII English');
  });

  it('forbids narrating what the player cannot see', () => {
    expect(directive).toMatch(/see or hear/i);
    expect(directive).toMatch(/never her thoughts/i);
  });

  it('asks for an intention, not an outcome', () => {
    expect(directive).toMatch(/not what happens/i);
  });

  it('names absent members as off limits', () => {
    expect(directive).toContain('Wendy');
  });

  /**
   * The directive is the cache miss on every chip call, measured live. A wordy
   * earlier version cost 171 tokens of miss and pushed the call past the beat
   * call it is meant to hide behind; trimming it took the call from 1725ms to
   * 1371ms. This is the guard against it growing back.
   */
  it('stays short enough to be cheap to miss on', () => {
    const full = buildChipDirective({
      stances: ['flirt', 'care', 'deflect', 'press', 'joke', 'retreat'],
      lang: 'en',
      absentNames: ['Nana', 'Jisoo', 'Hyewon', 'Yeri'],
      addresseeName: 'Irene',
    });
    expect(full.length).toBeLessThan(500);
  });

  /**
   * Who the player is talking to, in a group scene.
   *
   * The label is what the player SAYS to somebody, and after a `turnTo` that
   * is no longer whoever last spoke - so a model with no way to know it writes
   * the next line at the wrong woman (section 6).
   */
  it('names the addressee when there is one', () => {
    expect(buildChipDirective({ stances: ['flirt'], addresseeName: 'Yeri' })).toContain(
      'speaking to Yeri',
    );
  });

  /** A 1v1 has nobody to disambiguate, so it sends nothing extra. */
  it('says nothing extra in a one-member scene', () => {
    expect(buildChipDirective({ stances: ['flirt'] })).not.toMatch(/speaking to/i);
  });
});

describe('the request never touches the transcript', () => {
  it('leaves block 5 exactly as it was', async () => {
    const client = createMockClient({ seed: 4, delay: 0 });
    let session = beginScene(setup());
    session = await runTurn(session, { text: openingDirective(), client });

    const before = buildMessages(session.frame);
    const asked = chipMessages(session.frame, { stances: ['flirt', 'deflect'], lang: 'en' });

    // The chip call is the prefix plus one throwaway line, and the frame the
    // scene carries forward is untouched - so the next turn still hits cache.
    expect(asked).toHaveLength(before.length + 1);
    expect(asked.slice(0, before.length)).toEqual(before);
    expect(buildMessages(session.frame)).toEqual(before);
    expect(session.frame.turns.some((m) => /three things the player could do/i.test(m.content))).toBe(
      false,
    );
  });
});

describe('end to end against the offline writer', () => {
  it('comes back with three labelled, legal chips', async () => {
    const client = createMockClient({ seed: 11, delay: 0 });
    let session = beginScene(setup());
    session = await runTurn(session, { text: openingDirective(), client });

    const r = rel();
    const { available } = availableStances(r, { energy: 80 });
    const { chips, ok } = await writeChips({
      frame: session.frame,
      client,
      available,
      fallback: available.slice(0, 3),
      absentNames: cards.filter((c) => c.id !== 'irene').map((c) => c.name),
    });

    expect(ok).toBe(true);
    expect(chips).toHaveLength(3);
    expect(chips.every((c) => available.includes(c.stance))).toBe(true);
    expect(chips.filter((c) => c.label).length).toBeGreaterThan(0);
  });
});

/**
 * THE FIELD THE MODEL PICKS FROM. Day-three playtest, and the worst defect
 * this project has shipped since `markRisk` - which is the same defect.
 *
 * `writeChips` offered `available.slice(0, 6)`: the head of the `STANCES`
 * array, which is `flirt, care, casual, deflect, joke, press`, identical in
 * every scene of every campaign. `touch`, `invite` and `confide` are at
 * indices 7, 6 and 10, so THE ONLY THREE STANCES THAT MOVE ADMISSIBILITY could
 * never be written - and because a written set replaces the static one
 * wholesale, the slot `generateChips` reserves for exactly them was destroyed
 * on every turn the model answered.
 *
 * Played, in the report's own words: "I saw the option with a small circle
 * noted on it to be seen, but the option is changed to LLM options... we now
 * need to click the need to be seen option very fast before LLM options come."
 * A public risk, reachable only by out-racing an API call.
 */
describe('the model is offered a field, not the head of an array', () => {
  const ALL = [...STANCES];

  it('always offers what the static bar is already showing', () => {
    const field = chipField(ALL, ['invite', 'care', 'joke'], () => 0.5);

    for (const stance of ['invite', 'care', 'joke']) {
      expect(field, `${stance} was dealt and not offered`).toContain(stance);
    }
  });

  it('can offer a risk stance at all', () => {
    const seen = new Set();
    for (let i = 0; i < 200; i += 1) {
      for (const s of chipField(ALL, [], Math.random)) seen.add(s);
    }

    for (const stance of RISK_STANCES) {
      expect(seen, `${stance} is never offered`).toContain(stance);
    }
  });

  it('reaches every legal stance eventually, not just the first six', () => {
    const seen = new Set();
    for (let i = 0; i < 400; i += 1) {
      for (const s of chipField(ALL, [], Math.random)) seen.add(s);
    }
    expect(seen.size).toBe(ALL.length);
  });

  it('never exceeds the field size, because the directive is the cache miss', () => {
    expect(chipField(ALL, ALL, Math.random)).toHaveLength(CHIP_FIELD_SIZE);
  });

  /** A stance the relation has locked stays locked, even if it was dealt. */
  it('drops a fallback stance that is not legal', () => {
    const field = chipField(['care', 'casual'], ['touch', 'care'], () => 0.5);
    expect(field).not.toContain('touch');
    expect(field).toContain('care');
  });

  it('is deterministic given a deterministic rng', () => {
    expect(chipField(ALL, ['care'], makeRng(4))).toEqual(chipField(ALL, ['care'], makeRng(4)));
  });
});

/**
 * The belt, for the case where the field is right and the model still writes
 * three warm verbs. The bet keeps its slot and loses only its label.
 */
describe('a written set may not relabel away the bet', () => {
  const written = [
    { stance: 'care', label: 'a' },
    { stance: 'joke', label: 'b' },
    { stance: 'casual', label: 'c' },
  ];

  it('puts the risk back when the model wrote none', () => {
    const out = keepRisk(written, ['care', 'joke', 'invite'], 3);

    expect(out).toHaveLength(3);
    expect(out.some((c) => c.stance === 'invite')).toBe(true);
    // Two written labels survive - degrading chip by chip, not all at once.
    expect(out.filter((c) => c.label).length).toBe(2);
  });

  it('leaves a set that already has one alone', () => {
    const withRisk = [{ stance: 'touch', label: 'x' }, ...written.slice(0, 2)];
    expect(keepRisk(withRisk, ['touch', 'care', 'joke'], 3)).toEqual(withRisk);
  });

  it('adds nothing when the static bar was not offering a risk either', () => {
    expect(keepRisk(written, ['care', 'joke', 'casual'], 3)).toEqual(written);
  });

  /** A short set has room, so nothing has to be given up at all. */
  it('takes an empty slot rather than a written one when it can', () => {
    const out = keepRisk(written.slice(0, 2), ['care', 'joke', 'confide'], 3);
    expect(out).toHaveLength(3);
    expect(out.filter((c) => c.label).length).toBe(2);
  });
});

/**
 * "Give exactly three options" followed by "Stances, once each: <six>" is a
 * contradiction, and the model resolved it differently from turn to turn. The
 * day-three log contains replies with two lines and replies with six; two is
 * what the player saw and reported as "2 live options and 1 offline option".
 */
describe('the directive asks for one thing', () => {
  it('says choose three OF the stances, not one each', () => {
    const d = buildChipDirective({ stances: ['care', 'joke', 'flirt', 'invite'] });

    expect(d).toMatch(/choose three of these stances/i);
    expect(d).not.toMatch(/stances, once each/i);
  });

  it('still names every stance it is offering', () => {
    const d = buildChipDirective({ stances: ['care', 'invite'] });
    expect(d).toContain('care');
    expect(d).toContain('invite');
  });
});

/**
 * THE JOIN, and the only assertions here that could have caught the shipped
 * bug. Everything above tests `chipField` and `keepRisk`, which did not exist
 * when the defect did - a new helper cannot fail against old code. What was
 * broken was the WIRING in `writeChips`, so that is what these drive.
 */
describe('writeChips does not throw the risk slot away', () => {
  const ALL = [...STANCES];

  /**
   * A REAL frame, from the real engine.
   *
   * A bare `{ rosterIds }` stub makes `buildMessages` throw inside
   * `writeChips`, which catches everything - so the client is never called and
   * these assertions pass or fail for reasons unrelated to what they test. Two
   * of the three did exactly that on their first run, and one of them passed
   * against broken code because of it. A harness wrong in either direction is
   * worse than no harness.
   */
  const realFrame = async () => {
    const client = createMockClient({ seed: 5, delay: 0 });
    const session = await runTurn(beginScene(setup()), { text: openingDirective(), client });
    return session.frame;
  };

  /** Records the directive, and answers with three warm verbs like a model. */
  const warmClient = (seen) => async ({ messages }) => {
    seen.push(messages.at(-1).content);
    return 'care|I am here\njoke|Blame the choreographer\ncasual|Just stay a while';
  };

  it('offers the model the risk stance the bar is holding', async () => {
    const seen = [];
    await writeChips({
      frame: await realFrame(),
      client: warmClient(seen),
      available: ALL,
      // What `generateChips` dealt: two common, and the reserved slot.
      fallback: ['care', 'casual', 'invite'],
    });

    expect(seen).toHaveLength(1);
    expect(seen[0], 'the dealt risk stance never reached the model').toContain('invite');
  });

  it('keeps the bet on the bar when the model writes three warm verbs', async () => {
    const seen = [];
    const { chips } = await writeChips({
      frame: await realFrame(),
      client: warmClient(seen),
      available: ALL,
      fallback: ['care', 'casual', 'invite'],
    });

    // The model answered, so this is a written set rather than a fallback one.
    expect(seen).toHaveLength(1);
    expect(chips).toHaveLength(3);
    expect(chips.filter((c) => c.label).length).toBeGreaterThan(0);
    expect(
      chips.some((c) => RISK_STANCES.includes(c.stance)),
      'the written set relabelled the public risk out of existence',
    ).toBe(true);
  });

  /**
   * ...and it does this WITHOUT widening what is legal. Section 6: chips.js is
   * the source of truth, and nothing below it may add a locked stance.
   */
  it('still never offers a stance the relation has locked', async () => {
    const seen = [];
    const legal = availableStances(rel({ intimacy: 20 }), {}).available;
    expect(legal).not.toContain('touch');

    await writeChips({
      frame: await realFrame(),
      client: warmClient(seen),
      available: legal,
      fallback: ['touch', 'care', 'casual'],
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toMatch(/\btouch\b/);
  });
});
