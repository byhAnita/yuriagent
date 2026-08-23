/** @vitest-environment jsdom */
/**
 * Handing something over is a move inside the scene. CLAUDE.md section 11.
 *
 * Two bugs, reported after the first day of play, and they turned out to be
 * one mistake made twice:
 *
 * 1. The gift panel opened at the door of every scene, group scenes included -
 *    so the player was asked what they were giving somebody before they had
 *    been given any reason to want to, and in a group scene before they had
 *    seen who was in the room.
 * 2. Pass, in a group scene, was a 10px text link in the corner under the
 *    chips, so the one move that lets the room breathe read as chrome.
 *
 * Both are "this ends your turn, and it does not look like it does". The fix
 * is the same shape in both cases: everything that spends the turn sits at the
 * weight of the options, and the meta row keeps only what does not.
 *
 * The engine half lives in `agent/opening.test.js`. This is the join.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VNStage from './VNStage.jsx';
import { newMemory, addDossierEntry } from '../../agent/memory.js';
import { newRelation } from '../../systems/relationship.js';
import { getCast } from '../../data/cast.js';
import { buildLineup } from '../../systems/castBuilder.js';
import { getIdentity } from '../../data/identities.js';

afterEach(cleanup);

const cards = getCast();
const ids = cards.map((c) => c.id);
const ROOM = ['irene', 'nana', 'jisoo'];

const t = (k) => (k === 'vn.turnTo' ? 'turn to {name}' : k);
const BEAT = (who) => `@${who}|neutral|guard50|fluster10\n*She looks up.* "Right."`;

/** Irene has let something slip, so a knowledge opener is actually reachable. */
function knowing() {
  const m = newMemory(ids);
  m.dossier = addDossierEntry(m.dossier, 'irene', 'known_facts', 'hates cold hands');
  m.dossier = addDossierEntry(m.dossier, 'nana', 'known_facts', 'hates cold hands');
  return m;
}

function setup({ rosterIds = ['irene'], memory = knowing() } = {}) {
  return {
    cards,
    lineup: buildLineup(cards),
    identity: getIdentity(),
    player: { name: 'Yuhan', energy: 80, secrecy: 70, credits: 50 },
    lang: 'en',
    memory,
    relations: Object.fromEntries(ids.map((id) => [id, newRelation(20)])),
    scene: {
      id: 'o1',
      seed: 1,
      rosterIds,
      presentIds: rosterIds,
      focusId: 'irene',
      week: 0,
      day: 1,
      block: 'evening',
      phase: 'prep',
      locationId: 'dorm_living',
      locationLabel: 'Living room',
    },
  };
}

/**
 * The `openers` contract App fulfils: it owns what a spend COSTS and returns
 * the note, or null when it refuses. The stage owns only when it happens.
 */
function openers(overrides = {}) {
  const given = [];
  const api = {
    given,
    credits: 50,
    stock: {},
    usedGestures: [],
    dossierFor: (id) => knowing().dossier[id],
    give: (giftId, card) => {
      given.push({ kind: 'give', giftId, to: card.id });
      return `the player has just handed ${card.name} a ${giftId.replace(/_/g, ' ')}.`;
    },
    say: (giftId, card) => {
      given.push({ kind: 'say', giftId, to: card.id });
      return `the player has brought ${card.name} nothing at all.`;
    },
    ...overrides,
  };
  return api;
}

function scripted(reply) {
  return async ({ preset, messages, onChunk }) => {
    if (preset === 'chips') return '';
    const text = reply(messages);
    onChunk?.(text);
    return text;
  };
}

const chipButtons = () =>
  screen.getAllByRole('button').filter((b) => /stance\./.test(b.textContent ?? ''));

/**
 * Read through whatever she said, then take the live chips.
 *
 * Beats are revealed a tap at a time and the bar is held while any are
 * outstanding (section 9), so a group scene where somebody joins in leaves two
 * beats queued and the bar legitimately dead until the player has read both.
 * Tapping through is what a player does; not doing it made this helper hang.
 */
const liveChips = async () => {
  for (let i = 0; i < 6; i += 1) {
    const more = screen.queryByRole('button', { name: /vn\.continue/ });
    if (!more) break;
    await userEvent.click(more);
  }
  await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
    timeout: 10000,
  });
  return chipButtons().filter((b) => !b.disabled);
};

const giveButton = () => screen.queryByRole('button', { name: /vn\.give/ });

const mount = (props = {}) =>
  render(
    <VNStage
      setup={setup()}
      client={scripted(() => BEAT('irene'))}
      openers={openers()}
      onSceneEnd={() => {}}
      writtenChips={false}
      t={t}
      {...props}
    />,
  );

describe('the turn bar says what spends the turn', () => {
  it('offers the opener as a control of its own, not as a footnote', async () => {
    mount();
    await liveChips();

    const give = giveButton();
    expect(give).toBeTruthy();
    // A button with a border and a real target, not a bare text link. The bug
    // was specifically that these read as chrome.
    expect(give.className).toMatch(/border/);
    expect(give.className).toMatch(/min-h-11/);
  }, 15000);

  it('gives pass the same weight in a group scene', async () => {
    mount({ setup: setup({ rosterIds: ROOM }) });
    await liveChips();

    const pass = screen.getByRole('button', { name: /vn\.pass/ });
    expect(pass.className).toMatch(/border/);
    expect(pass.className).toMatch(/min-h-11/);
  }, 15000);

  it('does not offer pass in a one-to-one scene, where there is no room to carry it', async () => {
    mount();
    await liveChips();
    expect(screen.queryByRole('button', { name: /vn\.pass/ })).toBeNull();
  }, 15000);

  it('offers nothing to give when the scene was handed no openers', async () => {
    mount({ openers: null });
    await liveChips();
    expect(giveButton()).toBeNull();
  }, 15000);

  /**
   * Read her and the turn counter deliberately stay in the thin row: neither
   * ends the turn, and the split is the information.
   */
  it('leaves read her where it was', async () => {
    mount();
    await liveChips();

    const read = screen.getByRole('button', { name: /vn\.readHer/ });
    expect(read.className).not.toMatch(/min-h-11/);
  }, 15000);
});

describe('the sheet opens over the scene, not in front of it', () => {
  it('is not on screen until the player asks for it', async () => {
    mount();
    await liveChips();
    expect(screen.queryByText('gift.title')).toBeNull();
  }, 15000);

  it('opens on the control and closes again without spending anything', async () => {
    const api = openers();
    mount({ openers: api });
    await liveChips();

    await userEvent.click(giveButton());
    expect(screen.getByText('gift.title')).toBeTruthy();

    await userEvent.click(screen.getByText('gift.skip'));
    await waitFor(() => expect(screen.queryByText('gift.title')).toBeNull());
    expect(api.given).toHaveLength(0);
  }, 15000);
});

describe('handing something over is a turn', () => {
  it('puts the note in the prompt and lets her answer it', async () => {
    const seen = [];
    const client = scripted((messages) => {
      seen.push(messages.at(-1).content);
      return BEAT('irene');
    });

    mount({ client });
    await liveChips();
    await userEvent.click(giveButton());

    const rose = await screen.findByText('gift.rose');
    await userEvent.click(rose);

    await waitFor(() => expect(seen.some((c) => /handed Irene a rose/.test(c))).toBe(true), {
      timeout: 10000,
    });
  }, 15000);

  it('costs a turn, the same as saying something', async () => {
    mount();
    await liveChips();

    const before = screen.getByText(/vn\.turnsLeft/).textContent;
    await userEvent.click(giveButton());
    await userEvent.click(await screen.findByText('gift.rose'));

    await waitFor(
      () => expect(screen.getByText(/vn\.turnsLeft/).textContent).not.toBe(before),
      { timeout: 10000 },
    );
  }, 15000);

  /**
   * A spend App refuses - an opener that stopped being affordable between the
   * sheet opening and the tap - costs the player a tap and not a turn. It must
   * not send a turn carrying no note.
   */
  it('spends nothing at all when the purchase is refused', async () => {
    const seen = [];
    const client = scripted((messages) => {
      seen.push(messages.at(-1).content);
      return BEAT('irene');
    });

    mount({ client, openers: openers({ give: () => null }) });
    await liveChips();

    const before = seen.length;
    await userEvent.click(giveButton());
    await userEvent.click(await screen.findByText('gift.rose'));

    expect(seen).toHaveLength(before);
    // and the sheet stays open, so the player can pick something else
    expect(screen.getByText('gift.title')).toBeTruthy();
  }, 15000);
});

/**
 * "Allow player to choose character first."
 *
 * The old modal asked at the door, which in a group scene meant choosing before
 * seeing the room. Asking inside the scene means the question can default to
 * the person the player is already talking to - so most of the time there is
 * nothing to choose, and changing it is one tap.
 */
describe('choosing who, in a room with more than one of them', () => {
  const group = () => setup({ rosterIds: ROOM });

  it('offers no choice at all when there is only one of her', async () => {
    mount();
    await liveChips();
    await userEvent.click(giveButton());
    expect(screen.queryByText('gift.who')).toBeNull();
  }, 15000);

  it('asks who, and starts on whoever the player is already talking to', async () => {
    mount({ setup: group() });
    await liveChips();
    await userEvent.click(giveButton());

    expect(screen.getByText('gift.who')).toBeTruthy();
    const chosen = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('aria-pressed') === 'true');
    expect(chosen.textContent).toContain('Irene');
  }, 15000);

  /**
   * And handing it to somebody else MOVES the addressee, because a gift is a
   * way of addressing somebody (section 10c). Choosing her here and then still
   * talking to the last person would be two answers to the same question.
   */
  it('turns to whoever was given to, so she is the one who answers', async () => {
    const seen = [];
    const client = scripted((messages) => {
      seen.push(messages.at(-1).content);
      return BEAT('nana');
    });

    mount({ setup: group(), client });
    await liveChips();
    await userEvent.click(giveButton());

    const toNana = screen
      .getAllByRole('button')
      .find((b) => /Nana/.test(b.textContent ?? '') && b.hasAttribute('aria-pressed'));
    await userEvent.click(toNana);
    await userEvent.click(await screen.findByText('gift.rose'));

    await waitFor(() => expect(seen.some((c) => /handed Nana a rose/.test(c))).toBe(true), {
      timeout: 10000,
    });

    // The next ordinary turn goes to her too - the addressee moved and stayed.
    await liveChips();
    await userEvent.click((await liveChips())[0]);
    await waitFor(() => expect(seen.some((c) => c.includes('(to Nana)'))).toBe(true), {
      timeout: 10000,
    });
  }, 20000);
});
