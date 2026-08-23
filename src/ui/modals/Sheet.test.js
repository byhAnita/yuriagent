/**
 * Every modal is a `Sheet`, and this is asserted rather than reviewed.
 *
 * `DateModal` was the one of four hand-rolled sheets with no height cap and no
 * scroll. Because a bottom sheet grows UPWARD, it did not overflow somewhere a
 * scrollbar could rescue it - it went off the top of the screen and took the
 * close button with it, on the longest list in the game (five members times two
 * kinds of date). The run stopped there: no reachable option, no way out.
 *
 * A source-level test rather than a DOM one on purpose. The failure is a modal
 * that never renders through the shared shell at all, and every DOM test would
 * pass on a sheet that looks fine at the three rows the fixture happens to
 * have. What has to be true is structural, so it is checked structurally.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const modals = readdirSync(here).filter(
  (f) => f.endsWith('.jsx') && f !== 'Sheet.jsx' && !f.includes('.test.'),
);

const read = (f) => readFileSync(join(here, f), 'utf8');

describe('the modals', () => {
  it('exist, so this suite is not vacuously green', () => {
    expect(modals.length).toBeGreaterThan(2);
  });

  it.each(modals)('%s builds no shell of its own', (file) => {
    const src = read(file);
    // The tell-tale of a hand-rolled sheet: its own full-screen overlay.
    expect(src).not.toMatch(/fixed inset-0/);
  });

  it.each(modals)('%s renders through Sheet', (file) => {
    const src = read(file);
    expect(src).toMatch(/import Sheet from '\.\/Sheet\.jsx'/);
    expect(src).toMatch(/<Sheet[\s>]/);
  });
});

describe('Sheet itself', () => {
  const src = read('Sheet.jsx');

  it('caps its height and scrolls inside that cap', () => {
    expect(src).toMatch(/max-h-\[\d+dvh\]/);
    expect(src).toMatch(/overflow-y-auto/);
  });

  /**
   * `min-h-0` is load-bearing and looks like noise. A flex child defaults to
   * `min-height: auto` and refuses to shrink below its content, so without it
   * the cap is silently ignored and the sheet grows off screen exactly as
   * before - with the scrollbar never appearing to say so.
   */
  it('lets the scrolling area actually shrink', () => {
    expect(src).toMatch(/min-h-0/);
  });

  /**
   * The header is outside the scroll. The other three modals were bounded and
   * still put their close button inside it, so a long list pushed the way out
   * off-screen until the player thought to scroll up.
   */
  it('keeps the header out of the scrolling area', () => {
    const header = src.indexOf('shrink-0 items-baseline');
    const scroll = src.indexOf('overflow-y-auto');
    expect(header).toBeGreaterThan(-1);
    expect(scroll).toBeGreaterThan(header);
  });

  /**
   * A `fixed` overlay is laid out against the viewport, not against the padded
   * body, so section 20's `--safe-bottom` rule on `body` does not reach it.
   */
  it('insets itself from the home indicator', () => {
    expect(src).toMatch(/--safe-bottom/);
  });
});
