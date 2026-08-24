/**
 * What the campaign has decided. CLAUDE.md section 7, PROPOSALS 20 (c).
 *
 * The assertions that matter are the two rules the store exists to enforce: a
 * decision the event's agenda does not name is dropped, and storage never
 * compacts. Everything else follows from those.
 */

import { describe, it, expect } from 'vitest';
import {
  newCanon,
  agendaIds,
  parseDecisions,
  addDecisions,
  latestByTopic,
  canonForCycle,
  canonForEvent,
  renderCanon,
  CANON_TEXT_MAX,
  CANON_INJECT_MAX,
} from './canon.js';
import { EVENTS } from '../data/events/index.js';

const frame = {
  agenda: [
    { id: 'concept', text: 'which board becomes the concept' },
    { id: 'title_track', text: 'which demo is the title track' },
  ],
};

const decided = (topic, text = 'something was settled') => ({ topic, text });

describe('a decision has to be on the agenda', () => {
  it('keeps one the event asked for', () => {
    const out = parseDecisions([decided('title_track', 'the title track is Surfin Summer')], frame);
    expect(out).toEqual([
      {
        topic: 'title_track',
        text: 'the title track is Surfin Summer',
        display: 'the title track is Surfin Summer',
      },
    ]);
  });

  /**
   * THE RULE. Section 9's roster rule in a new place, and here for the same
   * reason: prompting alone will not hold it. A model asked what a room decided
   * will invent one, and a decision recorded for nothing is worse than one never
   * recorded - unlike a bad dossier entry, canon outlives the scene.
   */
  it('drops one it did not', () => {
    expect(parseDecisions([decided('who_married_whom')], frame)).toEqual([]);
    expect(parseDecisions([decided('title_track'), decided('nonsense')], frame)).toHaveLength(1);
  });

  it('drops everything when the scene had no agenda at all', () => {
    expect(parseDecisions([decided('title_track')], { movements: [] })).toEqual([]);
    expect(parseDecisions([decided('title_track')], null)).toEqual([]);
  });

  it('keeps only the first answer for a topic, so one event cannot say twice', () => {
    const out = parseDecisions([decided('concept', 'summer'), decided('concept', 'winter')], frame);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('summer');
  });

  it('treats an empty list as the correct answer for a day that settled nothing', () => {
    expect(parseDecisions([], frame)).toEqual([]);
    expect(parseDecisions(null, frame)).toEqual([]);
    expect(parseDecisions('not a list', frame)).toEqual([]);
  });

  it('drops junk rather than throwing', () => {
    expect(parseDecisions([null, 42, {}, { topic: 'concept' }], frame)).toEqual([]);
  });

  it('caps a runaway string so one decision cannot own block 4', () => {
    const [entry] = parseDecisions([decided('concept', 'x'.repeat(500))], frame);
    expect(entry.text).toHaveLength(CANON_TEXT_MAX);
  });
});

/**
 * Two texts, and section 12 learned this the hard way with `learnableFacts`:
 * memory is English (section 19 rule 2), so without a display string a `zh`
 * player reads their own campaign's decisions in English.
 */
describe('an entry carries the prompt text and the player text', () => {
  it('keeps them apart when the model gives both', () => {
    const [e] = parseDecisions(
      [{ topic: 'concept', text: 'the concept is summer', display: 'the concept is summer, in zh' }],
      frame,
    );
    expect(e.text).toBe('the concept is summer');
    expect(e.display).toBe('the concept is summer, in zh');
  });

  it('falls back to the English rather than to a blank', () => {
    const [e] = parseDecisions([decided('concept', 'the concept is summer')], frame);
    expect(e.display).toBe('the concept is summer');
  });
});

describe('storage never compacts', () => {
  it('appends with the cycle it happened in', () => {
    const canon = addDecisions(newCanon(), parseDecisions([decided('concept', 'summer')], frame), {
      cycle: 0,
      phase: 'prep',
      slot: 'event_a',
    });

    expect(canon).toHaveLength(1);
    expect(canon[0]).toMatchObject({ topic: 'concept', cycle: 0, phase: 'prep', slot: 'event_a' });
  });

  /**
   * Cycle 2's title track does not delete cycle 1's. The handbook should be
   * able to show a campaign that changed its mind, and a store that rewrites
   * its own history is the ledger's compaction rule leaking somewhere it was
   * deliberately kept out of.
   */
  it('keeps an earlier answer to the same topic', () => {
    let canon = newCanon();
    canon = addDecisions(canon, [{ topic: 'title_track', text: 'first', display: 'first' }], {
      cycle: 0,
      phase: 'prep',
      slot: 'event_a',
    });
    canon = addDecisions(canon, [{ topic: 'title_track', text: 'second', display: 'second' }], {
      cycle: 1,
      phase: 'prep',
      slot: 'event_a',
    });

    expect(canon).toHaveLength(2);
    expect(canon.map((e) => e.text)).toEqual(['first', 'second']);
  });

  it('is unchanged by an empty batch', () => {
    const canon = newCanon();
    expect(addDecisions(canon, [], { cycle: 0 })).toBe(canon);
  });
});

describe('injection is filtered where storage is not', () => {
  const entry = (topic, text, cycle) => ({ topic, text, display: text, cycle });

  it('supersedes: the latest answer per topic wins', () => {
    const canon = [entry('t', 'first', 0), entry('c', 'concept', 0), entry('t', 'second', 1)];
    expect(latestByTopic(canon).map((e) => e.text)).toEqual(['concept', 'second']);
  });

  it('shows this cycle only, so week 8 is not reading week 1', () => {
    const canon = [entry('a', 'old', 0), entry('b', 'new', 1)];
    expect(canonForCycle(canon, 1).map((e) => e.text)).toEqual(['new']);
    expect(canonForCycle(canon, 0).map((e) => e.text)).toEqual(['old']);
  });

  /**
   * Block 4 is ordered by immediacy and its most important line is the standing
   * sentence, the one that makes every reaction proportionate. Eighteen world
   * facts would drown it - so the cap is a salience rule, not a token budget.
   */
  it('caps the lines, keeping the most recent', () => {
    const many = Array.from({ length: 12 }, (_, i) => entry(`t${i}`, `d${i}`, 0));
    const out = canonForCycle(many, 0);

    expect(out).toHaveLength(CANON_INJECT_MAX);
    expect(out.at(-1).text).toBe('d11');
  });

  it('says nothing at all when nothing has been decided', () => {
    expect(canonForCycle([], 0)).toEqual([]);
    expect(renderCanon([])).toBeNull();
    expect(renderCanon(null)).toBeNull();
  });

  /** The prompt reads `text`, never `display` - memory stays English. */
  it('renders the English text and never the display one', () => {
    const out = renderCanon([{ topic: 't', text: 'the English one', display: 'the zh one' }]);
    expect(out).toContain('the English one');
    expect(out).not.toContain('the zh one');
  });
});

/**
 * Against the shipped catalogue rather than a fixture, because the topic ids
 * are content and a rename breaks this silently - the decision is simply
 * dropped and nothing says so.
 */
describe('against the real events', () => {
  it('reads every agenda id off a shipped event', () => {
    expect(agendaIds(EVENTS.concept_meeting.frame)).toEqual([
      'concept',
      'title_track',
      'styling',
      'centre',
    ]);
  });

  it('accepts what the concept meeting can settle and nothing else', () => {
    const f = EVENTS.concept_meeting.frame;
    expect(parseDecisions([decided('title_track')], f)).toHaveLength(1);
    expect(parseDecisions([decided('ending_pose')], f)).toEqual([]);
  });

  it('returns no ids for a frame with no agenda, like a date', () => {
    expect(agendaIds({ movements: [] })).toEqual([]);
    expect(agendaIds(null)).toEqual([]);
  });
});

/**
 * The chain. PROPOSALS 20 (c), step 4.
 *
 * `reads` is what makes the four recurring events a chain rather than four
 * separate days: the MV shoot shoots the concept the meeting chose, Music Bank
 * performs the ending pose the shoot landed on, and the next concept meeting
 * knows what the fandom made of all of it.
 */
describe('an event is handed what it was authored to build on', () => {
  const at = (topic, text, cycle) => ({ topic, text, display: text, cycle });

  it('reaches back into earlier cycles for a topic it reads', () => {
    const canon = [at('fandom_focus', 'the fandom latched onto the bridge', 0)];
    const out = canonForEvent(canon, { cycle: 1, reads: ['fandom_focus'] });

    expect(out.map((e) => e.text)).toEqual(['the fandom latched onto the bridge']);
  });

  it('prefers the current answer when a topic was settled again', () => {
    const canon = [at('title_track', 'first single', 0), at('title_track', 'second single', 1)];
    const out = canonForEvent(canon, { cycle: 1, reads: ['title_track'] });

    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('second single');
  });

  it('fills the rest of the budget from this cycle', () => {
    const canon = [at('fandom_focus', 'read me', 0), at('concept', 'this cycle', 1)];
    const out = canonForEvent(canon, { cycle: 1, reads: ['fandom_focus'] });

    expect(out.map((e) => e.topic).sort()).toEqual(['concept', 'fandom_focus']);
  });

  it('never lists a topic twice when it is both read and settled this cycle', () => {
    const canon = [at('title_track', 'old', 0), at('title_track', 'new', 1)];
    const out = canonForEvent(canon, { cycle: 1, reads: ['title_track'] });

    expect(out).toHaveLength(1);
  });

  /**
   * THE CAP HAS TO BITE THE RIGHT END. Four reads plus six current-cycle
   * entries is ten lines for a six-line budget, and trimming from the wrong
   * side would quietly delete the chain - the one thing the day was authored
   * to have - while keeping six facts it did not ask for.
   */
  it('keeps the chain and drops from this cycle when the budget runs out', () => {
    const reads = ['a', 'b', 'c', 'd'];
    const canon = [
      ...reads.map((t) => at(t, `chain ${t}`, 0)),
      ...Array.from({ length: 6 }, (_, i) => at(`x${i}`, `filler ${i}`, 1)),
    ];
    const out = canonForEvent(canon, { cycle: 1, reads });

    expect(out).toHaveLength(CANON_INJECT_MAX);
    for (const t of reads) expect(out.map((e) => e.topic)).toContain(t);
  });

  it('behaves like an ordinary scene when the event reads nothing', () => {
    const canon = [at('concept', 'this cycle', 1)];
    expect(canonForEvent(canon, { cycle: 1 }).map((e) => e.text)).toEqual(['this cycle']);
    expect(canonForEvent([], { cycle: 0, reads: ['anything'] })).toEqual([]);
  });

  it('reads history before the present', () => {
    const canon = [at('fandom_focus', 'last cycle', 0), at('concept', 'this cycle', 1)];
    const out = canonForEvent(canon, { cycle: 1, reads: ['fandom_focus'] });

    expect(out.map((e) => e.cycle)).toEqual([0, 1]);
  });
});

/**
 * A stale fact with no timestamp is worse than no fact: a model will state last
 * cycle's title track in the present tense, and the player reads a continuity
 * error rather than a callback.
 */
describe('an older decision says that it is older', () => {
  it('marks an earlier cycle and leaves the current one bare', () => {
    const out = renderCanon(
      [
        { topic: 'a', text: 'last time', cycle: 0 },
        { topic: 'b', text: 'this time', cycle: 1 },
      ],
      1,
    );

    expect(out).toContain('- earlier in the campaign: last time');
    expect(out).toContain('- this time');
    expect(out).not.toContain('earlier in the campaign: this time');
  });

  it('marks nothing when the caller does not say which cycle it is', () => {
    expect(renderCanon([{ topic: 'a', text: 'x', cycle: 0 }])).toBe('- x');
  });
});

/**
 * A `reads` id that matches no agenda anywhere is a DEAD REFERENCE, and it
 * fails silently - the line simply never appears, and the chain has a hole
 * nobody notices. Exactly the shape a rename produces.
 */
describe('every reads id points at something', () => {
  it('names only topics some event can actually settle', () => {
    const settleable = new Set(
      Object.values(EVENTS).flatMap((e) => e.frame.agenda.map((a) => a.id)),
    );

    for (const [id, event] of Object.entries(EVENTS)) {
      for (const topic of event.reads ?? []) {
        expect(settleable.has(topic), `${id} reads "${topic}", which nothing settles`).toBe(true);
      }
    }
  });

  it('gives every event something to build on', () => {
    for (const [id, event] of Object.entries(EVENTS)) {
      expect((event.reads ?? []).length, `${id} reads nothing`).toBeGreaterThan(0);
    }
  });

  /**
   * An event reading its OWN topics is correct and deliberate - a second
   * concept meeting should know what the first one chose, or it will pick the
   * same concept again and call it a comeback.
   */
  it('lets a recurring event read its own previous answers', () => {
    expect(EVENTS.concept_meeting.reads).toContain('title_track');
  });
});
