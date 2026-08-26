/**
 * The smoke harness. CLAUDE.md Part I.12.
 *
 * Replaces `playthrough.test.js`, and it is deliberately a much smaller claim.
 * Once the model sets the deltas there is no ending distribution to report -
 * `balanceSim` and the 189-block campaign harness cannot say anything about
 * balance any more, and that is a decision rather than an accident. Balance
 * becomes permanently a play question.
 *
 * What survives is worth having on its own: about forty rounds, offline, through
 * the REAL calendar, the real occupancy, the real engine and the real pool,
 * proving the loop does not crash, the window does not grow without bound, the
 * prefix does not shift, and no value drifts outside its range across a week.
 *
 * Every defect this project has found in play lived in the JOIN between two
 * correct halves, and a harness that plays the whole thing is the only test
 * shape that can see one.
 */

import { describe, it, expect } from 'vitest';
import { beginScene, runRound, endScene, isOver } from './roundEngine.js';
import { newPool, HISTORY_FULL_MAX } from './pool.js';
import { buildTier2 } from './tiers.js';
import { poolEntries } from './pool.js';
import { createMockClient } from '../tools/mockClient.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { getIdentity } from '../data/identities.js';
import { generateWeek, occupancyAt } from '../systems/calendar.js';
import { doingLine } from '../data/activities.js';
import { LOCATIONS } from '../data/locations.js';
import { DELTA_MAX } from '../config/rules.js';

const SEED = 42;
const BLOCKS = ['morning', 'afternoon', 'evening'];

/**
 * Play a week, one scene per block, walking into a different room each time.
 *
 * The room is chosen by the harness rather than by a player, and it is chosen
 * WITHOUT looking at occupancy - which is the point of Part I.11 and also the
 * only honest way to drive this: the player cannot see who is in a room, so a
 * harness that peeks would be exercising a game nobody can play.
 */
async function playWeek({ lang = 'en', days = 3 } = {}) {
  const cards = getCast();
  const lineup = buildLineup(cards);
  const identity = getIdentity();
  const client = createMockClient({ seed: SEED, delay: 0 });

  const weekPlan = generateWeek({ phase: 'prep', cards, seed: SEED, week: 0 });
  const rooms = ['practice_room', 'wardrobe', 'cafe', 'dorm_living', 'drink_room'];

  const relations = Object.fromEntries(
    cards.map((c) => [c.id, { affection: c.startIntimacy ?? 5, admissibility: 0 }]),
  );
  let player = { name: 'Yuhan', selfId: 40, mood: 55, secrecy: 70 };
  let pool = newPool();
  let live = relations;

  const rounds = [];
  const tier1s = new Set();
  let sceneNo = 0;

  for (let day = 0; day < days; day += 1) {
    for (const block of BLOCKS) {
      sceneNo += 1;
      const locationId = rooms[sceneNo % rooms.length];
      const occupancy = occupancyAt(weekPlan, {
        day,
        block,
        cards,
        seed: SEED,
        week: 0,
        phase: 'prep',
      });
      const present = cards.filter((c) => occupancy[c.id]?.locationId === locationId).map((c) => c.id);
      const doing = present[0] ? doingLine(occupancy[present[0]].activity) : null;
      const name = cards.find((c) => c.id === present[0])?.name;

      let session = beginScene({
        cards,
        lineup,
        identity,
        player,
        relations: live,
        lang,
        pool,
        seed: SEED,
        scene: {
          id: `s${sceneNo}`,
          locationId,
          locationLabel: LOCATIONS[locationId].label ?? locationId,
          present,
          activity: doing && name ? `${name} is ${doing}.` : null,
          week: 0,
          day,
          block,
          phase: 'prep',
        },
      });
      tier1s.add(session.tier1);

      let choice = null;
      const tier2s = [];
      while (!isOver(session)) {
        const out = await runRound(session, { client, choice });
        session = out.session;
        rounds.push(out.round);
        tier2s.push(buildTier2(poolEntries(session.pool)));
        // A middling answer every time, so nothing here is a player trying to win.
        choice = out.round.options[1] ?? out.round.options[0] ?? null;
      }

      // Within a scene the history only ever grows at the end.
      for (let i = 1; i < tier2s.length; i += 1) {
        expect(tier2s[i].startsWith(tier2s[i - 1])).toBe(true);
      }

      const closed = endScene(session);
      pool = closed.pool;
      live = closed.relations;
      player = closed.player;
    }
  }

  return { rounds, pool, relations: live, player, tier1s, cards };
}

describe('forty rounds, offline, through the real world', () => {
  it('plays a week without crashing or drifting', async () => {
    const { rounds, pool, relations, player, tier1s } = await playWeek();

    expect(rounds.length).toBeGreaterThanOrEqual(36);

    /** Tier 1 is byte-stable for the whole run, or the cache design is a lie. */
    expect(tier1s.size).toBe(1);

    /** The window is stepped, so full scenes never accumulate. */
    expect(pool.closed.filter((s) => s.type === 'full').length).toBeLessThanOrEqual(
      HISTORY_FULL_MAX,
    );
    expect(pool.closed.every((s) => s.summary)).toBe(true);
    expect(pool.current).toBe(null);

    for (const rel of Object.values(relations)) {
      expect(rel.affection).toBeGreaterThanOrEqual(0);
      expect(rel.affection).toBeLessThanOrEqual(100);
      expect(rel.admissibility).toBeGreaterThanOrEqual(0);
      expect(rel.admissibility).toBeLessThanOrEqual(100);
    }
    for (const key of ['selfId', 'mood', 'secrecy']) {
      expect(player[key]).toBeGreaterThanOrEqual(0);
      expect(player[key]).toBeLessThanOrEqual(100);
    }
  });

  it('gets a readable round nearly every time, and never a broken one', async () => {
    const { rounds } = await playWeek();

    // Prose always. A round with no prose is a blank screen, which is the one
    // failure the tolerant parser exists to make impossible.
    expect(rounds.every((r) => r.prose.length > 0)).toBe(true);

    // Options nearly always - the offline writer drops the sentinel on purpose
    // sometimes, and the UI backfills. A round short of four is survivable; most
    // rounds being short of four is not.
    const full = rounds.filter((r) => r.options.length === 4).length;
    expect(full / rounds.length).toBeGreaterThan(0.8);

    // And nothing the parser was supposed to eat reaches the screen.
    expect(rounds.some((r) => /^[A-D]\s*\|/m.test(r.prose))).toBe(false);
    expect(rounds.some((r) => /%%%/.test(r.prose))).toBe(false);
  });

  it('holds the delta bound over a whole week', async () => {
    const { rounds } = await playWeek();
    for (const r of rounds) {
      for (const d of Object.values(r.deltas)) {
        expect(Math.abs(d)).toBeLessThanOrEqual(DELTA_MAX);
      }
    }
  });

  /**
   * The empty room is what happens when you guess wrong (Part I.11), so it has
   * to be a scene rather than an error. A week of blind room choices reliably
   * produces some.
   */
  it('writes an empty room rather than failing on one', async () => {
    const { rounds } = await playWeek();
    const empty = rounds.filter((r) => r.emotion === null);
    expect(empty.length).toBeGreaterThan(0);
    expect(empty.every((r) => r.prose.length > 0)).toBe(true);
  });

  it('plays the same week in Chinese', async () => {
    const { rounds } = await playWeek({ lang: 'zh', days: 2 });
    expect(rounds.every((r) => r.prose.length > 0)).toBe(true);
    expect(rounds.some((r) => /[一-鿿]/.test(r.prose))).toBe(true);
  });
});
