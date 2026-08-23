/** @vitest-environment jsdom */
/**
 * A room offers what it offers.
 *
 * Walking in used to commit the player to a conversation the moment anybody was
 * standing there, so two thirds of the map was only ever reachable when it was
 * empty - and the knowledge economy quietly funnelled through whichever rooms
 * happened to be unoccupied. Every action is now offered in every room; what
 * changes with company is the price (systems/soloWork.js).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SoloAction from './SoloAction.jsx';
import { getCast } from '../../data/cast.js';
import { makeT } from '../../i18n/index.js';

const cards = getCast();
const t = makeT('en');

afterEach(cleanup);

function show(props = {}) {
  return render(
    <SoloAction
      locationId="wardrobe"
      task={null}
      result={null}
      present={[]}
      cards={cards}
      onTalk={() => {}}
      onChoose={() => {}}
      onDone={() => {}}
      t={t}
      {...props}
    />,
  );
}

describe('an empty room', () => {
  it('says nobody is there', () => {
    show();
    expect(screen.getByText(t('solo.alone'))).toBeTruthy();
  });

  it('still offers the work', () => {
    show();
    expect(screen.getByText(t('solo.read_fitting_notes'))).toBeTruthy();
  });
});

describe('a room with somebody in it', () => {
  it('offers her, and the work as well', () => {
    show({ present: ['irene'] });

    expect(screen.getByText('Talk to Irene')).toBeTruthy();
    // The snoop is still on the list. This is the whole change.
    expect(screen.getByText(t('solo.read_fitting_notes'))).toBeTruthy();
  });

  it('offers everybody who is there', () => {
    show({ present: ['irene', 'nana'] });

    expect(screen.getByText('Talk to Irene')).toBeTruthy();
    expect(screen.getByText('Talk to Nana')).toBeTruthy();
  });

  /**
   * Section 5b: turning to one member in front of the others is itself the
   * gesture, and it is priced. The player has to be able to see that before
   * they choose, or the cost is a surprise rather than a decision.
   */
  it('warns that the others are watching, and only when they are', () => {
    const solo = show({ present: ['irene'] });
    expect(screen.queryByText(t('solo.watched'))).toBeNull();
    solo.unmount();

    show({ present: ['irene', 'nana'] });
    expect(screen.getAllByText(t('solo.watched')).length).toBeGreaterThan(0);
  });

  it('says who the player walked up to', async () => {
    const onTalk = vi.fn();
    show({ present: ['irene', 'nana'], onTalk });

    await userEvent.click(screen.getByText('Talk to Nana'));
    expect(onTalk).toHaveBeenCalledWith('nana');
  });
});

describe('the day job', () => {
  const task = { taskId: 'prep_outfits', credits: 3, competence: 4, location: 'wardrobe' };

  /**
   * Section 10: the task is one option in the list, never a banner. It has to
   * compete with her for the same block - that competition IS the mechanic.
   */
  it('sits in the same list as everything else', () => {
    show({ task, present: ['irene'] });

    expect(screen.getByText(t('task.prep_outfits'))).toBeTruthy();
    expect(screen.getByText('Talk to Irene')).toBeTruthy();
    expect(screen.getByText(t('solo.read_fitting_notes'))).toBeTruthy();
  });

  it('is absent from a room that is not its own', () => {
    show({ task: null, locationId: 'cafe' });
    expect(screen.queryByText(t('task.prep_outfits'))).toBeNull();
  });
});

/**
 * Looking has to be free, or the map stops being a search.
 *
 * The block is paid by the ACTION - until one is picked nothing has happened -
 * and the room screen had no way out, so opening a door to see who was in it
 * was a commitment. Reported on the first day anyone played a full week
 * (CLAUDE.md section 10b).
 */
describe('walking back out', () => {
  it('is offered before anything has been spent', async () => {
    const onLeave = vi.fn();
    show({ onLeave });

    await userEvent.click(screen.getByRole('button', { name: new RegExp(t('map.back')) }));
    expect(onLeave).toHaveBeenCalled();
  });

  /**
   * ...and not after. Once an action has resolved the block IS spent, so the
   * only honest way on is the next block. A back button there would read as an
   * undo, which is the one thing it cannot be.
   */
  it('is gone once the block has been spent', () => {
    show({
      onLeave: vi.fn(),
      result: {
        action: { id: 'prep_fittings', learns: null },
        playerDelta: { credits: 2, competence: 1, energy: -6, secrecy: 0 },
      },
    });

    expect(screen.queryByRole('button', { name: new RegExp(t('map.back')) })).toBeNull();
  });

  /** A screen given no way home does not grow a dead control. */
  it('is absent when no caller offered one', () => {
    show();
    expect(screen.queryByRole('button', { name: new RegExp(t('map.back')) })).toBeNull();
  });
});
