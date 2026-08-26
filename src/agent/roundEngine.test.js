import { describe, it, expect } from 'vitest';
import { beginScene, runRound, endScene, leave, roundsLeft, isOver } from './roundEngine.js';
import { newPool, poolEntries } from './pool.js';
import { SENTINEL } from '../config/rules.js';
import { SCENE_ROUNDS_MIN, SCENE_ROUNDS_MAX } from '../config/constants.js';
import { RISK_EXPOSURE_THRESHOLD } from '../config/constants.js';
import { getCast } from '../data/cast.js';
import { getIdentity } from '../data/identities.js';
import { newRelation } from '../systems/relationship.js';

const cards = getCast().filter((c) => c.id === 'irene');

/** A client that answers with exactly what the test wants to see parsed. */
function scripted(...replies) {
  const seen = [];
  let n = 0;
  const client = async ({ messages, onChunk }) => {
    seen.push(messages);
    const out = replies[Math.min(n, replies.length - 1)];
    n += 1;
    onChunk?.(out);
    return out;
  };
  client.seen = seen;
  return client;
}

function round({ prose = 'She looks up.', options = ['a', 'b', 'c', 'd'], extra = [] } = {}) {
  return [
    prose,
    SENTINEL,
    ...options.map((o, i) => `${'ABCD'[i]}|${o}`),
    'emo|neutral',
    ...extra,
  ].join('\n');
}

function open(overrides = {}) {
  return beginScene({
    cards,
    identity: getIdentity(),
    player: { name: 'Yuhan', selfId: 40, mood: 55, secrecy: 70 },
    relations: { irene: { affection: 20, admissibility: 0 } },
    lang: 'en',
    pool: newPool(),
    seed: 3,
    scene: {
      id: 's1',
      locationId: 'practice_room',
      locationLabel: 'X Practice Room',
      present: ['irene'],
      week: 0,
      day: 1,
      block: 'evening',
      phase: 'prep',
    },
    ...overrides,
  });
}

describe('the round engine', () => {
  it('runs a round and hands back what the model wrote', async () => {
    const client = scripted(round({ prose: 'She is at the mirror.' }));
    const { session, round: r } = await runRound(open(), { client });

    expect(r.prose).toBe('She is at the mirror.');
    expect(r.options).toEqual(['a', 'b', 'c', 'd']);
    expect(r.emotion).toBe('neutral');
    expect(poolEntries(session.pool)).toHaveLength(1);
  });

  it('draws a scene length inside the band', async () => {
    for (let i = 0; i < 20; i += 1) {
      const s = open({ seed: i, scene: { ...open().scene, id: `s${i}` } });
      expect(s.total).toBeGreaterThanOrEqual(SCENE_ROUNDS_MIN);
      expect(s.total).toBeLessThanOrEqual(SCENE_ROUNDS_MAX);
    }
  });

  it('is the same length on the same seed, so a reload resumes the same scene', () => {
    expect(open({ seed: 11 }).total).toBe(open({ seed: 11 }).total);
  });

  it('moves nothing on the first round, whatever the model asks for', async () => {
    const client = scripted(round({ extra: ['irene+2'] }));
    const { session } = await runRound(open(), { client });
    expect(session.relations.irene.affection).toBe(20);
  });

  it('applies a delta on a later round', async () => {
    const client = scripted(round(), round({ extra: ['irene+2'] }));
    let s = open();
    ({ session: s } = await runRound(s, { client }));
    ({ session: s } = await runRound(s, { client, choice: 'a' }));
    expect(s.relations.irene.affection).toBe(22);
  });

  /** Part I.9, end to end: an empty practice room at night sees nothing. */
  it('refuses an admissibility rise in a low-exposure room', async () => {
    const client = scripted(round(), round({ extra: ['irene_adm+2'] }));
    let s = open();
    expect(s.exposure).toBeLessThan(RISK_EXPOSURE_THRESHOLD);
    ({ session: s } = await runRound(s, { client }));
    const out = await runRound(s, { client, choice: 'a' });
    expect(out.session.relations.irene.admissibility).toBe(0);
    expect(out.round.refused).toContain('irene_adm');
  });

  it('writes the player choice onto the round it answered', async () => {
    const client = scripted(round());
    let s = open();
    ({ session: s } = await runRound(s, { client }));
    ({ session: s } = await runRound(s, { client, choice: 'Say you were passing' }));
    expect(poolEntries(s.pool)[0].choice).toBe('Say you were passing');
  });

  /**
   * The prefix argument, at the level the engine actually produces it - and
   * across four rounds rather than two, because the round that could break it is
   * the one where a choice is patched onto an entry that has ALREADY been sent.
   */
  it('grows tier 2 by appending, never by rewriting', async () => {
    const client = scripted(round());
    let s = open();
    for (let i = 0; i < 4; i += 1) {
      ({ session: s } = await runRound(s, { client, choice: i ? `pick ${i}` : null }));
    }
    const tier2 = client.seen.map((m) => m[1].content);
    for (let i = 1; i < tier2.length; i += 1) {
      expect(tier2[i].startsWith(tier2[i - 1])).toBe(true);
    }
  });

  it('keeps tier 1 byte-identical between rounds', async () => {
    const client = scripted(round());
    let s = open();
    ({ session: s } = await runRound(s, { client }));
    ({ session: s } = await runRound(s, { client, choice: 'a' }));
    expect(client.seen[1][0].content).toBe(client.seen[0][0].content);
  });

  it('asks for a summary on the last round and on no other', async () => {
    const client = scripted(round());
    let s = open();
    const asks = [];
    for (let i = 0; i < s.total; i += 1) {
      ({ session: s } = await runRound(s, { client, choice: i ? 'a' : null }));
      asks.push(/This is the LAST round/.test(client.seen[i][2].content));
    }
    expect(asks.filter(Boolean)).toHaveLength(1);
    expect(asks[asks.length - 1]).toBe(true);
    expect(isOver(s)).toBe(true);
  });

  it('carries a note into the tail', async () => {
    const client = scripted(round());
    await runRound(open(), { client, note: 'System note: the player has just handed Irene a coffee.' });
    expect(client.seen[0][2].content).toContain('handed Irene a coffee');
  });

  it('streams prose to the caller before the round resolves', async () => {
    const shown = [];
    const client = scripted(round({ prose: 'She is at the mirror.' }));
    await runRound(open(), { client, onChunk: (t) => shown.push(t) });
    expect(shown.join('')).toContain('She is at the mirror.');
    expect(shown.join('')).not.toContain(SENTINEL);
  });

  /** Leave forfeits the rest; the block is already paid for. */
  it('ends on the next round once the player leaves', async () => {
    const client = scripted(round());
    let s = open();
    ({ session: s } = await runRound(s, { client }));
    expect(roundsLeft(s)).toBeGreaterThan(0);
    s = leave(s);
    expect(roundsLeft(s)).toBe(0);
  });

  it('closes with the summary the model gave', async () => {
    const client = scripted(round({ extra: ['sum|She let something slip.'] }));
    const { session } = await runRound(open(), { client });
    const out = endScene(session);
    expect(out.pool.closed[0].summary).toBe('She let something slip.');
    expect(out.pool.current).toBe(null);
  });

  /** Bookkeeping is bookkeeping. A walked-out scene costs no model call. */
  it('composes a line in code when the model gave no summary', async () => {
    const client = scripted(round());
    const { session } = await runRound(open(), { client });
    expect(endScene(session).summary).toContain('X Practice Room');
  });

  it('survives a reply with no sentinel at all', async () => {
    const client = scripted('She does not answer straight away.');
    const { session, round: r } = await runRound(open(), { client });
    expect(r.prose).toBe('She does not answer straight away.');
    expect(r.options).toEqual([]);
    expect(session.relations.irene.affection).toBe(20);
  });

  /**
   * THE JOIN, and it is the one this project keeps shipping broken.
   *
   * Every test above builds `relations` by hand, with the field name v2 uses.
   * `App` does not - it calls `newRelation`, which wrote `intimacy` for six
   * milestones. So on a real run `rel.affection` was `undefined`, the value bar
   * showed every member at 0 while the day screen showed 5, and tier 3 told the
   * model `affection NaN` - which is the number the entire pacing band, and
   * therefore the whole genre correction, is read off.
   *
   * Both halves were correct. Nothing joined them, and 879 tests were green.
   */
  it('reads a relation built the way App builds one', async () => {
    const client = scripted(round());
    await runRound(open({ relations: { irene: newRelation(12) } }), { client });

    const tail = client.seen[0][2].content;
    expect(tail).toContain('affection 12');
    expect(tail).not.toMatch(/NaN|undefined/);
  });

  /**
   * Did the player do anything the room could NAME? Section 5b, Part I.8.
   *
   * `systems/rumor.js` needs one bit at scene exit, and section 5b is emphatic
   * about where it may come from: PASSED, never inferred. The v1 loop read the
   * same flag off `Boolean(note)` when the only thing that appended a note was
   * an opener; a closing directive arrived eight weeks later as one more note
   * and quietly made every group scene in the game end witnessed, so four
   * absent members took the heaviest event in the game for a conversation.
   *
   * Today the only note that exists IS a gesture - but that is a fact about
   * today, which is exactly why the session carries a field instead of the exit
   * path re-deriving it.
   */
  describe('what the room could describe', () => {
    it('is false through a scene of nothing but talking', async () => {
      const client = scripted(round(), round());
      let s = open();
      ({ session: s } = await runRound(s, { client }));
      ({ session: s } = await runRound(s, { client, choice: 'Ask about the choreography' }));

      expect(s.gestured).toBe(false);
      expect(endScene(s).gestured).toBe(false);
    });

    it('turns true the moment the player hands something over', async () => {
      const client = scripted(round(), round());
      let s = open();
      ({ session: s } = await runRound(s, { client }));
      ({ session: s } = await runRound(s, {
        client,
        note: 'System note: the player has just handed Irene a hand warmer.',
      }));

      expect(endScene(s).gestured).toBe(true);
    });

    it('stays true for the rest of the scene', async () => {
      const client = scripted(round(), round(), round());
      let s = open();
      ({ session: s } = await runRound(s, { client }));
      ({ session: s } = await runRound(s, { client, note: 'System note: she was handed a dish.' }));
      ({ session: s } = await runRound(s, { client, choice: 'Say nothing' }));

      expect(endScene(s).gestured).toBe(true);
    });
  });
});
