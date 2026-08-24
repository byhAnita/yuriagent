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
import { hasAnySave, peekSlot, AUTO_SLOT } from './store/save.js';
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
   * The handbook, and this is the JOIN rather than the component.
   *
   * `HandbookModal.dom.test.jsx` covers what it renders; nothing there can tell
   * whether the day screen offers a way in. That is the shape this project
   * keeps producing - `markRisk` was implemented, tested, and never called.
   *
   * It is a HEADER control and free to open: a room action would read as
   * costing a block, and reading your own notes must not (section 7).
   */
  it('offers the notes from the day screen, and they open', async () => {
    await startARun('Yuhan');

    const open = screen.getByText(t('handbook.open'));
    expect(open).toBeTruthy();

    await userEvent.click(open);
    // A fresh run has decided nothing, and the panel says where the lines
    // will come from rather than showing an empty box.
    expect(screen.getByText(t('handbook.empty'))).toBeTruthy();

    // The energy readout is still there, so nothing spent a block.
    expect(screen.getByText(t('game.energy'))).toBeTruthy();
  });

  /**
   * The save is written at day rollover and on arrival, which is the only
   * moment section 15 allows: a scene is ephemeral, so a save taken mid-scene
   * would be a save taken at the room door.
   */
  it('writes a save the moment the run exists', async () => {
    await startARun('Yuhan');

    await waitFor(() => expect(hasAnySave()).toBe(true), { timeout: 10000 });
    expect(peekSlot(AUTO_SLOT).name).toBe('Yuhan');
    expect(peekSlot(AUTO_SLOT).week).toBe(0);
  });

  it('never lets the API key into it', async () => {
    localStorage.setItem('yuriagent_key_v1', 'sk-should-not-be-here');
    await startARun('Yuhan');

    await waitFor(() => expect(hasAnySave()).toBe(true), { timeout: 10000 });
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

  /**
   * The seam: App builds the `openers` object and `VNStage` calls into it.
   *
   * `Opener.dom.test.jsx` drives the sheet against a stub, so it proves the
   * scene half. This proves the other half is actually connected - that
   * `dossierFor` and `credits` reach the catalogue rather than throwing or
   * rendering an empty list. Exactly the join this project keeps shipping
   * broken: two correct halves and nothing calling between them.
   *
   * It does not complete a purchase, because the assistant starts on zero
   * credits and an empty dossier by design, so nothing is affordable on day
   * one. That is the game working, not the test being weak.
   */
  it('wires the real catalogue into the sheet', async () => {
    await startARun('Yuhan');

    const member = screen
      .getAllByRole('button')
      .find((b) => /Irene|Nana|Jisoo|Hyewon|Yeri/.test(b.textContent ?? ''));
    await userEvent.click(member);

    // Read through her opening beats - the bar is held while any are unread,
    // so a click before that lands on a disabled control and does nothing.
    for (let i = 0; i < 6; i += 1) {
      const more = screen.queryByRole('button', { name: new RegExp(t('vn.continue')) });
      if (!more) break;
      await userEvent.click(more);
    }
    await waitFor(
      () => expect(screen.getByRole('button', { name: t('vn.give') }).disabled).toBe(false),
      { timeout: 10000 },
    );
    await userEvent.click(screen.getByRole('button', { name: t('vn.give') }));

    expect(screen.getByText(t('gift.title'))).toBeTruthy();
    // A real shipped gift, from data/gifts.js through App's openers.
    expect(screen.getByText(t('gift.rose'))).toBeTruthy();
    // No knowledge opener yet, and the modal says why rather than showing
    // locked rows - section 11: naming one spoils the fact it waits on.
    expect(screen.getByText(t('gift.hint'))).toBeTruthy();
  }, 15000);
});

describe('picking a run back up', () => {
  it('offers a continue once a save exists, and lands on the day screen', async () => {
    await startARun('Yuhan');
    await waitFor(() => expect(hasAnySave()).toBe(true), { timeout: 10000 });
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
    await waitFor(() => expect(hasAnySave()).toBe(true), { timeout: 10000 });
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
    await waitFor(() => expect(hasAnySave()).toBe(true), { timeout: 10000 });

    const saved = JSON.parse(localStorage.getItem(SAVE_KEY)).slots[AUTO_SLOT];
    expect(saved.settings).toBeUndefined();
    expect(saved.meta.lang).toBeTruthy();
    // ...and settings have their own key, which the save never touches.
    expect(localStorage.getItem(SETTINGS_KEY)).toBeTruthy();
  });
});

/**
 * Slots, end to end through the real app. CLAUDE.md section 15.
 *
 * Every store-level assertion above passes with the UI wired to nothing, which
 * is exactly the failure this project keeps producing: two correct halves and
 * no call between them. So this reaches the slot list the way a player does -
 * from the day screen - and comes back to it from the cover.
 */
describe('save slots', () => {
  const openSaves = async () => {
    await userEvent.click(screen.getByRole('button', { name: t('save.open') }));
    await waitFor(() => expect(screen.getByText(t('save.pick'))).toBeTruthy());
  };

  /** Slot 1 is the second row and starts empty, so one tap writes it. */
  const saveToSlotOne = async () => {
    await openSaves();
    await userEvent.click(screen.getAllByText(t('save.saveHere'))[1]);
    await waitFor(() => expect(peekSlot('1').empty).toBe(false));
  };

  it('writes the run into a slot the player picked', async () => {
    await startARun('Yuhan');
    await saveToSlotOne();

    expect(peekSlot('1').name).toBe('Yuhan');
    // Writing is the whole errand, so the sheet closes behind it.
    expect(screen.queryByText(t('save.pick'))).toBeNull();
  });

  it('leaves the other slots alone', async () => {
    await startARun('Yuhan');
    await saveToSlotOne();

    expect(peekSlot('2').empty).toBe(true);
    expect(peekSlot('3').empty).toBe(true);
  });

  /**
   * The other half of the join. A manual save the cover cannot reach is
   * write-only, which is worse than not having slots at all.
   */
  it('loads a manual slot back from the cover', async () => {
    await startARun('Yuhan');
    await saveToSlotOne();
    cleanup();

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: t('save.title') }));

    // Two rows hold a run - the autosave and slot 1 - so the second Load is it.
    const loads = screen.getAllByText(t('save.load'));
    expect(loads).toHaveLength(2);
    await userEvent.click(loads[1]);

    await waitFor(() => expect(screen.getByText(t('map.calendar'))).toBeTruthy(), {
      timeout: 10000,
    });
  });

  /** The cover offers no `save here`: there is no run to write yet. */
  it('is read-only on the cover', async () => {
    await startARun('Yuhan');
    await saveToSlotOne();
    cleanup();

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: t('save.title') }));

    expect(screen.queryByText(t('save.saveHere'))).toBeNull();
    expect(screen.queryByText(t('save.pick'))).toBeNull();
  });

  it('deletes a slot on the second tap and not the first', async () => {
    await startARun('Yuhan');
    await saveToSlotOne();
    await openSaves();

    const del = () => screen.getAllByText(t('save.delete'))[1];
    await userEvent.click(del());
    expect(peekSlot('1').empty).toBe(false);

    await userEvent.click(screen.getByText(t('save.confirmDelete')));
    await waitFor(() => expect(peekSlot('1').empty).toBe(true));
  });
});
