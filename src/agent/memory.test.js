import { describe, it, expect } from 'vitest';
import {
  newMemory,
  newDossier,
  appendLedger,
  renderLedger,
  willCompact,
  addDossierEntry,
  resolveThread,
  renderDossier,
  countOpenThreads,
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
    for (let i = 0; i < DOSSIER_CAPS.known_facts + 3; i++) {
      d = addDossierEntry(d, 'irene', 'known_facts', `fact ${i}`);
    }
    expect(d.irene.known_facts).toHaveLength(DOSSIER_CAPS.known_facts);
    expect(texts(d.irene.known_facts)).not.toContain('fact 0');
    expect(entryText(d.irene.known_facts.at(-1))).toBe(`fact ${DOSSIER_CAPS.known_facts + 2}`);
  });

  it('moves a repeated fact to the end rather than storing it twice', () => {
    let d = base();
    d = addDossierEntry(d, 'irene', 'known_facts', 'hates cold hands');
    d = addDossierEntry(d, 'irene', 'known_facts', 'reads before sleep');
    d = addDossierEntry(d, 'irene', 'known_facts', 'Hates Cold Hands');

    expect(texts(d.irene.known_facts)).toEqual(['reads before sleep', 'Hates Cold Hands']);
  });

  it('keeps rumors FIFO because repetition is meaningful there', () => {
    let d = base();
    d = addDossierEntry(d, 'irene', 'heard_about', 'you heard about the cafe');
    d = addDossierEntry(d, 'irene', 'heard_about', 'you heard about the cafe');
    expect(d.irene.heard_about).toHaveLength(2);
  });

  it('ignores empty text', () => {
    const d = addDossierEntry(base(), 'irene', 'known_facts', '   ');
    expect(d.irene.known_facts).toHaveLength(0);
  });

  it('rejects an unknown category rather than silently dropping it', () => {
    expect(() => addDossierEntry(base(), 'irene', 'nonsense', 'x')).toThrow();
  });

  it('resolves a thread on a loose match', () => {
    let d = base();
    d = addDossierEntry(d, 'irene', 'open_threads', 'she asked if you are free Sunday');
    expect(countOpenThreads(d, 'irene')).toBe(1);

    d = resolveThread(d, 'irene', 'free Sunday');
    expect(countOpenThreads(d, 'irene')).toBe(0);
  });

  it('does not resolve an unrelated thread', () => {
    let d = base();
    d = addDossierEntry(d, 'irene', 'open_threads', 'she asked if you are free Sunday');
    d = resolveThread(d, 'irene', 'the wardrobe order');
    expect(countOpenThreads(d, 'irene')).toBe(1);
  });
});

describe('renderDossier', () => {
  it('renders only the roster', () => {
    let d = newMemory(['irene', 'nana']).dossier;
    d = addDossierEntry(d, 'irene', 'known_facts', 'hates cold hands');
    d = addDossierEntry(d, 'nana', 'known_facts', 'does her own makeup');

    const out = renderDossier(d, ['irene'], (id) => id.toUpperCase());
    expect(out).toContain('IRENE');
    expect(out).toContain('hates cold hands');
    expect(out).not.toContain('makeup');
  });

  it('says something rather than nothing when the dossier is empty', () => {
    expect(renderDossier(newMemory(['irene']).dossier, ['irene'])).toBe(
      'Nothing learned about her yet.',
    );
  });
});

describe('commitSummary', () => {
  it('applies the ledger entry and the dossier changes together', () => {
    let memory = newMemory(['irene']);
    memory.dossier = addDossierEntry(memory.dossier, 'irene', 'open_threads', 'free on Sunday?');

    const next = commitSummary(memory, {
      entry: { id: 's1', week: 0, day: 0, block: 'evening', text: 'They talked.', summary: 'Talked.' },
      dossierAdd: [{ memberId: 'irene', category: 'known_facts', text: 'hates cold hands' }],
      dossierResolve: [{ memberId: 'irene', text: 'Sunday' }],
    });

    expect(next.ledger).toHaveLength(1);
    expect(texts(next.dossier.irene.known_facts)).toContain('hates cold hands');
    expect(next.dossier.irene.open_threads).toHaveLength(0);
  });

  it('leaves memory intact when the summarizer returned nothing usable', () => {
    const memory = newMemory(['irene']);
    const next = commitSummary(memory, { entry: null, dossierAdd: [], dossierResolve: [] });
    expect(next.ledger).toHaveLength(0);
  });

  it('skips malformed dossier entries without throwing', () => {
    const memory = newMemory(['irene']);
    expect(() =>
      commitSummary(memory, {
        entry: null,
        dossierAdd: [{ memberId: null }, { category: 'known_facts' }, null],
      }),
    ).not.toThrow();
  });
});
