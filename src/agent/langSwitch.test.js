/**
 * Switching language mid-scene.
 *
 * Section 19: "Language switching is allowed at any time from settings and does
 * not reset the run." Section 8 invariant 1: "Nothing above block 5 may change
 * while a scene is open." Both are reasonable and together they are a bug.
 *
 * The frozen prefix carries the language directive, so an open scene keeps
 * writing in whatever language it was opened in. The CHIP directive is rebuilt
 * from live settings on every turn, so chips switch immediately. The player
 * sees Chinese buttons under English dialogue - which is exactly what was
 * reported, and what four live probes failed to reproduce because a harness
 * never changes its mind about the language halfway through.
 *
 * The fix costs one cache miss on one turn. A language switch is a rare,
 * deliberate act, and invariant 1 exists to stop the prefix churning EVERY
 * turn - not to make a deliberate settings change silently not work.
 */

import { describe, it, expect } from 'vitest';
import { openScene, appendTurn, relanguage, buildMessages } from './promptBuilder.js';
import { newMemory } from './memory.js';
import { newRelation } from '../systems/relationship.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';

const cards = getCast();
const ids = cards.map((c) => c.id);

const args = (lang) => ({
  cards,
  lineup: buildLineup(cards),
  identity: {},
  player: { name: 'Yuhan', energy: 80, secrecy: 70 },
  lang,
  memory: newMemory(ids),
  relations: Object.fromEntries(ids.map((id) => [id, newRelation(20)])),
  scene: {
    rosterIds: ['irene'],
    focusId: 'irene',
    week: 0,
    day: 0,
    block: 'evening',
    phase: 'prep',
    locationId: 'practice_room',
    locationLabel: 'X Practice Room',
    exposure: 20,
  },
});

const text = (frame) => buildMessages(frame).map((m) => m.content).join('\n');

describe('the bug', () => {
  it('keeps the old language in a frame opened before the switch', () => {
    const frame = openScene(args('en'));
    expect(text(frame)).toContain('Write in English: BOTH halves of every beat');
    expect(text(frame)).not.toContain('Simplified Chinese');
  });
});

describe('relanguage', () => {
  it('rebuilds the prefix in the new language', () => {
    const opened = openScene(args('en'));
    const switched = relanguage(opened, args('zh'));

    expect(text(switched)).toContain('Simplified Chinese');
    expect(text(switched)).not.toContain('Write in English: BOTH halves of every beat');
  });

  /**
   * The conversation survives. Rebuilding the prefix must not throw away block
   * 5 - the player is mid-scene, and losing her replies to change a setting
   * would be far worse than the thing being fixed.
   */
  it('keeps every turn of the conversation', () => {
    let frame = openScene(args('en'));
    frame = appendTurn(frame, { role: 'user', content: '[flirt] ' });
    frame = appendTurn(frame, { role: 'assistant', content: '@irene|happy|guard40|fluster10\n"Hi."' });

    const switched = relanguage(frame, args('zh'));

    expect(switched.turns).toHaveLength(2);
    expect(text(switched)).toContain('"Hi."');
  });

  it('keeps the roster and the focus', () => {
    const opened = openScene(args('en'));
    const switched = relanguage(opened, args('zh'));

    expect(switched.rosterIds).toEqual(opened.rosterIds);
    expect(switched.focusId).toBe(opened.focusId);
  });

  it('stays frozen afterwards, like any other frame', () => {
    const switched = relanguage(openScene(args('en')), args('zh'));
    expect(Object.isFrozen(switched)).toBe(true);
  });

  it('is a no-op returning an equivalent frame when the language has not moved', () => {
    const opened = openScene(args('zh'));
    expect(text(relanguage(opened, args('zh')))).toBe(text(opened));
  });
});
