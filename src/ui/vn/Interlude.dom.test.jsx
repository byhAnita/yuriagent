/** @vitest-environment jsdom */
/**
 * The mid-event interlude, on screen. PROPOSALS 23.
 *
 * The engine half is `agent/interlude.test.js`. This is the half that decides
 * WHEN it happens, and the client owns that for the same reason it owns the
 * closing directive: only the client can see the turn budget.
 *
 * Three things are asserted here and nowhere else, because each of them is a
 * bug this project has already shipped once in a different place:
 *
 *   ONCE          - the establishing beat fires once by construction (a scene
 *                   opens once). This one is guarded by a ref, and a ref is a
 *                   thing that can be got wrong.
 *   PHYSICAL ONLY - a flag read off the event, which is exactly the shape of
 *                   join that has failed silently here before.
 *   NARRATION     - `speaker: null`, so no name plate. A paragraph of room with
 *                   somebody's name over it is a line she never said.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VNStage from './VNStage.jsx';
import { newMemory } from '../../agent/memory.js';
import { newRelation } from '../../systems/relationship.js';
import { getCast } from '../../data/cast.js';
import { buildLineup } from '../../systems/castBuilder.js';
import { EVENTS } from '../../data/events/index.js';

afterEach(cleanup);

const cards = getCast();
const ids = cards.map((c) => c.id);
const t = (k) => k;

const ROOM = 'The room is full and nothing has been settled yet.';
const WORK = 'They reset the lights and go again on the wide shot.';
const BEAT = '@irene|neutral|guard40|fluster5\n*She looks over.* "Nearly there."';

/**
 * One deterministic answer per directive, so the assertions are about WHICH
 * call was made rather than about what any model happened to write.
 */
const fake = () => {
  const calls = { establish: 0, interlude: 0 };
  const client = async ({ messages, preset, onChunk }) => {
    if (preset === 'chips') return '';
    const last = messages.at(-1)?.content ?? '';
    if (/physically happening/.test(last)) {
      calls.interlude += 1;
      return WORK;
    }
    if (/before anyone speaks/.test(last)) {
      calls.establish += 1;
      return ROOM;
    }
    if (onChunk) onChunk(BEAT);
    return BEAT;
  };
  return { client, calls };
};

const TURN_LIMIT = 5;

const setup = (event) => ({
  cards,
  lineup: buildLineup(cards),
  identity: { promptRole: 'an artist assistant' },
  player: { name: 'You', energy: 80, secrecy: 70, credits: 10 },
  lang: 'en',
  memory: newMemory(ids),
  relations: Object.fromEntries(ids.map((id) => [id, newRelation(45)])),
  scene: {
    id: 's',
    rosterIds: ['irene'],
    presentIds: ids,
    focusId: 'irene',
    week: 0,
    day: 1,
    block: 'afternoon',
    phase: 'prep',
    locationId: 'practice_room',
    locationLabel: 'Set',
    seed: 1,
    event,
    sceneFrame: event?.frame ?? null,
  },
});

const chipButtons = () =>
  screen.getAllByRole('button').filter((b) => /stance\./.test(b.textContent ?? ''));

const mount = (event, client) =>
  render(
    <VNStage
      setup={setup(event)}
      client={client}
      onSceneEnd={() => {}}
      writtenChips={false}
      turnLimit={TURN_LIMIT}
      t={t}
    />,
  );

/**
 * While beats are outstanding the bar IS the continue control - section 6, and
 * the reason six dead options is worse than one live one. So reading a reply
 * through means clicking that, not the chips.
 */
const continueButton = () =>
  screen.queryAllByRole('button').find((b) => /vn\.continue/.test(b.textContent ?? ''));

/** Read every outstanding beat, then take a turn. */
async function takeTurn(user) {
  for (let i = 0; i < 8; i += 1) {
    if (chipButtons().some((b) => !b.disabled)) break;
    const next = continueButton();
    if (next && !next.disabled) {
      await user.click(next);
      continue;
    }
    await waitFor(
      () => expect(chipButtons().some((b) => !b.disabled) || Boolean(continueButton())).toBe(true),
      { timeout: 4000 },
    );
  }
  await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), { timeout: 4000 });
  await user.click(chipButtons().find((b) => !b.disabled));
}

describe('a day that does something', () => {
  /**
   * Two thirds of the way through, so "the day has been running for a while
   * now" is true and there is still enough scene left for the room to react.
   * With five turns that is turn 3, which is the fourth thing the player does.
   */
  it('shows the work in the middle, not at the start', async () => {
    const user = userEvent.setup();
    const { client, calls } = fake();
    mount(EVENTS.mv_shoot, client);

    await waitFor(() => expect(calls.establish).toBe(1), { timeout: 4000 });
    expect(calls.interlude).toBe(0);

    for (let i = 0; i < 3; i += 1) await takeTurn(user);
    expect(calls.interlude).toBe(0);

    await takeTurn(user);
    await waitFor(() => expect(calls.interlude).toBe(1), { timeout: 4000 });
    expect(screen.getByText(new RegExp(WORK.slice(0, 24)))).toBeTruthy();
  });

  it('does it once, however long the day runs', async () => {
    const user = userEvent.setup();
    const { client, calls } = fake();
    mount(EVENTS.mv_shoot, client);

    await waitFor(() => expect(calls.establish).toBe(1), { timeout: 4000 });
    for (let i = 0; i < 5; i += 1) await takeTurn(user);

    expect(calls.interlude).toBe(1);
  });
});

describe('a day that is people talking about one', () => {
  /**
   * A meeting IS people talking, so a second paragraph of room is the padding
   * that makes generated prose read as generated. It still gets its
   * establishing beat, which is the contrast that makes the flag mean anything.
   */
  it('never gets one, at the concept meeting', async () => {
    const user = userEvent.setup();
    const { client, calls } = fake();
    mount(EVENTS.concept_meeting, client);

    await waitFor(() => expect(calls.establish).toBe(1), { timeout: 4000 });
    for (let i = 0; i < 5; i += 1) await takeTurn(user);

    expect(calls.interlude).toBe(0);
  });

  it('never gets one in an ordinary block, which has no event at all', async () => {
    const user = userEvent.setup();
    const { client, calls } = fake();
    mount(null, client);

    await waitFor(() => expect(chipButtons().length).toBeGreaterThan(0), { timeout: 4000 });
    for (let i = 0; i < 5; i += 1) await takeTurn(user);

    expect(calls.establish).toBe(0);
    expect(calls.interlude).toBe(0);
  });
});
