/**
 * The slot list on screen. CLAUDE.md section 15.
 *
 * The assertions that matter are the destructive ones. Overwrite and delete are
 * the only two actions in the game that can lose a campaign, and they are two
 * taps on a 390px screen - so "one tap does nothing" is the property under
 * test, not an implementation detail.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach } from 'vitest';
import SaveModal from './SaveModal.jsx';
import { makeT } from '../../i18n/index.js';

afterEach(cleanup);

const t = makeT('en');

const cards = [
  { id: 'irene', name: 'Irene' },
  { id: 'nana', name: 'Nana' },
];

const slots = [
  { id: 'auto', auto: true, empty: false, savedAt: Date.now(), week: 2, day: 3, name: 'Yuhan', focusId: 'irene', focusAffection: 55 },
  { id: '1', auto: false, empty: false, savedAt: Date.now(), week: 0, day: 1, name: 'Yuhan', focusId: 'nana', focusAffection: 20 },
  { id: '2', auto: false, empty: true },
];

function show(props = {}) {
  const handlers = {
    onSave: vi.fn(() => true),
    onLoad: vi.fn(),
    onDelete: vi.fn(() => true),
    onClose: vi.fn(),
  };
  render(<SaveModal slots={slots} cards={cards} t={t} {...handlers} {...props} />);
  return handlers;
}

describe('reading a slot before loading it', () => {
  it('names the run, the day and whoever is closest', () => {
    show();

    expect(screen.getByText(/Yuhan, week 3, day 4/)).toBeTruthy();
    expect(screen.getByText(/closest to Irene/)).toBeTruthy();
    expect(screen.getByText(/closest to Nana/)).toBeTruthy();
  });

  it('marks the auto slot and says what it does', () => {
    show();
    expect(screen.getByText(t('save.auto'))).toBeTruthy();
    expect(screen.getByText(t('save.slot').replace('{n}', '1'))).toBeTruthy();
  });

  it('shows an empty slot as empty, with nothing to load or delete', () => {
    show();
    expect(screen.getByText(t('save.empty'))).toBeTruthy();
    // Two occupied slots, so exactly two of each.
    expect(screen.getAllByText(t('save.load'))).toHaveLength(2);
    expect(screen.getAllByText(t('save.delete'))).toHaveLength(2);
  });
});

describe('loading', () => {
  it('loads on a single tap, because loading destroys nothing', () => {
    const h = show();
    fireEvent.click(screen.getAllByText(t('save.load'))[0]);
    expect(h.onLoad).toHaveBeenCalledWith('auto');
  });
});

describe('the destructive pair', () => {
  it('does not delete on the first tap', () => {
    const h = show();
    fireEvent.click(screen.getAllByText(t('save.delete'))[0]);

    expect(h.onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(t('save.confirmDelete'))).toBeTruthy();
  });

  it('deletes on the second', () => {
    const h = show();
    fireEvent.click(screen.getAllByText(t('save.delete'))[0]);
    fireEvent.click(screen.getByText(t('save.confirmDelete')));

    expect(h.onDelete).toHaveBeenCalledWith('auto');
  });

  /**
   * Arming one row must disarm the last, or a player who changes their mind
   * leaves a live delete behind on a row they are no longer looking at.
   */
  it('only ever arms one row', () => {
    show();
    fireEvent.click(screen.getAllByText(t('save.delete'))[0]);
    fireEvent.click(screen.getAllByText(t('save.delete'))[0]);

    expect(screen.queryAllByText(t('save.confirmDelete'))).toHaveLength(1);
  });

  it('does not overwrite an occupied slot on the first tap', () => {
    const h = show();
    fireEvent.click(screen.getAllByText(t('save.saveHere'))[0]);

    expect(h.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(t('save.confirmOverwrite'))).toBeTruthy();
  });

  it('overwrites on the second', () => {
    const h = show();
    fireEvent.click(screen.getAllByText(t('save.saveHere'))[0]);
    fireEvent.click(screen.getByText(t('save.confirmOverwrite')));

    expect(h.onSave).toHaveBeenCalledWith('auto');
  });

  /** Writing into an empty slot destroys nothing, so it must not ask. */
  it('writes into an empty slot on one tap', () => {
    const h = show();
    // The empty slot is the last row, so its save button is the last one.
    const buttons = screen.getAllByText(t('save.saveHere'));
    fireEvent.click(buttons[buttons.length - 1]);

    expect(h.onSave).toHaveBeenCalledWith('2');
  });
});

describe('the cover screen', () => {
  /**
   * There is no run to write yet, so the same list is read-only there. Offering
   * `save here` on the cover would write an empty campaign over a real one.
   */
  it('offers no save button when there is nothing to save', () => {
    show({ onSave: null });

    expect(screen.queryByText(t('save.saveHere'))).toBeNull();
    expect(screen.getAllByText(t('save.load'))).toHaveLength(2);
  });
});

describe('when storage refuses', () => {
  it('says so rather than failing silently', () => {
    show({ onSave: vi.fn(() => false) });
    const buttons = screen.getAllByText(t('save.saveHere'));
    fireEvent.click(buttons[buttons.length - 1]);

    expect(screen.getByRole('alert').textContent).toBe(t('save.failed'));
  });
});
