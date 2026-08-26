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
const optionButtons = () => [...document.querySelectorAll('[data-round-option]')];

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

  /**
   * The scene is one screen, and this is the rule that makes it one.
   *
   * `.stage-fill` is a FIXED height, and a flex item defaults to `min-height:
   * auto` - so a child sized by its own content cannot give, and the column
   * overflows the page instead. That is exactly what shipped: a scene about 1.5
   * viewports tall, needing a scroll on every round before it could be answered.
   *
   * So every direct child declares which it is. `shrink-0` means "fixed, and
   * deliberately so" - the header, the value strip, the options the player acts
   * with. A `min-h-` class means "yields, down to this floor" - the portrait and
   * the prose. There is no third option, and a child with neither is the defect
   * coming back.
   *
   * jsdom does no layout, so this cannot measure a height. It can hold the rule
   * the height came from, which is the half that got broken.
   */
  it('gives every row in the column a stated way to yield', async () => {
    mount();
    await waitFor(() => expect(optionButtons().length).toBe(4));

    const column = document.querySelector('.stage-fill');
    const rows = [...column.children];
    expect(rows.length).toBeGreaterThan(3);

    for (const row of rows) {
      const cls = row.className;
      expect(
        cls.includes('shrink-0') || /(^|\s)min-h-/.test(cls),
        `a direct child of .stage-fill must be shrink-0 or carry a min-h floor: "${cls}"`,
      ).toBe(true);
    }
  });

  /** Part I.2: the numbers are on screen. This is the pillar, rendered. */
  it('shows both axes for the woman in the room', async () => {
    mount();
    await waitFor(() => expect(optionButtons().length).toBe(4));
    expect(screen.getByText('relations.closeShort')).toBeTruthy();
    expect(screen.getByText('relations.nameableShort')).toBeTruthy();
    expect(screen.getByText('45')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  /**
   * ...for HER, and not for the other four.
   *
   * Reported from play: the scene ran about 1.5 viewports tall, so every round
   * had to be scrolled past before it could be answered. A five-member room drew
   * ten bars over eleven rows of chrome above a paragraph of Chinese prose, and
   * none of it was what the player was reading while she was talking.
   *
   * Collapsed is not deleted, which is the half worth asserting: Part I.2 is a
   * rule about the numbers being AVAILABLE, so the strip has to open.
   */
  describe('the value strip', () => {
    const crowded = () => setup({ present: ['irene', 'nana', 'jisoo'] });

    it('carries only the woman whose portrait is up', async () => {
      mount({ setup: crowded() });
      await waitFor(() => expect(optionButtons().length).toBe(4));

      expect(screen.getAllByText('relations.closeShort').length).toBe(1);
      // She is in the room and on the portrait strip; she has no value row.
      expect(screen.queryByText('game.mood')).toBeNull();
    });

    it('opens to the rest of the room and the player, on one tap', async () => {
      const user = userEvent.setup();
      mount({ setup: crowded() });
      await waitFor(() => expect(optionButtons().length).toBe(4));

      await user.click(screen.getByLabelText('relations.open'));

      expect(screen.getAllByText('relations.closeShort').length).toBe(3);
      expect(screen.getByText('game.mood')).toBeTruthy();
      expect(screen.getByText('game.selfId')).toBeTruthy();
    });

    /** An empty room still has the player in it, and her own values still move. */
    it('falls back to the player when nobody is there', async () => {
      mount({ setup: setup({ present: [] }) });
      await waitFor(() => expect(screen.getByText('game.alone')).toBeTruthy());
      expect(screen.getByText('game.mood')).toBeTruthy();
      expect(screen.queryByText('relations.closeShort')).toBeNull();
    });
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

  /**
   * ...but it does spend ENERGY, and until now it spent nothing at all.
   *
   * `ENERGY_PER_READ` has been in `config/constants.js` since M1 with the
   * comment "Read her costs one on top", section 10 has called Read her "the
   * energy sink, not the block" for just as long, and nothing ever read the
   * constant: the screen counted down a per-scene allowance of two instead.
   * That allowance reset at every door, so nothing about the choice survived the
   * block and the day was flatly energy-positive however it was played.
   */
  describe('read her is priced in energy', () => {
    const thoughtClient = (thought = 'She is deciding not to say it.') => {
      return async ({ preset, onChunk }) => {
        if (preset === 'thought') return thought;
        const text = `Round.\n${SENTINEL}\nA|a\nB|b\nC|c\nD|d\nemo|neutral`;
        onChunk?.(text);
        return text;
      };
    };

    /** The scene hands the spend back to App, so it must land on the way out. */
    const closeAndRead = async (props) => {
      const ended = [];
      mount({ ...props, onSceneEnd: (r) => ended.push(r) });
      await waitFor(() => expect(optionButtons().length).toBe(4));
      return ended;
    };

    it('shows the price rather than a remaining count', async () => {
      mount({ client: thoughtClient() });
      await waitFor(() => expect(optionButtons().length).toBe(4));
      expect(screen.getByText('-1')).toBeTruthy();
    });

    it('charges it, and carries the charge out of the scene', async () => {
      const user = userEvent.setup();
      const ended = await closeAndRead({ client: thoughtClient() });

      await user.click(screen.getByText('vn.readHer'));
      await waitFor(() => expect(screen.getByText('She is deciding not to say it.')).toBeTruthy());
      await user.click(screen.getAllByText('vn.leave')[0]);

      // The mount fixture starts her at 80.
      expect(ended).toHaveLength(1);
      expect(ended[0].player.energy).toBe(79);
    });

    /**
     * Charged on the ANSWER, not on the ask. A provider that is down is not a
     * look inside her head, and must not also drain the day - the same rule the
     * date bill follows: she turned you down, you did not buy her dinner.
     */
    it('charges nothing when the call comes back empty', async () => {
      const user = userEvent.setup();
      const ended = await closeAndRead({ client: thoughtClient('') });

      await user.click(screen.getByText('vn.readHer'));
      await user.click(screen.getAllByText('vn.leave')[0]);

      expect(ended[0].player.energy).toBe(80);
    });

    /** It refuses rather than going negative, so it can never strand the day. */
    it('goes dead once she cannot be afforded', async () => {
      mount({
        client: thoughtClient(),
        setup: {
          ...setup(),
          player: { name: 'You', energy: 0, mood: 55, selfId: 40, secrecy: 70, credits: 10 },
        },
      });
      await waitFor(() => expect(optionButtons().length).toBe(4));

      expect(screen.getByText('vn.readHer').closest('button').disabled).toBe(true);
    });
  });
});
