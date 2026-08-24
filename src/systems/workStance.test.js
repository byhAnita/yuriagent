/**
 * The `work` stance. PROPOSALS 22.
 *
 * Reported in the day-three playtest, at an anchor event about a comeback:
 *
 *   > the options are still daily small talk options - maybe this is the cause
 *   > - the whole meeting continue talking about small talks like *Did you
 *   > sleep well yesterday*
 *
 * Every one of the other eleven stances is a move in a relationship, and the
 * player is an artist assistant. They typed every agenda topic in by hand.
 *
 * Kept in its own file rather than folded into `chips.test.js` because the
 * assertions here are about ONE stance's properties across four different
 * subsystems - legality, the common weighting, the reserved risk slot, and both
 * offline writers - and a describe block buried in a general file is where a
 * property quietly stops being checked.
 */

import { describe, it, expect } from 'vitest';
import { availableStances, generateChips, STANCES, COMMON_STANCES, RISK_STANCES, isRiskStance } from './chips.js';
import { newRelation } from './relationship.js';
import en from '../i18n/en.js';
import zh from '../i18n/zh.js';

const rel = (patch) => ({ ...newRelation(50), intimacy: 50, ...patch });

describe('work exists and is common', () => {
  it('is in the vocabulary', () => {
    expect(STANCES).toContain('work');
  });

  /**
   * FOUR IS THE NUMBER, and it is load-bearing. `generateChips` fills two of
   * three slots from the common set and reserves the third, so a fifth common
   * stance dilutes every other one by a fifth - including `care`, which the
   * `piqued` conversion runs through.
   */
  it('joins the common register without widening it', () => {
    expect(COMMON_STANCES).toContain('work');
    expect(COMMON_STANCES).toHaveLength(4);
  });

  /**
   * `deflect` gave up the slot, and only the slot. Evasion is a tactic, and the
   * day-two argument for `casual` was that most turns are not tactics - but
   * refusing a subject is still the only thing `deflect` does, and it reads as
   * "change the subject" in both locales, which day one specifically asked for.
   */
  it('did not cost deflect its place in the game', () => {
    expect(COMMON_STANCES).not.toContain('deflect');
    expect(STANCES).toContain('deflect');
    expect(availableStances(rel()).available).toContain('deflect');
  });
});

/**
 * There is no state of a working relationship in which the work stops. This is
 * the second safe move the strain bands wanted - `care` was the first, and
 * before it `apologize` was the only thing left in `rift`.
 */
describe('work is never taken away', () => {
  const states = {
    rift: { strain: 70 },
    critical: { strain: 95 },
    piqued: { jealousy: 30 },
    sharp: { jealousy: 60 },
    corrosive: { jealousy: 90 },
    stranger: { intimacy: 0 },
    reckless: { intimacy: 20, admissibility: 70 },
  };

  for (const [name, patch] of Object.entries(states)) {
    it(`survives ${name}`, () => {
      const { available, locked } = availableStances(rel(patch));
      expect(available).toContain('work');
      expect(locked.work).toBeUndefined();
    });
  }

  it('survives an exhausted player, when most of the palette does not', () => {
    const { available } = availableStances(rel(), { energy: 5 });
    expect(available).toContain('work');
    expect(available).not.toContain('press');
  });
});

/**
 * The third occurrence of the `markRisk` shape was a warm common register
 * crowding the one slot that reaches admissibility. Adding a fifth warm verb is
 * exactly the move that could do it again, so this is asserted rather than
 * assumed.
 */
describe('work does not eat the bet', () => {
  it('is not itself a risk', () => {
    expect(RISK_STANCES).not.toContain('work');
    expect(isRiskStance('work', 100)).toBe(false);
  });

  it('leaves the reserved slot reaching outside the common set', () => {
    let sharpSeen = 0;
    for (let turn = 0; turn < 200; turn += 1) {
      const chips = generateChips(rel({ intimacy: 60 }), { seed: 9, turn });
      expect(chips).toHaveLength(3);
      if (chips.some((s) => !COMMON_STANCES.includes(s))) sharpSeen += 1;
    }
    expect(sharpSeen).toBe(200);
  });

  it('still deals the stances that move admissibility', () => {
    const seen = new Set();
    for (let turn = 0; turn < 400; turn += 1) {
      for (const s of generateChips(rel({ intimacy: 60 }), { seed: 4, turn })) seen.add(s);
    }
    for (const s of RISK_STANCES) expect(seen).toContain(s);
  });

  it('is offered often enough to be the everyday move it claims to be', () => {
    let workSeen = 0;
    for (let turn = 0; turn < 400; turn += 1) {
      if (generateChips(rel({ intimacy: 60 }), { seed: 4, turn }).includes('work')) workSeen += 1;
    }
    // Two common slots shared four ways is 50% before suggestions displace any
    // of them. Anything near zero means it was added to a list nothing reads.
    expect(workSeen).toBeGreaterThan(120);
  });
});

describe('every layer knows the word', () => {
  it('has a label in both locales', () => {
    expect(en.stance.work).toBeTruthy();
    expect(zh.stance.work).toBeTruthy();
  });

  /**
   * The offline writer is a supported mode, not a degraded one (section 3), so
   * a stance the mock cannot answer is a stance that silently falls back to a
   * generic line for every player with no API key.
   */
  /**
   * Asserted against the TABLES rather than against pasted prose, for two
   * reasons: section 21 keeps non-ASCII out of `systems/`, and matching a
   * literal I copied out of the table only proves I can copy. This proves the
   * table has a `work` entry and that the writer reaches it.
   */
  it('has an offline answer in both locales', async () => {
    const { createMockClient } = await import('../tools/mockClient.js');
    const { LINES_ZH } = await import('../tools/mockLines.zh.js');
    const client = createMockClient({ delay: 0, failureRate: 0 });

    // The writer detects the language off the prompt rather than being told -
    // it is also the fallback for a failed live call, which has no settings.
    const say = (system) =>
      client({
        messages: [
          { role: 'system', content: `@irene\n${system}` },
          { role: 'user', content: '[work] ' },
        ],
      });

    expect(LINES_ZH.work?.length).toBeGreaterThan(0);

    const en = await say('Write in English.');
    const cn = await say('Write all prose in Simplified Chinese.');

    expect(cn).not.toBe(en);
    expect(LINES_ZH.work.some(([, , , body]) => cn.includes(body))).toBe(true);
  });
});
