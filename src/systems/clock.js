/**
 * Time. CLAUDE.md section 10.
 *
 * Three blocks a day, seven days a week, three phases a cycle, three cycles a
 * campaign. Pure: given a run position it returns the next one, and says what
 * boundaries were crossed so the caller knows when to roll a day over.
 *
 * Day rollover is where an unfinished task finally bites. That is deliberate -
 * the task is not a checkbox, it is a deadline that competes with her for the
 * same blocks.
 */

import {
  BLOCKS,
  DAYS_PER_WEEK,
  PHASES,
  CYCLES_PER_CAMPAIGN,
  ENERGY_PER_BLOCK,
  ENERGY_RESTORED_OVERNIGHT,
} from '../config/constants.js';
import { clamp } from './rng.js';

export const WEEKS_PER_CAMPAIGN = PHASES.length * CYCLES_PER_CAMPAIGN;

export function newRun({ identityId = 'assistant', seed = 1 } = {}) {
  return { identityId, seed, week: 0, day: 0, block: BLOCKS[0], phase: PHASES[0] };
}

export function phaseForWeek(week) {
  return PHASES[week % PHASES.length];
}

export function cycleForWeek(week) {
  return Math.floor(week / PHASES.length);
}

/**
 * Advance one block.
 *
 * @returns {{ run, rolledDay, rolledWeek, campaignOver }}
 */
export function advanceBlock(run) {
  const i = BLOCKS.indexOf(run.block);
  const next = { ...run };

  let rolledDay = false;
  let rolledWeek = false;

  if (i < BLOCKS.length - 1) {
    next.block = BLOCKS[i + 1];
  } else {
    next.block = BLOCKS[0];
    rolledDay = true;
    next.day = run.day + 1;

    if (next.day >= DAYS_PER_WEEK) {
      next.day = 0;
      next.week = run.week + 1;
      rolledWeek = true;
    }
  }

  next.phase = phaseForWeek(next.week);
  const campaignOver = next.week >= WEEKS_PER_CAMPAIGN;

  return { run: next, rolledDay, rolledWeek, campaignOver };
}

/** How far through the campaign, for a progress read. */
export function campaignProgress(run) {
  const blocksPerWeek = DAYS_PER_WEEK * BLOCKS.length;
  const done = run.week * blocksPerWeek + run.day * BLOCKS.length + BLOCKS.indexOf(run.block);
  return done / (WEEKS_PER_CAMPAIGN * blocksPerWeek);
}

/** Spending a block is tiring whatever you spend it on. */
export function spendBlockEnergy(player, extra = 0) {
  return { ...player, energy: clamp(player.energy - ENERGY_PER_BLOCK - extra) };
}

/** Sleep is the only thing that gives energy back. */
export function restOvernight(player) {
  return { ...player, energy: clamp(player.energy + ENERGY_RESTORED_OVERNIGHT) };
}

export function isLastBlockOfDay(run) {
  return run.block === BLOCKS[BLOCKS.length - 1];
}
