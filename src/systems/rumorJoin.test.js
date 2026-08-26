/**
 * The join, asserted as a join. CLAUDE.md section 5b, Part I.8.
 *
 * `propagate` has been correct and covered by two test files for six milestones.
 * It has also, twice now, been called by nothing:
 *
 *   - `markRisk` was tested, correct, and never invoked, so `admissibility`
 *     never left 0 in any shipped campaign and four endings were unreachable.
 *   - `propagate` itself dropped out when `onSceneEnd` was rewritten for v2, so
 *     for the whole of phase 2 a player could take somebody to the cafe at noon
 *     in comeback week and the other four never heard a word.
 *
 * Both halves were right both times. Only the line between them was missing, and
 * NO UNIT TEST CAN SEE THAT - by construction, because a unit test supplies the
 * call itself. So this one reads the caller.
 *
 * It is a source assertion and that is a deliberate trade rather than laziness.
 * A behavioural test would have to steer a seeded campaign into a room with
 * company at an exposure that leaks, and would then be testing the calendar. The
 * question here is narrower and answerable directly: does the scene-exit path
 * still call this, and does what comes back still reach a dossier and a screen.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8');

/** Everything from `const onSceneEnd` to the next top-level `const` binding. */
const sceneExit = (() => {
  const start = app.indexOf('const onSceneEnd');
  expect(start, 'App no longer has an onSceneEnd').toBeGreaterThan(-1);
  const end = app.indexOf('\n  const ', start + 10);
  return app.slice(start, end === -1 ? app.length : end);
})();

describe('the scene-exit path', () => {
  it('imports propagate at all', () => {
    expect(app).toMatch(/import \{[^}]*\bpropagate\b[^}]*\} from '\.\/systems\/rumor\.js'/);
  });

  it('calls it when a scene closes', () => {
    expect(sceneExit, 'nothing in onSceneEnd calls propagate').toMatch(/\bpropagate\(/);
  });

  /**
   * A rumor that reaches nobody's dossier is a rumor nobody ever reacts to,
   * because the tail is the only way it gets in front of the model.
   */
  it('writes what came back into heard_about', () => {
    expect(sceneExit).toMatch(/heard_about/);
    expect(sceneExit).toMatch(/addDossierEntry\(/);
  });

  /**
   * ...and the player is told. Pillar 4: memory shows in mechanics, not only in
   * prose. v1 shipped this hole and it was reported as "missing witness info
   * displayed in ending of the scene".
   */
  it('hands both lists to the aftermath screen', () => {
    expect(sceneExit).toMatch(/rumors:/);
    expect(sceneExit).toMatch(/noticed:/);
  });

  /**
   * PASSED, NEVER INFERRED. Section 5b records the eight-week-delayed bug that
   * came of reading this flag off "did a system note go out": a second kind of
   * note arrived later and quietly made every group scene in the game end
   * witnessed.
   */
  it('takes singledOut from the round loop rather than guessing', () => {
    expect(sceneExit).toMatch(/singledOut:\s*Boolean\(result\.gestured\)/);
  });

  /** An anchor event and a dorm evening are not choices, so neither costs. */
  it('still passes the two exemptions', () => {
    expect(sceneExit).toMatch(/shared:/);
    expect(sceneExit).toMatch(/collective:/);
  });
});
