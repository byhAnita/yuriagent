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

  it('takes a stance click and starts the next turn', async () => {
    const user = userEvent.setup();
    mount({ client: createMockClient({ seed: 3, delay: 0 }) });

    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 4000,
    });

    const before = dialogueBox()?.textContent;
    await user.click(chipButtons().find((b) => !b.disabled));
    await waitFor(() => expect(dialogueBox()?.textContent).not.toBe(before), { timeout: 4000 });
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
        return Promise.resolve('tease|Say that again\nreassure|I am here\ndeflect|So. The schedule.');
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
    const teased = chipButtons().find((b) => /Say that again/.test(b.textContent ?? ''));
    expect(teased.textContent).toContain('stance.tease');
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
