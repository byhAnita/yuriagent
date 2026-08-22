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
  SECRECY_RECOVERED_OVERNIGHT,
} from '../config/constants.js';
import { clamp } from './rng.js';
import { SECRECY_NEUTRAL } from './exposure.js';

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

/**
 * Sleep is the only thing that gives energy back - and a day's distance is the
 * only thing that gives secrecy back.
 *
 * Secrecy used to be a one-way ratchet. Snooping costs 1-7 and nothing restored
 * it, so a full campaign hit 0 in week 3 of 9 and stayed there: every later
 * snoop was free, which switched off section 10b's "the cost is real" for two
 * thirds of the run, and exposure carried a flat +21 on every scene forever.
 * A stat that saturates early is not a decision any more.
 *
 * It recovers slowly and only toward the baseline, never past it - a reputation
 * for being nosy fades if you stop being nosy, but discretion is not something
 * you accumulate by sleeping. One a day against a 63-day campaign is small
 * enough that a snooping streak still hurts, and large enough that the value
 * spends the whole run somewhere interesting instead of pinned at the floor.
 */
export function restOvernight(player, { secrecyBaseline = SECRECY_NEUTRAL } = {}) {
  const secrecy =
    player.secrecy < secrecyBaseline
      ? Math.min(secrecyBaseline, player.secrecy + SECRECY_RECOVERED_OVERNIGHT)
      : player.secrecy;

  return { ...player, energy: clamp(player.energy + ENERGY_RESTORED_OVERNIGHT), secrecy };
}

export function isLastBlockOfDay(run) {
  return run.block === BLOCKS[BLOCKS.length - 1];
}
