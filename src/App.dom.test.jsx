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
 * From the map to her.
 *
 * THE MAP SAYS WHERE EVERYONE IS AGAIN. Part I.11 hid occupancy to make the map
 * a search, and one phone session said what a hidden map actually produces:
 * tapping into rooms one at a time to see who is in them, which is not a bet,
 * it is a lottery with the same block spent either way.
 *
 * What did NOT come back is the per-member button on the row. Those are separate
 * features and only the information was wanted: v1's crowded row offered only
 * faces, so the task, the snoop and the solo work were all locked out by
 * company. Every row still opens the ROOM, and choosing one member in front of
 * the others still happens inside it.
 *
 * The opener still lives inside the scene, which is v1's own lesson and
 * unchanged: it used to open at the door of every scene, before the player had
 * any reason to want to give her anything.
 */
describe('walking into a room', () => {
  /**
   * Every row on the map is a room, and the rooms are the only rows.
   *
   * The name can be on screen twice - the task banner says where today's job
   * is - so this takes the one that is a row.
   */
  const roomRow = (locId) =>
    screen.queryAllByText(t(`location.${locId}`)).find((el) => el.closest('li'));

  /** Walk through doors until one has somebody behind it. */
  async function findSomebody() {
    for (const locId of ['practice_room', 'wardrobe', 'drink_room', 'bistro', 'corridor']) {
      const row = roomRow(locId);
      if (!row) continue;
      await userEvent.click(row);
      const talk = screen
        .getAllByRole('button')
        .find((b) => /Irene|Nana|Jisoo|Hyewon|Yeri/.test(b.textContent ?? ''));
      if (talk) return talk;
      // Nobody home. Backing out costs nothing - the block is not spent yet.
      await userEvent.click(screen.getByText(new RegExp(t('map.back'))));
    }
    return null;
  }

  /**
   * Somebody is visible on the map before a single door is opened.
   *
   * Asserted by NAME rather than by counting faces, because the face is an emoji
   * on a coloured disc and `title` is the only text it carries - which is also
   * what makes it reachable here and to a screen reader.
   */
  it('says who is in a room before the player walks in', async () => {
    await startARun('Yuhan');
    expect(screen.getByText(t('map.calendar'))).toBeTruthy();

    const onMap = ['Irene', 'Nana', 'Jisoo', 'Hyewon', 'Yeri'].filter((name) =>
      document.querySelector(`li [title="${name}"]`),
    );
    expect(onMap.length, 'the whole cast vanished from the map').toBeGreaterThan(0);
  }, 15000);

  /**
   * ...and a row is still a ROOM, never a shortcut to one of the people in it.
   *
   * This is the half of Part I.11 that stands. v1's crowded row offered only
   * per-member buttons, so the daily task, the snoop and the solo work were
   * silently unreachable whenever two members happened to be standing there -
   * worst on an event day, where all five are.
   */
  it('never turns a face on the map into a way to skip the room', async () => {
    await startARun('Yuhan');

    for (const face of document.querySelectorAll('li [title]')) {
      const row = face.closest('button');
      expect(row, 'a face on the map that is not part of a room row').toBeTruthy();
      // The room's own name is in the same control, so the tap opens the room.
      expect(row.textContent).not.toBe('');
    }
  }, 15000);

  it('goes from the room to her, with nothing in between', async () => {
    await startARun('Yuhan');

    const talk = await findSomebody();
    expect(talk).toBeTruthy();
    await userEvent.click(talk);

    // The scene, not a shop. `vn.turnsLeft` is on the option bar and nowhere else.
    await waitFor(() => expect(screen.getByText(t('vn.turnsLeft'), { exact: false })).toBeTruthy(), {
      timeout: 10000,
    });
    expect(screen.queryByText(t('gift.title'))).toBeNull();
  }, 20000);

  /**
   * The seam: App builds the `openers` object and `RoundStage` calls into it.
   *
   * This proves the halves are connected - that `credits` and `stock` reach the
   * catalogue rather than throwing or rendering an empty list. Exactly the join
   * this project keeps shipping broken: two correct halves and nothing calling
   * between them.
   *
   * It does not complete a purchase, because the assistant starts on zero
   * credits by design, so nothing is affordable on day one. That is the game
   * working, not the test being weak.
   */
  it('wires the real catalogue into the sheet', async () => {
    await startARun('Yuhan');

    const talk = await findSomebody();
    await userEvent.click(talk);

    await waitFor(
      () => expect(screen.getByRole('button', { name: t('vn.give') }).disabled).toBe(false),
      { timeout: 10000 },
    );
    await userEvent.click(screen.getByRole('button', { name: t('vn.give') }));

    expect(screen.getByText(t('gift.title'))).toBeTruthy();
    // Real shipped gifts, from data/gifts.js through App's openers.
    expect(screen.getByText(t('gift.rose'))).toBeTruthy();

    /**
     * THE SHELF IS OPEN ON DAY ONE (Part I.10). A specific object used to be
     * hidden behind a fact the player had not found, and the sheet showed a
     * hint about it instead. Now it is simply there and unaffordable, which is
     * a price rather than a lock - and knowing WHICH member a mugwort pack is
     * for is the player's job, not a `requires` array's.
     */
    expect(screen.getByText(t('gift.mugwort_pack'))).toBeTruthy();
  }, 20000);
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

/**
 * One whole block, map to map. CLAUDE.md Part I.3.
 *
 * The reason this exists: the aftermath screen was still reporting v1's three
 * computed numbers - affection, admissibility, strain - none of which the v2
 * result carries, so it would have crashed the moment a scene ended. The whole
 * suite was green, because nothing walked past the last option of a scene.
 *
 * That is the join shape this project keeps shipping: two correct halves and
 * nothing calling between them. A test that plays a block is the cheapest thing
 * that can see one.
 */
describe('playing a block through', () => {
  const optionButtons = () => [...document.querySelectorAll('[data-round-option]')];

  it('goes map -> room -> scene -> aftermath -> map', async () => {
    await startARun('Yuhan');

    // Into a room, and out again if nobody is home. Walking in costs nothing.
    let talk = null;
    for (const locId of ['practice_room', 'wardrobe', 'drink_room', 'bistro']) {
      const row = screen.queryAllByText(t(`location.${locId}`)).find((el) => el.closest('li'));
      if (!row) continue;
      await userEvent.click(row);
      talk = screen
        .getAllByRole('button')
        .find((b) => /Irene|Nana|Jisoo|Hyewon|Yeri/.test(b.textContent ?? ''));
      if (talk) break;
      await userEvent.click(screen.getByText(new RegExp(t('map.back'))));
    }
    expect(talk).toBeTruthy();
    await userEvent.click(talk);

    // Play the block out. The bar is REPLACED by the door when it is spent.
    await waitFor(() => expect(optionButtons().length).toBe(4), { timeout: 10000 });
    for (let i = 0; i < 10; i += 1) {
      if (screen.queryByText(t('vn.outOfTurns'))) break;
      const options = optionButtons();
      if (options.length === 0) break;
      await userEvent.click(options[0]);
      /**
       * Wait on the BAR, not on the placeholder. The placeholder only shows
       * while there is no prose at all, so it is gone a moment after the stream
       * opens - and every click landing in that window is swallowed by the
       * engine's own re-entry guard, which is invisible from out here.
       */
      await waitFor(
        () =>
          expect(
            screen.queryByText(t('vn.outOfTurns')) || optionButtons().some((b) => !b.disabled),
          ).toBeTruthy(),
        { timeout: 10000 },
      );
    }
    expect(screen.getByText(t('vn.outOfTurns'))).toBeTruthy();
    await userEvent.click(screen.getAllByText(t('vn.leave')).at(-1));

    // The aftermath, which is a diff and not a payout - nothing computes what a
    // scene was worth any more.
    await waitFor(() => expect(screen.getByText(t('vn.sceneOver'))).toBeTruthy(), {
      timeout: 10000,
    });

    // And back to the day, one block later.
    await userEvent.click(screen.getByText(t('game.nextBlock')));
    await waitFor(() => expect(screen.getByText(t('map.calendar'))).toBeTruthy(), {
      timeout: 10000,
    });
    expect(screen.getByText(t('block.afternoon'), { exact: false })).toBeTruthy();
  }, 30000);
});
