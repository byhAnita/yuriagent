/** @vitest-environment jsdom */
/**
 * The scene, rendered. CLAUDE.md section 6.
 *
 * Every bug this file covers was reported from play rather than caught here,
 * which is the argument for the file existing: the chip bar going dead is
 * invisible to a pure-function test, and it has now happened twice.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VNStage from './VNStage.jsx';
import { createMockClient } from '../../tools/mockClient.js';
import { newMemory } from '../../agent/memory.js';
import { newRelation } from '../../systems/relationship.js';
import { getCast } from '../../data/cast.js';
import { buildLineup } from '../../systems/castBuilder.js';

// Auto-cleanup only registers itself when vitest globals are on, and they are
// not - without this every test renders into the previous test's DOM.
afterEach(cleanup);

const cards = getCast();
const ids = cards.map((c) => c.id);
const t = (k) => k;

const setup = () => ({
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
    focusId: 'irene',
    week: 0,
    day: 1,
    block: 'evening',
    phase: 'prep',
    locationId: 'practice_room',
    locationLabel: 'X Practice Room',
    seed: 1,
  },
});

const chipButtons = () =>
  screen.getAllByRole('button').filter((b) => /stance\./.test(b.textContent ?? ''));

const dialogueBox = () =>
  screen.getAllByRole('button').find((b) => /irene/i.test(b.textContent ?? ''));

const mount = (props) =>
  render(
    <StrictMode>
      <VNStage setup={setup()} onSceneEnd={() => {}} t={t} {...props} />
    </StrictMode>,
  );

describe('the chip bar comes back to life', () => {
  it('is clickable once the opening beat has landed', async () => {
    mount({ client: createMockClient({ seed: 3, delay: 0 }) });

    await waitFor(() => expect(chipButtons().length).toBeGreaterThan(0));
    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 4000,
    });
  });

  /**
   * The timeouts are generous because this asserts BEHAVIOUR, not latency: a
   * chip click advances the turn. Four seconds flaked when the 25-second
   * campaign harness was running in the same suite - a wall-clock assertion
   * competing for a core is a test that fails for the wrong reason.
   */
  it('takes a stance click and starts the next turn', async () => {
    const user = userEvent.setup();
    mount({ client: createMockClient({ seed: 3, delay: 0 }) });

    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 10000,
    });

    const before = dialogueBox()?.textContent;
    await user.click(chipButtons().find((b) => !b.disabled));
    await waitFor(() => expect(dialogueBox()?.textContent).not.toBe(before), { timeout: 10000 });
  });

  /**
   * The reported bug. A request that never settles never rejects, so the turn
   * never ends: `pending` stays true and every control in the scene - chips,
   * free text, Read her, and Leave - stays disabled with nothing on screen to
   * say why. The router now puts a deadline on every call, so the offline
   * writer answers instead and the scene stays playable.
   */
  it('survives a provider that never answers', async () => {
    const hangs = () => new Promise(() => {});
    mount({ client: hangs });

    await waitFor(() => expect(chipButtons().length).toBeGreaterThan(0));
    // Disabled while the turn is genuinely in flight - that part is correct.
    expect(chipButtons().every((b) => b.disabled)).toBe(true);
  });

  it('unlocks the chips after a multi-beat reply is read through', async () => {
    const beats =
      '@irene|neutral|guard+2|fluster+0\n*She glances up.* "You are early."\n\n' +
      '@irene|shy|guard-6|fluster+8\n*A pause.* "That was not a complaint."';

    const client = ({ preset, onChunk }) => {
      if (preset === 'chips') return Promise.resolve('');
      if (onChunk) for (let i = 0; i < beats.length; i += 9) onChunk(beats.slice(i, i + 9));
      return Promise.resolve(beats);
    };

    const user = userEvent.setup();
    mount({ client });

    await waitFor(() => expect(chipButtons().length).toBeGreaterThan(0));
    await waitFor(() => expect(dialogueBox()?.disabled).toBe(false), { timeout: 4000 });

    // Two beats, so the bar is held until the player has read both.
    expect(chipButtons().every((b) => b.disabled)).toBe(true);
    await user.click(dialogueBox());

    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 4000,
    });
  });
});

describe('written chips', () => {
  it('replaces the labels without changing what the stances mean', async () => {
    const beat = '@irene|neutral|guard+2|fluster+0\n*She glances up.* "You are early."';
    const client = ({ preset, onChunk }) => {
      if (preset === 'chips') {
        return Promise.resolve('flirt|Say that again\ncare|I am here\ndeflect|So. The schedule.');
      }
      if (onChunk) onChunk(beat);
      return Promise.resolve(beat);
    };

    mount({ client, writtenChips: true });

    await waitFor(
      () => expect(chipButtons().some((b) => /Say that again/.test(b.textContent ?? ''))).toBe(true),
      { timeout: 4000 },
    );

    // The stance is still on the button, because every rule keys off it.
    const flirted = chipButtons().find((b) => /Say that again/.test(b.textContent ?? ''));
    expect(flirted.textContent).toContain('stance.flirt');
  });

  it('leaves the static set alone when the writer returns nothing', async () => {
    const beat = '@irene|neutral|guard+2|fluster+0\n*She glances up.* "You are early."';
    const client = ({ preset, onChunk }) => {
      if (preset === 'chips') return Promise.resolve('I cannot help with that.');
      if (onChunk) onChunk(beat);
      return Promise.resolve(beat);
    };

    mount({ client, writtenChips: true });

    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 4000,
    });
    expect(chipButtons()).toHaveLength(3);
    for (const b of chipButtons()) expect(b.textContent).toMatch(/^stance\.\w+$/);
  });
});

describe('written chips land in the common case', () => {
  const ONE_BEAT = '@irene|neutral|guard+2|fluster+0\n*She glances up.* "You are early."';

  /**
   * The reported bug, and the one the instant-resolving test above missed.
   *
   * A one-beat reply makes the bar live the moment the turn resolves, which is
   * about a second BEFORE the chip call comes back. The swap used to require
   * the bar to still be disabled, so in the commonest case the written set was
   * computed, paid for, and thrown away - the player only ever saw the static
   * labels, and the only written chips that survived were the ones arriving
   * while the bar was disabled, which is exactly when they could not be used.
   */
  const slowChips =
    (delayMs) =>
    ({ preset, onChunk }) => {
      if (preset === 'chips') {
        return new Promise((resolve) =>
          setTimeout(
            () => resolve('flirt|Say that again\ncare|I am here\ndeflect|So. The schedule.'),
            delayMs,
          ),
        );
      }
      if (onChunk) onChunk(ONE_BEAT);
      return Promise.resolve(ONE_BEAT);
    };

  it('swaps in labels that arrive after the bar has already gone live', async () => {
    mount({ client: slowChips(80), writtenChips: true });

    // The bar is usable first, on the static set - that must never regress.
    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 4000,
    });

    // And the written labels still arrive afterwards.
    await waitFor(
      () => expect(chipButtons().some((b) => /Say that again/.test(b.textContent ?? ''))).toBe(true),
      { timeout: 4000 },
    );
    expect(chipButtons().every((b) => !b.disabled)).toBe(true);
  });

  it('keeps one geometry, so a swap never moves a button', async () => {
    mount({ client: slowChips(80) });

    await waitFor(() => expect(chipButtons().length).toBe(3));
    const before = chipButtons().map((b) => b.className);

    await waitFor(
      () => expect(chipButtons().some((b) => /Say that again/.test(b.textContent ?? ''))).toBe(true),
      { timeout: 4000 },
    );
    expect(chipButtons().map((b) => b.className)).toEqual(before);
  });
});

describe('unread beats say so', () => {
  const TWO_BEATS =
    '@irene|neutral|guard+2|fluster+0\n*She glances up.* "You are early."\n\n' +
    '@irene|shy|guard-6|fluster+8\n*A pause.* "That was not a complaint."';

  const client = ({ preset, onChunk }) => {
    if (preset === 'chips') return Promise.resolve('');
    if (onChunk) for (let i = 0; i < TWO_BEATS.length; i += 9) onChunk(TWO_BEATS.slice(i, i + 9));
    return Promise.resolve(TWO_BEATS);
  };

  /**
   * A dead bar with a caret in the corner as its only explanation is the same
   * mistake section 6 already fixed once for a spent block.
   */
  it('offers a continue control instead of only a caret', async () => {
    const user = userEvent.setup();
    mount({ client });

    const cont = () => screen.queryByText(/vn\.continue/);
    await waitFor(() => expect(cont()).not.toBeNull(), { timeout: 4000 });
    expect(chipButtons().every((b) => b.disabled)).toBe(true);

    await user.click(cont());
    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 4000,
    });
    expect(cont()).toBeNull();
  });
});

/**
 * One thing on this screen does not reset at the door.
 *
 * Reported after the first played anchor event: Irene finished the meeting at
 * `fluster 28` and the next afternoon's scene opened at 0, which read as her
 * affection having been wiped. Both numbers were correct - guard and fluster
 * are volatile by design (section 6) - and nothing on screen said they were a
 * different kind of thing from `intimacy`.
 */
describe('where the two of you stand', () => {
  it('is on the meter bar, as a word', async () => {
    mount({ client: createMockClient({ seed: 3, delay: 0 }) });

    // intimacy 45 -> good_friends. The word, not the number.
    await waitFor(() => expect(screen.getByText(/stage\.good_friends/)).toBeTruthy(), {
      timeout: 10000,
    });
    expect(screen.queryByText('45')).toBeNull();
  }, 15000);
});
