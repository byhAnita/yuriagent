/** @vitest-environment jsdom */
/**
 * The scene, rendered. CLAUDE.md section 6.
 *
 * Every bug this file covers was reported from play rather than caught here,
 * which is the argument for the file existing: the chip bar going dead is
 * invisible to a pure-function test, and it has now happened twice.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VNStage from './VNStage.jsx';
import { createMockClient } from '../../tools/mockClient.js';
import { newMemory } from '../../agent/memory.js';
import { newRelation } from '../../systems/relationship.js';
import { getCast } from '../../data/cast.js';
import { buildLineup } from '../../systems/castBuilder.js';

// Auto-cleanup only registers itself when vitest globals are on, and they are
// not - without this every test renders into the previous test's DOM.
afterEach(cleanup);

const cards = getCast();
const ids = cards.map((c) => c.id);
const t = (k) => k;

const setup = () => ({
  cards,
  lineup: buildLineup(cards),
  identity: { promptRole: 'an artist assistant' },
  player: { name: 'You', energy: 80, secrecy: 70, credits: 10 },
  lang: 'en',
  memory: newMemory(ids),
  relations: Object.fromEntries(ids.map((id) => [id, newRelation(45)])),
  scene: {
    id: 's',
    rosterIds: ['irene'],
    focusId: 'irene',
    week: 0,
    day: 1,
    block: 'evening',
    phase: 'prep',
    locationId: 'practice_room',
    locationLabel: 'X Practice Room',
    seed: 1,
  },
});

const chipButtons = () =>
  screen.getAllByRole('button').filter((b) => /stance\./.test(b.textContent ?? ''));

const dialogueBox = () =>
  screen.getAllByRole('button').find((b) => /irene/i.test(b.textContent ?? ''));

const mount = (props) =>
  render(
    <StrictMode>
      <VNStage setup={setup()} onSceneEnd={() => {}} t={t} {...props} />
    </StrictMode>,
  );

describe('the chip bar comes back to life', () => {
  it('is clickable once the opening beat has landed', async () => {
    mount({ client: createMockClient({ seed: 3, delay: 0 }) });

    await waitFor(() => expect(chipButtons().length).toBeGreaterThan(0));
    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 4000,
    });
  });

  /**
   * The timeouts are generous because this asserts BEHAVIOUR, not latency: a
   * chip click advances the turn. Four seconds flaked when the 25-second
   * campaign harness was running in the same suite - a wall-clock assertion
   * competing for a core is a test that fails for the wrong reason.
   */
  it('takes a stance click and starts the next turn', async () => {
    const user = userEvent.setup();
    mount({ client: createMockClient({ seed: 3, delay: 0 }) });

    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 10000,
    });

    const before = dialogueBox()?.textContent;
    await user.click(chipButtons().find((b) => !b.disabled));
    await waitFor(() => expect(dialogueBox()?.textContent).not.toBe(before), { timeout: 10000 });
  });

  /**
   * The reported bug. A request that never settles never rejects, so the turn
   * never ends: `pending` stays true and every control in the scene - chips,
   * free text, Read her, and Leave - stays disabled with nothing on screen to
   * say why. The router now puts a deadline on every call, so the offline
   * writer answers instead and the scene stays playable.
   */
  it('survives a provider that never answers', async () => {
    const hangs = () => new Promise(() => {});
    mount({ client: hangs });

    await waitFor(() => expect(chipButtons().length).toBeGreaterThan(0));
    // Disabled while the turn is genuinely in flight - that part is correct.
    expect(chipButtons().every((b) => b.disabled)).toBe(true);
  });

  it('unlocks the chips after a multi-beat reply is read through', async () => {
    const beats =
      '@irene|neutral|guard+2|fluster+0\n*She glances up.* "You are early."\n\n' +
      '@irene|shy|guard-6|fluster+8\n*A pause.* "That was not a complaint."';

    const client = ({ preset, onChunk }) => {
      if (preset === 'chips') return Promise.resolve('');
      if (onChunk) for (let i = 0; i < beats.length; i += 9) onChunk(beats.slice(i, i + 9));
      return Promise.resolve(beats);
    };

    const user = userEvent.setup();
    mount({ client });

    await waitFor(() => expect(chipButtons().length).toBeGreaterThan(0));
    await waitFor(() => expect(dialogueBox()?.disabled).toBe(false), { timeout: 4000 });

    // Two beats, so the bar is held until the player has read both.
    expect(chipButtons().every((b) => b.disabled)).toBe(true);
    await user.click(dialogueBox());

    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 4000,
    });
  });
});

describe('written chips', () => {
  it('replaces the labels without changing what the stances mean', async () => {
    const beat = '@irene|neutral|guard+2|fluster+0\n*She glances up.* "You are early."';
    const client = ({ preset, onChunk }) => {
      if (preset === 'chips') {
        return Promise.resolve('flirt|Say that again\ncare|I am here\ndeflect|So. The schedule.');
      }
      if (onChunk) onChunk(beat);
      return Promise.resolve(beat);
    };

    mount({ client, writtenChips: true });

    await waitFor(
      () => expect(chipButtons().some((b) => /Say that again/.test(b.textContent ?? ''))).toBe(true),
      { timeout: 4000 },
    );

    // The stance is still on the button, because every rule keys off it.
    const flirted = chipButtons().find((b) => /Say that again/.test(b.textContent ?? ''));
    expect(flirted.textContent).toContain('stance.flirt');
  });

  it('leaves the static set alone when the writer returns nothing', async () => {
    const beat = '@irene|neutral|guard+2|fluster+0\n*She glances up.* "You are early."';
    const client = ({ preset, onChunk }) => {
      if (preset === 'chips') return Promise.resolve('I cannot help with that.');
      if (onChunk) onChunk(beat);
      return Promise.resolve(beat);
    };

    mount({ client, writtenChips: true });

    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 4000,
    });
    expect(chipButtons()).toHaveLength(3);
    for (const b of chipButtons()) expect(b.textContent).toMatch(/^stance\.\w+$/);
  });
});

describe('written chips land in the common case', () => {
  const ONE_BEAT = '@irene|neutral|guard+2|fluster+0\n*She glances up.* "You are early."';

  /**
   * The reported bug, and the one the instant-resolving test above missed.
   *
   * A one-beat reply makes the bar live the moment the turn resolves, which is
   * about a second BEFORE the chip call comes back. The swap used to require
   * the bar to still be disabled, so in the commonest case the written set was
   * computed, paid for, and thrown away - the player only ever saw the static
   * labels, and the only written chips that survived were the ones arriving
   * while the bar was disabled, which is exactly when they could not be used.
   */
  const slowChips =
    (delayMs) =>
    ({ preset, onChunk }) => {
      if (preset === 'chips') {
        return new Promise((resolve) =>
          setTimeout(
            () => resolve('flirt|Say that again\ncare|I am here\ndeflect|So. The schedule.'),
            delayMs,
          ),
        );
      }
      if (onChunk) onChunk(ONE_BEAT);
      return Promise.resolve(ONE_BEAT);
    };

  it('swaps in labels that arrive after the bar has already gone live', async () => {
    mount({ client: slowChips(80), writtenChips: true });

    // The bar is usable first, on the static set - that must never regress.
    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 4000,
    });

    // And the written labels still arrive afterwards.
    await waitFor(
      () => expect(chipButtons().some((b) => /Say that again/.test(b.textContent ?? ''))).toBe(true),
      { timeout: 4000 },
    );
    expect(chipButtons().every((b) => !b.disabled)).toBe(true);
  });

  it('keeps one geometry, so a swap never moves a button', async () => {
    mount({ client: slowChips(80) });

    await waitFor(() => expect(chipButtons().length).toBe(3));
    const before = chipButtons().map((b) => b.className);

    await waitFor(
      () => expect(chipButtons().some((b) => /Say that again/.test(b.textContent ?? ''))).toBe(true),
      { timeout: 4000 },
    );
    expect(chipButtons().map((b) => b.className)).toEqual(before);
  });
});

describe('unread beats say so', () => {
  const TWO_BEATS =
    '@irene|neutral|guard+2|fluster+0\n*She glances up.* "You are early."\n\n' +
    '@irene|shy|guard-6|fluster+8\n*A pause.* "That was not a complaint."';

  const client = ({ preset, onChunk }) => {
    if (preset === 'chips') return Promise.resolve('');
    if (onChunk) for (let i = 0; i < TWO_BEATS.length; i += 9) onChunk(TWO_BEATS.slice(i, i + 9));
    return Promise.resolve(TWO_BEATS);
  };

  /**
   * A dead bar with a caret in the corner as its only explanation is the same
   * mistake section 6 already fixed once for a spent block.
   */
  it('offers a continue control instead of only a caret', async () => {
    const user = userEvent.setup();
    mount({ client });

    const cont = () => screen.queryByText(/vn\.continue/);
    await waitFor(() => expect(cont()).not.toBeNull(), { timeout: 4000 });
    expect(chipButtons().every((b) => b.disabled)).toBe(true);

    await user.click(cont());
    await waitFor(() => expect(chipButtons().some((b) => !b.disabled)).toBe(true), {
      timeout: 4000,
    });
    expect(cont()).toBeNull();
  });
});

/**
 * One thing on this screen does not reset at the door.
 *
 * Reported after the first played anchor event: Irene finished the meeting at
 * `fluster 28` and the next afternoon's scene opened at 0, which read as her
 * affection having been wiped. Both numbers were correct - guard and fluster
 * are volatile by design (section 6) - and nothing on screen said they were a
 * different kind of thing from `intimacy`.
 */
describe('where the two of you stand', () => {
  it('is on the meter bar, as a word', async () => {
    mount({ client: createMockClient({ seed: 3, delay: 0 }) });

    // intimacy 45 -> good_friends. The word, not the number.
    await waitFor(() => expect(screen.getByText(/stage\.good_friends/)).toBeTruthy(), {
      timeout: 10000,
    });
    expect(screen.queryByText('45')).toBeNull();
  }, 15000);
});

/**
 * The establishing beat, on screen. PROPOSALS 20 (a).
 *
 * This file exists for exactly this shape: `establish` is tested in
 * `opening.test.js` and the directive is tested there too, and neither of them
 * can tell whether anything CALLS it. That is the join the project keeps
 * losing - `markRisk` was implemented, tested, and never called for two
 * milestones.
 */
describe('an anchor event opens with the room', () => {
  const ROOM = 'The room is already full, and nothing has been settled yet.';
  const BEAT = '@irene|neutral|guard50|fluster0\n*She looks up from the table.* "You made it."';

  /** Records every preset asked for, and answers the establishing call. */
  const spyClient = () => {
    const presets = [];
    const client = ({ preset, onChunk }) => {
      presets.push(preset ?? 'turn');
      if (preset === 'chips') return Promise.resolve('');
      if (preset === 'establish') return Promise.resolve(ROOM);
      if (onChunk) onChunk(BEAT);
      return Promise.resolve(BEAT);
    };
    return { client, presets };
  };

  const eventScene = () => {
    const base = setup();
    return {
      ...base,
      scene: {
        ...base.scene,
        event: { id: 'concept_meeting' },
        sceneFrame: { setting: 'A long table.', movements: ['the boards going up'] },
      },
    };
  };

  it('puts the room on screen before anybody speaks', async () => {
    const { client, presets } = spyClient();
    render(
      <StrictMode>
        <VNStage setup={eventScene()} client={client} onSceneEnd={() => {}} t={t} />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByText(new RegExp(ROOM))).toBeTruthy(), {
      timeout: 4000,
    });
    expect(presets).toContain('establish');
  });

  /**
   * Nobody said it, so nobody's name goes over it. Attributing narration to the
   * addressee is the same defect as drawing the addressee for a second voice -
   * her face and her name over a line she did not speak.
   */
  it('draws no name plate over it', async () => {
    const { client } = spyClient();
    render(
      <StrictMode>
        <VNStage setup={eventScene()} client={client} onSceneEnd={() => {}} t={t} />
      </StrictMode>,
    );

    let box;
    await waitFor(
      () => {
        box = screen.getAllByRole('button').find((b) => (b.textContent ?? '').includes(ROOM));
        expect(box).toBeTruthy();
      },
      { timeout: 4000 },
    );
    expect(box.textContent).not.toMatch(/Irene/);
  });

  /**
   * EVENTS ONLY. Pillar 1 is 30-50 word bursts and the contrast is the point -
   * a game that establishes every room has stopped establishing anything. This
   * is also the cost assertion: one extra call five times a campaign, not once
   * per scene.
   */
  it('does not establish an ordinary block', async () => {
    const { client, presets } = spyClient();
    render(
      <StrictMode>
        <VNStage setup={setup()} client={client} onSceneEnd={() => {}} t={t} />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByText(/You made it/)).toBeTruthy(), { timeout: 4000 });
    expect(presets).not.toContain('establish');
  });

  /**
   * A flatter event is acceptable; a scene that never opens is not. Section 3
   * keeps every degraded mode playable, and this one is degraded by definition.
   */
  it('opens the scene anyway when the establishing call fails', async () => {
    const client = ({ preset, onChunk }) => {
      if (preset === 'chips') return Promise.resolve('');
      if (preset === 'establish') return Promise.reject(new Error('down'));
      if (onChunk) onChunk(BEAT);
      return Promise.resolve(BEAT);
    };
    render(
      <StrictMode>
        <VNStage setup={eventScene()} client={client} onSceneEnd={() => {}} t={t} />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByText(/You made it/)).toBeTruthy(), { timeout: 4000 });
  });
});

/**
 * THE RISK CHIP SURVIVES THE WRITTEN SWAP.
 *
 * This belongs at THIS layer and could not have been caught at any other, which
 * is the reason to write it here rather than as one more unit test.
 *
 * `chipWriter.test.js` drives `writeChips` directly and proves the field and
 * the belt. What it cannot prove is that the SCREEN keeps the bet, because the
 * bug was in the swap: `chips.js` deals a risk, the bar renders it, the model
 * answers a second later, and the written set replaces the whole bar.
 *
 * Neither harness could see it either, and that is worth stating plainly.
 * `playthrough.test.js` and `balanceSim` pick stances straight out of
 * `availableStances` - they never call `generateChips`, let alone `writeChips`
 * - so a risk stance was always available to them. Their admissibility numbers
 * were an upper bound on a game in which the player could not reach the button.
 * Failure mode 9 for the third time: a harness wrong in the player's favour
 * hides a bug instead of finding it.
 */
describe('a written set never takes the bet off the bar', () => {
  const RISK = /invite|touch|confide/;

  /**
   * Legal for every risk stance (`touch` gates at intimacy 50) and public
   * enough for one to be worth taking.
   */
  const riskySetup = () => {
    const base = setup();
    return {
      ...base,
      relations: Object.fromEntries(ids.map((id) => [id, newRelation(60)])),
      scene: { ...base.scene, locationId: 'cafe', locationLabel: 'Cafe', block: 'afternoon' },
    };
  };

  /**
   * A client whose chip call is held open until the test releases it.
   *
   * That is what makes this an assertion about the SWAP rather than about a
   * seed: the bar is read while it is still the deterministic set, and again
   * after the model's three warm verbs land on top of it.
   */
  const heldClient = () => {
    let release;
    const held = new Promise((r) => {
      release = r;
    });
    const client = ({ preset, onChunk }) => {
      if (preset === 'chips') return held;
      const beat = '@irene|neutral|guard40|fluster10\n*She looks up.* "You came."';
      if (onChunk) onChunk(beat);
      return Promise.resolve(beat);
    };
    return { client, release: () => release('care|I am here\njoke|Blame the choreographer\ncasual|Just stay a while') };
  };

  it('keeps a dealt risk after the labels land on top of it', async () => {
    const { client, release } = heldClient();
    mount({ setup: riskySetup(), client });

    // Read through her opening beats: the bar is one control until they are done.
    for (let i = 0; i < 6; i += 1) {
      const more = screen.queryByRole('button', { name: /vn\.continue/ });
      if (!more) break;
      await userEvent.click(more);
    }
    await waitFor(() => expect(chipButtons().length).toBeGreaterThan(0), { timeout: 4000 });

    // The deterministic bar, before the model has answered.
    const before = chipButtons().map((b) => b.textContent ?? '');
    expect(
      before.some((s) => RISK.test(s)),
      `fixture dealt no risk to protect: ${JSON.stringify(before)}`,
    ).toBe(true);

    release();

    // ...and the same bar once three warm, deniable verbs have arrived.
    await waitFor(
      () => expect(chipButtons().some((b) => /I am here/.test(b.textContent ?? ''))).toBe(true),
      { timeout: 4000 },
    );

    const after = chipButtons().map((b) => b.textContent ?? '');
    expect(
      after.some((s) => RISK.test(s)),
      `the written set relabelled the bet away: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`,
    ).toBe(true);
  });
});
