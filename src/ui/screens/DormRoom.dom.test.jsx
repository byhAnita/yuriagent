/** @vitest-environment jsdom */
/**
 * What the dorm offers, and what it deliberately does not. PROPOSALS 15.
 *
 * The interesting assertion is the negative one. Section 10b's rule is that
 * every room offers every action - and the two shared dorm rooms are the one
 * documented exception, because the dorm is where an unchosen 1v1 costs the
 * most. That exception only means anything if it is enforced.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SoloAction from './SoloAction.jsx';
import { getCast } from '../../data/cast.js';
import { sharedActivityFor } from '../../data/sharedActivities.js';
import { makeT } from '../../i18n/index.js';

const cards = getCast();
const t = makeT('en');

afterEach(cleanup);

function show({ locationId, present, onTalk = vi.fn(), onShared = vi.fn() }) {
  render(
    <SoloAction
      locationId={locationId}
      task={null}
      result={null}
      present={present}
      cards={cards}
      onTalk={onTalk}
      onShared={onShared}
      onJoin={vi.fn()}
      onChoose={vi.fn()}
      onDone={vi.fn()}
      t={t}
    />,
  );
  return { onTalk, onShared };
}

const talkButtons = () =>
  screen.queryAllByText((text) => text.startsWith('Talk to '), { exact: false });

describe('the living room, with people in it', () => {
  const present = ['irene', 'nana', 'jisoo'];

  it('offers the film and nobody in particular', async () => {
    const { onShared, onTalk } = show({ locationId: 'dorm_living', present });

    expect(talkButtons()).toHaveLength(0);
    expect(onTalk).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText(t('shared.watch_a_film')));
    expect(onShared).toHaveBeenCalledWith(sharedActivityFor('dorm_living'));
  });

  it('says outright that nobody is being singled out', () => {
    show({ locationId: 'dorm_living', present });
    expect(screen.getByText(t('shared.note'))).toBeTruthy();
  });

  /**
   * Section 10b still holds: the work and the snoop are on offer whoever is
   * standing there. Removing the 1v1 is the exception, not a lockout.
   */
  it('still offers what the room offers', () => {
    show({ locationId: 'dorm_living', present });
    expect(screen.getByText(t('solo.wait_up'))).toBeTruthy();
  });
});

describe('the kitchen', () => {
  it('offers cooking together when there is anyone to cook with', () => {
    show({ locationId: 'dorm_kitchen', present: ['irene', 'yeri'] });

    expect(screen.getByText(t('shared.cook_together'))).toBeTruthy();
    expect(talkButtons()).toHaveLength(0);
  });

  /**
   * An empty kitchen is an ordinary empty room: cook for later, cook for the
   * others, read the fridge. "Cook together" with nobody in it is not a scene.
   */
  it('offers nothing shared when the room is empty', () => {
    show({ locationId: 'dorm_kitchen', present: [] });

    expect(screen.queryByText(t('shared.cook_together'))).toBeNull();
    expect(screen.getByText(t('solo.cook_a_dish'))).toBeTruthy();
    expect(screen.getByText(t('solo.read_the_fridge'))).toBeTruthy();
  });
});

describe('everywhere else', () => {
  /**
   * The exception is the dorm and only the dorm. A practice room with three
   * members in it still offers each of them individually - that room is where
   * the choosing is supposed to cost something.
   */
  it('still lets the player walk up to one person', async () => {
    const { onTalk } = show({ locationId: 'practice_room', present: ['irene', 'nana'] });

    expect(talkButtons().length).toBeGreaterThan(0);
    expect(screen.queryByText(t('shared.note'))).toBeNull();

    await userEvent.click(screen.getByText(t('solo.talkTo').replace('{name}', 'Irene')));
    expect(onTalk).toHaveBeenCalledWith('irene');
  });
});
