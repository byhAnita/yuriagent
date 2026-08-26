/** @vitest-environment jsdom */
/**
 * The scene, rendered. CLAUDE.md Part I.3.
 *
 * Every defect v1's stage had was reported from play rather than caught in a
 * unit test - the bar going dead, the modal that grew off the top of the screen,
 * the options that could not be clicked. None of those are visible to a pure
 * function, so the DOM test is where they belong.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoundStage from './RoundStage.jsx';
import { createMockClient } from '../../tools/mockClient.js';
import { newPool } from '../../agent/pool.js';
import { getCast } from '../../data/cast.js';
import { buildLineup } from '../../systems/castBuilder.js';
import { SENTINEL } from '../../config/rules.js';

afterEach(cleanup);

const cards = getCast();
const ids = cards.map((c) => c.id);
const t = (k) => k;

const setup = (scene = {}) => ({
  cards,
  lineup: buildLineup(cards),
  identity: { promptRole: 'an artist assistant' },
  player: { name: 'You', energy: 80, mood: 55, selfId: 40, secrecy: 70, credits: 10 },
  relations: Object.fromEntries(
    ids.map((id) => [id, { affection: 45, admissibility: 12 }]),
  ),
  dossier: {},
  lang: 'en',
  pool: newPool(),
  seed: 1,
  scene: {
    id: 's1',
    present: ['irene'],
    week: 0,
    day: 1,
    block: 'evening',
    phase: 'prep',
    locationId: 'practice_room',
    locationLabel: 'X Practice Room',
    ...scene,
  },
});

/** Anything the player can tap that is one of the four written options. */
const optionButtons = () =>
  screen
    .getAllByRole('button')
    .filter((b) => b.className.includes('py-2.5') && b.className.includes('text-left'));

const mount = (props = {}) =>
  render(
    <StrictMode>
      <RoundStage
        setup={setup()}
        client={createMockClient({ seed: 5, delay: 0, failureRate: 0 })}
        onSceneEnd={() => {}}
        t={t}
        {...props}
      />
    </StrictMode>,
  );

describe('the round stage', () => {
  it('opens on her, with nobody having spent a round walking in', async () => {
    mount();
    await waitFor(() => expect(optionButtons().length).toBe(4));
    // Her name is in two places on purpose: the plate over her line, and the
    // row that carries her two numbers.
    expect(screen.getAllByText('Irene').length).toBe(2);
  });

  /** Part I.2: the numbers are on screen. This is the pillar, rendered. */
  it('shows both axes for the woman in the room', async () => {
    mount();
    await waitFor(() => expect(optionButtons().length).toBe(4));
    expect(screen.getByText('relations.close')).toBeTruthy();
    expect(screen.getByText('relations.nameable')).toBeTruthy();
    expect(screen.getByText('45')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('never shows a machine line or the sentinel', async () => {
    mount();
    await waitFor(() => expect(optionButtons().length).toBe(4));
    expect(document.body.textContent).not.toContain(SENTINEL);
    expect(document.body.textContent).not.toMatch(/^\s*A\s*\|/m);
  });

  /**
   * Four controls, always. A round that parsed three costs one option, not the
   * round - and the geometry must not change, or the target under the player's
   * finger moves between rounds.
   */
  it('backfills to four when the model gave fewer', async () => {
    const short = async ({ onChunk }) => {
      const text = `She looks up.\n${SENTINEL}\nA|Say something\nemo|neutral`;
      onChunk?.(text);
      return text;
    };
    mount({ client: short });
    await waitFor(() => expect(optionButtons().length).toBe(4));
    expect(screen.getByText('Say something')).toBeTruthy();
    expect(screen.getByText('vn.fallback.d')).toBeTruthy();
  });

  it('takes a choice and asks for the next round', async () => {
    const user = userEvent.setup();
    const seen = [];
    const client = async ({ messages, onChunk }) => {
      seen.push(messages);
      const text = `Round ${seen.length}.\n${SENTINEL}\nA|first\nB|second\nC|third\nD|fourth\nemo|neutral`;
      onChunk?.(text);
      return text;
    };
    mount({ client });

    await waitFor(() => expect(optionButtons().length).toBe(4));
    await user.click(screen.getByText('second'));
    await waitFor(() => expect(seen.length).toBe(2));

    // The chosen option IS the player's line, and it goes into the history as one.
    expect(seen[1][1].content).toContain('> second');
    expect(seen[1][2].content).toContain('The player chose: second');
  });

  it('sends free text as the player line', async () => {
    const user = userEvent.setup();
    const seen = [];
    const client = async ({ messages, onChunk }) => {
      seen.push(messages);
      const text = `Round.\n${SENTINEL}\nA|a\nB|b\nC|c\nD|d\nemo|neutral`;
      onChunk?.(text);
      return text;
    };
    mount({ client });

    await waitFor(() => expect(optionButtons().length).toBe(4));
    await user.click(screen.getByText('vn.sayIt'));
    await user.type(screen.getByPlaceholderText('vn.freeTextPlaceholder'), 'What are you doing here');
    await user.click(screen.getByText('vn.send'));

    await waitFor(() => expect(seen.length).toBe(2));
    expect(seen[1][2].content).toContain('What are you doing here');
  });

  /**
   * Section 6, learned in play twice: a spent block that leaves six dead
   * controls on screen reads as a frozen game. The bar is REPLACED.
   */
  it('replaces the bar with the door when the block is spent', async () => {
    const user = userEvent.setup();
    const ended = [];
    mount({ onSceneEnd: (r) => ended.push(r) });

    await waitFor(() => expect(optionButtons().length).toBe(4));
    for (let i = 0; i < 8; i += 1) {
      const options = optionButtons();
      if (options.length === 0) break;
      await user.click(options[0]);
      await waitFor(() => expect(screen.queryByText('vn.thinking')).toBeNull());
    }

    expect(screen.getByText('vn.outOfTurns')).toBeTruthy();
    // The door is in two places once the block is spent - the header, and the
    // control that replaced the bar. This is the second one.
    await user.click(screen.getAllByText('vn.leave').at(-1));
    expect(ended).toHaveLength(1);
    expect(ended[0].pool.closed[0].summary).toBeTruthy();
  });

  it('leaves early from the header, and the scene still closes', async () => {
    const user = userEvent.setup();
    const ended = [];
    mount({ onSceneEnd: (r) => ended.push(r) });

    await waitFor(() => expect(optionButtons().length).toBe(4));
    await user.click(screen.getAllByText('vn.leave')[0]);
    expect(ended).toHaveLength(1);
    expect(ended[0].pool.current).toBe(null);
  });

  /** Part I.11: guessing wrong is a scene, not an error. */
  it('renders an empty room', async () => {
    mount({ setup: setup({ present: [] }) });
    await waitFor(() => expect(optionButtons().length).toBe(4));
    expect(screen.getByText('game.alone')).toBeTruthy();
    // Nobody to read, and nothing to hand over.
    expect(screen.queryByText('vn.readHer')).toBeNull();
  });

  it('reads her without spending a round', async () => {
    const user = userEvent.setup();
    const presets = [];
    const client = async ({ preset, onChunk }) => {
      presets.push(preset);
      if (preset === 'thought') return 'She is deciding not to say it.';
      const text = `Round.\n${SENTINEL}\nA|a\nB|b\nC|c\nD|d\nemo|neutral`;
      onChunk?.(text);
      return text;
    };
    mount({ client });

    await waitFor(() => expect(optionButtons().length).toBe(4));
    await user.click(screen.getByText('vn.readHer'));
    await waitFor(() => expect(screen.getByText('She is deciding not to say it.')).toBeTruthy());

    expect(presets).toEqual(['round', 'thought']);
    // Still four options, and still the same round.
    expect(optionButtons().length).toBe(4);
  });
});
