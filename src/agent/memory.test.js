import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  newMemory,
  newDossier,
  appendLedger,
  renderLedger,
  willCompact,
  addDossierEntry,
  commitSummary,
  entryText,
} from './memory.js';
import { LEDGER_FULL_MAX, DOSSIER_CAPS } from '../config/constants.js';

/** Dossier entries are objects now; the tests below care about the English. */
const texts = (list) => list.map(entryText);

const entry = (n) => ({ id: `s${n}`, week: 0, day: n, block: 'morning', text: `full text ${n}`, summary: `sum ${n}` });

describe('ledger compaction', () => {
  it('keeps entries full until the cap', () => {
    let ledger = [];
    for (let i = 0; i < LEDGER_FULL_MAX; i++) ledger = appendLedger(ledger, entry(i));
    expect(ledger.every((e) => e.type === 'full')).toBe(true);
  });

  it('collapses older entries IN PLACE, never reordering or deleting', () => {
    let ledger = [];
    for (let i = 0; i <= LEDGER_FULL_MAX; i++) ledger = appendLedger(ledger, entry(i));

    expect(ledger).toHaveLength(LEDGER_FULL_MAX + 1);
    expect(ledger.map((e) => e.id)).toEqual(
      Array.from({ length: LEDGER_FULL_MAX + 1 }, (_, i) => `s${i}`),
    );
    expect(ledger.slice(0, -1).every((e) => e.type === 'summary')).toBe(true);
    expect(ledger.at(-1).type).toBe('full');
  });

  it('replaces the collapsed text with the summary', () => {
    let ledger = [];
    for (let i = 0; i <= LEDGER_FULL_MAX; i++) ledger = appendLedger(ledger, entry(i));
    expect(renderLedger(ledger)).toContain('sum 0');
    expect(renderLedger(ledger)).not.toContain('full text 0');
  });

  it('announces the miss before it happens', () => {
    let ledger = [];
    for (let i = 0; i < LEDGER_FULL_MAX - 1; i++) ledger = appendLedger(ledger, entry(i));
    expect(willCompact(ledger)).toBe(false);
    ledger = appendLedger(ledger, entry(99));
    expect(willCompact(ledger)).toBe(true);
  });

  it('keeps the rendered prefix stable between compactions', () => {
    let ledger = [];
    for (let i = 0; i < LEDGER_FULL_MAX - 1; i++) ledger = appendLedger(ledger, entry(i));

    const before = renderLedger(ledger);
    expect(willCompact(ledger)).toBe(false);

    const after = renderLedger(appendLedger(ledger, entry(50)));
    expect(after.startsWith(before)).toBe(true);
  });

  it('never grows unbounded in full entries', () => {
    let ledger = [];
    for (let i = 0; i < 40; i++) ledger = appendLedger(ledger, entry(i));
    expect(ledger.filter((e) => e.type === 'full').length).toBeLessThanOrEqual(LEDGER_FULL_MAX);
    expect(ledger).toHaveLength(40);
  });

  it('has something to say on an empty run', () => {
    expect(renderLedger([])).toBe('Nothing has happened yet.');
  });
});

describe('dossier', () => {
  const base = () => newMemory(['irene', 'nana']).dossier;

  it('starts with every category present and empty', () => {
    for (const list of Object.values(newDossier())) expect(list).toEqual([]);
  });

  it('caps each category and drops the oldest', () => {
    let d = base();
    for (let i = 0; i < DOSSIER_CAPS.facts + 3; i++) {
      d = addDossierEntry(d, 'irene', 'facts', `fact ${i}`);
    }
    expect(d.irene.facts).toHaveLength(DOSSIER_CAPS.facts);
    expect(texts(d.irene.facts)).not.toContain('fact 0');
    expect(entryText(d.irene.facts.at(-1))).toBe(`fact ${DOSSIER_CAPS.facts + 2}`);
  });

  it('moves a repeated fact to the end rather than storing it twice', () => {
    let d = base();
    d = addDossierEntry(d, 'irene', 'facts', 'hates cold hands');
    d = addDossierEntry(d, 'irene', 'facts', 'reads before sleep');
    d = addDossierEntry(d, 'irene', 'facts', 'Hates Cold Hands');

    expect(texts(d.irene.facts)).toEqual(['reads before sleep', 'Hates Cold Hands']);
  });

  it('keeps rumors FIFO because repetition is meaningful there', () => {
    let d = base();
    d = addDossierEntry(d, 'irene', 'heard_about', 'you heard about the cafe');
    d = addDossierEntry(d, 'irene', 'heard_about', 'you heard about the cafe');
    expect(d.irene.heard_about).toHaveLength(2);
  });

  it('ignores empty text', () => {
    const d = addDossierEntry(base(), 'irene', 'facts', '   ');
    expect(d.irene.facts).toHaveLength(0);
  });

  it('rejects an unknown category rather than silently dropping it', () => {
    expect(() => addDossierEntry(base(), 'irene', 'nonsense', 'x')).toThrow();
  });

  /**
   * THREE CATEGORIES, AND THEY ARE THE ONES TIER 3 ACTUALLY READS.
   *
   * Asserted against `tiers.js` source rather than against a list written out
   * here, because a list written out here is precisely what let the two drift.
   * `memory.js` wrote `known_facts` and `player_told_her` for a whole milestone
   * while `tiers.js` read `facts` and `told_her` - so every fact a snoop awarded
   * went into a key the prompt pipeline never looked at, and the knowledge
   * economy reached the model through `heard_about` and nothing else.
   *
   * Every test passed throughout, because every test asked `memory.js` what it
   * had just written. Both halves correct, the join one word wrong in each of
   * two places: the fourth instance of this project's signature bug. This is the
   * assertion that makes the join a thing which can fail.
   */
  it('names its categories the way the prompt tail reads them', () => {
    const tiers = readFileSync(new URL('./tiers.js', import.meta.url), 'utf8');
    const tail = tiers.slice(tiers.indexOf('const known = ['));

    expect(Object.keys(DOSSIER_CAPS).sort()).toEqual(['facts', 'heard_about', 'told_her']);
    for (const category of Object.keys(DOSSIER_CAPS)) {
      expect(tail, category).toContain(`d.${category}`);
    }
  });
});

describe('commitSummary', () => {
  it('applies the ledger entry and the dossier changes together', () => {
    const memory = newMemory(['irene']);

    const next = commitSummary(memory, {
      entry: { id: 's1', week: 0, day: 0, block: 'evening', text: 'They talked.', summary: 'Talked.' },
      dossierAdd: [{ memberId: 'irene', category: 'facts', text: 'hates cold hands' }],
    });

    expect(next.ledger).toHaveLength(1);
    expect(texts(next.dossier.irene.facts)).toContain('hates cold hands');
  });

  it('leaves memory intact when the summarizer returned nothing usable', () => {
    const memory = newMemory(['irene']);
    const next = commitSummary(memory, { entry: null, dossierAdd: [] });
    expect(next.ledger).toHaveLength(0);
  });

  it('skips malformed dossier entries without throwing', () => {
    const memory = newMemory(['irene']);
    expect(() =>
      commitSummary(memory, {
        entry: null,
        dossierAdd: [{ memberId: null }, { category: 'facts' }, null],
      }),
    ).not.toThrow();
  });
});
