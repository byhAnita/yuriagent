/**
 * What the writing is actually like. OPT-IN - skipped without a key.
 *
 * `tools/live.test.js` answers 'does the router work and does the contract
 * hold'. This answers the questions that decide whether the game is any good,
 * and that no offline test can reach:
 *
 *   1. do the meters MOVE? the whole micro-to-macro mapping in section 6 is
 *      thresholded (guard drop >= 15, fluster peak >= 60), and those numbers
 *      were calibrated against the offline writer, which is generous
 *   2. do the five members read as five people, or as one idol with five names
 *   3. does `zh` keep the machine tokens ASCII while writing Chinese prose
 *   4. does the summarizer produce a usable ledger line and real dossier facts
 *
 * Run with LIVE_QUALITY=1 and a key in .env.local. Costs real tokens, and
 * reports far more than it asserts, because most of these are readings about a
 * provider rather than contracts this repo controls.
 */

import { describe, it, expect } from 'vitest';
import { stream, complete } from '../tools/llmTool.js';
import { liveConfig } from '../tools/liveEnv.js';
import {
  beginScene,
  runTurn,
  endScene,
  openingDirective,
  readHer,
} from './sceneEngine.js';
import { newMemory } from './memory.js';
import { newRelation } from '../systems/relationship.js';
import { availableStances } from '../systems/chips.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { makeRng } from '../systems/rng.js';
import { GUARD_DROP_TO_PAY, FLUSTER_PEAK_TO_PAY } from '../config/constants.js';

const { apiKey, modelId, live } = liveConfig();

/**
 * Gated on an env flag as well as the key, unlike `tools/live.test.js`.
 *
 * That one is three calls and worth paying for on any run that has a key.
 * This one plays whole scenes - a single pass is dozens of calls - so it must
 * not fire just because a key happens to be present. `npm test` should never
 * cost money by surprise.
 */
const enabled = live && Boolean(process.env.LIVE_QUALITY);
const log = (...a) => process.stdout.write(`${a.join(' ')}\n`);

/**
 * The real thresholds, imported rather than copied.
 *
 * They were copied once, and after `GUARD_DROP_TO_PAY` / `FLUSTER_PEAK_TO_PAY`
 * moved, the report cheerfully printed "0/6 paid" for a sample in which one
 * scene had in fact cleared the fluster bar. A measurement harness that lies is
 * worse than none.
 */
const pays = (r) => r.drop >= GUARD_DROP_TO_PAY || r.peak >= FLUSTER_PEAK_TO_PAY;

const cards = getCast();
const castIds = cards.map((c) => c.id);
const lineup = buildLineup(cards);

function client({ messages, preset, onChunk }) {
  if (onChunk) {
    return stream({ messages, apiKey, modelId, preset, onChunk }).then(
      (r) => r.text,
    );
  }
  return complete({ messages, apiKey, modelId, preset }).then((r) => r.text);
}

function setup({
  memberId = 'irene',
  intimacy = 45,
  lang = 'en',
  locationId = 'practice_room',
  activity = null,
  task = null,
} = {}) {
  return {
    cards,
    lineup,
    identity: { promptRole: 'an artist assistant', exposureModifier: {} },
    player: { name: 'You', energy: 80, secrecy: 70, credits: 10 },
    lang,
    memory: newMemory(castIds),
    relations: Object.fromEntries(
      castIds.map((id) => [id, newRelation(intimacy)]),
    ),
    scene: {
      id: 'lq',
      rosterIds: [memberId],
      focusId: memberId,
      week: 0,
      day: 1,
      block: 'evening',
      phase: 'prep',
      locationId,
      locationLabel: locationId,
      seed: 1,
      occupancy: activity ? { [memberId]: { activity } } : {},
      task,
    },
  };
}

describe.skipIf(!enabled)('what the model actually writes', () => {
  /**
   * The central calibration question.
   *
   * Section 6 pays intimacy for a guard drop of 15 or more across a scene, and
   * for a fluster peak of 60. Those thresholds have only ever been met by the
   * offline writer. If a real model moves the meters by one or two a beat, a
   * scene against a real provider pays nothing at all - and the entire
   * relationship model would be driven by openers and by nothing the player
   * said.
   */
  it('moves the meters far enough for a scene to pay', async () => {
    const samples = Number(process.env.LIVE_SAMPLES ?? 1);
    const runs = [];

    for (let s = 0; s < samples; s += 1) {
      runs.push(await oneScene());
    }

    if (samples > 1) {
      log('\n[quality] --- distribution over ' + samples + ' scenes ---');
      for (const r of runs) {
        log(
          `  beats ${String(r.beats).padStart(3)}  guard drop ${String(r.drop).padStart(4)}  ` +
            `fluster peak ${String(r.peak).padStart(4)}  pays ${
              pays(r) ? 'yes' : 'NO'
            }`,
        );
      }
      const paid = runs.filter((r) => pays(r)).length;
      log(`[quality] ${paid}/${samples} scenes paid any intimacy at all`);
    }

    expect(runs.every((r) => r.beats > 3)).toBe(true);
  }, 900000);

  async function oneScene() {
    let session = beginScene(setup({ intimacy: 45 }));
    session = await runTurn(session, { text: openingDirective(false), client });

    const path = [
      { turn: 0, guard: session.meters.guard, fluster: session.meters.fluster },
    ];
    const stances = ['tease', 'confide', 'press', 'reassure', 'joke', 'invite'];

    for (let i = 0; i < stances.length; i += 1) {
      const { available } = availableStances(newRelation(45), { energy: 80 });
      const stance = available.includes(stances[i]) ? stances[i] : 'joke';
      session = await runTurn(session, { stance, text: '', client });
      path.push({
        turn: i + 1,
        stance,
        guard: session.meters.guard,
        fluster: session.meters.fluster,
      });
    }

    log(
      '\n[quality] --- meters over one scene (start guard ' +
        session.meters.guardStart +
        ') ---',
    );
    for (const p of path) {
      log(
        `  t${p.turn} ${String(p.stance ?? 'open').padEnd(9)} guard ${String(p.guard).padStart(3)}  fluster ${String(p.fluster).padStart(3)}`,
      );
    }

    const drop = session.meters.guardStart - session.meters.guard;
    log(
      `[quality] guard drop over the scene: ${drop} (section 6 pays at 15)  fluster peak: ${session.meters.flusterPeak} (pays at 60)`,
    );

    const withMeta = session.beats.filter((b) => !b.inferred).length;
    log(`[quality] ${withMeta}/${session.beats.length} beats carried metadata`);

    if (Number(process.env.LIVE_SAMPLES ?? 1) === 1) {
      log('\n[quality] --- the scene ---');
      for (const b of session.beats)
        log(`  @${b.speaker}|${b.emotion}  ${b.text}`);
    }

    return {
      drop,
      peak: session.meters.flusterPeak,
      beats: session.beats.length,
    };
  }

  /**
   * Five people, or one idol with five names?
   *
   * Block 1 gained a differentiation directive for exactly this. The same
   * room, the same intimacy, the same opening instruction - the only thing
   * that varies is the card.
   */
  it('writes five different women into the same room', async () => {
    const opens = {};
    for (const id of castIds) {
      let s = beginScene(setup({ memberId: id }));
      s = await runTurn(s, { text: openingDirective(false), client });
      opens[id] = s.beats.map((b) => b.text).join(' ');
    }

    log('\n[quality] --- the same room, five members ---');
    for (const [id, text] of Object.entries(opens))
      log(`  ${id.padEnd(7)} ${text}`);

    // Crude but real: how much vocabulary do any two of them share?
    const words = (t) =>
      new Set(
        t
          .toLowerCase()
          .replace(/[^a-z\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 4),
      );
    const ids = Object.keys(opens);
    let worst = 0;
    let worstPair = '';
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = words(opens[ids[i]]);
        const b = words(opens[ids[j]]);
        const shared = [...a].filter((w) => b.has(w)).length;
        const overlap = shared / Math.max(1, Math.min(a.size, b.size));
        if (overlap > worst) {
          worst = overlap;
          worstPair = `${ids[i]}/${ids[j]}`;
        }
      }
    }
    log(
      `[quality] worst vocabulary overlap: ${worstPair} ${(worst * 100).toFixed(0)}%`,
    );

    // Nobody should be speaking as somebody else - that one IS a contract.
    for (const [id, text] of Object.entries(opens)) {
      expect(text.length).toBeGreaterThan(0);
      for (const other of cards.filter((c) => c.id !== id)) {
        expect(text).not.toContain(other.name);
      }
    }
  }, 300000);

  /**
   * Section 19: prose in the player's language, machine tokens in ASCII
   * English. A localized emotion name kills the parser, and `zh` is the
   * primary locale.
   */
  it('writes Chinese prose without localizing a single machine token', async () => {
    let session = beginScene(setup({ lang: 'zh' }));
    session = await runTurn(session, { text: openingDirective(false), client });
    session = await runTurn(session, { stance: 'tease', text: '', client });

    log('\n[quality] --- zh ---');
    for (const b of session.beats)
      log(`  @${b.speaker}|${b.emotion}  ${b.text}`);

    const prose = session.beats.map((b) => b.text).join(' ');
    const han = (prose.match(/[一-鿿]/g) ?? []).length;
    log(
      `[quality] ${han} Han characters in ${prose.length} characters of prose`,
    );

    // The contract half: ids and emotions stay ASCII whatever the prose does.
    for (const b of session.beats) {
      expect(b.speaker).toBe('irene');
      if (b.emotion) expect(/^[a-z]+$/.test(b.emotion)).toBe(true);
    }
    expect(han).toBeGreaterThan(10);
  }, 180000);

  /**
   * The scene exit is the only thing that writes long-term memory. A summary
   * that says nothing, or a dossier entry that is a transcript rather than a
   * fact, degrades every later prompt in the run.
   */
  it('closes a scene with a usable ledger line and real dossier entries', async () => {
    const args = setup({ intimacy: 55 });
    let session = beginScene(args);
    session = await runTurn(session, { text: openingDirective(false), client });
    session = await runTurn(session, { stance: 'confide', text: '', client });
    session = await runTurn(session, { stance: 'press', text: '', client });

    const { thought } = await readHer(session, { client });
    log(`\n[quality] --- read her ---\n  ${thought}`);

    const result = await endScene(session, {
      client,
      memory: args.memory,
      relations: args.relations,
      cards,
      scene: args.scene,
      rng: makeRng(5),
    });

    log('\n[quality] --- scene exit ---');
    log(`  ledger: ${result.memory.ledger.at(-1)?.text}`);
    log(`  dossier(irene): ${JSON.stringify(result.memory.dossier.irene)}`);
    log(`  deltas: ${JSON.stringify(result.delta)}`);
    log(`  rumors: ${result.rumors.length}`);

    expect(result.memory.ledger.length).toBeGreaterThan(0);
    // English memory whatever the UI language - section 19, rule 2.
    const line = result.memory.ledger.at(-1).text;
    expect(/[一-鿿]/.test(line)).toBe(false);
  }, 240000);

  /**
   * The other half of section 11's diagram: talking to her has to be able to
   * teach the player something they can SPEND. The summarizer used to write its
   * own phrasing, which matched no opener's `requires` needle, so every opener
   * in the game was reachable by snooping alone.
   */
  it('records a card fact in the card wording when it actually comes up', async () => {
    const args = setup({ intimacy: 55 });
    let session = beginScene(args);
    session = await runTurn(session, { text: openingDirective(false), client });
    session = await runTurn(session, {
      text: 'You never sit still. Do you actually train on top of all this practice?',
      client,
    });
    session = await runTurn(session, {
      text: 'Ten minutes between runs. That is not a break, that is a second workout.',
      client,
    });

    const result = await endScene(session, {
      client,
      memory: args.memory,
      relations: args.relations,
      cards,
      scene: args.scene,
      rng: makeRng(9),
    });

    const facts = result.memory.dossier.irene.known_facts;
    log('\n[quality] --- fact capture ---');
    for (const b of session.beats) log(`  @${b.speaker}  ${b.text}`);
    log(`  known_facts: ${JSON.stringify(facts)}`);

    const gym = 'squeezes ten-minute gym sets into the breaks between practices';
    const matched = facts.some((f) => f.toLowerCase().includes('gym'));
    log(
      matched
        ? '[quality] a gym fact was recorded'
        : '[quality] NOT captured - the dialogue arm of the economy is still shut',
    );
    log(`  (the card wording is: "${gym}")`);

    expect(Array.isArray(facts)).toBe(true);
  }, 240000);


  /**
   * The same woman, the same room, a different reason to be in it.
   *
   * Every scene in the practice room used to open the same way, because block 4
   * named the location and nothing else - the model had to invent why she was
   * standing there. The calendar knew all along.
   */
  it('gives the same room a different scene when the schedule changes', async () => {
    const opens = {};
    for (const activity of ['group_practice', 'late_practice', 'solo_recording']) {
      let s = beginScene(setup({ activity }));
      s = await runTurn(s, { text: openingDirective(false), client });
      opens[activity] = s.beats.map((b) => b.text).join(' ');
    }

    log('\n[quality] --- same room, three schedules ---');
    for (const [a, text] of Object.entries(opens)) log(`  ${a.padEnd(15)} ${text}`);

    for (const text of Object.values(opens)) expect(text.length).toBeGreaterThan(0);
  }, 240000);

  /**
   * The player's own job is the other half of "why is this conversation
   * happening now". A still-unfinished one is visible pressure she can name.
   */
  it('lets her notice the job the player has not done', async () => {
    let s = beginScene(
      setup({
        locationId: 'wardrobe',
        activity: 'fitting',
        task: { taskId: 'prep_outfits', done: false },
      }),
    );
    s = await runTurn(s, { text: openingDirective(false), client });
    s = await runTurn(s, { stance: 'deflect', text: '', client });

    log('\n[quality] --- wardrobe, outfits not prepped ---');
    for (const b of s.beats) log(`  @${b.speaker}|${b.emotion}  ${b.text}`);

    expect(s.beats.length).toBeGreaterThan(0);
  }, 240000);

});
