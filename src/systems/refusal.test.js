/**
 * A refusal names the axis it was short on. PROPOSALS 25.
 *
 * The report asked for `affection` on the scene screen, and the answer to that
 * is no: pillar 1 is the player READING hidden state and betting on it, and
 * `Read her` is rationed precisely so that reading her costs something. A
 * readout retires both in one stroke.
 *
 * But the thing underneath the ask is real, and it is a legibility problem
 * rather than a numbers one:
 *
 *   > Oh no we have no dating access to anyone.
 *
 * A public date gates on `admissibility` and a private one on `affection` - two
 * completely different questions - and both came back as `too_soon`. Naming the
 * axis is pillar 1 WORKING: the hidden state becomes readable through a
 * decision the player made, not through a number on the screen.
 */

import { describe, it, expect } from 'vitest';
import { blockedReason, axisRefusal, REFUSAL, dateOffers } from './dating.js';
import { newRelation } from './relationship.js';
import { DATE_KINDS } from '../config/constants.js';
import en from '../i18n/en.js';
import zh from '../i18n/zh.js';

const rel = (patch) => ({ ...newRelation(5), ...patch });
const rich = { credits: 999 };

describe('the two axes give two different answers', () => {
  /**
   * The plateau, stating its terms. Enormous affection and no admissibility: the
   * private day is easy and the public one is shut, and the player should be
   * able to tell those apart from the refusal alone.
   */
  it('tells the plateau it is not nameable, not that it is not close', () => {
    const stalled = rel({ affection: 90, admissibility: 5, stage: 'confidante' });
    expect(blockedReason(stalled, 'private', rich)).toBeNull();
    expect(blockedReason(stalled, 'public', rich)).toBe(REFUSAL.NOT_NAMEABLE);
  });

  it('tells a reckless run it is not close, not that it is not nameable', () => {
    const reckless = rel({ affection: 10, admissibility: 70 });
    expect(blockedReason(reckless, 'public', rich)).toBeNull();
    expect(blockedReason(reckless, 'private', rich)).toBe(REFUSAL.NOT_CLOSE);
  });

  it('never answers with the old undifferentiated reason', () => {
    expect(REFUSAL.TOO_SOON).toBeUndefined();
  });

  /**
   * Derived from the gate rather than hardcoded, so a third kind of date with a
   * third axis cannot silently fall back to a reason naming the wrong one.
   */
  it('derives which reason from the kind\'s own axis', () => {
    expect(axisRefusal('public')).toBe(REFUSAL.NOT_NAMEABLE);
    expect(axisRefusal('private')).toBe(REFUSAL.NOT_CLOSE);
    for (const [kind, def] of Object.entries(DATE_KINDS)) {
      const expected = def.axis === 'admissibility' ? REFUSAL.NOT_NAMEABLE : REFUSAL.NOT_CLOSE;
      expect(axisRefusal(kind)).toBe(expected);
    }
  });

  it('falls back to a real reason for a kind that does not exist', () => {
    expect(blockedReason(rel(), 'nonsense', rich)).toBe(REFUSAL.NOT_CLOSE);
  });
});

/**
 * THE AXIS FIRST, AND IT IS NOW THE ONLY THING AHEAD OF THE PRICE.
 *
 * Strain and jealousy used to outrank both, on the grounds that they were
 * states the player could repair where "not yet" only means keep going. Part
 * I.8 retires both numbers, and the argument survives them: what the player most
 * needs to hear is which of two completely different questions they were short
 * on, because that is the one that says what to go and do.
 */
describe('the ordering', () => {
  it('names the axis before the price', () => {
    expect(blockedReason(rel({ affection: 0, admissibility: 0 }), 'public', { credits: 0 })).toBe(
      REFUSAL.NOT_NAMEABLE,
    );
  });

  it('still says the price last, once she would have said yes', () => {
    expect(blockedReason(rel({ affection: 0, admissibility: 90 }), 'public', { credits: 0 })).toBe(
      REFUSAL.CREDITS,
    );
  });
});

describe('the player can read it', () => {
  it('has words for both, in both locales, and neither is a number', () => {
    for (const bundle of [en, zh]) {
      for (const key of [REFUSAL.NOT_CLOSE, REFUSAL.NOT_NAMEABLE]) {
        expect(bundle.date.no[key]).toBeTruthy();
        expect(bundle.date.refused[key]).toBeTruthy();
        expect(bundle.date.refused[key]).not.toMatch(/\d/);
      }
    }
  });

  it('has kept a word for every reason the system can return', () => {
    for (const reason of Object.values(REFUSAL)) {
      for (const bundle of [en, zh]) {
        expect(bundle.date.no[reason], `no.${reason}`).toBeTruthy();
        expect(bundle.date.refused[reason], `refused.${reason}`).toBeTruthy();
      }
    }
  });

  /** The offer list carries it, which is where the player meets it first. */
  it('reaches the offers', () => {
    const cast = [{ id: 'irene' }];
    const relations = { irene: rel({ affection: 90, admissibility: 5 }) };
    const offers = dateOffers({ phase: 'prep', cast, relations, player: rich });

    const publicOffer = offers.find((o) => o.kind === 'public');
    expect(publicOffer.available).toBe(false);
    expect(publicOffer.reason).toBe(REFUSAL.NOT_NAMEABLE);
  });
});
