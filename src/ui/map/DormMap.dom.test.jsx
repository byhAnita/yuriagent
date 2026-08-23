/** @vitest-environment jsdom */
/**
 * The five closed doors. CLAUDE.md section 10.
 *
 * A door is the one place in the game where a threshold is shown to the player
 * as a goal rather than hidden as a stat, so what it says has to be true. The
 * light behind it means SHE IS IN THERE, and it used to mean "she is somewhere
 * in the dorm" - which put Nana in her room and in the kitchen at the same
 * time on the second evening anybody played.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DormMap from './DormMap.jsx';
import { getCast } from '../../data/cast.js';
import { newRelation } from '../../systems/relationship.js';
import { LOCATIONS } from '../../data/locations.js';
import { makeT } from '../../i18n/index.js';

const cards = getCast();
const t = makeT('en');
const GATE = LOCATIONS.dorm_room.entryIntimacy;

afterEach(cleanup);

/** Everyone idle somewhere harmless, then whatever the test cares about. */
function show({ where = {}, intimacy = GATE + 10, onEnterRoom = vi.fn() } = {}) {
  const occupancy = Object.fromEntries(
    cards.map((c) => [c.id, { locationId: where[c.id] ?? 'practice_room' }]),
  );
  const relations = Object.fromEntries(cards.map((c) => [c.id, newRelation(intimacy)]));

  render(
    <DormMap
      cards={cards}
      relations={relations}
      occupancy={occupancy}
      onBack={vi.fn()}
      onEnterRoom={onEnterRoom}
      onEnterSolo={vi.fn()}
      t={t}
    />,
  );
  return { onEnterRoom };
}

const door = (name) =>
  screen.getByText(t('map.herRoom').replace('{name}', name)).closest('button');

describe('her door', () => {
  it('opens when she is behind it', async () => {
    const { onEnterRoom } = show({ where: { nana: 'dorm_room' } });

    expect(door('Nana').disabled).toBe(false);
    await userEvent.click(door('Nana'));
    expect(onEnterRoom).toHaveBeenCalledWith('dorm_room', [{ id: 'nana' }]);
  });

  /**
   * THE BUG. She is home, she is not in her room, and the door said she was.
   *
   * The light was drawn from `DORM_OCCUPANCY` - anywhere in the dorm - so a
   * member standing in the kitchen lit her own door as well, and the map
   * showed her in two rooms at once. The routine layer answers the exact
   * question: `occupancyAt` puts her in `dorm_room` on the evenings that are
   * hers and in a shared room on the ones that are not.
   */
  it('stays dark while she is in the kitchen, however close she is', () => {
    show({ where: { nana: 'dorm_kitchen' }, intimacy: 100 });

    expect(door('Nana').disabled).toBe(true);
    expect(door('Nana').textContent).toContain(t('map.notHome'));
  });

  it('stays dark while she is in the living room too', () => {
    show({ where: { nana: 'dorm_living' }, intimacy: 100 });
    expect(door('Nana').disabled).toBe(true);
  });

  /** ...and she is still visibly in the room she is actually in. */
  it('puts her where she really is', () => {
    show({ where: { nana: 'dorm_kitchen' } });

    const kitchen = screen.getByText(t('location.dorm_kitchen')).closest('button');
    const nana = cards.find((c) => c.id === 'nana');
    expect(kitchen.textContent).toContain(nana.emoji);
  });

  /**
   * A locked door names the number rather than hiding it: that is a goal, not
   * a spoiler - and it stays locked even on an evening that is hers.
   */
  it('names the threshold while it is locked', () => {
    show({ where: { nana: 'dorm_room' }, intimacy: GATE - 10 });

    expect(door('Nana').disabled).toBe(true);
    expect(door('Nana').textContent).toContain(String(GATE));
  });
});
