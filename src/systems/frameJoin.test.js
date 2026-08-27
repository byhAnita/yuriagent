/**
 * The four values that were written and never read. CLAUDE.md sections 7 and 10.
 *
 * Instances seven through ten of this project's signature defect, and the first
 * ones found by reading the source rather than by playing it:
 *
 *   - `onShared` set `pendingScene.sceneFrame`  -> read by nothing
 *   - `askOut`   set `pendingScene.date`        -> read by nothing
 *   - `onEnter`  set `pendingScene.event`       -> read only by `endScene`, for canon
 *   - `run.canon` was written, capped, persisted -> read only by the handbook
 *
 * `renderFrame`, `dateFrame` and `eventFrame` were imported by no module in the
 * app. Every half was correct and tested; the slot they all fed was missing.
 *
 * SOURCE ASSERTION, the trade `rumorJoin.test.js` and `floorJoin.test.js` both
 * make and for the same reason: a unit test supplies its own arguments, so it
 * can prove `buildTier3` renders a frame and can never prove anybody passes one.
 * The behavioural half is `agent/frameTail.test.js`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const app = read('../App.jsx');
const engine = read('../agent/roundEngine.js');

/** Everything from a top-level binding to the next one. */
const slice = (source, from) => {
  const start = source.indexOf(from);
  expect(start, `no longer present: ${from}`).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf('\n  const ', start + 10));
};

describe('what today is reaches the scene', () => {
  const setup = slice(app, 'const setup = useMemo');

  it('resolves all three kinds of framed day', () => {
    expect(setup, 'an anchor event no longer builds a frame').toMatch(/eventFrame\(/);
    expect(setup, 'a date no longer builds a frame').toMatch(/dateFrame\(/);
    expect(setup, 'a shared dorm evening no longer builds a frame').toMatch(
      /pendingScene\.sceneFrame/,
    );
  });

  /**
   * The event wins where two could collide, because an event day IS the event -
   * the map is the site and there is nothing else to walk to (section 10).
   */
  it('lets the event outrank a date', () => {
    expect(setup.indexOf('pendingScene.event')).toBeLessThan(setup.indexOf('pendingScene.date'));
  });

  it('hands it to the engine rather than only computing it', () => {
    expect(setup).toMatch(/^\s*frame,$/m);
  });

  /**
   * Derived from `(seed, cycle)`, never stored - the rule `focusId` and the
   * calendar both follow, and what keeps the comeback style pools out of the
   * save file.
   */
  it('derives the comeback style rather than reading it back', () => {
    expect(setup).toMatch(/eventFrame\(pendingScene\.event, \{ cycle, seed: SEED \}\)/);
  });
});

describe('what the campaign has settled reaches the scene', () => {
  const setup = slice(app, 'const setup = useMemo');

  it('is injected, not only stored and shown in the handbook', () => {
    expect(setup).toMatch(/renderCanon\(/);
    expect(setup).toMatch(/^\s*canon: canonLines,$/m);
  });

  /**
   * NOT frame-conditional, and that is the half section 7 cares most about. An
   * event reading its own chain is what stops cycle 2 repeating cycle 1; a
   * member bringing up the title track in a wardrobe on a Tuesday is what makes
   * the decision feel like it happened to the world rather than to a menu.
   */
  it('carries the current cycle into an ordinary block too', () => {
    expect(setup).toMatch(/canonForCycle\(canon, cycle\)/);
    expect(setup).toMatch(/canonForEvent\(canon, \{ cycle, reads:/);
  });

  /**
   * A memo that does not list `canon` recomputes nothing when a decision lands,
   * so the scene after an event would be built from the canon before it. The
   * quiet half of this join: everything looks wired and the value is one scene
   * stale forever.
   */
  it('rebuilds the scene when a decision lands', () => {
    const deps = app.slice(app.indexOf('  }, [', app.indexOf('const setup = useMemo')));
    expect(deps.slice(0, deps.indexOf(']'))).toMatch(/^\s*canon,$/m);
  });
});

describe('the engine passes all of it through to the tail', () => {
  it('reads them off the scene rather than inventing them', () => {
    expect(engine).toMatch(/frame: session\.scene\.frame/);
    expect(engine).toMatch(/canon: session\.scene\.canon/);
    expect(engine).toMatch(/session\.scene\.work/);
  });

  /**
   * WHICH round is the engine's, because the engine is the only thing that
   * knows how many are left - the same argument that owned v1's closing
   * directive. Every round would be worse than none.
   */
  it('picks one round for the work rather than every round', () => {
    expect(engine).toMatch(/roundCount\(pool\) === Math\.floor\(\(session\.total \* 2\) \/ 3\)/);
  });
});

/**
 * `physical` sat on three events with no reader from the moment the v1
 * interlude call was deleted, which is what a played session reported three
 * separate times: no shoot, no stage, no fan meeting - just a green room.
 */
describe('a physical event reaches the work line', () => {
  it('is read off the event rather than hardcoded per id', () => {
    const setup = slice(app, 'const setup = useMemo');
    expect(setup).toMatch(/pendingScene\.event\?\.physical \? WORK_INTERLUDE : null/);
  });
});

/**
 * A CLAIMED CHECK NOBODY GOES LOOKING FOR.
 *
 * `App.jsx` said in a comment that `endScene` had already validated a decision
 * against the event's agenda, and nothing had: `canon|` went from the parser
 * into the session and out to `addDecisions`, which appends to a list that never
 * compacts, is shown to the player, and is read back by the next event.
 */
describe('a decision may only be about what the day was for', () => {
  it('hands the agenda to the engine', () => {
    const setup = slice(app, 'const setup = useMemo');
    expect(setup).toMatch(/agenda: pendingScene\.event\?\.frame\?\.agenda \?\? \[\]/);
  });

  it('vetoes there rather than trusting the model', () => {
    expect(engine).toMatch(/topics\.includes\(d\.topic\)/);
    expect(engine, 'canon is still appended unfiltered').not.toMatch(
      /canon: round\.canon\.length \?/,
    );
  });

  /** `agent/` may not import `data/events/`, the same rule that excludes i18n. */
  it('does not reach into the event catalogue from the engine', () => {
    expect(engine).not.toMatch(/from '\.\.\/data\/events/);
  });
});
