/** @vitest-environment jsdom */
/**
 * The relationship panel. PROPOSALS 25.
 *
 * Two things are asserted here that nothing else can see. The first is that
 * `admissibility` is on screen AT ALL - it is half the relationship model, it
 * decides the plateau, the public date and four endings, and until now it
 * appeared nowhere in the UI. The second is the negative: this is a DAY-screen
 * panel, and nothing about it may leak into a scene.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RelationsModal from './RelationsModal.jsx';
import { getCast } from '../../data/cast.js';
import { newRelation } from '../../systems/relationship.js';
import { makeT } from '../../i18n/index.js';
import en from '../../i18n/en.js';

afterEach(cleanup);

const cards = getCast();
const rel = (patch) => ({ ...newRelation(5), ...patch });

const show = ({ relations, lang = 'en', onClose = vi.fn() } = {}) => {
  render(
    <RelationsModal
      cards={cards}
      relations={relations ?? Object.fromEntries(cards.map((c) => [c.id, rel({ intimacy: 40 })]))}
      onClose={onClose}
      t={makeT(lang)}
    />,
  );
  return { onClose };
};

describe('it shows both axes', () => {
  it('names the second one, which has never been in the UI before', () => {
    show();
    expect(screen.getAllByText(en.relations.nameable).length).toBe(cards.length);
    expect(screen.getAllByText(en.relations.close).length).toBe(cards.length);
  });

  it('prints both numbers for every member', () => {
    show({
      relations: Object.fromEntries(
        cards.map((c) => [c.id, rel({ intimacy: 72, admissibility: 18 })]),
      ),
    });

    expect(screen.getAllByText('72')).toHaveLength(cards.length);
    expect(screen.getAllByText('18')).toHaveLength(cards.length);
  });

  /**
   * The sentence is what turns two bars into a relationship, and it is the
   * player-facing twin of block 4's standing line - second person, localized,
   * and deliberately not the same string.
   */
  it('says where you stand in words as well as numbers', () => {
    show({
      relations: Object.fromEntries(
        cards.map((c) => [c.id, rel({ intimacy: 60, admissibility: 25 })]),
      ),
    });

    const line = en.standing.nameless.replace('{name}', cards[0].name);
    expect(screen.getByText(line)).toBeTruthy();
  });
});

describe('it explains the states the player cannot infer', () => {
  /**
   * The plateau is the one state that demands a specific answer - be seen - and
   * the one the player cannot work out, because all it does is stop a number
   * they were not watching.
   */
  it('tells the plateau what to do about it', () => {
    show({
      relations: Object.fromEntries(
        cards.map((c) => [c.id, rel({ intimacy: 90, admissibility: 2, stage: 'confidante' })]),
      ),
    });

    expect(screen.getAllByText(en.relations.stalled).length).toBe(cards.length);
  });

  it('says nothing about strain or jealousy while there is nothing to say', () => {
    show();
    expect(screen.queryByText(new RegExp(en.relations.jealousy, 'i'))).toBeNull();
    expect(screen.queryByText(new RegExp(en.relations.strain, 'i'))).toBeNull();
  });

  it('surfaces both once there is', () => {
    const relations = Object.fromEntries(cards.map((c) => [c.id, rel({ intimacy: 40 })]));
    relations[cards[0].id] = rel({ intimacy: 40, jealousy: 60, strain: 70 });
    show({ relations });

    expect(screen.getAllByText(new RegExp(en.relations.jealousy, 'i')).length).toBe(1);
    expect(screen.getAllByText(new RegExp(en.relations.strain, 'i')).length).toBe(1);
  });
});

describe('it is a sheet like every other', () => {
  it('closes, and the way out is in the pinned header', async () => {
    const user = userEvent.setup();
    const { onClose } = show();

    await user.click(screen.getByText(en.relations.dismiss));
    expect(onClose).toHaveBeenCalled();
  });

  /**
   * Section 20: the cap and the scroll live in `Sheet`, and this list is five
   * members deep with two bars and up to three lines each - long enough that a
   * hand-rolled shell would repeat the DateModal failure.
   */
  it('scrolls inside itself rather than growing off the screen', () => {
    const { container } = render(
      <RelationsModal
        cards={cards}
        relations={Object.fromEntries(cards.map((c) => [c.id, rel({ intimacy: 40 })]))}
        onClose={vi.fn()}
        t={makeT('en')}
      />,
    );
    expect(container.querySelector('.overflow-y-auto')).toBeTruthy();
    expect(container.querySelector('[class*="max-h-"]')).toBeTruthy();
  });

  it('renders in zh without falling back to English', () => {
    cleanup();
    show({ lang: 'zh' });
    const zhTitle = makeT('zh')('relations.title');
    expect(screen.getByText(zhTitle)).toBeTruthy();
    expect(zhTitle).not.toBe(en.relations.title);
  });

  it('skips a member with no relation rather than throwing', () => {
    expect(() =>
      render(
        <RelationsModal
          cards={cards}
          relations={{ [cards[0].id]: rel({ intimacy: 40 }) }}
          onClose={vi.fn()}
          t={makeT('en')}
        />,
      ),
    ).not.toThrow();
    const body = within(document.body);
    expect(body.getByText(cards[0].name)).toBeTruthy();
    expect(body.queryByText(cards[1].name)).toBeNull();
  });
});
