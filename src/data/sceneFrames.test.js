import { describe, it, expect } from 'vitest';
import { DATE_FRAMES, PRIVATE_DATE_FRAME, dateFrame, renderFrame } from './sceneFrames.js';
import { PHASES, locationsForRole } from './phaseMaps.js';

describe('every public venue has a frame', () => {
  it('covers the venue of every phase, so no date opens on nothing', () => {
    for (const phase of PHASES) {
      for (const id of locationsForRole(phase, 'public_date')) {
        expect(DATE_FRAMES[id], `${phase} venue ${id} has no frame`).toBeDefined();
      }
    }
  });

  it('gives the private date one frame, because it is the same room every phase', () => {
    expect(dateFrame('private', 'dorm_room')).toBe(PRIVATE_DATE_FRAME);
    expect(dateFrame('private', null)).toBe(PRIVATE_DATE_FRAME);
  });

  it('returns null rather than throwing for a venue with nothing authored', () => {
    expect(dateFrame('public', 'practice_room')).toBeNull();
  });
});

describe('a frame has a spine', () => {
  const frames = [...Object.values(DATE_FRAMES), PRIVATE_DATE_FRAME];

  it('gives every frame a setting and two to four movements', () => {
    for (const f of frames) {
      expect(f.setting.length).toBeGreaterThan(20);
      expect(f.movements.length).toBeGreaterThanOrEqual(2);
      expect(f.movements.length).toBeLessThanOrEqual(4);
    }
  });

  /**
   * The rule from section 11, and the one most likely to be broken by a content
   * edit: a movement sets the SITUATION, never the OUTCOME. "The walk back, and
   * how long it takes" is a place. "She takes your hand on the walk back" is a
   * branch, which section 1 rules out.
   *
   * This is a smell test rather than a proof - it catches the obvious form of
   * the mistake, which is writing her reaction into the frame.
   */
  it('never writes her reaction into a movement', () => {
    const scripted = /\bshe (takes|kisses|blushes|smiles|leans|admits|confesses|cries|says)\b/i;
    for (const f of frames) {
      for (const m of f.movements) {
        expect(scripted.test(m), `scripted movement: "${m}"`).toBe(false);
      }
    }
  });
});

describe('renderFrame', () => {
  const text = renderFrame(PRIVATE_DATE_FRAME);

  it('offers the movements rather than ordering them', () => {
    expect(text).toContain('may pass through any of these, in any order, or none');
  });

  it('says outright that the outcome is not the frame to decide', () => {
    expect(text).toContain('These are situations, not instructions');
  });

  it('never numbers the movements - a numbered list gets marched through', () => {
    expect(text).not.toMatch(/^\s*1[.)]/m);
  });

  it('returns null for no frame rather than an empty block', () => {
    expect(renderFrame(null)).toBeNull();
  });
});

/**
 * The agenda. PROPOSALS 20 (b).
 *
 * A frame with no agenda must render byte-for-byte what it rendered before,
 * because every date in the game has one and the whole argument for keeping
 * ordinary scenes terse rests on them not quietly acquiring a business section.
 */
describe('renderFrame carries the day business, when there is any', () => {
  const withAgenda = {
    ...PRIVATE_DATE_FRAME,
    agenda: [
      { id: 'title_track', text: 'which of the demos is the title track' },
      { id: 'centre', text: 'who takes the centre position' },
    ],
  };

  it('adds nothing at all to a frame without one', () => {
    expect(renderFrame(PRIVATE_DATE_FRAME)).not.toMatch(/settle/i);
    expect(renderFrame({ ...PRIVATE_DATE_FRAME, agenda: [] })).toBe(
      renderFrame(PRIVATE_DATE_FRAME),
    );
  });

  it('lists every item', () => {
    const out = renderFrame(withAgenda);
    for (const item of withAgenda.agenda) expect(out).toContain(item.text);
  });

  /**
   * The id is for the code, not the model. It is what a decision is recorded
   * under and what a later event asks for by name (`systems/canon.js`) - and
   * putting it in the prompt would invite the model to quote a machine token
   * back at the player, which section 9 forbids for the same reason it forbids
   * numbers in prose.
   */
  it('never prints a topic id into block 4', () => {
    const out = renderFrame(withAgenda);
    expect(out).not.toContain('title_track');
    expect(out).not.toContain('centre position:');
  });

  /**
   * The two halves have to read as different KINDS of thing, or the model
   * treats the agenda as four more optional situations and the day goes back to
   * being atmosphere. Movements say "may"; the agenda says "does not end until".
   */
  it('states the agenda as obligation where movements are offered', () => {
    const out = renderFrame(withAgenda);
    expect(out).toContain('may pass through any of these');
    expect(out).toContain('does not end until it has');
  });

  /**
   * A room told to decide four things will otherwise agree pleasantly about
   * all four, which is the same failure as small talk wearing a suit.
   */
  it('says outright that not everything has to go anyone way', () => {
    expect(renderFrame(withAgenda)).toMatch(/nothing was at stake/);
  });

  it('keeps the business below the situations, so salience runs downward', () => {
    const out = renderFrame(withAgenda);
    expect(out.indexOf('here to settle these')).toBeGreaterThan(
      out.indexOf('These are situations, not instructions'),
    );
  });
});

/**
 * `REGISTERS` and the four turn constants are gone with the v1 turn loop, and
 * the register they carried is now `config/rules.js` for every round in the
 * game. What replaces those assertions is the one rule that outlived them:
 * everything in this file is an instruction to a model, so none of it may be
 * localized or shown to a player.
 */
describe('a frame is model-facing English', () => {
  it('keeps every authored frame in ASCII', () => {
    const frames = [PRIVATE_DATE_FRAME, ...Object.values(DATE_FRAMES)];
    for (const frame of frames) {
      const text = [frame.setting, ...frame.movements].join(' ');
      expect(text).toMatch(/^[\x20-\x7E]*$/);
    }
  });
});
