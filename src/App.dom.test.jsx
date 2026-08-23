/** @vitest-environment jsdom */
/**
 * The whole shell, from the cover to a saved run.
 *
 * Every serious bug this milestone produced was a JOIN - two correct halves
 * with nothing calling between them. `markRisk`, the event site the map hid,
 * the crowded row with no way into the room, `campaignOver` nobody read,
 * `commitSummary` dropping everything but `text`. Unit tests could not see any
 * of them, and this is the cheapest place that can.
 *
 * Deliberately shallow: it walks the shell rather than playing the game. The
 * campaign harness already plays 189 blocks through the real engine.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { hasSave, peek } from './store/save.js';
import { SAVE_KEY, SETTINGS_KEY } from './config/constants.js';
import { makeT } from './i18n/index.js';

const t = makeT('en');

/** localStorage exists in jsdom, but each test wants a clean one. */
beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

const beginButton = () => screen.getByRole('button', { name: t('start.begin') });

async function startARun(name = 'Yuhan') {
  render(<App />);
  await userEvent.type(screen.getByRole('textbox'), name);
  await userEvent.click(beginButton());
  await waitFor(() => expect(screen.getByText(t('map.calendar'))).toBeTruthy(), { timeout: 10000 });
}

describe('the cover', () => {
  it('is where the game opens, not the day screen', () => {
    render(<App />);

    expect(screen.getByText(t('start.nameLabel'))).toBeTruthy();
    expect(screen.queryByText(t('map.calendar'))).toBeNull();
  });

  it('will not start without a name', async () => {
    render(<App />);
    expect(beginButton().disabled).toBe(true);
  });

  it('offers no continue when there is nothing to continue', () => {
    render(<App />);
    expect(screen.queryByText(t('start.continue'))).toBeNull();
  });
});

describe('starting a run', () => {
  it('reaches the day screen with the name the player typed', async () => {
    await startARun('Yuhan');
    expect(screen.getByText(t('game.energy'))).toBeTruthy();
  });

  /**
   * The save is written at day rollover and on arrival, which is the only
   * moment section 15 allows: a scene is ephemeral, so a save taken mid-scene
   * would be a save taken at the room door.
   */
  it('writes a save the moment the run exists', async () => {
    await startARun('Yuhan');

    await waitFor(() => expect(hasSave()).toBe(true), { timeout: 10000 });
    expect(peek().name).toBe('Yuhan');
    expect(peek().week).toBe(0);
  });

  it('never lets the API key into it', async () => {
    localStorage.setItem('yuriagent_key_v1', 'sk-should-not-be-here');
    await startARun('Yuhan');

    await waitFor(() => expect(hasSave()).toBe(true), { timeout: 10000 });
    expect(localStorage.getItem(SAVE_KEY)).not.toContain('sk-should-not-be-here');
  });
});

/**
 * Reported after the first day of play: the gift panel opened at the door of
 * every scene, group scenes included.
 *
 * Walking into a room now goes straight to the scene, and the opener is a move
 * the player makes during it - which is also when a person would actually make
 * it. `ui/vn/Opener.dom.test.jsx` covers the inside of the scene; this asserts
 * only that nothing stands between the map and her.
 */
describe('walking into a room', () => {
  it('goes straight to her, with nothing in between', async () => {
    await startARun('Yuhan');

    const member = screen
      .getAllByRole('button')
      .find((b) => /Irene|Nana|Jisoo|Hyewon|Yeri/.test(b.textContent ?? ''));
    expect(member).toBeTruthy();
    await userEvent.click(member);

    // The scene, not a shop. `vn.turnsLeft` is on the chip bar and nowhere else.
    await waitFor(() => expect(screen.getByText(t('vn.turnsLeft'), { exact: false })).toBeTruthy(), {
      timeout: 10000,
    });
    expect(screen.queryByText(t('gift.title'))).toBeNull();
  }, 15000);

  it('offers the opener inside the scene instead', async () => {
    await startARun('Yuhan');

    const member = screen
      .getAllByRole('button')
      .find((b) => /Irene|Nana|Jisoo|Hyewon|Yeri/.test(b.textContent ?? ''));
    await userEvent.click(member);

    await waitFor(() => expect(screen.getByRole('button', { name: t('vn.give') })).toBeTruthy(), {
      timeout: 10000,
    });
  }, 15000);
});

describe('picking a run back up', () => {
  it('offers a continue once a save exists, and lands on the day screen', async () => {
    await startARun('Yuhan');
    await waitFor(() => expect(hasSave()).toBe(true), { timeout: 10000 });
    cleanup();

    render(<App />);
    expect(screen.getByText(t('start.continue'))).toBeTruthy();
    // It says whose run it is, so a stale save is not resumed by accident.
    expect(screen.getByText(/Yuhan/)).toBeTruthy();

    await userEvent.click(screen.getByText(t('start.continue')));
    await waitFor(() => expect(screen.getByText(t('map.calendar'))).toBeTruthy(), {
      timeout: 10000,
    });
  });

  /** With a run in progress, Begin is a destructive act and has to say so. */
  it('relabels begin as starting over', async () => {
    await startARun('Yuhan');
    await waitFor(() => expect(hasSave()).toBe(true), { timeout: 10000 });
    cleanup();

    render(<App />);
    expect(screen.getByRole('button', { name: t('start.beginOver') })).toBeTruthy();
  });
});

describe('settings are device-level, not run-level', () => {
  /**
   * Section 15 keeps them out of the save on purpose: a player who switches to
   * Chinese should stay in Chinese across a restart, and a save carried to
   * another device should not drag somebody else's font scale with it.
   */
  it('stays out of the save file', async () => {
    await startARun('Yuhan');
    await waitFor(() => expect(hasSave()).toBe(true), { timeout: 10000 });

    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    expect(saved.settings).toBeUndefined();
    expect(saved.meta.lang).toBeTruthy();
    // ...and settings have their own key, which the save never touches.
    expect(localStorage.getItem(SETTINGS_KEY)).toBeTruthy();
  });
});
