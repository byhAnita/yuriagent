/**
 * Block 4 standing. CLAUDE.md sections 7 and 8.
 *
 * Without this the model writes every scene at the same emotional distance,
 * which is the most obvious way a generated line reads as canned - the same
 * gift from a colleague and from someone at `unspoken` came back as the same
 * sentence, because nothing in the prompt distinguished them.
 */

import { describe, it, expect } from 'vitest';
import { buildSceneHeader, standingLine, STANDING } from './promptBuilder.js';
import { newRelation, resolveStage } from '../systems/relationship.js';

const rel = (intimacy, admissibility = 0, extra = {}) => ({
  ...newRelation(intimacy),
  admissibility,
  stage: resolveStage(intimacy, admissibility),
  ...extra,
});

const header = (relations, roster = [{ id: 'irene', name: 'Irene' }]) =>
  buildSceneHeader({
    roster,
    absent: [],
    week: 0,
    day: 1,
    block: 'evening',
    phase: 'prep',
    locationLabel: 'X Practice Room',
    exposure: 20,
    relations,
    player: { energy: 80 },
  });

describe('the header says where the two of you stand', () => {
  it('names a standing for every stage the map can actually produce', () => {
    const reachable = new Set();
    for (let i = 0; i <= 100; i += 1) {
      for (let a = 0; a <= 100; a += 1) reachable.add(resolveStage(i, a));
    }
    expect(reachable.size).toBeGreaterThan(6);
    for (const stage of reachable) {
      expect(STANDING[stage], `no standing sentence for stage "${stage}"`).toBeTruthy();
    }
  });

  it('says something different at colleague and at unspoken', () => {
    const early = header({ irene: rel(20) });
    const late = header({ irene: rel(80, 50) });
    expect(early).not.toBe(late);
    expect(early).toContain('colleague');
    expect(late).toContain('Neither of them has said it out loud');
  });

  /**
   * Numbers in the header invite the model to narrate the number, and section 9
   * forbids numbers in the prose. A sentence cannot be quoted back.
   */
  it('states no numbers', () => {
    const line = standingLine('Irene', rel(72, 45));
    expect(/\d/.test(line)).toBe(false);
  });

  it('only describes members who are present', () => {
    const relations = { irene: rel(70), yeri: rel(70) };
    const out = header(relations);
    expect(out).toContain('Irene');
    expect(out).not.toContain('Yeri put a name to');
  });

  /**
   * Same coordinates, different scene (section 5). Bottom-left with a high
   * peak is Aftermath, not Stranger, and she has to be written that way.
   */
  it('distinguishes never-started from fallen-back', () => {
    const fresh = standingLine('Irene', rel(20));
    const after = standingLine('Irene', rel(20, 0, { peakIntimacy: 70 }));
    expect(after).not.toBe(fresh);
    expect(after).toContain('closer than this once');
  });

  it('survives a relation with no cached stage', () => {
    const bare = { intimacy: 60, admissibility: 30, jealousy: 0, peakIntimacy: 60 };
    expect(standingLine('Irene', bare)).toContain('put a name to');
  });
});

/**
 * Her voice, repeated next to the instruction.
 *
 * All five cards live in block 1, roughly 1500 tokens above the thing the model
 * is being asked to write, and picking the right one out of five is a step it
 * does not reliably take. Given the same practice-room opening, Irene and
 * Hyewon came back with the same line at 90% shared vocabulary while the three
 * louder cards stayed distinct; repeating one line of card here took that to
 * 27%. Both cards were well written - the model had collapsed the two reserved
 * women onto the subset they share.
 */
describe('the header carries her voice, not only her standing', () => {
  const withVoice = (roster) =>
    buildSceneHeader({
      roster,
      absent: [],
      week: 0,
      day: 1,
      block: 'evening',
      phase: 'prep',
      locationLabel: 'X Practice Room',
      exposure: 20,
      relations: { irene: rel(40), hyewon: rel(40) },
      player: { energy: 80 },
    });

  it('quotes the speech style of everyone in the room', () => {
    const out = withVoice([
      { id: 'irene', name: 'Irene', speechStyle: 'Measured and short.' },
      { id: 'hyewon', name: 'Hyewon', speechStyle: 'Soft, careful, slightly formal.' },
    ]);
    expect(out).toContain('Irene speaks like this: Measured and short.');
    expect(out).toContain('Hyewon speaks like this: Soft, careful, slightly formal.');
  });

  it('says nothing at all for a card that has no speech style', () => {
    const out = withVoice([{ id: 'irene', name: 'Irene' }]);
    expect(out).not.toContain('speaks like this');
  });

  it('gives two adjacent cards different headers', () => {
    const a = withVoice([{ id: 'irene', name: 'Irene', speechStyle: 'Measured and short.' }]);
    const b = withVoice([{ id: 'hyewon', name: 'Hyewon', speechStyle: 'Soft and careful.' }]);
    expect(a).not.toBe(b);
  });
});

/**
 * Why she is in this room.
 *
 * The calendar has always known - `occupancyAt` returns an activity for every
 * member in every block - and none of it reached the prompt, which said only
 * "Location: X Practice Room". The model had to invent a reason for her to be
 * standing there, so every scene in a given room opened the same way and she
 * could never say the obvious thing: that the new choreography is hard.
 */
describe('the header says what she is doing here', () => {
  const scene = (extra) =>
    buildSceneHeader({
      roster: [{ id: 'irene', name: 'Irene' }],
      absent: [],
      week: 0,
      day: 1,
      block: 'evening',
      phase: 'prep',
      locationLabel: 'X Practice Room',
      exposure: 20,
      relations: { irene: rel(40) },
      player: { energy: 80 },
      ...extra,
    });

  it('turns a scheduled activity into something she could talk about', () => {
    const out = scene({ occupancy: { irene: { activity: 'group_practice' } } });
    expect(out).toContain('Irene is running the new choreography with the other four.');
  });

  it('says something different for the same room on a different day', () => {
    const practice = scene({ occupancy: { irene: { activity: 'group_practice' } } });
    const alone = scene({ occupancy: { irene: { activity: 'late_practice' } } });
    expect(practice).not.toBe(alone);
    expect(alone).toContain('long after she needed to be');
  });

  it('says nothing rather than guessing when the activity is unknown', () => {
    expect(scene({ occupancy: { irene: { activity: 'wandering_about' } } })).not.toContain(
      'Irene is undefined',
    );
    expect(scene({})).not.toContain('Irene is .');
  });

  it('only speaks for people who are actually in the room', () => {
    const out = scene({
      occupancy: { irene: { activity: 'group_practice' }, yeri: { activity: 'radio_host' } },
    });
    expect(out).toContain('Irene is running');
    expect(out).not.toContain('radio');
  });

  it('gives the week a meaning, not just a label', () => {
    expect(scene({ phase: 'comeback' })).toContain('Cameras on everything');
    expect(scene({ phase: 'rest' })).toContain('scattered to their own work');
    expect(scene({ phase: 'prep' })).not.toBe(scene({ phase: 'comeback' }));
  });

  it('names the job the player still owes, and drops it once it is done', () => {
    const owed = scene({ task: { taskId: 'prep_outfits', done: false } });
    const done = scene({ task: { taskId: 'prep_outfits', done: true } });
    expect(owed).toContain('still owes');
    expect(owed).toContain('stage outfits still need prepping');
    expect(done).toContain('has already prepped the stage outfits');
    expect(done).not.toContain('still owes');
  });

  it('puts the job after her, and the gift after everything', () => {
    // Section 8: the most decision-relevant material sits closest to the
    // dialogue, and what the player walked in holding is the most immediate
    // thing in the room.
    const out = scene({
      occupancy: { irene: { activity: 'group_practice' } },
      task: { taskId: 'stage_check', done: false },
      giftNote: 'System note: the player handed Irene a mugwort pack.',
    });
    const at = (needle) => out.indexOf(needle);
    expect(at('Irene is running')).toBeLessThan(at('still owes'));
    expect(at('still owes')).toBeLessThan(at('System note'));
  });

  it('survives a weekend, when there is no task at all', () => {
    expect(() => scene({ task: null })).not.toThrow();
    expect(scene({ task: null })).not.toContain('owes');
  });
});
