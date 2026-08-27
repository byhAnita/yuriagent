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

  it('never spends it on a scene that is not physical', async () => {
    const client = scripted();
    let session = open({ frame: 'A meeting room.' });
    for (let i = 0; i < session.total; i += 1) {
      ({ session } = await runRound(session, { client, choice: 'A' }));
      expect(tailOf(client)).not.toContain('The work does not wait');
    }
  });
});
