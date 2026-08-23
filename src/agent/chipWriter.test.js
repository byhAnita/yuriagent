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
} from './chipWriter.js';
import { buildMessages } from './promptBuilder.js';
import { beginScene, runTurn, openingDirective } from './sceneEngine.js';
import { availableStances } from '../systems/chips.js';
import { newRelation } from '../systems/relationship.js';
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
  const available = ['tease', 'reassure', 'deflect'];

  it('reads the contract', () => {
    const out = parseChips(
      'tease|You are enjoying this\nreassure|I am not going anywhere\ndeflect|So. The schedule.',
      { available },
    );
    expect(out).toEqual([
      { stance: 'tease', label: 'You are enjoying this' },
      { stance: 'reassure', label: 'I am not going anywhere' },
      { stance: 'deflect', label: 'So. The schedule.' },
    ]);
  });

  it('survives fences, bullets, numbering and stray quotes', () => {
    const out = parseChips(
      '```\n1. tease | "You are enjoying this"\n- reassure|  I am not going anywhere  \n```',
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

    const out = parseChips('touch|Reach for her hand\ntease|You are enjoying this', {
      available: locked.available,
    });
    expect(out.map((c) => c.stance)).toEqual(['tease']);
  });

  it('drops an invented stance', () => {
    expect(parseChips('flirt|Say something reckless', { available })).toEqual([]);
  });

  it('deduplicates stances', () => {
    const out = parseChips('tease|One\ntease|Two\nreassure|Three', { available });
    expect(out.map((c) => c.stance)).toEqual(['tease', 'reassure']);
  });

  it('drops a label that is prose rather than an option', () => {
    const long = 'x'.repeat(MAX_CHIP_LABEL + 1);
    expect(parseChips(`tease|${long}`, { available })).toEqual([]);
  });

  it('drops an empty label', () => {
    expect(parseChips('tease|   \nreassure|Fine', { available })).toHaveLength(1);
  });

  it('ignores a line with no metadata at all', () => {
    expect(parseChips('Here are three options for you!', { available })).toEqual([]);
  });

  /**
   * The roster rule from section 9, mirrored. The player has not seen Wendy, so
   * a chip may not mention her - that would leak a rumor she never voiced.
   */
  it('drops a label naming someone who is not in the scene', () => {
    const out = parseChips('tease|Ask about Wendy again\nreassure|I am here', {
      available,
      absentNames: ['Wendy', 'Yeri'],
    });
    expect(out.map((c) => c.stance)).toEqual(['reassure']);
  });
});

describe('failure degrades chip by chip', () => {
  it('backfills a short result instead of discarding it', () => {
    const written = [{ stance: 'tease', label: 'You are enjoying this' }];
    const out = backfill(written, ['reassure', 'deflect', 'joke']);

    expect(out).toHaveLength(3);
    expect(out[0]).toEqual(written[0]);
    expect(out.slice(1).every((c) => c.label === null)).toBe(true);
  });

  /**
   * The filler comes from what is already on the bar, so a partial swap moves
   * as few buttons as it can rather than dealing a fresh hand.
   */
  it('fills from the set already on screen', () => {
    const out = backfill([{ stance: 'tease', label: 'Say that again' }], ['deflect', 'retreat']);
    expect(out.map((c) => c.stance)).toEqual(['tease', 'deflect', 'retreat']);
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
      available: ['tease', 'reassure', 'deflect'],
      fallback: ['tease', 'reassure', 'deflect'],
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
        available: ['tease', 'reassure'],
        fallback: ['tease', 'reassure'],
      }),
    ).resolves.toMatchObject({ ok: false });
  });
});

describe('the directive says what may not be written', () => {
  const directive = buildChipDirective({
    stances: ['tease', 'reassure', 'deflect'],
    lang: 'zh',
    absentNames: ['Wendy'],
  });

  it('names only the legal stances', () => {
    expect(directive).toContain('tease, reassure, deflect');
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
      stances: ['tease', 'reassure', 'deflect', 'press', 'joke', 'retreat'],
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
    expect(buildChipDirective({ stances: ['tease'], addresseeName: 'Yeri' })).toContain(
      'speaking to Yeri',
    );
  });

  /** A 1v1 has nobody to disambiguate, so it sends nothing extra. */
  it('says nothing extra in a one-member scene', () => {
    expect(buildChipDirective({ stances: ['tease'] })).not.toMatch(/speaking to/i);
  });
});

describe('the request never touches the transcript', () => {
  it('leaves block 5 exactly as it was', async () => {
    const client = createMockClient({ seed: 4, delay: 0 });
    let session = beginScene(setup());
    session = await runTurn(session, { text: openingDirective(), client });

    const before = buildMessages(session.frame);
    const asked = chipMessages(session.frame, { stances: ['tease', 'deflect'], lang: 'en' });

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
