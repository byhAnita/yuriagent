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

function show({ event = todayEvent, lang = 'en', onEnterSolo = vi.fn() } = {}) {
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
      task={null}
      taskState={{ done: false }}
      identity={getIdentity()}
      event={event}
      onEnter={vi.fn()}
      onEnterSolo={onEnterSolo}
      onSkipBlock={vi.fn()}
      onOpenSettings={vi.fn()}
      t={t}
    />,
  );
  return { t, onEnterSolo };
}

describe('the day an anchor event lands on', () => {
  it('says what today is, and that it takes all of it', () => {
    const { t } = show();

    expect(screen.getByText(t(`event.${todayEvent.content.id}`))).toBeTruthy();
    expect(screen.getByText(new RegExp(t('event.wholeDay')))).toBeTruthy();
  });

  it('puts the event site on the map so the player can walk into it', async () => {
    const { t, onEnterSolo } = show();

    const row = mapRow(t(`location.${todayEvent.location}`));
    expect(row).toBeTruthy();
    await userEvent.click(row.querySelector('button') ?? row);

    expect(onEnterSolo).toHaveBeenCalled();
    expect(onEnterSolo.mock.calls[0][0]).toBe(todayEvent.location);
  });

  /**
   * The whole cast is there, which is what makes an event categorically the
   * loudest place in the game to choose one of them (section 5b's witnessed
   * rule needs no roll).
   */
  it('shows the whole cast standing in it', () => {
    const { t } = show();
    const row = mapRow(t(`location.${todayEvent.location}`));
    for (const card of cards) {
      expect(row.textContent).toContain(card.name);
    }
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
