/**
 * The gate on the mobile console.
 *
 * The overlay itself is a dynamic import and cannot be exercised in node; the
 * DECISION can, and the decision is where the rules are. A rule that is not
 * asserted is one that gets quietly broken (section 21) - and the rule that
 * matters most here is the negative one: an ordinary player must never
 * download half a megabyte of devtools.
 */

import { describe, it, expect, vi } from 'vitest';
import { erudaDecision, maybeInstallEruda } from './eruda.js';

/** localStorage does not exist in the node environment, so stand one up. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, String(v)),
    map,
  };
}

/** ...and one that refuses, the way a locked-down private window does. */
const hostileStorage = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
};

describe('who gets a console', () => {
  it('nobody, by default', () => {
    expect(erudaDecision('', fakeStorage())).toEqual({ load: false, persist: null });
  });

  it('anybody who asks in the URL', () => {
    expect(erudaDecision('?debug=1', fakeStorage()).load).toBe(true);
    expect(erudaDecision('?debug=true', fakeStorage()).load).toBe(true);
  });

  it('ignores an unrelated query string', () => {
    expect(erudaDecision('?lang=zh&slot=2', fakeStorage()).load).toBe(false);
  });

  /**
   * Asking is sticky, and it has to be: an installed PWA opens at `start_url`,
   * which carries no query string. Without this the console would disappear
   * the moment a tester added the game to their home screen - which is exactly
   * when they are most likely to be testing on a phone.
   */
  it('remembers the ask across a reload with no query string', () => {
    const storage = fakeStorage();
    erudaDecisionAndPersist('?debug=1', storage);
    expect(erudaDecision('', storage).load).toBe(true);
  });

  it('forgets it again when told to', () => {
    const storage = fakeStorage();
    erudaDecisionAndPersist('?debug=1', storage);
    erudaDecisionAndPersist('?debug=0', storage);
    expect(erudaDecision('', storage).load).toBe(false);
  });

  /** The URL wins over what was remembered, in both directions. */
  it('lets the URL override the memory', () => {
    const on = fakeStorage({ yuriagent_eruda_v1: '1' });
    expect(erudaDecision('?debug=0', on).load).toBe(false);

    const off = fakeStorage({ yuriagent_eruda_v1: '0' });
    expect(erudaDecision('?debug=1', off).load).toBe(true);
  });

  it('survives storage that refuses to answer', () => {
    expect(() => erudaDecision('', hostileStorage)).not.toThrow();
    expect(erudaDecision('', hostileStorage).load).toBe(false);
    expect(erudaDecision('?debug=1', hostileStorage).load).toBe(true);
  });

  it('survives having no storage at all', () => {
    expect(erudaDecision('?debug=1', null).load).toBe(true);
    expect(erudaDecision('', null).load).toBe(false);
  });
});

/** `maybeInstallEruda` persists as a side effect; this drives that path. */
function erudaDecisionAndPersist(search, storage) {
  return maybeInstallEruda({ search, storage, load: async () => ({ default: stubEruda() }) });
}

function stubEruda() {
  return {
    init: vi.fn(),
    get: () => ({ add: vi.fn() }),
  };
}

describe('loading it', () => {
  it('does not import the chunk for an ordinary player', async () => {
    const load = vi.fn();
    const out = await maybeInstallEruda({ search: '', storage: fakeStorage(), load });

    expect(load).not.toHaveBeenCalled();
    expect(out).toBe(false);
  });

  it('imports and initialises it for somebody who asked', async () => {
    const eruda = stubEruda();
    const out = await maybeInstallEruda({
      search: '?debug=1',
      storage: fakeStorage(),
      load: async () => ({ default: eruda }),
    });

    expect(out).toBe(true);
    expect(eruda.init).toHaveBeenCalled();
  });

  it('gives the dump its own button, because typing it on a phone is the friction', async () => {
    const added = [];
    const eruda = {
      init: vi.fn(),
      get: () => ({ add: (name) => added.push(name) }),
    };
    await maybeInstallEruda({
      search: '?debug=1',
      storage: fakeStorage(),
      load: async () => ({ default: eruda }),
    });

    expect(added).toContain('yuri.dump()');
  });

  /**
   * A diagnostic that takes the game down with it is worse than no
   * diagnostic. Section 3 keeps every degraded mode playable.
   */
  it('fails silently when the chunk will not load', async () => {
    const out = await maybeInstallEruda({
      search: '?debug=1',
      storage: fakeStorage(),
      load: async () => {
        throw new Error('offline');
      },
    });
    expect(out).toBe(false);
  });

  it('fails silently when init throws', async () => {
    const out = await maybeInstallEruda({
      search: '?debug=1',
      storage: fakeStorage(),
      load: async () => ({
        default: {
          init: () => {
            throw new Error('no dom');
          },
        },
      }),
    });
    expect(out).toBe(false);
  });

  it('does not initialise twice', async () => {
    const eruda = { ...stubEruda(), _isInit: true };
    await maybeInstallEruda({
      search: '?debug=1',
      storage: fakeStorage(),
      load: async () => ({ default: eruda }),
    });
    expect(eruda.init).not.toHaveBeenCalled();
  });
});
