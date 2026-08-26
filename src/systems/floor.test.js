import { describe, it, expect } from 'vitest';
import { newFloor, turnTo, speakersFor, noteSpoke, addresseeOf } from './floor.js';
import { makeRng } from './rng.js';

const ROOM = ['irene', 'nana', 'jisoo', 'hyewon', 'yeri'];
const rng = () => makeRng(7);

/** Play n rounds, always accepting whoever the chain names. */
function run(floor, n, { roster = ROOM } = {}) {
  const log = [];
  let f = floor;
  for (let i = 0; i < n; i += 1) {
    const turn = speakersFor(f, { roster, rng: rng() });
    log.push(turn);
    f = noteSpoke(f, turn);
  }
  return { floor: f, log };
}

describe('the chain', () => {
  /**
   * Three steps, in this order, and the order IS the design: an explicit choice
   * beats continuity, and continuity beats the arbitrary pick that only ever
   * applies to round one.
   */
  it('gives the floor to whoever the player tapped', () => {
    const floor = turnTo(newFloor(ROOM), 'yeri');
    expect(speakersFor(floor, { roster: ROOM, rng: rng() }).primary).toBe('yeri');
  });

  it('keeps it with the last speaker when nobody has tapped', () => {
    const floor = noteSpoke(newFloor(ROOM), { primary: 'jisoo' });
    expect(floor.addresseeId).toBeNull();
    expect(speakersFor(floor, { roster: ROOM, rng: rng() }).primary).toBe('jisoo');
  });

  it('falls back to the roster only when nothing has happened yet', () => {
    expect(speakersFor(newFloor(ROOM), { roster: ROOM, rng: rng() }).primary).toBe('irene');
  });

  /** A tap outranks continuity, which is the whole reason a tap exists. */
  it('lets a tap take the floor back from the last speaker', () => {
    let floor = noteSpoke(newFloor(ROOM), { primary: 'jisoo' });
    floor = turnTo(floor, 'hyewon');
    expect(speakersFor(floor, { roster: ROOM, rng: rng() }).primary).toBe('hyewon');
  });

  /**
   * STICKY. The commonest thing a player does is keep talking to the same
   * person, and that has to cost nothing - the report's complaint was that
   * changing WHO required typing free text, not that staying was hard.
   */
  it('stays on the addressee across rounds without another tap', () => {
    const floor = turnTo(newFloor(ROOM), 'nana');
    const { log } = run(floor, 4);
    expect(log.map((r) => r.primary)).toEqual(['nana', 'nana', 'nana', 'nana']);
  });

  /** An interruption borrows the floor; it does not redirect the conversation. */
  it('does not hand the floor to whoever cut in', () => {
    const floor = noteSpoke(newFloor(ROOM), { primary: 'irene', second: 'yeri' });
    expect(floor.lastSpeakerId).toBe('irene');
    expect(speakersFor(floor, { roster: ROOM, rng: rng() }).primary).toBe('irene');
  });

  it('ignores a tap on somebody who is not in the room', () => {
    const floor = turnTo(newFloor(ROOM), 'seulgi');
    expect(floor.addresseeId).toBeNull();
  });
});

describe('the second voice', () => {
  it('is somebody other than the primary', () => {
    const { log } = run(turnTo(newFloor(ROOM), 'irene'), 6);
    for (const { primary, second } of log) {
      expect(second).not.toBe(primary);
      expect(ROOM).toContain(second);
    }
  });

  /**
   * SILENCE DOMINATES, which is what makes the room circulate with nothing as
   * rigid as a rota deciding it. A speaker's counter resets, so the next second
   * voice is somebody else - and no rule had to be written for room size.
   */
  it('goes to whoever has been quiet longest', () => {
    let floor = newFloor(ROOM);
    // Everybody but hyewon has spoken recently.
    floor = noteSpoke(floor, { primary: 'irene', second: 'nana' });
    floor = noteSpoke(floor, { primary: 'irene', second: 'jisoo' });
    floor = noteSpoke(floor, { primary: 'irene', second: 'yeri' });

    expect(speakersFor(floor, { roster: ROOM, rng: rng() }).second).toBe('hyewon');
  });

  it('brings everybody round, rather than pairing the same two', () => {
    const { log } = run(turnTo(newFloor(ROOM), 'irene'), 8);
    const heard = new Set(log.flatMap((r) => [r.primary, r.second]));
    expect(heard.size).toBe(ROOM.length);
  });

  /**
   * Ties are broken by the RNG, never by position. Round one of every scene is
   * a five-way tie at silence 0, and this project has shipped a deterministic
   * index standing in for a choice three separate times.
   */
  it('does not always pick the same member out of a tie', () => {
    const seen = new Set();
    for (let seed = 1; seed <= 30; seed += 1) {
      seen.add(speakersFor(newFloor(ROOM), { roster: ROOM, rng: makeRng(seed) }).second);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('is nobody at all in a one-member scene', () => {
    const floor = newFloor(['irene']);
    expect(speakersFor(floor, { roster: ['irene'], rng: rng() })).toEqual({
      primary: 'irene',
      second: null,
    });
  });

  /**
   * A 1v1 in an OCCUPIED room. The roster is one, the room is not, and the
   * others are witnesses rather than voices (section 5b) - standing there
   * requires no lines. Passing the room here is what put Nana in a scene the
   * player opened with Yeri.
   */
  it('never speaks for somebody who is in the room but not on the roster', () => {
    const { log } = run(newFloor(['yeri']), 4, { roster: ['yeri'] });
    for (const { primary, second } of log) {
      expect(primary).toBe('yeri');
      expect(second).toBeNull();
    }
  });
});

describe('the addressee, seen from outside the scene', () => {
  /**
   * `propagate` needs this. A scene's SUBJECT is whoever the player spent it
   * on, and reading `presentIds[0]` instead is what produced "I chose Yeri to
   * have a 1v1 chat, while witness is herself": Nana was subject by array
   * position, so Yeri was listed as a witness of her own scene.
   */
  it('is the same answer the round loop uses', () => {
    let floor = turnTo(newFloor(ROOM), 'yeri');
    floor = noteSpoke(floor, { primary: 'yeri', second: 'nana' });

    expect(addresseeOf(floor, { roster: ROOM })).toBe('yeri');
  });

  it('is stable - reading it twice cannot give two answers', () => {
    const floor = noteSpoke(newFloor(ROOM), { primary: 'jisoo' });
    expect(addresseeOf(floor, { roster: ROOM })).toBe(addresseeOf(floor, { roster: ROOM }));
  });

  it('is the one member of a 1v1, tapped or not', () => {
    expect(addresseeOf(newFloor(['nana']), { roster: ['nana'] })).toBe('nana');
  });

  it('is nobody in an empty room', () => {
    expect(addresseeOf(newFloor([]), { roster: [] })).toBeNull();
    expect(speakersFor(newFloor([]), { roster: [] })).toEqual({ primary: null, second: null });
  });
});
