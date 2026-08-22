/**
 * Daily work objectives. CLAUDE.md section 10.
 *
 * A task is not a checkbox that ticks itself when you walk into a room. It is a
 * CONFLICT: one block left, the outfit is not ready, and she wants to talk.
 * That tension is the entire point of the task system, so completion always
 * costs a block that could have been spent on someone.
 *
 * No tasks at the weekend - days 5 and 6 belong to the player.
 */

import { isWeekend } from './calendar.js';
import { resolveSlot } from '../data/phaseMaps.js';
import { makeRng, deriveSeed, pick } from './rng.js';
import { clamp } from './rng.js';

/**
 * Task definitions for the assistant identity. Keyed by identity taskPool.
 *
 * A task names a SLOT, not a location. `prep_outfits` belongs to workroom B,
 * which is the wardrobe in PREP, the make-up room in COMEBACK and the photo
 * studio in REST. Binding to a location id does not survive the map rotating:
 * three of these five used to point at `corridor` or `broadcast_studio`, and
 * neither exists as an ordinary room in every phase. See CLAUDE.md section 10.
 */
export const TASKS = {
  prep_outfits: { slot: 'workroom_b', affectsMembers: true, credits: 3, competence: 4 },
  run_schedule: { slot: 'workroom_a', affectsMembers: true, credits: 2, competence: 3 },
  handle_press_kit: { slot: 'solo_site', affectsMembers: false, credits: 3, competence: 4 },
  stage_check: { slot: 'workroom_a', affectsMembers: true, credits: 4, competence: 5 },
  restock_wardrobe: { slot: 'workroom_b', affectsMembers: false, credits: 2, competence: 2 },
};

export const FAILURE = {
  competence: -3,
  energy: -5,
  strainIfAffected: 8,
};

export function newTaskState() {
  return { taskId: null, done: false, day: null };
}

/**
 * The objective for one day. Null at the weekend.
 *
 * @param {object} args - { identity, day, week, phase, seed }
 */
export function generateDayTask({ identity, day, week = 0, phase, seed }) {
  if (isWeekend(day)) return null;

  const pool = (identity?.taskPool ?? Object.keys(TASKS)).filter((id) => TASKS[id]);
  if (pool.length === 0) return null;

  const rng = makeRng(deriveSeed(seed, `task:${week}:${day}:${phase}`));

  // A slot the phase does not fill has nowhere to discharge the task, so it is
  // not a legal objective this week. Never let the pool empty entirely.
  const placeable = pool.filter((id) => resolveSlot(phase, TASKS[id].slot));
  const taskId = pick(rng, placeable.length > 0 ? placeable : pool);

  const def = TASKS[taskId];
  return { taskId, ...def, location: resolveSlot(phase, def.slot), day, week };
}

/** Can this task be discharged here, right now? */
export function canAttempt(task, locationId) {
  return Boolean(task) && task.location === locationId;
}

/**
 * Spending the block on work rather than on her.
 * Returns stat deltas; the caller applies them.
 */
export function completeTask(task) {
  if (!task) return { competence: 0, credits: 0 };
  return { competence: task.competence, credits: task.credits, done: true };
}

/**
 * Called at day rollover for a task that was never discharged.
 * Returns player deltas plus a per-member strain delta when the failure landed
 * on someone - a missed outfit is her problem, not just yours.
 *
 * @param {string[]} castIds - who the failure touched
 */
export function failTask(task, castIds = []) {
  if (!task) return { competence: 0, energy: 0, strain: {} };

  const strain = {};
  if (task.affectsMembers) {
    for (const id of castIds) strain[id] = FAILURE.strainIfAffected;
  }
  return { competence: FAILURE.competence, energy: FAILURE.energy, strain };
}

export function applyPlayerDeltas(player, deltas) {
  return {
    ...player,
    competence: clamp(player.competence + (deltas.competence ?? 0)),
    energy: clamp(player.energy + (deltas.energy ?? 0)),
    credits: Math.max(0, player.credits + (deltas.credits ?? 0)),
  };
}
