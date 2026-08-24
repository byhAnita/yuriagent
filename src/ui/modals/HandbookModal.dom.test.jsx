/** @vitest-environment jsdom */
/**
 * The handbook. CLAUDE.md section 7, PROPOSALS 20 (c) step 5.
 *
 * Canon reaches the model through block 4. Without this it reaches the player
 * through nothing, which is the exact failure pillar 4 exists to forbid -
 * *memory that shows in mechanics, not only in prose*. So the assertions here
 * are about what the player can actually see, and the sharpest one is the
 * language: a `zh` player must not read their own campaign in English.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import HandbookModal from './HandbookModal.jsx';
import en from '../../i18n/en.js';

afterEach(cleanup);

const t = (k) => k.split('.').reduce((o, part) => o?.[part], en) ?? k;

const entry = (topic, text, display, cycle) => ({
  topic,
  text,
  display,
  cycle,
  phase: 'prep',
  slot: 'event_a',
});

const mount = (canon) =>
  render(<HandbookModal canon={canon} onClose={() => {}} t={t} />);

describe('what the campaign decided, on screen', () => {
  it('lists a decision', () => {
    mount([entry('title_track', 'the title track is Surfin Summer', '', 0)]);
    expect(screen.getByText(/Surfin Summer/)).toBeTruthy();
  });

  /**
   * THE POINT OF THE SECOND STRING. Memory is English so a language switch
   * cannot corrupt a run (section 19 rule 2) - which means without `display`
   * the handbook would show a Chinese player their own campaign in English.
   * Section 12 made this exact mistake once with `learnableFacts`.
   */
  it('shows the player-facing text, never the prompt text', () => {
    mount([entry('title_track', 'the English one', 'the player-facing one', 0)]);

    expect(screen.getByText('the player-facing one')).toBeTruthy();
    expect(screen.queryByText('the English one')).toBeNull();
  });

  /** The wrong language still beats a blank line. */
  it('falls back to the English when the model gave no display string', () => {
    mount([entry('title_track', 'the English one', '', 0)]);
    expect(screen.getByText('the English one')).toBeTruthy();
  });

  /**
   * Grouped by cycle and newest first: the last thing decided is the thing the
   * group is currently living with, and a nine-week campaign's handbook is
   * otherwise a wall of sentences with no shape.
   */
  it('groups by cycle, most recent first', () => {
    mount([
      entry('concept', 'the first concept', 'the first concept', 0),
      entry('concept', 'the second concept', 'the second concept', 1),
    ]);

    const text = document.body.textContent ?? '';
    expect(text.indexOf('the second concept')).toBeLessThan(text.indexOf('the first concept'));
  });

  /**
   * A campaign in its first week has decided nothing, and the empty panel is
   * the only thing that tells the player where these lines will come from.
   */
  it('explains itself before anything has been decided', () => {
    mount([]);
    expect(screen.getByText(en.handbook.empty)).toBeTruthy();
    expect(screen.queryByText(/Cycle/)).toBeNull();
  });

  it('keeps a topic settled twice, because storage never compacts', () => {
    mount([
      entry('concept', 'a', 'the first answer', 0),
      entry('concept', 'b', 'the second answer', 1),
    ]);

    expect(screen.getByText('the first answer')).toBeTruthy();
    expect(screen.getByText('the second answer')).toBeTruthy();
  });
});
