/**
 * The other join, asserted the same way. CLAUDE.md section 10, Part I.10.
 *
 * A routine is worth exactly one thing: the door it opens on an evening the
 * player has not reached yet. Every piece of that is unit-tested elsewhere -
 * `roomRoutine` fixes the evenings, `availableFinds` offers them, `DormMap`
 * renders them - and the whole feature is still worth nothing if App does not
 * resolve the learned keys and hand them down.
 *
 * That failure is silent in the worst way. `routines` handed `undefined` gives
 * every door its default `{}`, so it renders the old "not home" sentence, looks
 * completely correct, and the snoop that found it simply pays out nothing. It is
 * the shape of `markRisk`, `propagate`, `ENERGY_PER_READ`, and of the dossier
 * category tier 3 read under a different name - and no unit test can see it, by
 * construction, because a unit test supplies the call itself.
 *
 * Source assertion, the same deliberate trade `rumorJoin.test.js` makes: a
 * behavioural version would have to steer a seeded campaign to a snoop that
 * happened to draw a routine, then to the dorm on an evening she is out, and
 * would spend most of its length testing the calendar.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const app = read('../App.jsx');
const day = read('../ui/screens/Day.jsx');
const dorm = read('../ui/map/DormMap.jsx');

describe('what a snoop learns reaches the door', () => {
  it('keeps the learned keys, and only the keys', () => {
    expect(app).toMatch(/const \[foundRoutines, setFoundRoutines\]/);
    expect(app, 'a routine find is never recorded').toMatch(
      /setFoundRoutines\(\(r\) => \[\.\.\.r, result\.routine\.routineKey\]\)/,
    );
  });

  /**
   * DERIVED, never stored - the rule `focusId` and the calendar both follow.
   * Storing the evenings themselves would let a save disagree with the seed
   * that produces them, and would need an expiry pass when the week turns.
   */
  it('resolves them back through the calendar rather than storing them', () => {
    expect(app).toMatch(/const knownRoutines = useMemo/);
    expect(app).toMatch(/roomRoutine\(/);
    expect(app, 'knownRoutines is not filtered by what was found').toMatch(
      /foundRoutines\.includes\(key\)/,
    );
  });

  /** ...and it is handed down, which is the half that goes missing. */
  it('passes them to the day screen and on to the dorm', () => {
    expect(app).toMatch(/routines=\{knownRoutines\}/);
    expect(day).toMatch(/routines=\{routines\}/);
    expect(dorm).toMatch(/routines\[c\.id\]/);
  });

  /**
   * The snoop screen asks the same question `resolveSoloAction` answers, so a
   * room with a routine left but no facts must not render as spent. Without the
   * clock going in, `availableFinds` cannot offer a routine at all and the two
   * would disagree - which is the one thing that call site exists to prevent.
   */
  it('gives the snoop screen the clock its find list needs', () => {
    const solo = read('../ui/screens/SoloAction.jsx');
    for (const arg of ['foundRoutines', 'phase', 'week', 'seed']) {
      expect(solo, `hasFinds is missing ${arg}`).toMatch(new RegExp(`\\n      ${arg},`));
    }
    expect(app).toMatch(/foundRoutines=\{foundRoutines\}/);
  });

  /**
   * It is what the PLAYER knows, not what she knows. A dossier write would put
   * the player's own plans in front of the model as though they were a fact
   * about her, and `heard_about` would then leak them into her next scene.
   */
  it('never writes a routine into anybody dossier', () => {
    const start = app.indexOf('const onChooseSolo');
    expect(start, 'App no longer has an onChooseSolo').toBeGreaterThan(-1);
    const solo = app.slice(start, app.indexOf('\n  const ', start + 10));
    expect(solo).toMatch(/result\.routine/);
    expect(solo).not.toMatch(/addDossierEntry\([^)]*routine/);
  });
});
