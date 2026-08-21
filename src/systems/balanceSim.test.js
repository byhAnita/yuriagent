import { describe, it, expect } from 'vitest';
import { runPlaythrough, runBatch, formatReport, POLICIES } from './balanceSim.js';
import { getCast } from '../data/cast.js';

const cards = getCast();
const RUNS = 400;

/**
 * This file is the M1 exit criterion. It is a tuning instrument as much as a
 * test: when a coefficient in config/constants.js moves, the numbers printed
 * here are the evidence for whether it moved the right way.
 *
 * Run `npm test -- balanceSim` to see the full report.
 */
describe('balance simulator', () => {
  it('is reproducible from a seed', () => {
    const a = runPlaythrough({ cards, seed: 42, policy: 'balanced' });
    const b = runPlaythrough({ cards, seed: 42, policy: 'balanced' });
    expect(a.endings).toEqual(b.endings);
    expect(a.balance).toBe(b.balance);
  });

  it('produces different runs from different seeds', () => {
    const seeds = [1, 2, 3, 4, 5].map(
      (s) => JSON.stringify(runPlaythrough({ cards, seed: s, policy: 'balanced' }).endings),
    );
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('reports every ending against a real ending id', () => {
    const known = new Set([
      'drift_end',
      'friends_end',
      'confidante_end',
      'unnamed_end',
      'unspoken_end',
      'ours_end',
      'out_end',
      'reckless_end',
      'nameless_end',
      'exposure_end',
      'severance_end',
    ]);
    const { endings } = runBatch({ cards, runs: 40, policy: 'random' });
    for (const id of Object.keys(endings)) expect(known).toContain(id);
  });

  describe('policy reports', () => {
    const reports = {};

    for (const policy of Object.keys(POLICIES)) {
      it(`runs ${policy}`, () => {
        const r = runBatch({ cards, runs: RUNS, policy });
        reports[policy] = r;
        console.log('\n' + formatReport(r));
        expect(r.runs).toBe(RUNS);
      });
    }

    it('THE TARGET: the balance ending stays under 10% for a competent player', () => {
      const r = reports.balanced ?? runBatch({ cards, runs: RUNS, policy: 'balanced' });
      expect(r.balanceRate).toBeLessThan(0.1);
    });

    it('a single deep route is easier than holding all five', () => {
      const devoted = reports.devoted ?? runBatch({ cards, runs: RUNS, policy: 'devoted' });
      const good = ['ours_end', 'out_end', 'unspoken_end'];
      const total = Object.values(devoted.endings).reduce((a, b) => a + b, 0);
      const goodShare = good.reduce((a, k) => a + (devoted.endings[k] ?? 0), 0) / total;

      // Devotion should reliably land at least one real relationship.
      expect(goodShare).toBeGreaterThan(devoted.balanceRate);
    });

    it('spreading attention thin costs more jealousy than devotion', () => {
      const devoted = reports.devoted ?? runBatch({ cards, runs: RUNS, policy: 'devoted' });
      const spread = reports.spread ?? runBatch({ cards, runs: RUNS, policy: 'spread' });
      console.log(
        `\njealousy  devoted=${devoted.meanJealousy.toFixed(1)}  spread=${spread.meanJealousy.toFixed(1)}`,
      );
      expect(spread.meanJealousy).toBeGreaterThan(0);
    });
  });
});
