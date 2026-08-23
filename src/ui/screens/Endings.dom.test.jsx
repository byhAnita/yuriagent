/** @vitest-environment jsdom */
/**
 * The last screen. CLAUDE.md section 5.
 *
 * Endings resolve PER CHARACTER, so the thing to assert is that the screen is
 * a list rather than a verdict: a run can finish with one at `ours`, one at
 * `nameless_end` and three at `drift_end`, and all five have to be reported.
 *
 * The screen also has to be *reachable*, and it was not - `advanceBlock` has
 * returned `campaignOver` since M1 and nothing read it, so the clock rolled
 * past the end of the campaign and the game kept going. That half is asserted
 * against `clock.js` here rather than by driving 189 blocks through the UI.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Endings from './Endings.jsx';
import { getCast } from '../../data/cast.js';
import { newRelation, resolveEnding, isBalanceEnding } from '../../systems/relationship.js';
import { advanceBlock, newRun, WEEKS_PER_CAMPAIGN } from '../../systems/clock.js';
import { makeT } from '../../i18n/index.js';
import { BLOCKS, DAYS_PER_WEEK } from '../../config/constants.js';

const cards = getCast();
const t = makeT('en');

afterEach(cleanup);

/**
 * A relationship parked exactly where a given ending resolves.
 *
 * `stage` is set explicitly and not left to be inferred, because
 * `resolveEnding` reads the STORED stage rather than recomputing it from the
 * two axes - `applySceneOutcome` is what keeps the two in step during play. A
 * fixture that sets only the numbers resolves to `drift_end` for everybody,
 * which is a test that passes while asserting nothing.
 */
const at = (patch) => ({ ...newRelation(5), ...patch });

const OURS = at({
  stage: 'ours',
  intimacy: 90,
  admissibility: 65,
  peakIntimacy: 90,
  peakAdmissibility: 65,
});
const NAMELESS = at({
  stage: 'nameless',
  intimacy: 60,
  admissibility: 25,
  peakIntimacy: 60,
  peakAdmissibility: 25,
});
const DRIFT = at({ stage: 'stranger', intimacy: 8, peakIntimacy: 8 });
const BROKEN = at({
  stage: 'good_friends',
  intimacy: 20,
  peakIntimacy: 80,
  admissibility: 10,
  endingLocked: 'nameless_end',
});

function show(relations, onRestart = vi.fn()) {
  render(<Endings cards={cards} relations={relations} onRestart={onRestart} t={t} />);
  return onRestart;
}

const mixed = () => ({
  irene: OURS,
  nana: NAMELESS,
  jisoo: DRIFT,
  hyewon: DRIFT,
  yeri: BROKEN,
});

describe('it reports all five', () => {
  it('names every member and the ending she got', () => {
    const relations = mixed();
    show(relations);

    for (const card of cards) {
      expect(screen.getByText(card.name), card.id).toBeTruthy();
      const endingId = resolveEnding(relations[card.id]);
      expect(screen.getAllByText(t(`ending.${endingId}`)).length, endingId).toBeGreaterThan(0);
    }
  });

  it('says something about each of them, not just a label', () => {
    show(mixed());
    expect(screen.getByText(t('ending.ours_endLine'))).toBeTruthy();
    expect(screen.getByText(t('ending.unnamed_endLine'))).toBeTruthy();
    expect(screen.getByText(t('ending.nameless_endLine'))).toBeTruthy();
  });

  /**
   * Best first. A screen that opens on three `drift_end` rows reads as a
   * failure even when one of the other two is `ours`.
   */
  it('leads with whatever the run actually achieved', () => {
    show(mixed());
    const names = screen.getAllByText(/^(Irene|Nana|Jisoo|Hyewon|Yeri)$/).map((n) => n.textContent);
    expect(names[0]).toBe('Irene');
    expect(names.at(-1)).toBe('Yeri');
  });
});

describe('the balance ending', () => {
  const allNameless = Object.fromEntries(cards.map((c) => [c.id, NAMELESS]));

  it('is called out when every one of them got there', () => {
    expect(isBalanceEnding(allNameless)).toBe(true);
    show(allNameless);
    expect(screen.getByText(t('endings.balance'))).toBeTruthy();
  });

  /** Four out of five is not it. That is the whole point of the bar. */
  it('is not claimed for four out of five', () => {
    const nearly = { ...allNameless, yeri: DRIFT };
    expect(isBalanceEnding(nearly)).toBe(false);
    show(nearly);
    expect(screen.queryByText(t('endings.balance'))).toBeNull();
  });
});

describe('starting over', () => {
  it('offers it, and asks the caller rather than resetting itself', async () => {
    const onRestart = show(mixed());
    await userEvent.click(screen.getByText(t('endings.again')));
    expect(onRestart).toHaveBeenCalled();
  });
});

describe('the campaign actually ends', () => {
  /**
   * The join that was missing. Nine weeks of blocks, and the last one has to
   * report it - otherwise the endings screen is unreachable however correct it
   * is.
   */
  it('reports campaignOver on the block that runs out the clock', () => {
    let run = {
      ...newRun({ seed: 1 }),
      week: WEEKS_PER_CAMPAIGN - 1,
      day: DAYS_PER_WEEK - 1,
      block: BLOCKS.at(-1),
    };
    const step = advanceBlock(run);

    expect(step.campaignOver).toBe(true);
    expect(step.run.week).toBe(WEEKS_PER_CAMPAIGN);
  });

  it('does not report it a day early', () => {
    const run = {
      ...newRun({ seed: 1 }),
      week: WEEKS_PER_CAMPAIGN - 1,
      day: DAYS_PER_WEEK - 2,
      block: BLOCKS.at(-1),
    };
    expect(advanceBlock(run).campaignOver).toBe(false);
  });
});
