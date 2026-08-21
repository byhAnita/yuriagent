import { describe, it, expect } from 'vitest';
import { parseSummary, toCommit, SUMMARIZER_INSTRUCTION } from './summarizer.js';

const ctx = { rosterIds: ['irene', 'nana'] };

const GOOD = JSON.stringify({
  summary: 'Irene stayed late and let the player fix her mic pack.',
  dossier_add: [{ memberId: 'irene', category: 'known_facts', text: 'hates cold hands' }],
  dossier_resolve: [{ memberId: 'irene', text: 'free on Sunday' }],
});

describe('the four-level fallback', () => {
  it('level 1: clean JSON', () => {
    const out = parseSummary(GOOD, ctx);
    expect(out.level).toBe(1);
    expect(out.summary).toContain('mic pack');
    expect(out.dossierAdd[0].text).toBe('hates cold hands');
    expect(out.dossierResolve[0].memberId).toBe('irene');
  });

  it('level 2: wrapped in a markdown fence', () => {
    const out = parseSummary('```json\n' + GOOD + '\n```', ctx);
    expect(out.level).toBe(2);
    expect(out.dossierAdd).toHaveLength(1);
  });

  it('level 3: regex extraction from something that will not parse', () => {
    const broken = `Here you go:
    {
      "summary": "They argued about the schedule.",
      "dossier_add": [
        { "memberId": "irene", "category": "known_facts", "text": "hates being managed" },
      ],
    }`;
    const out = parseSummary(broken, ctx);
    expect(out.level).toBe(3);
    expect(out.summary).toBe('They argued about the schedule.');
    expect(out.dossierAdd[0].text).toBe('hates being managed');
  });

  it('level 4: safe defaults, and never a crash', () => {
    for (const junk of ['', null, undefined, 'I cannot do that.', '{{{{']) {
      const out = parseSummary(junk, ctx);
      expect(out.level).toBe(4);
      expect(out.summary.length).toBeGreaterThan(0);
      expect(out.dossierAdd).toEqual([]);
    }
  });

  it('level 4 honours a caller-supplied fallback line', () => {
    const out = parseSummary('garbage', { ...ctx, fallbackSummary: 'They shared a quiet hour.' });
    expect(out.summary).toBe('They shared a quiet hour.');
  });
});

describe('sanitising what the model returned', () => {
  it('drops dossier entries for members who were not in the scene', () => {
    const raw = JSON.stringify({
      summary: 'ok',
      dossier_add: [
        { memberId: 'irene', category: 'known_facts', text: 'in scene' },
        { memberId: 'wendy', category: 'known_facts', text: 'not in scene' },
      ],
    });
    const out = parseSummary(raw, ctx);
    expect(out.dossierAdd).toHaveLength(1);
    expect(out.dossierAdd[0].memberId).toBe('irene');
  });

  it('drops an invented category', () => {
    const raw = JSON.stringify({
      summary: 'ok',
      dossier_add: [{ memberId: 'irene', category: 'secrets', text: 'x' }],
    });
    expect(parseSummary(raw, ctx).dossierAdd).toHaveLength(0);
  });

  it('truncates a summary that ran long', () => {
    const raw = JSON.stringify({ summary: 'x'.repeat(500), dossier_add: [] });
    expect(parseSummary(raw, ctx).summary.length).toBeLessThanOrEqual(200);
  });

  it('caps how many facts one scene can add', () => {
    const raw = JSON.stringify({
      summary: 'ok',
      dossier_add: Array.from({ length: 10 }, (_, i) => ({
        memberId: 'irene',
        category: 'known_facts',
        text: `fact ${i}`,
      })),
    });
    expect(parseSummary(raw, ctx).dossierAdd.length).toBeLessThanOrEqual(3);
  });

  it('survives dossier_add being the wrong type entirely', () => {
    const raw = JSON.stringify({ summary: 'ok', dossier_add: 'nope' });
    expect(parseSummary(raw, ctx).dossierAdd).toEqual([]);
  });
});

describe('the instruction', () => {
  it('demands English memory regardless of the language of play', () => {
    expect(SUMMARIZER_INSTRUCTION).toContain('ENGLISH');
  });

  it('does not ask the model for macro deltas', () => {
    for (const forbidden of ['intimacy', 'admissibility', 'strain', 'jealousy']) {
      expect(SUMMARIZER_INSTRUCTION.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe('toCommit', () => {
  it('shapes a parsed summary for memory.commitSummary', () => {
    const parsed = parseSummary(GOOD, ctx);
    const commit = toCommit(parsed, { week: 1, day: 3, block: 'evening', id: 's7' });
    expect(commit.entry).toMatchObject({ id: 's7', week: 1, day: 3, block: 'evening' });
    expect(commit.entry.text).toBe(commit.entry.summary);
  });
});
