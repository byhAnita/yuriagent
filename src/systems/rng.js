/**
 * Seeded RNG.
 *
 * Every stochastic system takes an rng as a parameter rather than reaching for
 * Math.random. Two reasons: the calendar must be reproducible from run.seed so
 * a save reloads into the same week, and balanceSim needs to replay identical
 * runs while coefficients change underneath it.
 */

/** mulberry32 - small, fast, good enough for scheduling and rumor rolls. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive a stable sub-seed so independent systems do not share a stream. */
export function deriveSeed(seed, label) {
  let h = seed >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = (Math.imul(h ^ label.charCodeAt(i), 0x01000193) + 1) >>> 0;
  }
  return h;
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function clamp(v, lo = 0, hi = 100) {
  return v < lo ? lo : v > hi ? hi : v;
}
