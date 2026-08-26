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
const GATE = LOCATIONS.dorm_room.entryAffection;

afterEach(cleanup);

/** Everyone idle somewhere harmless, then whatever the test cares about. */
function show({ where = {}, affection = GATE + 10, routines = {}, onEnterRoom = vi.fn() } = {}) {
  const occupancy = Object.fromEntries(
    cards.map((c) => [c.id, { locationId: where[c.id] ?? 'practice_room' }]),
  );
  const relations = Object.fromEntries(cards.map((c) => [c.id, newRelation(affection)]));

  render(
    <DormMap
      cards={cards}
      relations={relations}
      occupancy={occupancy}
      routines={routines}
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
    show({ where: { nana: 'dorm_kitchen' }, affection: 100 });

    expect(door('Nana').disabled).toBe(true);
    expect(door('Nana').textContent).toContain(t('map.notHome'));
  });

  it('stays dark while she is in the living room too', () => {
    show({ where: { nana: 'dorm_living' }, affection: 100 });
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
    show({ where: { nana: 'dorm_room' }, affection: GATE - 10 });

    expect(door('Nana').disabled).toBe(true);
    expect(door('Nana').textContent).toContain(String(GATE));
  });
});

/**
 * WHERE A LEARNED ROUTINE IS SPENT. CLAUDE.md section 10, Part I.10.
 *
 * A dark door said "not home" and nothing else - which the player could already
 * see by standing here, so the block was spent finding out. Knowing her routine
 * turns the same door into a plan: not tonight, Thursday.
 *
 * Asserted at the door because that is the only place it pays off, and because
 * the failure is silent: `routines` handed `undefined` renders the old
 * sentence, looks completely correct, and quietly makes the whole find
 * worthless. That is the join bug this project keeps shipping.
 */
describe('a routine the player has worked out', () => {
  it('turns a dark door into an evening', () => {
    show({ routines: { nana: [2, 4] } });

    const note = door('Nana').textContent;
    expect(note).toContain(t('day.wed'));
    expect(note).toContain(t('day.fri'));
    expect(note).not.toContain(t('map.notHome'));
  });

  /** Nothing learned, nothing said. The door is dark exactly as it always was. */
  it('leaves an unknown routine saying only that she is out', () => {
    show();
    expect(door('Nana').textContent).toContain(t('map.notHome'));
  });

  /**
   * Knowing when she is home does not open the door tonight, and it does not
   * open it early either - the affection gate is untouched, and a locked door
   * still shows the threshold rather than a schedule.
   */
  it('does not open a door that is shut', () => {
    show({ routines: { nana: [2] } });
    expect(door('Nana').disabled).toBe(true);

    cleanup();
    show({ affection: GATE - 1, routines: { nana: [2] } });
    expect(door('Nana').textContent).toContain(String(GATE));
    expect(door('Nana').textContent).not.toContain(t('day.wed'));
    expect(door('Nana').disabled).toBe(true);
  });

  /** She is standing in the room. The light is the answer, not a schedule. */
  it('says nothing extra on an evening she is actually home', () => {
    show({ where: { nana: 'dorm_room' }, routines: { nana: [2, 4] } });

    expect(door('Nana').disabled).toBe(false);
    expect(door('Nana').textContent).not.toContain(t('day.wed'));
  });
});
