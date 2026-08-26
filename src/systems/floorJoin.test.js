/**
 * The join that was missing for the whole of v2. CLAUDE.md Part I.3, section 5b.
 *
 * `onEnter` has computed a correct roster since v2's first day - `[speaker]` for
 * a one-to-one, the whole room for a group scene - and **the scene was built
 * from `presentIds` one line later.** Three separate reports came out of that
 * single discarded value:
 *
 *   - clicking "talk to Yeri" in a bistro with Nana in it produced a two-hander,
 *     because the model was handed `Present: nana, yeri` with no roster;
 *   - the activity line described Nana ("out for coffee") in a scene the player
 *     had opened with Yeri, because it read `present[0]`;
 *   - the aftermath filed Yeri as a witness of her own scene, because
 *     `propagate` took its subject from `presentIds[0]` as well.
 *
 * Right answer, computed, thrown away. Sixth instance after `markRisk`,
 * `campaignOver`, `propagate`, `ENERGY_PER_READ` and the dossier category
 * `tiers.js` read under a different name - and, as always, no unit test could
 * see it, because a unit test supplies the call itself.
 *
 * Source assertion, the same deliberate trade `rumorJoin.test.js` makes. The
 * behavioural half lives in `agent/floorTail.test.js`, which drives the real
 * engine and reads the rendered tail; what cannot be checked there is whether
 * App still hands the roster over at all.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const app = read('../App.jsx');
const stage = read('../ui/vn/RoundStage.jsx');

/** Everything from `const setup = useMemo` to the next top-level binding. */
const slice = (source, from) => {
  const start = source.indexOf(from);
  expect(start, `no longer present: ${from}`).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf('\n  const ', start + 10));
};

describe('the roster reaches the scene', () => {
  it('is handed to the engine, not just computed', () => {
    const setup = slice(app, 'const setup = useMemo');
    expect(setup).toMatch(/pendingScene\.rosterIds/);
    expect(setup).toMatch(/^\s*roster,$/m);
  });

  /**
   * The activity line says what the woman the player came to see is doing. It
   * read `present[0]`, which in a one-to-one is whoever happened to be first in
   * the room - so a scene opened with Yeri announced that Nana was out for
   * coffee, while Nana was standing in it.
   */
  it('describes the member on the roster, not the first one in the room', () => {
    const setup = slice(app, 'const setup = useMemo');
    expect(setup).toMatch(/const first = roster\[0\]/);
  });

  /**
   * A scene's SUBJECT is whoever the player spent it on, and only the round loop
   * knows - it is whoever the floor ended on, tapped or inherited.
   */
  it('takes the propagate subject from the addressee', () => {
    const exit = slice(app, 'const onSceneEnd');
    expect(exit).toMatch(/result\.addresseeId/);
    expect(exit, 'the subject is still read off the room').not.toMatch(
      /const subjectId =\s*\(pendingScene\?\.presentIds \?\? \[\]\)\[0\]/,
    );
  });
});

describe('the scene screen draws the floor rather than the room', () => {
  it('gets its roster and its speaker from the engine', () => {
    expect(stage).toMatch(/rosterOf\(session\)/);
    expect(stage).toMatch(/session\.turn/);
    expect(stage, 'the big portrait is still present[0]').not.toMatch(
      /find\(\(c\) => c\.id === present\[0\]\)/,
    );
  });

  /**
   * The row's buttons existed and called an `onTurnTo` that was never passed, so
   * every dimmed portrait in every group scene threw on tap. The feature was
   * drawn, wired to nothing, and looked completely finished.
   */
  it('wires turning to somebody, which was rendered and never connected', () => {
    expect(stage).toMatch(/turnToMember/);
    expect(stage).toMatch(/onTurnTo=\{onTurnTo\}/);
  });

  /** Two different people, and both are on screen (section 10c). */
  it('separates who is speaking from who the player is turned to', () => {
    expect(stage).toMatch(/speakingId=\{speakingId\}/);
    expect(stage).toMatch(/addresseeId=\{addresseeId\}/);
  });
});

/**
 * The `sum|` line is ENGLISH by contract (Part I.6) - it is what the pool
 * collapses a scene to, so a `zh` run's ledger stays comparable and byte-stable.
 * Printing it put an English sentence under Chinese numbers on a Chinese screen,
 * which is the `learnableFacts` mistake exactly: one string doing a memory job
 * and a display job at once.
 */
describe('memory does not leak onto the aftermath screen', () => {
  it('does not render the English scene summary', () => {
    const after = app.slice(app.indexOf('function Aftermath'));
    expect(after).not.toMatch(/\{outcome\.summary\}/);
  });
});
