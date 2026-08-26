import { describe, it, expect } from 'vitest';
import { newFloor, turnTo, nextSpeaker, noteSpoke, addresseeOf, speakerWeights } from './floor.js';
import { makeRng } from './rng.js';
import { MAX_STREAK, AFFECTION_PULL, CONTINUITY_PULL } from '../config/constants.js';

const ROOM = ['irene', 'nana', 'jisoo', 'hyewon', 'yeri'];
const flat = Object.fromEntries(ROOM.map((id) => [id, { affection: 5 }]));
const rng = () => makeRng(7);

/** Play n rounds, taking whoever the chain names and answering every time. */
function run(floor, n, { roster = ROOM, relations = flat, spoke = true, seed = 7 } = {}) {
  const draw = makeRng(seed);
  const log = [];
  let f = floor;
  for (let i = 0; i < n; i += 1) {
    const turn = nextSpeaker(f, { roster, relations, spoke, rng: draw });
    log.push(turn);
    f = noteSpoke(f, { primary: turn.primary });
  }
  return { floor: f, log };
}

describe('the chain', () => {
  /**
   * Three steps, in this order, and the order IS the design: an explicit choice
   * beats the draw, and the draw only applies once somebody has spoken.
   */
  it('gives the floor to whoever the player tapped', () => {
    const floor = turnTo(newFloor(ROOM), 'yeri');
    expect(nextSpeaker(floor, { roster: ROOM, relations: flat, rng: rng() }).primary).toBe('yeri');
  });

  it('falls back to the roster only when nothing has happened yet', () => {
    const turn = nextSpeaker(newFloor(ROOM), { roster: ROOM, relations: flat, rng: rng() });
    expect(turn.primary).toBe('irene');
    expect(turn.mode).toBe('answers');
  });

  /** A tap outranks the draw, which is the whole reason a tap exists. */
  it('lets a tap take the floor from whoever the draw would have picked', () => {
    let floor = noteSpoke(newFloor(ROOM), { primary: 'jisoo' });
    floor = turnTo(floor, 'hyewon');
    expect(nextSpeaker(floor, { roster: ROOM, relations: flat, rng: rng() }).primary).toBe(
      'hyewon',
    );
  });

  /**
   * STICKY. The commonest thing a player does is keep talking to the same
   * person, and that has to cost nothing - the first hand test's complaint was
   * that changing WHO required typing free text, not that staying was hard.
   *
   * And it survives the streak cap, which nothing else does: asking for
   * somebody by name is an instruction, and a pacing rule must never refuse one.
   */
  it('stays on the addressee across rounds, past the streak cap', () => {
    const { log } = run(turnTo(newFloor(ROOM), 'nana'), MAX_STREAK + 3);
    expect(log.map((r) => r.primary)).toEqual(Array(MAX_STREAK + 3).fill('nana'));
  });

  it('ignores a tap on somebody who is not in the room', () => {
    expect(turnTo(newFloor(ROOM), 'seulgi').addresseeId).toBeNull();
  });

  it('has nobody to give it to in an empty room', () => {
    expect(nextSpeaker(newFloor([]), { roster: [] })).toMatchObject({
      primary: null,
      mode: 'answers',
    });
    expect(addresseeOf(newFloor([]), { roster: [] })).toBeNull();
  });
});

/**
 * ONE VOICE A ROUND, and `mode` is what stops that reading as a queue.
 *
 * It is the difference between she is answering you, she is carrying on because
 * nobody stopped her, and somebody else has taken the floor. v1 spent a whole
 * extra model call per round on the third one.
 */
describe('the posture', () => {
  it('answers when the player spoke to her', () => {
    const floor = turnTo(noteSpoke(newFloor(ROOM), { primary: 'irene' }), 'irene');
    expect(
      nextSpeaker(floor, { roster: ROOM, relations: flat, spoke: true, rng: rng() }),
    ).toMatchObject({ primary: 'irene', mode: 'answers', changed: false });
  });

  it('continues when she keeps the floor and nobody answered', () => {
    const floor = turnTo(noteSpoke(newFloor(ROOM), { primary: 'irene' }), 'irene');
    const turn = nextSpeaker(floor, { roster: ROOM, relations: flat, spoke: false, rng: rng() });
    expect(turn).toMatchObject({ primary: 'irene', mode: 'continues', changed: false });
  });

  /**
   * Somebody new takes it while the player said nothing. That IS the
   * interruption, and it costs no extra call - it is the round that was
   * happening anyway, given to somebody else.
   */
  it('cuts in when somebody new takes it unasked', () => {
    let floor = newFloor(ROOM);
    for (let i = 0; i < 3; i += 1) floor = noteSpoke(floor, { primary: 'irene' });

    const turn = nextSpeaker(floor, { roster: ROOM, relations: flat, spoke: false, rng: rng() });
    expect(turn.primary).not.toBe('irene');
    expect(turn.mode).toBe('cuts_in');
  });

  /** Answering somebody moves the conversation, so it is never an interruption. */
  it('never calls it a cut-in when the player just spoke', () => {
    const { log } = run(newFloor(ROOM), 8, { spoke: true });
    expect(log.every((r) => r.mode === 'answers')).toBe(true);
  });
});

describe('the weights', () => {
  /**
   * SILENCE DOMINATES, and that is the load-bearing part. It is unbounded while
   * everything else is capped, so the room always circulates eventually however
   * the other terms fall.
   */
  it('lets silence outgrow affection and continuity together', () => {
    let floor = newFloor(ROOM);
    for (let i = 0; i < 4; i += 1) floor = noteSpoke(floor, { primary: 'irene' });

    const w = speakerWeights(floor, {
      roster: ROOM,
      relations: { ...flat, nana: { affection: 100 } },
    });
    // Irene is capped out entirely; the quiet ones are all above what affection
    // and continuity could ever contribute on their own.
    expect(w.irene).toBeUndefined();
    expect(w.jisoo).toBeGreaterThan(AFFECTION_PULL + CONTINUITY_PULL);
  });

  it('gives the recent speaker a continuity bonus that fades', () => {
    const floor = noteSpoke(newFloor(ROOM), { primary: 'irene' });
    const w = speakerWeights(floor, { roster: ROOM, relations: flat });

    // One round in, she is still ahead...
    expect(w.irene).toBeGreaterThan(w.jisoo);

    // ...and two rounds later the quiet ones have overtaken her.
    let later = noteSpoke(floor, { primary: 'irene' });
    later = noteSpoke(later, { primary: 'nana' });
    const w2 = speakerWeights(later, { roster: ROOM, relations: flat });
    expect(w2.jisoo).toBeGreaterThan(w2.nana);
  });

  it('tilts toward affection without handing her the room', () => {
    const floor = noteSpoke(newFloor(ROOM), { primary: 'nana' });
    const loved = { ...flat, jisoo: { affection: 100 } };
    const w = speakerWeights(floor, { roster: ROOM, relations: loved });

    expect(w.jisoo).toBeGreaterThan(w.hyewon);
    expect(w.jisoo - w.hyewon).toBeLessThanOrEqual(AFFECTION_PULL);
  });

  /** Nobody is ever impossible, however recently she spoke. */
  it('never drops anybody to zero', () => {
    const floor = noteSpoke(newFloor(ROOM), { primary: 'irene' });
    for (const v of Object.values(speakerWeights(floor, { roster: ROOM, relations: flat }))) {
      expect(v).toBeGreaterThan(0);
    }
  });
});

/**
 * THE BELT. The weights are a distribution, a distribution can roll badly, and
 * rolling badly here looks exactly like the bug this replaced: one member takes
 * over and every round is her.
 */
describe('the streak cap', () => {
  it('takes the floor off anybody who has held it too long', () => {
    let floor = newFloor(ROOM);
    for (let i = 0; i < MAX_STREAK; i += 1) floor = noteSpoke(floor, { primary: 'irene' });

    expect(floor.streak.irene).toBe(MAX_STREAK);
    for (let seed = 1; seed <= 20; seed += 1) {
      const turn = nextSpeaker(floor, { roster: ROOM, relations: flat, rng: makeRng(seed) });
      expect(turn.primary, `seed ${seed}`).not.toBe('irene');
    }
  });

  it('resets the moment somebody else speaks', () => {
    let floor = newFloor(ROOM);
    for (let i = 0; i < MAX_STREAK; i += 1) floor = noteSpoke(floor, { primary: 'irene' });
    floor = noteSpoke(floor, { primary: 'nana' });
    expect(floor.streak.irene).toBe(0);
  });

  /**
   * A two-member room where one of them is capped out - the cap YIELDS rather
   * than returning nobody. A round with no speaker is a dead screen.
   */
  it('yields rather than emptying the room', () => {
    let floor = newFloor(['irene']);
    for (let i = 0; i < MAX_STREAK + 1; i += 1) floor = noteSpoke(floor, { primary: 'irene' });

    expect(nextSpeaker(floor, { roster: ['irene'], relations: flat, rng: rng() }).primary).toBe(
      'irene',
    );
  });
});

describe('the room circulates', () => {
  it('brings everybody round without a rota', () => {
    const { log } = run(newFloor(ROOM), 14, { spoke: false });
    expect(new Set(log.map((r) => r.primary)).size).toBe(ROOM.length);
  });

  /**
   * Ties are broken by the RNG, never by position. Round two is close to a
   * five-way tie, and this codebase has shipped a deterministic index standing
   * in for a choice four times.
   */
  it('does not always pick the same member out of a near-tie', () => {
    const floor = noteSpoke(newFloor(ROOM), { primary: 'irene' });
    const seen = new Set();
    for (let seed = 1; seed <= 30; seed += 1) {
      seen.add(nextSpeaker(floor, { roster: ROOM, relations: flat, rng: makeRng(seed) }).primary);
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  /**
   * A 1v1 in an OCCUPIED room. The roster is one, the room is not, and the
   * others are witnesses rather than voices (section 5b) - standing there
   * requires no lines. Passing the room in here put Nana in a scene the player
   * opened with Yeri.
   */
  it('never speaks for somebody in the room but not on the roster', () => {
    const { log } = run(newFloor(['yeri']), 5, { roster: ['yeri'], spoke: false });
    expect(log.every((r) => r.primary === 'yeri')).toBe(true);
  });
});

describe('the addressee, seen from outside the scene', () => {
  /**
   * `propagate` needs this. A scene's SUBJECT is whoever the player spent it
   * on, and reading `presentIds[0]` instead produced "I chose Yeri to have a
   * 1v1 chat, while witness is herself".
   *
   * The TAP wins here even more clearly than in the draw: who the player chose
   * to spend the scene on is a question about intent, and a member who happened
   * to take the last round does not change the answer.
   */
  it('is who the player tapped, not who last spoke', () => {
    let floor = turnTo(newFloor(ROOM), 'yeri');
    floor = noteSpoke(floor, { primary: 'nana' });
    expect(addresseeOf(floor, { roster: ROOM })).toBe('yeri');
  });

  it('falls back to the last speaker when nobody was tapped', () => {
    const floor = noteSpoke(newFloor(ROOM), { primary: 'jisoo' });
    expect(addresseeOf(floor, { roster: ROOM })).toBe('jisoo');
  });

  it('is stable - reading it twice cannot give two answers', () => {
    const floor = noteSpoke(newFloor(ROOM), { primary: 'jisoo' });
    expect(addresseeOf(floor, { roster: ROOM })).toBe(addresseeOf(floor, { roster: ROOM }));
  });

  it('is the one member of a 1v1, tapped or not', () => {
    expect(addresseeOf(newFloor(['nana']), { roster: ['nana'] })).toBe('nana');
  });
});

/**
 * WHETHER THE SUBJECT JUST CHANGED, which is a fact about PROSE.
 *
 * Found by the live harness rather than by reading. Round 8 of a five-member
 * scene handed the floor to somebody new and the model wrote her as 她
 * throughout - correct for an established subject, and exactly wrong on the
 * round it stops being the same one. The player could not tell who was talking.
 *
 * Only the code knows the subject changed, so only the code can say to name her.
 */
describe('whether the speaker is new', () => {
  it('is false while the same member keeps the floor', () => {
    const floor = turnTo(noteSpoke(newFloor(ROOM), { primary: 'irene' }), 'irene');
    expect(nextSpeaker(floor, { roster: ROOM, relations: flat, rng: rng() }).changed).toBe(false);
  });

  it('is true when somebody else takes it', () => {
    let floor = newFloor(ROOM);
    for (let i = 0; i < 3; i += 1) floor = noteSpoke(floor, { primary: 'irene' });
    expect(nextSpeaker(floor, { roster: ROOM, relations: flat, rng: rng() }).changed).toBe(true);
  });

  /** The first round of a scene has no previous subject, so she is always new. */
  it('is true on the opening round', () => {
    expect(nextSpeaker(newFloor(ROOM), { roster: ROOM, relations: flat, rng: rng() }).changed).toBe(
      true,
    );
  });

  it('is true when a tap moves the floor, and false when it does not', () => {
    const after = noteSpoke(newFloor(ROOM), { primary: 'irene' });
    expect(
      nextSpeaker(turnTo(after, 'yeri'), { roster: ROOM, relations: flat, rng: rng() }).changed,
    ).toBe(true);
    expect(
      nextSpeaker(turnTo(after, 'irene'), { roster: ROOM, relations: flat, rng: rng() }).changed,
    ).toBe(false);
  });
});
