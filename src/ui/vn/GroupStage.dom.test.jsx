/** @vitest-environment jsdom */
/**
 * The group scene as the player meets it. Proposal 12, section 14.
 *
 * The engine half is covered in `agent/groupScene.test.js`. This is the join,
 * and the join is the part this project keeps getting wrong: `speaker.js` has
 * been able to pick an addressee and an interjector since M4 and no screen ever
 * asked it to.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VNStage from './VNStage.jsx';
import { newMemory } from '../../agent/memory.js';
import { newRelation } from '../../systems/relationship.js';
import { getCast } from '../../data/cast.js';
import { buildLineup } from '../../systems/castBuilder.js';
import { getIdentity } from '../../data/identities.js';

afterEach(cleanup);

const cards = getCast();
const ids = cards.map((c) => c.id);
const ROOM = ['irene', 'nana', 'jisoo'];
/**
 * Keys, except where the key carries a placeholder the component fills in.
 * A pass-through `t` makes every "turn to {name}" label identical, and the
 * assertions below would then be checking nothing.
 */
const t = (k) => (k === 'vn.turnTo' ? 'turn to {name}' : k);

const BEAT = (who) => `@${who}|neutral|guard50|fluster10\n*She looks up.* "Right."`;

function setup({ rosterIds = ROOM, relations } = {}) {
  return {
    cards,
    lineup: buildLineup(cards),
    identity: getIdentity(),
    player: { name: 'Yuhan', energy: 80, secrecy: 70, credits: 10 },
    lang: 'en',
    memory: newMemory(ids),
    relations: relations ?? Object.fromEntries(ids.map((id) => [id, newRelation(20)])),
    scene: {
      id: 'g1',
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

/** A streaming client, because that is the only path the parser is fed by. */
function scripted(reply) {
  return async ({ preset, messages, onChunk }) => {
    if (preset === 'chips') return '';
    const text = reply(messages);
    onChunk?.(text);
    return text;
  };
}

const mount = (props) =>
  render(<VNStage setup={setup()} onSceneEnd={() => {}} writtenChips={false} t={t} {...props} />);

const turnToButtons = () =>
  screen.getAllByRole('button').filter((b) => /^turn to /.test(b.getAttribute('aria-label') ?? ''));

const chipButtons = () =>
  screen.getAllByRole('button').filter((b) => /stance\./.test(b.textContent ?? ''));

describe('the stage shows the room', () => {
  it('offers everybody else in it as somebody to turn to', async () => {
    mount({ client: scripted(() => BEAT('irene')) });

    await waitFor(() => expect(turnToButtons().length).toBeGreaterThan(0), { timeout: 10000 });

    const labels = turnToButtons().map((b) => b.getAttribute('aria-label'));
    // The addressee is spoken to, not turned to - she is the big portrait.
    expect(labels.some((l) => l.includes('Nana'))).toBe(true);
    expect(labels.some((l) => l.includes('Jisoo'))).toBe(true);
    expect(labels.some((l) => l.includes('Irene'))).toBe(false);
  }, 15000);

  it('shows no row at all in a one-member scene', async () => {
    render(
      <VNStage
        setup={setup({ rosterIds: ['irene'] })}
        client={scripted(() => BEAT('irene'))}
        onSceneEnd={() => {}}
        writtenChips={false}
        t={t}
      />,
    );

    await waitFor(() => expect(chipButtons().length).toBeGreaterThan(0), { timeout: 10000 });
    expect(turnToButtons()).toHaveLength(0);
    expect(screen.queryByText('vn.pass')).toBeNull();
  }, 15000);
});

describe('turning to somebody', () => {
  /**
   * The whole primitive. Who the player is turned to decides who answers, and
   * one tap moves it - which is also what makes attention a visible, priced
   * state rather than something settled at scene exit.
   */
  it('sends the next turn to whoever the player turned to', async () => {
    const seen = [];
    const client = scripted((messages) => {
      seen.push(messages.at(-1).content);
      return BEAT('nana');
    });

    mount({ client });
    await waitFor(() => expect(turnToButtons().length).toBeGreaterThan(0), { timeout: 10000 });

    const toNana = turnToButtons().find((b) => b.getAttribute('aria-label').includes('Nana'));
    await userEvent.click(toNana);

    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 10000,
    });
    await userEvent.click(chipButtons().find((b) => !b.disabled));

    await waitFor(() => expect(seen.some((c) => c.includes('(to Nana)'))).toBe(true), {
      timeout: 10000,
    });
  }, 15000);
});

describe('letting the room carry it', () => {
  it('offers pass in a group scene and spends a turn on it', async () => {
    const seen = [];
    const client = scripted((messages) => {
      seen.push(messages.at(-1).content);
      return BEAT('jisoo');
    });

    mount({ client });
    await waitFor(() => expect(screen.queryByText('vn.pass')).toBeTruthy(), { timeout: 10000 });
    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 10000,
    });

    await userEvent.click(screen.getByText('vn.pass'));

    // The player said nothing, and it is still the player's move that was sent
    // - never a line put in their mouth (pillar 3).
    await waitFor(() => expect(seen.some((c) => c.includes('says nothing'))).toBe(true), {
      timeout: 10000,
    });
  }, 15000);
});

describe('somebody cutting in', () => {
  /**
   * Reaches the screen, which is the assertion that matters: the engine test
   * proves `interject` returns a beat, and this proves a beat it returns is
   * one the player can actually read.
   */
  it('puts the interjection into the beat queue', async () => {
    const relations = Object.fromEntries(
      ids.map((id) => [
        id,
        { ...newRelation(20), ...(id === 'nana' ? { intimacy: 90, jealousy: 85 } : {}) },
      ]),
    );

    const calls = [];
    const client = async ({ preset, messages, onChunk }) => {
      if (preset === 'chips') return '';
      const prompt = messages.at(-1).content;
      calls.push(prompt);
      const text = prompt.includes('write one beat for Nana only')
        ? '@nana|upset|guard30|fluster5\n*She does not look up.* "Sure. Fine."'
        : BEAT('irene');
      onChunk?.(text);
      return text;
    };

    render(
      <VNStage
        setup={setup({ relations })}
        client={client}
        onSceneEnd={() => {}}
        writtenChips={false}
        t={t}
      />,
    );

    await waitFor(
      () => expect(calls.some((c) => c.includes('write one beat for Nana only'))).toBe(true),
      { timeout: 10000 },
    );

    /**
     * And it is READABLE, not merely fetched. Beats are revealed one tap at a
     * time (section 9), so hers waits behind the addressee's until the player
     * reads through - which is correct, and the reason this has to tap rather
     * than look.
     */
    const dialogue = () =>
      screen.getAllByRole('button').find((b) => /looks up|Sure/.test(b.textContent ?? ''));

    await waitFor(() => expect(dialogue()).toBeTruthy(), { timeout: 10000 });
    await userEvent.click(dialogue());

    await waitFor(() => expect(screen.getByText(/Sure\. Fine\./)).toBeTruthy(), { timeout: 10000 });
  }, 15000);

  /**
   * The bar must not look live while she is still being written.
   *
   * `busy` is a ref, so it stopped a second turn starting but the BAR never
   * knew: on any turn where the addressee answered in a single beat, the chips
   * went enabled the instant `pending` cleared - about a second before the
   * second call returned - and every tap in that window vanished. Section 6
   * has learned twice that a control which does nothing has to say why.
   *
   * It was survivable while a second voice was rare. It stopped being
   * survivable when chimes started arriving most turns.
   */
  it('holds the bar, and says why, while somebody else is answering', async () => {
    const relations = Object.fromEntries(
      ids.map((id) => [id, { ...newRelation(40) }]),
    );

    let release;
    const held = new Promise((r) => {
      release = r;
    });

    const client = async ({ preset, messages, onChunk }) => {
      if (preset === 'chips') return '';
      const prompt = messages.at(-1).content;
      // One beat only, so `hasMore` is false and the bar has nothing else
      // holding it - this is the exact shape that used to go live.
      const one = '@irene|neutral|guard50|fluster10\n*She nods.* "Mm."';
      if (/write one beat for/.test(prompt)) {
        await held;
        onChunk?.('@nana|neutral|guard50|fluster5\n*She looks over.* "Wait."');
        return '@nana|neutral|guard50|fluster5\n*She looks over.* "Wait."';
      }
      onChunk?.(one);
      return one;
    };

    render(
      <VNStage
        setup={setup({ relations })}
        client={client}
        onSceneEnd={() => {}}
        writtenChips={false}
        t={t}
      />,
    );

    /**
     * Nobody joins in on the opening beat - one turn of silence is under the
     * bar - so the scene has to get one player turn in first. Which is also
     * the honest shape: this is the second turn of an ordinary group scene.
     */
    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 10000,
    });
    await userEvent.click(chipButtons().find((b) => !b.disabled));

    // The second call is in flight and parked. The bar must be dead AND say so.
    await waitFor(() => expect(screen.queryByText('vn.roomSpeaking')).toBeTruthy(), {
      timeout: 10000,
    });
    expect(chipButtons().every((b) => b.disabled)).toBe(true);

    release();
    await waitFor(() => expect(screen.queryByText('vn.roomSpeaking')).toBeNull(), {
      timeout: 10000,
    });
  }, 20000);

  it('does not fire when nobody has anything at stake', async () => {
    const calls = [];
    const client = scripted((messages) => {
      calls.push(messages.at(-1).content);
      return BEAT('irene');
    });

    mount({ client });
    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 10000,
    });

    expect(calls.every((c) => !c.includes('write one beat for'))).toBe(true);
  }, 15000);
});
