/**
 * The stubs have to be real data or they are worth nothing.
 *
 * Section 2 requires v2 features to have their interface stubbed in MVP so
 * that adding them later is content rather than a refactor. That promise is
 * only kept if the stub rows are shaped like the shipped one - a `producer`
 * whose taskPool names a task that does not exist is not a stub, it is a note
 * to self that will fail on the day somebody flips `available`.
 */

import { describe, it, expect } from 'vitest';
import { IDENTITIES, IDENTITY_IDS, DEFAULT_IDENTITY, getIdentity, playableIdentities } from './identities.js';
import { TASKS } from '../systems/tasks.js';
import { SLOTS, CONSTANT_SLOTS } from './phaseMaps.js';
import { LOCATIONS } from './locations.js';
import en from '../i18n/en.js';
import zh from '../i18n/zh.js';

const all = IDENTITY_IDS.map((id) => IDENTITIES[id]);

describe('identities', () => {
  it('ships exactly one, and it is the default', () => {
    expect(playableIdentities()).toEqual([DEFAULT_IDENTITY]);
    expect(IDENTITIES[DEFAULT_IDENTITY].available).toBe(true);
  });

  it.each(all)('$id names tasks that exist', (identity) => {
    expect(identity.taskPool.length).toBeGreaterThan(0);
    for (const taskId of identity.taskPool) {
      expect(TASKS[taskId], `unknown task ${taskId}`).toBeTruthy();
    }
  });

  /**
   * Slots, not location ids. The inline table this replaced named `backstage`,
   * `van` and `cafeteria`, none of which have ever existed - dead data
   * survives precisely because nothing reads it, so this is the assertion that
   * would have caught it.
   */
  it.each(all)('$id names role slots that exist', (identity) => {
    for (const slot of identity.slots) {
      expect(SLOTS[slot] ?? CONSTANT_SLOTS[slot], `unknown slot ${slot}`).toBeTruthy();
    }
  });

  it.each(all)('$id modifies exposure only at real locations', (identity) => {
    for (const locId of Object.keys(identity.exposureModifier ?? {})) {
      expect(LOCATIONS[locId], `unknown location ${locId}`).toBeTruthy();
    }
  });

  it.each(all)('$id starts with a complete stat line', (identity) => {
    for (const stat of ['competence', 'energy', 'secrecy', 'credits']) {
      expect(typeof identity.startStats[stat]).toBe('number');
    }
  });

  /**
   * Section 21: no hardcoded display text. The picker renders every row, so a
   * missing key shows the raw id on the first screen of the game.
   */
  it.each(all)('$id is named and described in every locale', (identity) => {
    for (const bundle of [en, zh]) {
      expect(bundle.identity[identity.id]).toBeTruthy();
      expect(bundle.identityNote[identity.id]).toBeTruthy();
    }
  });

  /** The prompt role is model-facing English and never localized (section 19). */
  it.each(all)('$id describes itself to the model in ASCII English', (identity) => {
    // eslint-disable-next-line no-control-regex
    expect(/^[\x20-\x7e]+$/.test(identity.promptRole)).toBe(true);
  });

  it('never hands back an identity the run cannot use', () => {
    expect(getIdentity('producer').id).toBe(DEFAULT_IDENTITY);
    expect(getIdentity('nonsense').id).toBe(DEFAULT_IDENTITY);
    expect(getIdentity(undefined).id).toBe(DEFAULT_IDENTITY);
  });
});
