/**
 * WHO SPEAKS, AND WHO IS NOT EVEN HERE. CLAUDE.md Part I.3, section 9.
 *
 * Two reports from one phone session, and each turned out to be one missing
 * sentence in the tail:
 *
 *   > if player choose interact to Irene's option in 1st round, then options of
 *   > following round tend to be all different interactions to Irene ... While
 *   > the lines and scene disc contains all characters.
 *
 *   > 1v1 chat button leads to group chat ... I clicked 1v1 chat to Yeri, while
 *   > NANA and Yeri all occurs. What's worse, Irene also occurred!
 *
 * Nothing told the model who had the floor, so it wrote every member every
 * round - and having written everybody, it aimed all four options at whoever
 * the player had just answered. Nothing said who was ABSENT either, so with the
 * previous scene's Chinese prose sitting in tier 2 it walked Irene in from two
 * locations away.
 *
 * Asserted against the RENDERED TAIL rather than against `systems/floor.js`,
 * because the decision was never the part that was wrong. `onEnter` has computed
 * a correct roster since v2's first day and the scene was built from
 * `presentIds` one line later - a right answer with nothing reading it, which is
 * this project's entire bug catalogue.
 */

import { describe, it, expect } from 'vitest';
import { beginScene, runRound, endScene, turnToMember, roundsLeft } from './roundEngine.js';
import { newPool } from './pool.js';
import { SENTINEL } from '../config/rules.js';
import { getCast } from '../data/cast.js';
import { getIdentity } from '../data/identities.js';
import { newRelation } from '../systems/relationship.js';
import { MAX_STREAK } from '../config/constants.js';

const room = getCast();
const everyone = room.map((c) => c.id);
const nameOf = (id) => room.find((c) => c.id === id)?.name;

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

const aRound = () =>
  ['She looks up.', SENTINEL, 'A|a', 'B|b', 'C|c', 'D|d', 'emo|neutral'].join('\n');

function open({ present = everyone, roster = present, seed = 3, id = 's1' } = {}) {
  return beginScene({
    cards: room,
    identity: getIdentity(),
    player: { name: 'Yuhan', selfId: 40, mood: 55, secrecy: 70 },
    relations: Object.fromEntries(room.map((c) => [c.id, newRelation(5)])),
    lang: 'en',
    pool: newPool(),
    seed,
    scene: {
      id,
      locationId: 'practice_room',
      locationLabel: 'X Practice Room',
      present,
      roster,
      week: 0,
      day: 1,
      block: 'evening',
      phase: 'prep',
    },
  });
}

/** Tier 3 is the last message; everything above it is cached and static. */
const tailOf = (client) => client.seen.at(-1).at(-1).content;

describe('the tail says who has the floor', () => {
  it('names exactly one member, and says to write her alone', async () => {
    const client = scripted(aRound());
    const { session } = await runRound(open(), { client });
    const tail = tailOf(client);

    expect(tail).toContain('## WHO SPEAKS');
    expect(tail).toContain(`(${session.turn.primary})`);
    expect(tail).toContain('One voice this round');

    /**
     * ...and nobody else is named as A SPEAKER. The silent list names everybody
     * else by display name on purpose; what must not appear is a second
     * `(id)` handle, which is what the model reads as "write this person".
     */
    const block = tail.slice(tail.indexOf('## WHO SPEAKS'), tail.indexOf('## VALUES'));
    expect(block).toBeTruthy();
    for (const id of everyone.filter((x) => x !== session.turn.primary)) {
      expect(block, id).not.toContain(`(${id})`);
    }
  });

  /**
   * Everybody else is told to stay out of it, BY NAME. A model handed two
   * speakers and four other people in the room will otherwise give the four a
   * line each anyway - which is the five-paragraph round the report describes.
   */
  it('names the members who do not speak this round', async () => {
    const client = scripted(aRound());
    const { session } = await runRound(open(), { client });
    const tail = tailOf(client);

    expect(tail).toContain('Nobody else speaks this round');
    const silent = everyone.filter((id) => id !== session.turn.primary);
    expect(silent.length).toBeGreaterThan(0);
    for (const id of silent) {
      expect(tail, id).toMatch(new RegExp(`Nobody else speaks[^\\n]*${nameOf(id)}`));
    }
  });

  /**
   * A 1V1 IN AN OCCUPIED ROOM. The roster is one and the room is not; the
   * others are witnesses, and standing there requires no lines (section 5b).
   *
   * This is the report exactly - "1v1 chat button leads to group chat" - and it
   * was never a prompt failure. `rosterIds` said `['yeri']` and the scene was
   * built from `presentIds`.
   */
  it('keeps a one-to-one one-sided when somebody else is in the room', async () => {
    const client = scripted(aRound());
    const { session } = await runRound(open({ present: ['nana', 'yeri'], roster: ['yeri'] }), {
      client,
    });
    const tail = tailOf(client);

    expect(session.turn.primary).toBe('yeri');
    expect(tail).toContain('Present: Nana (nana), Yeri (yeri)');
    expect(tail).toMatch(/Nana is in the room and does not speak/);
    // Escaped, because `(nana)` unescaped is a capture group and matches nothing
    // useful - a regex that passes for the wrong reason is worse than no test.
    expect(tail).not.toMatch(/\(nana\) (has|still has|takes)/);
  });

  /**
   * WHO IS NOT HERE. The cheapest of section 9's three separation layers, and
   * the only one v2 kept none of - there are no per-beat speaker ids left for
   * the parser's roster rule to check against.
   */
  it('names the absent cast as absent', async () => {
    const client = scripted(aRound());
    await runRound(open({ present: ['nana', 'yeri'], roster: ['yeri'] }), { client });
    const tail = tailOf(client);

    for (const id of ['irene', 'jisoo', 'hyewon']) {
      expect(tail, id).toMatch(new RegExp(`Not here, and cannot appear:[^\\n]*${nameOf(id)}`));
    }
    expect(tail).not.toMatch(/Not here[^\n]*Nana/);
  });

  it('says nothing about absence when the whole cast is in the room', async () => {
    const client = scripted(aRound());
    await runRound(open(), { client });
    expect(tailOf(client)).not.toMatch(/Not here, and cannot appear/);
  });

  /** A scene with nobody in it has no floor to talk about. */
  it('is silent about all of this in an empty room', async () => {
    const client = scripted(aRound());
    await runRound(open({ present: [], roster: [] }), { client });
    const tail = tailOf(client);

    expect(tail).toContain('Nobody else is here.');
    expect(tail).not.toContain('## WHO SPEAKS');
  });
});

describe('the floor moves, and the scene remembers where it ended', () => {
  it('hands the floor around when the player keeps letting it pass', async () => {
    const client = scripted(...Array(9).fill(aRound()));
    let s = open({ seed: 11, id: 's9' });

    const heard = [];
    for (let i = 0; i < 9; i += 1) {
      ({ session: s } = await runRound(s, { client, skip: true }));
      heard.push(s.turn.primary);
    }

    // Everybody, without a rota - and nobody holding it for more than the cap.
    expect(new Set(heard).size).toBe(everyone.length);
    expect(Math.max(...Object.values(s.floor.streak))).toBeLessThanOrEqual(MAX_STREAK);
  });

  /**
   * The tap outranks continuity and then sticks - which is the whole answer to
   * "the player has to type manually if they want to change a character".
   */
  it('follows the player to whoever they turned to, and stays there', async () => {
    const client = scripted(aRound(), aRound(), aRound());
    let s = turnToMember(open({ seed: 4, id: 's7' }), 'hyewon');

    for (let i = 0; i < 3; i += 1) {
      ({ session: s } = await runRound(s, { client }));
      expect(s.turn.primary).toBe('hyewon');
    }
  });

  /**
   * `propagate` prices a scene against a SUBJECT and everybody else against
   * her. Reading `presentIds[0]` instead produced *"I chose Yeri to have a 1v1
   * chat, while witness is herself"* - Nana was subject by array position, so
   * Yeri was filed as a witness of her own scene and took the wrong affection.
   */
  it('reports the addressee, not the first name in the room', async () => {
    const client = scripted(aRound(), aRound());
    let s = open({ present: ['nana', 'yeri'], roster: ['nana', 'yeri'], seed: 5, id: 's2' });

    s = turnToMember(s, 'yeri');
    ({ session: s } = await runRound(s, { client }));

    expect(endScene(s).addresseeId).toBe('yeri');
  });

  it('falls back to whoever last held it when the player never tapped', async () => {
    const client = scripted(aRound());
    let s = open({ present: ['nana', 'yeri'], roster: ['nana'], seed: 5, id: 's3' });

    ({ session: s } = await runRound(s, { client }));
    expect(endScene(s).addresseeId).toBe('nana');
  });
});

/**
 * THE FACE CHANGES WITH THE ROUND, NOT WITH ITS ANSWER.
 *
 * Reported from the second hand test:
 *
 *   > when primary character changed for next round, the next round lines start
 *   > streaming while the portrait is still last round speaker until streaming
 *   > finish.
 *
 * `session.turn` only lands when the promise resolves, so the screen drew the
 * previous speaker for the whole of the stream - her name over the dialogue box
 * while somebody else's words arrived under it, for the three or four seconds
 * the player spends reading them. The worst possible moment to be wrong.
 *
 * The decision is already made before the request goes out; it has to be, the
 * prompt is built from it. So this is a synchronous announcement rather than a
 * second decision, and the assertion that matters is ORDERING: `onTurn` fires
 * before the first chunk, and it names the same people the session ends up with.
 */
describe('the turn is announced before the round streams', () => {
  it('fires onTurn ahead of the first chunk, and of the result', async () => {
    const client = scripted(aRound());
    const order = [];
    let announced = null;

    const { session } = await runRound(open(), {
      client,
      onTurn: (t) => {
        announced = t;
        order.push('turn');
      },
      onChunk: () => {
        if (order.at(-1) !== 'chunk') order.push('chunk');
      },
    });

    expect(order).toEqual(['turn', 'chunk']);
    expect(announced).toEqual(session.turn);
  });

  /** It is a report, not a decision - the prompt was already built from it. */
  it('names the same speaker the prompt was built from', async () => {
    const client = scripted(aRound());
    let announced = null;
    await runRound(open(), { client, onTurn: (t) => (announced = t) });

    expect(tailOf(client)).toContain(`(${announced.primary})`);
  });

  /** A caller that does not want to know must not be broken by not asking. */
  it('does not require the callback', async () => {
    const client = scripted(aRound());
    await expect(runRound(open(), { client })).resolves.toBeTruthy();
  });
});

/**
 * LETTING THE ROUND PASS. CLAUDE.md Part I.3, section 10c.
 *
 * Asked for twice, across two engines - once about a member continuing across
 * several turns in v1, and again as *"the player don't need to choose option
 * each round and gives back the skip button"*. A round is one voice now, so
 * hearing her out is a real thing to want.
 *
 * It is section 10c's `pass`: **the player letting the room breathe, not a
 * fast-forward.** So it spends a round like everything else, and the tail says
 * outright that nobody left - an absent choice line is ambiguous, and a model
 * that cannot tell "said nothing" from "move not recorded" writes around the gap
 * by having somebody ask whether the player is alright.
 */
describe('the player lets the round pass', () => {
  it('says so, rather than leaving the choice line absent', async () => {
    const client = scripted(aRound());
    await runRound(open(), { client, skip: true });
    const tail = tailOf(client);

    expect(tail).toMatch(/says nothing and lets the room carry it/i);
    expect(tail).toMatch(/attention, not absence/i);
    expect(tail).not.toContain('The player chose:');
  });

  /** It costs a round. That is what makes it a move rather than a skip button. */
  it('spends a round', async () => {
    const client = scripted(aRound(), aRound());
    let s = open();
    const before = roundsLeft(s);

    ({ session: s } = await runRound(s, { client, skip: true }));
    expect(roundsLeft(s)).toBe(before - 1);
  });

  /**
   * A skip hands the floor to the draw, so she carries on or somebody takes it.
   * Answering is never either of those - the player moved the conversation.
   */
  it('is what makes a round continue or be cut into', async () => {
    const client = scripted(...Array(6).fill(aRound()));
    let s = open({ seed: 2, id: 'sk' });

    const modes = [];
    for (let i = 0; i < 6; i += 1) {
      ({ session: s } = await runRound(s, { client, skip: true }));
      modes.push(s.turn.mode);
    }

    // Round one has nobody to continue from; everything after is one or other.
    expect(modes.slice(1).every((m) => m === 'continues' || m === 'cuts_in')).toBe(true);
    expect(modes).toContain('cuts_in');
  });

  /** Answering and skipping in the same call is answering. A note counts too. */
  it('is not a skip if the player actually said something', async () => {
    const client = scripted(aRound(), aRound());
    let s = open();
    ({ session: s } = await runRound(s, { client }));
    await runRound(s, { client, choice: 'I say this', skip: true });

    const tail = tailOf(client);
    expect(tail).toContain('The player chose: I say this');
    expect(tail).not.toMatch(/lets the room carry it/i);
  });
});
