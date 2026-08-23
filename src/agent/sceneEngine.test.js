/**
 * The M2 exit criterion: a whole scene runs end to end with no network and no
 * key, with the cache invariants and the roster rule asserted along the way.
 *
 * The mock client below stands in for the model. It streams, it emits beats in
 * the contract format, and in one test it deliberately misbehaves.
 */

import { describe, it, expect } from 'vitest';
import {
  beginScene,
  runTurn,
  readHer,
  endScene,
  markRisk,
  computeDeltas,
  newMeters,
  applyBeatToMeters,
  riskPayoff,
} from './sceneEngine.js';
import { prefixOf, buildMessages } from './promptBuilder.js';
import { entryText, newMemory, addDossierEntry } from './memory.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { newRelation } from '../systems/relationship.js';
import { makeRng } from '../systems/rng.js';
import { createMockClient } from '../tools/mockClient.js';
import { RISK_EXPOSURE_THRESHOLD } from '../config/constants.js';

const cards = getCast();
const lineup = buildLineup(cards);
const castIds = cards.map((c) => c.id);

/** Streams a canned response one chunk at a time, like a real provider. */
function mockClient(scripted) {
  let call = 0;
  const seen = [];

  const client = async ({ messages, preset, onChunk }) => {
    seen.push({ messages, preset });
    const text = typeof scripted === 'function' ? scripted(call++, preset) : scripted;
    if (onChunk) {
      for (let i = 0; i < text.length; i += 7) onChunk(text.slice(i, i + 7));
    }
    return text;
  };

  client.seen = seen;
  return client;
}

const BEAT = (id, guard, fluster) =>
  `@${id}|blush|guard${guard}|fluster+${fluster}\n*She glances up.* "You actually came."`;

function setup(overrides = {}) {
  return {
    cards,
    lineup,
    identity: { promptRole: 'an artist assistant', exposureModifier: {} },
    player: { name: 'Yuhan', energy: 80, secrecy: 70, credits: 10 },
    lang: 'en',
    memory: newMemory(castIds),
    relations: Object.fromEntries(castIds.map((id) => [id, newRelation(5)])),
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
    ...overrides,
  };
}

describe('a scene, end to end', () => {
  it('runs turns, closes, and commits to memory', async () => {
    const args = setup();
    const client = mockClient((n, preset) =>
      preset === 'summarize'
        ? JSON.stringify({
            summary: 'Irene stayed late and let the player help.',
            dossier_add: [
              { memberId: 'irene', category: 'known_facts', text: 'hates cold hands' },
            ],
          })
        : BEAT('irene', -12, 20),
    );

    let session = beginScene(args);
    expect(session.meters.guard).toBe(95);

    for (const stance of ['flirt', 'care', 'confide']) {
      session = await runTurn(session, { stance, client });
    }

    expect(session.beats).toHaveLength(3);
    expect(session.meters.guard).toBeLessThan(session.meters.guardStart);
    expect(session.meters.flusterPeak).toBeGreaterThan(0);

    const out = await endScene(session, {
      client,
      memory: args.memory,
      relations: args.relations,
      cards,
      scene: args.scene,
      rng: makeRng(1),
    });

    expect(out.memory.ledger).toHaveLength(1);
    expect(out.memory.ledger[0].text).toContain('stayed late');
    expect(out.memory.dossier.irene.known_facts.map(entryText)).toContain('hates cold hands');
    expect(out.relations.irene.intimacy).toBeGreaterThan(5);
  });

  it('holds the cache prefix byte-identical for every turn of the scene', async () => {
    const args = setup();
    const client = mockClient(BEAT('irene', -8, 12));

    let session = beginScene(args);
    const prefix = prefixOf(session.frame);

    for (let i = 0; i < 4; i++) {
      session = await runTurn(session, { stance: 'flirt', client });
      // mutate live state the way a real scene would
      args.relations.irene.intimacy += 10;
      args.player.energy -= 10;
      expect(prefixOf(session.frame)).toBe(prefix);
    }

    for (const { messages } of client.seen) {
      expect(messages[0].content).toBe(prefix);
    }
  });

  it('appends a gift note at the tail, not into the header', async () => {
    const args = setup();
    const client = mockClient(BEAT('irene', -5, 8));

    let session = beginScene(args);
    const prefix = prefixOf(session.frame);
    session = await runTurn(session, {
      note: 'the player gave Irene a hand warmer',
      stance: 'care',
      client,
    });

    expect(prefixOf(session.frame)).toBe(prefix);
    const sent = client.seen[0].messages;
    expect(sent[0].content).not.toContain('hand warmer');
    expect(sent.some((m) => m.content.includes('hand warmer'))).toBe(true);
  });

  it('grows only the tail across a scene', async () => {
    const args = setup();
    const client = mockClient(BEAT('irene', -3, 5));
    let session = beginScene(args);

    const lengths = [];
    for (let i = 0; i < 3; i++) {
      session = await runTurn(session, { stance: 'joke', client });
      lengths.push(buildMessages(session.frame).length);
    }
    expect(lengths).toEqual([3, 5, 7]);
  });
});

describe('member bleed cannot survive the pipeline', () => {
  it('drops a beat from an absent member even when the model insists', async () => {
    const args = setup();
    const client = mockClient(
      [
        '@irene|neutral|guard-4|fluster+3',
        '"You are late."',
        '',
        '@wendy|happy|guard-9|fluster+15',
        '"Where is my present?"',
      ].join('\n'),
    );

    let session = beginScene(args);
    const seen = [];
    session = await runTurn(session, { stance: 'joke', client, onBeat: (b) => seen.push(b) });

    expect(session.beats.map((b) => b.speaker)).toEqual(['irene']);
    expect(seen.every((b) => b.speaker === 'irene')).toBe(true);
    // the off-roster beat's meters must not have moved anything either
    expect(session.meters.fluster).toBe(3);
  });

  it('keeps an absent member out of block 3 entirely', () => {
    const args = setup();
    args.memory.dossier = addDossierEntry(
      args.memory.dossier,
      'nana',
      'known_facts',
      'does her own makeup',
    );
    const session = beginScene(args);
    expect(prefixOf(session.frame)).not.toContain('does her own makeup');
  });
});

describe('resilience', () => {
  it('survives a model that ignores the format contract', async () => {
    const args = setup();
    const client = mockClient('She just looks at you for a moment, and says nothing.');

    let session = beginScene(args);
    session = await runTurn(session, { stance: 'press', client });

    expect(session.beats).toHaveLength(1);
    expect(session.beats[0].speaker).toBe('irene');
    // rule 1: no metadata means no state movement
    expect(session.meters.guard).toBe(session.meters.guardStart);
    expect(session.meters.fluster).toBe(0);
  });

  it('survives a summarizer call that throws', async () => {
    const args = setup();
    const client = async ({ preset }) => {
      if (preset === 'summarize') throw new Error('network down');
      return BEAT('irene', -5, 5);
    };

    let session = beginScene(args);
    session = await runTurn(session, { stance: 'flirt', client });

    const out = await endScene(session, {
      client,
      memory: args.memory,
      relations: args.relations,
      cards,
      scene: args.scene,
      rng: makeRng(2),
    });

    expect(out.memory.ledger).toHaveLength(1);
    expect(out.summary.level).toBe(4);
  });
});

describe('Read her', () => {
  it('returns a thought, costs a use, and moves nothing', async () => {
    const args = setup();
    const client = mockClient((n, preset) =>
      preset === 'thought' ? 'She wonders whether you noticed her hands shaking.' : BEAT('irene', -5, 5),
    );

    let session = beginScene(args);
    const before = { ...session.meters };

    const first = await readHer(session, { client });
    expect(first.thought).toContain('hands shaking');
    expect(first.session.meters).toEqual(before);

    const second = await readHer(first.session, { client });
    const third = await readHer(second.session, { client });
    expect(third.thought).toBeNull();
  });
});

describe('computeDeltas', () => {
  const rel = newRelation(50);

  it('rewards a real guard drop', () => {
    const session = { exposure: 20, meters: { ...newMeters(rel), guardStart: 50, guard: 30, flusterPeak: 0 } };
    expect(computeDeltas(session, rel, makeRng(1)).intimacy).toBeGreaterThan(0);
  });

  it('gives nothing for a scene that went nowhere', () => {
    const session = { exposure: 20, meters: { ...newMeters(rel), guardStart: 50, guard: 48, flusterPeak: 10 } };
    const d = computeDeltas(session, rel, makeRng(1));
    expect(d.intimacy).toBe(0);
    expect(d.good).toBe(false);
  });

  it('only lets admissibility move where it could actually cost something', () => {
    const quiet = { exposure: 20, meters: { ...newMeters(rel), riskTaken: true } };
    expect(computeDeltas(quiet, rel, makeRng(1)).admissibility).toBe(0);

    const public_ = { exposure: 80, meters: { ...newMeters(rel), riskTaken: true } };
    const d = computeDeltas(public_, rel, makeRng(1));
    expect(d.admissibility > 0 || d.strain > 0).toBe(true);
  });

  it('is marked by markRisk rather than inferred', () => {
    const session = markRisk({ exposure: 80, meters: newMeters(rel) });
    expect(session.meters.riskTaken).toBe(true);
  });
});

/**
 * The second axis has to be reachable BY PLAYING.
 *
 * `computeDeltas` and `markRisk` were both correct and tested, and nothing
 * called `markRisk` - so `riskTaken` was false in every scene that has ever
 * run, admissibility never left 0, every route plateaued at `confidante`, and
 * all four good endings plus the balance ending were unreachable in the
 * shipped game. Each half passed its own unit test. These assert the join.
 */
describe('taking a risk is something the player can actually do', () => {
  const client = createMockClient({ seed: 3, delay: 0 });

  const sceneAt = (locationId, block) =>
    setup({
      relations: Object.fromEntries(castIds.map((id) => [id, newRelation(60)])),
      scene: { ...setup().scene, locationId, block, locationLabel: locationId },
    });

  it('an overt stance in a visible place is a bet', async () => {
    let session = beginScene(sceneAt('cafe', 'afternoon'));
    expect(session.exposure).toBeGreaterThanOrEqual(RISK_EXPOSURE_THRESHOLD);

    session = await runTurn(session, { stance: 'touch', text: '', client });
    expect(session.meters.riskTaken).toBe(true);
  });

  it('the same stance in private is not', async () => {
    let session = beginScene(sceneAt('practice_room', 'evening'));
    expect(session.exposure).toBeLessThan(RISK_EXPOSURE_THRESHOLD);

    session = await runTurn(session, { stance: 'touch', text: '', client });
    expect(session.meters.riskTaken).toBe(false);
  });

  it('a deniable stance in public is not, however loud it is', async () => {
    let session = beginScene(sceneAt('cafe', 'afternoon'));
    session = await runTurn(session, { stance: 'flirt', text: '', client });
    expect(session.meters.riskTaken).toBe(false);
  });

  it('once taken, it stays taken for the rest of the scene', async () => {
    let session = beginScene(sceneAt('cafe', 'afternoon'));
    session = await runTurn(session, { stance: 'invite', text: '', client });
    session = await runTurn(session, { stance: 'joke', text: '', client });
    expect(session.meters.riskTaken).toBe(true);
  });

  it('and it is what puts admissibility on the board', async () => {
    let session = beginScene(sceneAt('cafe', 'afternoon'));
    session = await runTurn(session, { stance: 'touch', text: '', client });

    const rel60 = newRelation(60);
    // Survival is a roll, so assert the outcome is one of the two priced ones
    // rather than a particular side of it.
    const d = computeDeltas(session, rel60, makeRng(4));
    expect(d.admissibility > 0 || d.strain > 0).toBe(true);
  });
});

describe('rumor propagation at scene exit', () => {
  it('writes a rumor into an absent member dossier from a public scene', async () => {
    const args = setup();
    args.scene.locationId = 'cafe';
    args.scene.locationLabel = 'the cafe';
    args.scene.block = 'afternoon';
    // give the others enough investment to care
    for (const id of castIds) {
      args.relations[id] = { ...newRelation(60), intimacy: 60, stage: 'nameless' };
    }

    const client = mockClient((n, preset) =>
      preset === 'summarize' ? '{"summary":"They had coffee."}' : BEAT('irene', -6, 10),
    );

    let session = beginScene(args);
    session = await runTurn(session, { stance: 'flirt', client });

    const out = await endScene(session, {
      client,
      memory: args.memory,
      relations: args.relations,
      cards,
      scene: args.scene,
      rng: () => 0, // dice always favour propagation
    });

    expect(out.rumors.length).toBeGreaterThan(0);
    const heard = out.memory.dossier[out.rumors[0].memberId].heard_about;
    expect(entryText(heard[0])).toContain('Irene');
    // The shape travels with it, so the snoop screen can localize it later.
    expect(heard[0].kind).toBeTruthy();
    expect(heard[0].subjectName).toBe('Irene');
    expect(out.relations[out.rumors[0].memberId].jealousy).toBeGreaterThan(0);
  });

  it('leaks nothing from a private scene', async () => {
    const args = setup();
    args.scene.locationId = 'dorm_room';
    const client = mockClient((n, preset) =>
      preset === 'summarize' ? '{"summary":"They talked quietly."}' : BEAT('irene', -6, 10),
    );

    let session = beginScene(args);
    session = await runTurn(session, { stance: 'confide', client });

    const out = await endScene(session, {
      client,
      memory: args.memory,
      relations: args.relations,
      cards,
      scene: args.scene,
      rng: () => 0,
    });

    expect(out.rumors).toHaveLength(0);
  });
});

/**
 * Getting closer to her must not make it harder to ever name it.
 *
 * `STAGE_A_MIN` steps the admissibility requirement up in 20-point jumps as
 * intimacy crosses each tier, so escaping the `confidante` plateau costs 10 at
 * intimacy 60 and 50 at intimacy 90 - while a flat 3-6 payout stayed the same
 * size. Measured, the campaign with LOWER intimacy got the better endings.
 */
describe('a public risk is worth more the more there is between you', () => {
  const spread = (intimacy) => {
    const seen = new Set();
    for (let i = 0; i < 40; i += 1) seen.add(riskPayoff(intimacy, makeRng(i + 1)));
    return { min: Math.min(...seen), max: Math.max(...seen) };
  };

  it('pays more at unspoken than at colleague', () => {
    expect(spread(90).min).toBeGreaterThan(spread(20).min);
    expect(spread(90).max).toBeGreaterThan(spread(20).max);
  });

  it('still pays something at the very bottom of the map', () => {
    expect(spread(0).min).toBeGreaterThanOrEqual(3);
  });

  it('rises smoothly rather than in steps', () => {
    const at = (i) => spread(i).max;
    expect(at(30)).toBeLessThanOrEqual(at(60));
    expect(at(60)).toBeLessThanOrEqual(at(90));
  });

  /**
   * The failure branch is deliberately NOT scaled. A public risk gone wrong
   * already costs 10-20 strain, and doubling that at high intimacy would hand
   * the problem straight back in the other direction.
   */
  it('does not scale the punishment with it', () => {
    const rel = (intimacy) => ({ ...newRelation(intimacy), stage: 'unspoken' });
    const failed = (intimacy) => {
      const session = {
        exposure: 80,
        meters: { ...newMeters(rel(intimacy)), riskTaken: true },
      };
      // a seed that fails the survival roll at both ends of the map
      return computeDeltas(session, rel(intimacy), () => 0.99);
    };
    expect(failed(20).strain).toBe(failed(90).strain);
  });
});

/**
 * The meter reading is WHERE SHE IS, and that is what finally makes beat count
 * irrelevant. Three earlier schemes all failed the same way, because the client
 * was reassembling a quantity from however many pieces the model chose to write:
 * summing made a chatty reply worth three times a terse one, averaging flipped
 * the bias, and a per-reply budget in the prompt did not take either.
 */
describe('an absolute reading says where she is', () => {
  const at = (guard, fluster) => ({
    guard,
    guardIsAbsolute: true,
    fluster,
    flusterIsAbsolute: true,
  });
  const start = { guard: 60, guardStart: 60, fluster: 0, flusterPeak: 0, riskTaken: false };

  it('replaces the meter rather than moving it', () => {
    expect(applyBeatToMeters(start, [at(42, 18)])).toMatchObject({ guard: 42, fluster: 18 });
  });

  it('lets the last beat of a reply win', () => {
    const out = applyBeatToMeters(start, [at(55, 5), at(48, 12), at(40, 22)]);
    expect(out.guard).toBe(40);
    expect(out.fluster).toBe(22);
  });

  /** The whole reason for the change. */
  it('makes a three-beat reply worth exactly what a one-beat reply is worth', () => {
    const chatty = applyBeatToMeters(start, [at(55, 8), at(48, 15), at(40, 22)]);
    const terse = applyBeatToMeters(start, [at(40, 22)]);
    expect(chatty.guard).toBe(terse.guard);
    expect(chatty.fluster).toBe(terse.fluster);
  });

  it('still keeps fluster as a high-water mark', () => {
    // She is flustered and recovers inside the same reply. It still landed.
    const out = applyBeatToMeters(start, [at(50, 65), at(52, 20)]);
    expect(out.fluster).toBe(20);
    expect(out.flusterPeak).toBe(65);
  });

  it('reads a signed value as movement, in the same reply', () => {
    // A model that mixes the two must not be punished for it.
    const out = applyBeatToMeters(start, [
      at(50, 10),
      { guard: -6, guardIsAbsolute: false, fluster: 4, flusterIsAbsolute: false },
    ]);
    expect(out.guard).toBe(44);
    expect(out.fluster).toBe(14);
  });

  it('clamps to the meter range', () => {
    expect(applyBeatToMeters(start, [at(0, 100)])).toMatchObject({ guard: 0, fluster: 100 });
  });

  it('leaves the meters alone when a reply carries no beats at all', () => {
    expect(applyBeatToMeters(start, [])).toMatchObject({ guard: 60, fluster: 0 });
    expect(applyBeatToMeters(start, undefined)).toMatchObject({ guard: 60, fluster: 0 });
  });

  it('does not move anything for a beat that carried no metadata', () => {
    // parseResponse gives prose-only beats guard 0 / fluster 0 as deltas, and
    // rule 1 says a beat with no metadata moves nothing.
    const out = applyBeatToMeters(start, [
      { guard: 0, guardIsAbsolute: false, fluster: 0, flusterIsAbsolute: false },
    ]);
    expect(out).toMatchObject({ guard: 60, fluster: 0 });
  });
});

/**
 * And block 4 has to give it a scale to be absolute against.
 */
describe('the header states her opening reading', () => {
  it('seeds guard from intimacy, the same way the client does', async () => {
    const args = setup({
      relations: Object.fromEntries(castIds.map((id) => [id, newRelation(35)])),
    });
    const session = beginScene(args);
    expect(prefixOf(session.frame)).toContain('starts this scene at guard65, fluster0');
    expect(session.meters.guardStart).toBe(65);
  });
});
