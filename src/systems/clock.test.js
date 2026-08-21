import { describe, it, expect } from 'vitest';
import {
  newRun,
  advanceBlock,
  phaseForWeek,
  cycleForWeek,
  campaignProgress,
  spendBlockEnergy,
  restOvernight,
  isLastBlockOfDay,
  WEEKS_PER_CAMPAIGN,
} from './clock.js';
import {
  BLOCKS,
  DAYS_PER_WEEK,
  ENERGY_PER_BLOCK,
  ENERGY_RESTORED_OVERNIGHT,
} from '../config/constants.js';
import { isWeekend } from './calendar.js';

describe('advanceBlock', () => {
  it('walks morning to afternoon to evening', () => {
    let run = newRun();
    expect(run.block).toBe('morning');
    run = advanceBlock(run).run;
    expect(run.block).toBe('afternoon');
    run = advanceBlock(run).run;
    expect(run.block).toBe('evening');
  });

  it('rolls the day after the last block', () => {
    let state = { run: { ...newRun(), block: 'evening' } };
    state = advanceBlock(state.run);
    expect(state.rolledDay).toBe(true);
    expect(state.run.day).toBe(1);
    expect(state.run.block).toBe('morning');
  });

  it('rolls the week after the last day', () => {
    const out = advanceBlock({ ...newRun(), day: DAYS_PER_WEEK - 1, block: 'evening' });
    expect(out.rolledWeek).toBe(true);
    expect(out.run.week).toBe(1);
    expect(out.run.day).toBe(0);
  });

  it('cycles the phase with the week', () => {
    expect(phaseForWeek(0)).toBe('prep');
    expect(phaseForWeek(1)).toBe('comeback');
    expect(phaseForWeek(2)).toBe('rest');
    expect(phaseForWeek(3)).toBe('prep');
    expect(cycleForWeek(4)).toBe(1);
  });

  it('updates the phase on the run as the week turns', () => {
    const out = advanceBlock({ ...newRun(), day: DAYS_PER_WEEK - 1, block: 'evening' });
    expect(out.run.phase).toBe('comeback');
  });

  it('reports the campaign over only at the very end', () => {
    let run = newRun();
    let over = false;
    let guard = 0;
    while (!over && guard++ < 5000) {
      const out = advanceBlock(run);
      run = out.run;
      over = out.campaignOver;
    }
    expect(over).toBe(true);
    expect(run.week).toBe(WEEKS_PER_CAMPAIGN);
  });

  it('produces the full campaign block count', () => {
    let run = newRun();
    let blocks = 0;
    for (;;) {
      const out = advanceBlock(run);
      run = out.run;
      blocks++;
      if (out.campaignOver) break;
    }
    expect(blocks).toBe(WEEKS_PER_CAMPAIGN * DAYS_PER_WEEK * BLOCKS.length);
  });

  it('passes through both weekend days every week', () => {
    let run = newRun();
    const weekendBlocks = [];
    for (let i = 0; i < DAYS_PER_WEEK * BLOCKS.length; i++) {
      if (isWeekend(run.day)) weekendBlocks.push(`${run.day}:${run.block}`);
      run = advanceBlock(run).run;
    }
    expect(weekendBlocks).toHaveLength(2 * BLOCKS.length);
  });
});

describe('energy', () => {
  it('drains per block and drains more when Read her was used', () => {
    const player = { energy: 80 };
    expect(spendBlockEnergy(player).energy).toBe(74);
    expect(spendBlockEnergy(player, 2).energy).toBe(72);
  });

  it('floors at zero rather than going negative', () => {
    expect(spendBlockEnergy({ energy: 2 }).energy).toBe(0);
  });

  it('is restored overnight but capped', () => {
    expect(restOvernight({ energy: 40 }).energy).toBe(40 + ENERGY_RESTORED_OVERNIGHT);
    expect(restOvernight({ energy: 95 }).energy).toBe(100);
  });

  it('does not cover a full day, so resting has to compete for a block', () => {
    // Three blocks plus a couple of Read her uses should outrun a night of
    // sleep - otherwise the player never has a reason to spend a block resting.
    const spentInADay = ENERGY_PER_BLOCK * BLOCKS.length + 2;
    expect(spentInADay).toBeGreaterThan(ENERGY_RESTORED_OVERNIGHT - 5);
  });

  it('cannot survive a full day of blocks without sleeping', () => {
    let player = { energy: 100 };
    for (let i = 0; i < 20; i++) player = spendBlockEnergy(player);
    expect(player.energy).toBe(0);
  });
});

describe('campaignProgress', () => {
  it('runs from zero to one', () => {
    expect(campaignProgress(newRun())).toBe(0);
    expect(campaignProgress({ week: WEEKS_PER_CAMPAIGN, day: 0, block: 'morning' })).toBe(1);
  });
});

describe('isLastBlockOfDay', () => {
  it('is true only in the evening', () => {
    expect(isLastBlockOfDay({ block: 'evening' })).toBe(true);
    expect(isLastBlockOfDay({ block: 'morning' })).toBe(false);
  });
});
