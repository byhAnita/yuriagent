/**
 * What today is, and what the campaign has settled, in the rendered tail.
 * CLAUDE.md Part I.5, sections 7 and 10.
 *
 * Three places computed a frame and handed it over - `onShared`, `askOut`,
 * `onEnter` - and nothing read any of them for the whole of the v2 rebuild;
 * `systems/canon.js` was written, tested and persisted at schemaVersion 3 and
 * never reached a prompt at all. Four values, one missing slot.
 *
 * This file is the BEHAVIOURAL half: given a frame, does the tail carry it, and
 * does it stay out of the way when there is not one. Whether App still hands
 * either of them over is `systems/frameJoin.test.js`, because a test that
 * supplies its own arguments structurally cannot see a missing call - which is
 * the whole reason this bug reached nine instances.
 */

import { describe, it, expect } from 'vitest';
import { buildTier3 } from './tiers.js';
import { beginScene, runRound } from './roundEngine.js';
import { newPool } from './pool.js';
import { SENTINEL } from '../config/rules.js';
import { getCast } from '../data/cast.js';
import { getIdentity } from '../data/identities.js';
import { newRelation } from '../systems/relationship.js';
import { renderFrame, dateFrame } from '../data/sceneFrames.js';
import { EVENTS, eventFrame, WORK_INTERLUDE } from '../data/events/index.js';
import { renderCanon, canonForCycle, addDecisions } from '../systems/canon.js';

const cards = [
  { id: 'irene', name: 'Irene' },
  { id: 'yeri', name: 'Yeri' },
];

const base = {
  cards,
  present: ['irene'],
  roster: ['irene'],
  speaking: { primary: 'irene', mode: 'answers', changed: false },
  relations: { irene: { affection: 40, admissibility: 10 } },
  player: { selfId: 30, mood: 50, secrecy: 70 },
  locationLabel: 'Bistro',
  week: 2,
  day: 5,
  block: 'evening',
  phase: 'prep',
  roundIndex: 3,
  roundsLeft: 4,
};

describe('the frame reaches the tail', () => {
  it('says nothing at all on an ordinary block', () => {
    const tail = buildTier3(base);
    expect(tail).not.toContain('## THE DAY');
  });

  /**
   * A date is the case with the least other context: a venue, one member, and
   * a whole afternoon. Without the frame the model is handed a room and a name
   * and has nothing to aim at, which is what section 10 measured producing a
   * scene that settles nothing.
   */
  it('carries a date frame - the setting and the situations', () => {
    const frame = renderFrame(dateFrame('public', 'bistro'));
    const tail = buildTier3({ ...base, frame });

    expect(tail).toContain('## THE DAY');
    expect(tail).toContain('corner table at a small bistro');
    expect(tail).toContain('the walk back afterwards');
  });

  it('carries an event frame with its agenda intact', () => {
    const frame = renderFrame(eventFrame(EVENTS.concept_meeting, { cycle: 0, seed: 7 }));
    const tail = buildTier3({ ...base, present: ['irene', 'yeri'], frame });

    expect(tail).toContain('## THE DAY');
    expect(tail).toContain('here to settle these');
    // The business, not only the mood - the half a concept meeting was missing.
    for (const item of EVENTS.concept_meeting.frame.agenda) {
      expect(tail).toContain(item.text);
    }
  });

  /**
   * Immediacy runs downward inside the tail (section 8): where you are, then
   * what today is, then the numbers, then what the player just did. A frame
   * read after the round instruction is a footnote.
   */
  it('puts the day above the values and below the room', () => {
    const frame = renderFrame(dateFrame('private'));
    const tail = buildTier3({ ...base, frame });

    expect(tail.indexOf('## THE DAY')).toBeGreaterThan(tail.indexOf('## NOW'));
    expect(tail.indexOf('## THE DAY')).toBeLessThan(tail.indexOf('## VALUES'));
    expect(tail.indexOf('## THE DAY')).toBeLessThan(tail.indexOf('## THIS ROUND'));
  });
});

/**
 * The complaint this answers was stated three times in one played session - no
 * description of the shoot, the stage or the fan meeting - and the flag that was
 * supposed to answer it, `physical`, has been on three events with no reader
 * since the v1 interlude call went. Eleventh instance of the same shape.
 */
describe('a day that does something says so, once', () => {
  it('carries the work when the engine hands it over', () => {
    const tail = buildTier3({ ...base, work: WORK_INTERLUDE });
    expect(tail).toContain('The work does not wait for the conversation');
  });

  it('says nothing on an ordinary event round', () => {
    expect(buildTier3(base)).not.toContain('The work does not wait');
  });

  /**
   * It points at the movements rather than repeating them. Writing the shoot's
   * specifics here as well would be the card-said-twice mistake, and the frame
   * is three sections up in the same tail.
   */
  it('names no event in particular', () => {
    for (const id of ['shoot', 'Music Bank', 'fan meeting', 'album']) {
      expect(WORK_INTERLUDE).not.toContain(id);
    }
  });
});

/**
 * THE CLOSING DIRECTIVE, and it is the half v2 was missing.
 *
 * Measured live: an eight-round concept meeting with a four-item agenda in the
 * tail on every single round settled NOTHING. The prose was good and `canon`
 * came back empty, so the campaign would have gone on to shoot a video for a
 * concept nobody chose - which is v1's played defect arriving by a new door.
 *
 * Section 10 always had both halves: the agenda stated as an obligation where
 * the movements are offered, AND said once more on the turn the client knows is
 * last. A room told at the top of a scene that it must decide four things will
 * spend the scene being a room, because that is what every other instruction it
 * holds asks for.
 */
describe('the last round of an event has to decide something', () => {
  const agenda = [
    { id: 'title_track', text: 'which of the demos is the title track' },
    { id: 'concept', text: 'the concept the comeback is built on' },
  ];

  it('says nothing while there are rounds left', () => {
    const tail = buildTier3({ ...base, agenda, roundsLeft: 3 });
    expect(tail).not.toContain('The day ends here');
  });

  it('names what is still unsettled on the last round', () => {
    const tail = buildTier3({ ...base, agenda, roundIndex: 7, roundsLeft: 0 });

    expect(tail).toContain('The day ends here');
    expect(tail).toContain('which of the demos is the title track');
    expect(tail).toContain('the concept the comeback is built on');
  });

  /**
   * The `canon|` line rides with the FORMAT reminder, not with the agenda.
   *
   * Measured live: told to settle four things on the last round, the model
   * settled all four by name - in the prose - and emitted no machine line for
   * any of them. The instruction existed and sat three hundred tokens above the
   * generation beside a request for prose, which this file has already measured
   * being too far to see. The last line of the tail is the one place with a
   * demonstrated hit rate, so that is where it goes.
   */
  it('asks for the machine line at the very bottom, where the format lives', () => {
    const tail = buildTier3({ ...base, agenda, roundIndex: 7, roundsLeft: 0 });
    const lines = tail.split('\n');

    expect(tail).toContain('canon|title_track|');
    expect(tail).toContain('canon|concept|');
    // Below the four-options reminder, which is the last thing the model reads.
    expect(lines.findIndex((l) => l.includes('canon|title_track|'))).toBeGreaterThan(
      lines.findIndex((l) => l.includes('The four options are not optional')),
    );
  });

  /**
   * Only the unsettled ones. `canon` appends rather than merges, so a topic the
   * room reached in round three and settles again, differently, on the last
   * round leaves the campaign holding both answers.
   */
  it('leaves out what the room already decided', () => {
    const tail = buildTier3({
      ...base,
      agenda,
      settled: ['title_track'],
      roundIndex: 7,
      roundsLeft: 0,
    });

    expect(tail).not.toContain('which of the demos is the title track');
    expect(tail).toContain('the concept the comeback is built on');
  });

  it('stays silent when the day settled all of it', () => {
    const tail = buildTier3({
      ...base,
      agenda,
      settled: ['title_track', 'concept'],
      roundIndex: 7,
      roundsLeft: 0,
    });

    expect(tail).toContain('This is the LAST round');
    expect(tail).not.toContain('The day ends here');
  });

  /** An ordinary scene has no agenda and is not asked to decide anything. */
  it('never appears in a scene that is not an event', () => {
    const tail = buildTier3({ ...base, roundIndex: 7, roundsLeft: 0 });
    expect(tail).not.toContain('The day ends here');
  });
});

describe('canon reaches the tail', () => {
  const settled = addDecisions([], [{ topic: 'title_track', text: 'the title track is Surfin Summer' }], {
    cycle: 0,
    phase: 'prep',
    slot: 'event_a',
  });

  /**
   * A campaign in its first week has decided nothing, and a heading that says
   * so is worse than no heading - the same rule `renderCanon` follows.
   */
  it('says nothing in a campaign that has settled nothing', () => {
    expect(buildTier3({ ...base, canon: renderCanon(canonForCycle([], 0), 0) })).not.toContain(
      '## WHAT THE CAMPAIGN HAS SETTLED',
    );
  });

  /**
   * The half that makes pillar 4 true: this is an ORDINARY block in a wardrobe,
   * and the model can still bring up what the group chose. Before this, canon
   * reached the handbook and nothing else, so a decision the player watched
   * being made was never mentioned again by anybody.
   */
  it('carries the current cycle into an ordinary scene', () => {
    const canon = renderCanon(canonForCycle(settled, 0), 0);
    const tail = buildTier3({ ...base, canon });

    expect(tail).toContain('## WHAT THE CAMPAIGN HAS SETTLED');
    expect(tail).toContain('Surfin Summer');
  });

  /**
   * An entry from an earlier cycle has to SAY so, or the last comeback's title
   * track reads as the current one - a model handed a stale fact with no
   * timestamp states it in the present tense.
   */
  it('marks an older decision as older', () => {
    const tail = buildTier3({ ...base, canon: renderCanon(canonForCycle(settled, 0), 1) });
    expect(tail).toContain('earlier in the campaign');
  });
});

/**
 * ...and through the real loop, because `buildTier3` renders whatever it is
 * handed and the whole defect being fixed here is nobody handing it anything.
 * The engine is the one layer between App and the tail, and it is where the
 * work line's ROUND is decided.
 */
describe('the engine carries a framed scene end to end', () => {
  const room = getCast();

  function scripted() {
    const seen = [];
    const client = async ({ messages, onChunk }) => {
      seen.push(messages);
      const out = ['She looks up.', SENTINEL, 'A|a', 'B|b', 'C|c', 'D|d', 'emo|neutral'].join('\n');
      onChunk?.(out);
      return out;
    };
    client.seen = seen;
    return client;
  }

  const open = (extra) =>
    beginScene({
      cards: room,
      identity: getIdentity(),
      player: { name: 'Yuhan', selfId: 40, mood: 55, secrecy: 70 },
      relations: Object.fromEntries(room.map((c) => [c.id, newRelation(5)])),
      lang: 'en',
      pool: newPool(),
      seed: 11,
      scene: {
        id: 'e1',
        locationId: 'meeting_room',
        locationLabel: 'Meeting Room',
        present: room.map((c) => c.id),
        roster: room.map((c) => c.id),
        week: 0,
        day: 1,
        block: 'morning',
        phase: 'prep',
        ...extra,
      },
    });

  const tailOf = (client) => client.seen.at(-1).at(-1).content;

  it('puts the day and the campaign in the tail of a real round', async () => {
    const frame = renderFrame(eventFrame(EVENTS.concept_meeting, { cycle: 0, seed: 11 }));
    const canon = renderCanon(
      canonForCycle(
        addDecisions([], [{ topic: 'concept', text: 'the concept is a winter road trip' }], {
          cycle: 0,
          phase: 'prep',
          slot: 'event_a',
        }),
        0,
      ),
      0,
    );

    const client = scripted();
    await runRound(open({ frame, canon }), { client });
    const tail = tailOf(client);

    expect(tail).toContain('## THE DAY');
    expect(tail).toContain('## WHAT THE CAMPAIGN HAS SETTLED');
    expect(tail).toContain('winter road trip');
  });

  /**
   * One round, not every round and not none. Played the wrong way round, this
   * is either a scene where something is permanently being reset or the green
   * room the complaint was about.
   */
  it('spends the work line on exactly one round of the scene', async () => {
    const client = scripted();
    let session = open({ frame: 'A set.', work: WORK_INTERLUDE });
    const total = session.total;

    let hits = 0;
    for (let i = 0; i < total; i += 1) {
      ({ session } = await runRound(session, { client, choice: 'A' }));
      if (tailOf(client).includes('The work does not wait')) hits += 1;
    }

    expect(hits).toBe(1);
  });

  /**
   * The model proposes a decision; the code says whether the room was entitled
   * to make it. Section 7's rule, which `App.jsx` claimed `endScene` enforced
   * while nothing did - and a canon entry is permanent, shown to the player and
   * read back by the next event in the chain.
   */
  it('keeps a decision that was on the agenda and drops one that was not', async () => {
    const decided = (topic) =>
      [
        'They settle it.',
        SENTINEL,
        'A|a',
        'B|b',
        'C|c',
        'D|d',
        'emo|neutral',
        `canon|${topic}|the title track is Winter Drive`,
      ].join('\n');

    const client = async ({ messages, onChunk }) => {
      void messages;
      const out = decided(client.topic);
      onChunk?.(out);
      return out;
    };

    let session = open({ agenda: [{ id: 'title_track', text: 'the title track' }, { id: 'concept', text: 'the concept' }] });
    client.topic = 'title_track';
    ({ session } = await runRound(session, { client }));
    expect(session.canon).toHaveLength(1);

    client.topic = 'centre';
    ({ session } = await runRound(session, { client, choice: 'A' }));
    expect(session.canon, 'a topic nobody put on the agenda was kept').toHaveLength(1);
  });

  /**
   * The strong version: only an authored event has an agenda, and a wardrobe
   * chat is not entitled to decide the group's title track however confidently
   * the model writes the line.
   */
  it('records nothing at all in a scene with no agenda', async () => {
    const client = async ({ onChunk }) => {
      const out = [
        'She shrugs.',
        SENTINEL,
        'A|a',
        'B|b',
        'C|c',
        'D|d',
        'emo|neutral',
        'canon|title_track|the title track is Winter Drive',
      ].join('\n');
      onChunk?.(out);
      return out;
    };

    const { session } = await runRound(open(), { client });
    expect(session.canon).toHaveLength(0);
  });

  it('never spends it on a scene that is not physical', async () => {
    const client = scripted();
    let session = open({ frame: 'A meeting room.' });
    for (let i = 0; i < session.total; i += 1) {
      ({ session } = await runRound(session, { client, choice: 'A' }));
      expect(tailOf(client)).not.toContain('The work does not wait');
    }
  });
});
