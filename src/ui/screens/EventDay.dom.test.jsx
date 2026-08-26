/** @vitest-environment jsdom */
/**
 * An event day, as the player meets it.
 *
 * The calendar has placed event days since M1 and `overworldFor` has hidden
 * event sites since the phase maps landed, and nothing joined the two - so on
 * an event day the whole cast stood somewhere unreachable and the map showed
 * an ordinary, empty day. Both halves were correct. This is the join, and it
 * is asserted at the screen because that is the only place the absence was
 * visible.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Day from './Day.jsx';
import { getCast } from '../../data/cast.js';
import { eventFor } from '../../data/events/index.js';
import { generateWeek, occupancyAt } from '../../systems/calendar.js';
import { newRelation } from '../../systems/relationship.js';
import { getIdentity } from '../../data/identities.js';
import { makeT } from '../../i18n/index.js';

/**
 * The site name is on screen twice on an event day - once in the banner that
 * says what today is, once as the map row you walk into. This is the row.
 */
const mapRow = (label) =>
  screen.getAllByText(label).map((el) => el.closest('li')).find(Boolean);

const cards = getCast();
const SEED = 20260823;
const PHASE = 'comeback';

afterEach(cleanup);

const weekPlan = generateWeek({ phase: PHASE, cards, seed: SEED, week: 0 });
const placed = weekPlan.events[0];
const todayEvent = { ...placed, content: eventFor(placed.phase, placed.slot) };

function show({
  event = todayEvent,
  lang = 'en',
  onEnterSolo = vi.fn(),
  onEnter = vi.fn(),
  onOpenRelations = vi.fn(),
  task = null,
} = {}) {
  const t = makeT(lang);
  const run = { week: 0, day: placed.day, block: 'morning', phase: PHASE };
  render(
    <Day
      run={run}
      player={{ energy: 90, credits: 6, competence: 20, secrecy: 70 }}
      cards={cards}
      relations={Object.fromEntries(cards.map((c) => [c.id, newRelation(5)]))}
      occupancy={occupancyAt(weekPlan, {
        day: placed.day,
        block: 'morning',
        cards,
        seed: SEED,
        week: 0,
      })}
      weekPlan={weekPlan}
      task={task}
      taskState={{ done: false }}
      identity={getIdentity()}
      event={event}
      onEnter={onEnter}
      onEnterSolo={onEnterSolo}
      onSkipBlock={vi.fn()}
      onOpenSettings={vi.fn()}
      onOpenRelations={onOpenRelations}
      t={t}
    />,
  );
  return { t, onEnterSolo, onEnter, onOpenRelations };
}

describe('the day an anchor event lands on', () => {
  it('says what today is, and that it takes all of it', () => {
    const { t } = show();

    expect(screen.getByText(t(`event.${todayEvent.content.id}`))).toBeTruthy();
    expect(screen.getByText(new RegExp(t('event.wholeDay')))).toBeTruthy();
  });

  /**
   * Walking in IS the event, and it is the whole cast.
   *
   * It used to open the room screen - a 1v1 with any of the five, a snoop, and
   * the day's chores - on a day that is none of those things. Section 10:
   * choosing one of them in front of the other four is what the addressee is
   * for, and it belongs inside the scene where it costs what it should.
   */
  it('walks the player straight into the room, with everybody in it', async () => {
    const { t, onEnter, onEnterSolo } = show();

    const row = mapRow(t(`location.${todayEvent.location}`));
    expect(row).toBeTruthy();
    await userEvent.click(row.querySelector('button') ?? row);

    expect(onEnterSolo).not.toHaveBeenCalled();
    expect(onEnter).toHaveBeenCalled();

    const [locationId, present, addresseeId, opts] = onEnter.mock.calls[0];
    expect(locationId).toBe(todayEvent.location);
    expect(present.map((m) => m.id).sort()).toEqual(cards.map((c) => c.id).sort());
    expect(addresseeId).toBeNull();
    expect(opts).toMatchObject({ group: true });
  });

  /**
   * The whole cast is there, and now the row shows it - but it still offers no
   * ONE of them.
   *
   * That is the half of Part I.11 that survives the map showing occupancy again.
   * The two are separate features: faces on a row are information, a per-member
   * BUTTON on a row is a shortcut past the room. An anchor event is where the
   * shortcut would hurt most - the whole point of the day is one player in a room
   * with five women, and picking her at the door skips the room entirely.
   *
   * (It is also where v1's version broke worst: its crowded rows offered only
   * per-member buttons, so on an event day the row was five faces and no way in.)
   */
  it('names the day, shows the cast, and still offers no one of them', () => {
    const { t } = show();
    const row = mapRow(t(`location.${todayEvent.location}`));

    expect(screen.getByText(t('event.today'))).toBeTruthy();

    // Everybody is on the row...
    for (const card of cards) {
      expect(row.querySelector(`[title="${card.name}"]`), card.name).toBeTruthy();
    }

    // ...and the row is ONE control, which opens the room. Five faces and five
    // buttons would be the version that skips it.
    expect(row.querySelectorAll('button').length).toBe(1);
  });

  /**
   * "It takes the whole day" was on this screen from the first build and
   * nothing enforced it. Played, the concept meeting was one row among four
   * other rooms, a task in the wardrobe, and the dorm.
   */
  it('offers nowhere else to go, including the dorm', () => {
    const { t } = show();

    expect(screen.queryByText(t('location.practice_room'))).toBeNull();
    expect(screen.queryByText(t('location.dorm_living'))).toBeNull();
    expect(screen.queryByText(t('map.dorm'))).toBeNull();
  });

  it('lets an ordinary day keep its whole map', () => {
    const { t } = show({ event: null });
    expect(screen.getByText(t('map.dorm'))).toBeTruthy();
  });

  it('hides the site again on a day with no event', () => {
    const { t } = show({ event: null });
    expect(screen.queryByText(t(`location.${todayEvent.location}`))).toBeNull();
    expect(screen.queryByText(t(`event.${todayEvent.content.id}`))).toBeNull();
  });

  it('reads in the run language', () => {
    const { t } = show({ lang: 'zh' });
    expect(t(`event.${todayEvent.content.id}`)).not.toBe(todayEvent.content.id);
    expect(screen.getByText(t(`event.${todayEvent.content.id}`))).toBeTruthy();
  });
});

/**
 * The relationship row is a way in, not just a readout (PROPOSALS 25).
 *
 * Asserted at the screen because the failure mode is silent: an `onClick` handed
 * `undefined` renders, looks exactly right, and does nothing - which is the join
 * bug this project keeps finding, in the one place a unit test cannot look. The
 * panel's own contents are `ui/modals/RelationsModal.dom.test.jsx`.
 */
describe('the relationship row opens', () => {
  it('is a control, and it calls out', async () => {
    const { t, onOpenRelations } = show();

    const opener = screen.getByText(t('relations.open'));
    expect(opener).toBeTruthy();
    await userEvent.click(opener);

    expect(onOpenRelations).toHaveBeenCalled();
  });

  /**
   * Free, and not a block. Same rule the handbook follows: a room action reads
   * as costing a block, and reading what you already half-know must not.
   */
  it('costs nothing - it does not enter a room or spend the day', async () => {
    const { t, onEnter, onEnterSolo, onOpenRelations } = show();

    await userEvent.click(screen.getByText(t('relations.open')));

    expect(onOpenRelations).toHaveBeenCalled();
    expect(onEnter).not.toHaveBeenCalled();
    expect(onEnterSolo).not.toHaveBeenCalled();
  });
});
