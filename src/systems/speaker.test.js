import { describe, it, expect } from 'vitest';
import {
  stakeOf,
  rankBystanders,
  pickInterjector,
  pickOnPass,
  setAddressee,
  openingAddressee,
  trackSilence,
} from './speaker.js';
import { newRelation } from './relationship.js';
import { INTERJECT_THRESHOLD } from '../config/constants.js';

const rel = (over = {}) => ({ ...newRelation(5), ...over });
const room = ['irene', 'nana', 'jisoo'];

const ctx = (relations, extra = {}) => ({ relations, mentioned: [], silentTurns: {}, ...extra });

describe('stakeOf', () => {
  it('is zero for somebody with no relationship at all', () => {
    expect(stakeOf('ghost', ctx({}))).toBe(0);
  });

  it('rises with how invested she already is', () => {
    const low = stakeOf('irene', ctx({ irene: rel({ intimacy: 10 }) }));
    const high = stakeOf('irene', ctx({ irene: rel({ intimacy: 90 }) }));
    expect(high).toBeGreaterThan(low);
  });

  it('rises with each jealousy band', () => {
    const at = (j) => stakeOf('irene', ctx({ irene: rel({ intimacy: 50, jealousy: j }) }));
    expect(at(30)).toBeGreaterThan(at(0));
    expect(at(60)).toBeGreaterThan(at(30));
    expect(at(85)).toBeGreaterThan(at(60));
  });

  it('rises when she was just talked about', () => {
    const relations = { irene: rel({ intimacy: 50 }) };
    const quiet = stakeOf('irene', ctx(relations));
    const named = stakeOf('irene', ctx(relations, { mentioned: ['irene'] }));
    expect(named).toBeGreaterThan(quiet);
  });

  /**
   * The one that matters most for how a scene reads. A member who never speaks
   * stops being in the room, so silence itself has to build pressure.
   */
  it('rises the longer she has stood there saying nothing', () => {
    const relations = { irene: rel({ intimacy: 50 }) };
    const fresh = stakeOf('irene', ctx(relations, { silentTurns: { irene: 0 } }));
    const ignored = stakeOf('irene', ctx(relations, { silentTurns: { irene: 3 } }));
    expect(ignored).toBeGreaterThan(fresh);
  });

  it('stops counting silence past a point, so it cannot dominate everything', () => {
    const relations = { irene: rel({ intimacy: 50 }) };
    const long = stakeOf('irene', ctx(relations, { silentTurns: { irene: 4 } }));
    const absurd = stakeOf('irene', ctx(relations, { silentTurns: { irene: 400 } }));
    expect(absurd).toBe(long);
  });
});

describe('rankBystanders', () => {
  const relations = {
    irene: rel({ intimacy: 80 }),
    nana: rel({ intimacy: 40, jealousy: 60 }),
    jisoo: rel({ intimacy: 10 }),
  };

  it('never includes the person being addressed', () => {
    expect(rankBystanders('irene', room, ctx(relations)).map((b) => b.id)).not.toContain('irene');
  });

  it('puts the biggest stake first', () => {
    expect(rankBystanders('irene', room, ctx(relations))[0].id).toBe('nana');
  });

  it('is deterministic when stakes tie', () => {
    const flat = { a: rel({ intimacy: 50 }), b: rel({ intimacy: 50 }) };
    const once = rankBystanders('x', ['b', 'a'], ctx(flat)).map((r) => r.id);
    const twice = rankBystanders('x', ['a', 'b'], ctx(flat)).map((r) => r.id);
    expect(once).toEqual(twice);
  });
});

describe('pickInterjector', () => {
  it('stays quiet when nobody has enough at stake', () => {
    const relations = { irene: rel({ intimacy: 80 }), nana: rel({ intimacy: 5 }) };
    expect(pickInterjector('irene', ['irene', 'nana'], ctx(relations))).toBeNull();
  });

  it('lets the one who is actually upset cut in', () => {
    const relations = {
      irene: rel({ intimacy: 80 }),
      nana: rel({ intimacy: 70, jealousy: 80 }),
    };
    expect(pickInterjector('irene', ['irene', 'nana'], ctx(relations))).toBe('nana');
  });

  it('never interjects in a room with only one person in it', () => {
    expect(pickInterjector('irene', ['irene'], ctx({ irene: rel({ intimacy: 99 }) }))).toBeNull();
  });

  it('uses a threshold, so something has to have happened', () => {
    const relations = { irene: rel(), nana: rel({ intimacy: 0, jealousy: 0 }) };
    expect(stakeOf('nana', ctx(relations))).toBeLessThan(INTERJECT_THRESHOLD);
    expect(pickInterjector('irene', ['irene', 'nana'], ctx(relations))).toBeNull();
  });
});

/**
 * `pass` is not a skip button - it is the player letting the room breathe, so
 * somebody fills the silence whether or not they cleared the interjection bar.
 */
describe('pickOnPass', () => {
  it('always returns somebody', () => {
    const relations = { irene: rel(), nana: rel(), jisoo: rel() };
    expect(room).toContain(pickOnPass('irene', room, ctx(relations)));
  });

  it('falls back to the addressee when nobody else is there', () => {
    expect(pickOnPass('irene', ['irene'], ctx({ irene: rel() }))).toBe('irene');
  });

  it('fills the silence even below the interjection threshold', () => {
    const relations = { irene: rel(), nana: rel({ intimacy: 1 }) };
    expect(pickOnPass('irene', ['irene', 'nana'], ctx(relations))).toBe('nana');
  });
});

describe('setAddressee', () => {
  it('turns to somebody in the room', () => {
    expect(setAddressee('irene', 'nana', room)).toBe('nana');
  });

  /** Mirrors the parser roster rule: you cannot turn to somebody not there. */
  it('refuses to turn to somebody who is not there', () => {
    expect(setAddressee('irene', 'wendy', room)).toBe('irene');
  });
});

describe('openingAddressee', () => {
  const relations = { irene: rel({ intimacy: 20 }), nana: rel({ intimacy: 90 }) };

  it('honours who the player came to see', () => {
    expect(openingAddressee(room, ctx(relations), 'jisoo')).toBe('jisoo');
  });

  it('ignores a preference for somebody not in the room', () => {
    expect(openingAddressee(['irene', 'nana'], ctx(relations), 'wendy')).toBe('nana');
  });

  it('otherwise opens on whoever the scene is most about', () => {
    expect(openingAddressee(['irene', 'nana'], ctx(relations))).toBe('nana');
  });

  it('handles an empty room without throwing', () => {
    expect(openingAddressee([], ctx({}))).toBeNull();
  });
});

describe('trackSilence', () => {
  it('resets whoever spoke and increments everyone else', () => {
    const next = trackSilence({ irene: 2, nana: 1, jisoo: 0 }, room, 'nana');
    expect(next).toEqual({ irene: 3, nana: 0, jisoo: 1 });
  });

  it('starts everyone from nothing', () => {
    expect(trackSilence({}, room, 'irene')).toEqual({ irene: 0, nana: 1, jisoo: 1 });
  });

  it('drops anyone who has left the room', () => {
    expect(Object.keys(trackSilence({ wendy: 9 }, room, 'irene'))).toEqual(room);
  });
});
