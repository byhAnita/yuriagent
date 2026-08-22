/** @vitest-environment jsdom */
/**
 * The cover collects the three things a run is fixed by.
 *
 * Two of them are stubs, and the tests that matter most are the ones that
 * assert the stubs STAY stubs: a picker that renders a disabled row is only
 * worth having if the row cannot be clicked into the run. Section 13 ships one
 * identity, and a bug that let the player start as a producer would produce a
 * run with a task pool the rest of the game has never been played against.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Start from './Start.jsx';
import { getCast } from '../../data/cast.js';
import { buildLineup } from '../../systems/castBuilder.js';
import { IDENTITIES, playableIdentities } from '../../data/identities.js';
import { makeT } from '../../i18n/index.js';
import { MAX_PLAYER_NAME } from '../../store/playerName.js';

const cards = getCast();
const lineup = buildLineup(cards);

afterEach(cleanup);

function show(props = {}) {
  const onBegin = vi.fn();
  const t = makeT(props.lang ?? 'en');
  render(
    <Start
      cards={cards}
      lineup={lineup}
      onBegin={onBegin}
      onOpenSettings={() => {}}
      t={t}
      {...props}
    />,
  );
  return { onBegin, t };
}

const beginButton = (t) => screen.getByRole('button', { name: t('start.begin') });

describe('the start screen', () => {
  it('will not begin without a name', async () => {
    const { onBegin, t } = show();
    const button = beginButton(t);

    expect(button.disabled).toBe(true);
    await userEvent.click(button);
    expect(onBegin).not.toHaveBeenCalled();
  });

  it('begins with the sanitised name and the chosen identity', async () => {
    const { onBegin, t } = show();

    await userEvent.type(screen.getByRole('textbox'), '  Yuhan  ');
    await userEvent.click(beginButton(t));

    expect(onBegin).toHaveBeenCalledWith({ name: 'Yuhan', identityId: 'assistant' });
  });

  /**
   * Whitespace is the case that matters: it passes `length > 0` and sanitises
   * to nothing, so a naive check would start a run whose block 1 says the
   * player is called "   ".
   */
  it('treats a name of only spaces as no name', async () => {
    const { onBegin, t } = show();

    await userEvent.type(screen.getByRole('textbox'), '    ');

    expect(beginButton(t).disabled).toBe(true);
    expect(onBegin).not.toHaveBeenCalled();
  });

  it('caps what can be typed at the prompt-safe length', async () => {
    show();
    const field = screen.getByRole('textbox');

    await userEvent.type(field, 'x'.repeat(MAX_PLAYER_NAME + 20));

    expect(field.value.length).toBe(MAX_PLAYER_NAME);
  });

  it('shows every identity and lets you choose only the shipped one', async () => {
    const { onBegin, t } = show();

    for (const id of Object.keys(IDENTITIES)) {
      expect(screen.getByText(t(`identity.${id}`))).toBeTruthy();
    }
    expect(playableIdentities()).toEqual(['assistant']);

    // Try to pick one that is not shipped, then start anyway.
    await userEvent.click(screen.getByText(t('identity.producer')));
    await userEvent.type(screen.getByRole('textbox'), 'Yuhan');
    await userEvent.click(beginButton(t));

    expect(onBegin).toHaveBeenCalledWith({ name: 'Yuhan', identityId: 'assistant' });
  });

  it('names the cast and the roles castBuilder resolved for them', () => {
    const { t } = show();

    for (const card of cards) {
      expect(screen.getByText(card.name)).toBeTruthy();
    }
    // Whoever ended up leader is said out loud here and nowhere else.
    const leader = cards.find((c) => lineup[c.id].includes('leader'));
    expect(screen.getByText(new RegExp(t('role.leader')))).toBeTruthy();
    expect(leader).toBeTruthy();
  });

  it('offers the custom-cast row without letting it do anything', async () => {
    const { onBegin, t } = show();

    const custom = screen.getByText(t('start.customCast'));
    await userEvent.click(custom);

    expect(onBegin).not.toHaveBeenCalled();
    expect(custom.closest('button').disabled).toBe(true);
  });

  /**
   * Section 21: every player-facing string goes through i18n. A hardcoded
   * English label on the cover would be the first thing a zh player sees.
   */
  it('renders in the run language', () => {
    const { t } = show({ lang: 'zh' });

    expect(t('start.begin')).not.toBe('Begin');
    expect(screen.getByRole('button', { name: t('start.begin') })).toBeTruthy();
    expect(screen.getByText(t('identity.assistant'))).toBeTruthy();
  });
});
