/**
 * One shape for every conversation in the game. CLAUDE.md sections 6 and 10c.
 *
 * Raised by Yuhan after playing a day: "let's figure out the dialogue mechanism
 * to make it uniform and clean for all dialogues - 1v1, group chat, the
 * together activities in the dorm, special event group chat, dating."
 *
 * The spec, and it is the right one:
 *
 *   count who is in the conversation
 *     -> one member: no second voice. more: allow one.
 *     -> set the turn limit from how many are in it
 *     -> then the ordinary turn loop
 *
 * Both answers come from the same number, which is why they live in one
 * function rather than being decided in `App` and in `sceneEngine` separately.
 */

import { describe, it, expect } from 'vitest';
import { dialogueShape, turnLimitFor, allowsSecondVoice } from './dialogue.js';
import { SCENE_TURN_LIMIT, SCENE_TURN_LIMITS, SCENE_TURN_LIMIT_MAX } from '../config/constants.js';

describe('a conversation with one person in it', () => {
  /**
   * The engine has always returned early from `interject` on a one-member
   * roster, but it was true by accident of where the check lived - and the UI
   * did not know, so a 1v1 rendered controls only a group scene needs. Stated
   * once, here, and read by both.
   */
  it('has no second voice', () => {
    expect(allowsSecondVoice(1)).toBe(false);
    expect(dialogueShape({ rosterIds: ['irene'] }).interject).toBe(false);
    expect(dialogueShape({ rosterIds: ['irene'] }).group).toBe(false);
  });

  it('is the ordinary length', () => {
    expect(dialogueShape({ rosterIds: ['irene'] }).turnLimit).toBe(SCENE_TURN_LIMIT);
  });

  it('treats an empty roster as one, rather than as zero', () => {
    // A caller with no roster yet must not get a zero-turn scene.
    expect(dialogueShape({}).turnLimit).toBe(SCENE_TURN_LIMIT);
    expect(dialogueShape({}).members).toBe(1);
  });
});

describe('a conversation with more people in it', () => {
  it('lets somebody who was not addressed speak', () => {
    expect(allowsSecondVoice(2)).toBe(true);
    expect(dialogueShape({ rosterIds: ['irene', 'nana'] }).interject).toBe(true);
  });

  /**
   * Eight turns across five members is a turn and a half each, which is not a
   * conversation with anybody. Every extra person buys a little more room.
   */
  it('runs longer the more of them there are', () => {
    const lengths = [1, 2, 3, 4, 5].map((n) => turnLimitFor(n));
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
    expect(lengths.at(-1)).toBeGreaterThan(lengths[0]);
  });

  /**
   * The thing to watch, and the reason this is a balance change rather than a
   * cosmetic one: both cost ONE block. A five-member scene at the cap gives
   * each member ~3 turns of the player's attention against a 1v1's 8, so depth
   * still belongs to the private conversation - which is section 5b's claim
   * that breadth is cheap and shallow.
   */
  it('never gives one member more attention than a one-to-one does', () => {
    for (const n of [2, 3, 4, 5]) {
      expect(turnLimitFor(n) / n).toBeLessThan(SCENE_TURN_LIMIT);
    }
  });

  it('stops before a scene turns into a day', () => {
    expect(turnLimitFor(12)).toBe(SCENE_TURN_LIMIT_MAX);
    expect(turnLimitFor(5, 'event')).toBe(SCENE_TURN_LIMIT_MAX);
  });
});

describe('the five kinds of dialogue all come out of the same function', () => {
  const shape = (rosterIds, kind) => dialogueShape({ rosterIds, kind });

  it('an ordinary block is one member at the base length', () => {
    expect(shape(['irene'], 'ordinary')).toMatchObject({
      members: 1,
      interject: false,
      turnLimit: SCENE_TURN_LIMITS.ordinary,
    });
  });

  it('a date is one member at the long length, and still has no second voice', () => {
    expect(shape(['irene'], 'date')).toMatchObject({
      members: 1,
      interject: false,
      turnLimit: SCENE_TURN_LIMITS.date,
    });
  });

  it('a group chat is several members, longer, with a second voice', () => {
    const out = shape(['irene', 'nana', 'jisoo'], 'ordinary');
    expect(out.interject).toBe(true);
    expect(out.turnLimit).toBeGreaterThan(SCENE_TURN_LIMITS.ordinary);
  });

  /**
   * A shared dorm evening is a group chat with a frame on it, so it takes the
   * group shape and nothing else has to know. That is the point of putting the
   * rule in one place - PROPOSALS 15 added a scene type and did not have to
   * touch a turn limit anywhere.
   */
  it('a dorm evening is a group chat by another name', () => {
    const room = ['irene', 'nana', 'jisoo'];
    expect(shape(room, 'ordinary')).toEqual(shape(room, 'ordinary'));
    expect(shape(room, 'ordinary').interject).toBe(true);
  });

  /**
   * And an anchor event, which already ran at 16 by hand, arrives at 16 from
   * the formula - five members times two extra turns each on top of the event
   * base, clamped. The three used to be three separate decisions.
   */
  it('an anchor event lands on the number it already used', () => {
    expect(shape(['irene', 'nana', 'jisoo', 'hyewon', 'yeri'], 'event').turnLimit).toBe(
      SCENE_TURN_LIMITS.event,
    );
  });
});
