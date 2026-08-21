import { describe, it, expect } from 'vitest';
import {
  openScene,
  appendTurn,
  appendSystemNote,
  requestThought,
  buildMessages,
  prefixOf,
  buildSystemBlock,
  cardForPrompt,
} from './promptBuilder.js';
import { newMemory, appendLedger, addDossierEntry } from './memory.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { newRelation } from '../systems/relationship.js';
import { READ_HER_USES_PER_SCENE } from '../config/constants.js';

const cards = getCast();
const lineup = buildLineup(cards);
const castIds = cards.map((c) => c.id);

function baseArgs(overrides = {}) {
  const memory = newMemory(castIds);
  return {
    cards,
    lineup,
    identity: { promptRole: 'an artist assistant at the agency' },
    player: { name: 'Yuhan', energy: 80 },
    lang: 'en',
    memory,
    relations: Object.fromEntries(castIds.map((id) => [id, newRelation(5)])),
    scene: {
      rosterIds: ['irene'],
      focusId: 'irene',
      week: 0,
      day: 1,
      block: 'evening',
      phase: 'prep',
      locationLabel: 'X Practice Room',
      exposure: 20,
    },
    ...overrides,
  };
}

describe('block 1: the static system block', () => {
  const system = buildSystemBlock({
    cards,
    lineup,
    identity: { promptRole: 'an artist assistant' },
    playerName: 'Yuhan',
    lang: 'en',
  });

  it('is large enough for automatic prefix caching to engage', () => {
    // ~4 chars per token; the threshold is 1024 tokens (section 8, invariant 4)
    expect(system.length / 4).toBeGreaterThan(1024);
  });

  it('never leaks a real group name into the prompt', () => {
    for (const forbidden of ['Red Velvet', 'BLACKPINK', 'IZ*ONE', 'After School']) {
      expect(system).not.toContain(forbidden);
    }
  });

  it('carries the language directive and keeps machine tokens English', () => {
    const zh = buildSystemBlock({ cards, lineup, playerName: 'Y', lang: 'zh' });
    expect(zh).toContain('Simplified Chinese');
    expect(zh).toContain('remain ASCII English');
    expect(zh).toContain('@<speaker_id>|<emotion>|guard');
  });

  it('is byte-identical for the same run regardless of language of play', () => {
    const a = buildSystemBlock({ cards, lineup, playerName: 'Y', lang: 'en' });
    const b = buildSystemBlock({ cards, lineup, playerName: 'Y', lang: 'en' });
    expect(a).toBe(b);
  });

  it('withholds hiddenConflict until jealousy earns it', () => {
    expect(system).not.toContain(cards.find((c) => c.hiddenConflict).hiddenConflict);
  });
});

describe('cardForPrompt', () => {
  it('strips origin and other library-only fields', () => {
    const out = cardForPrompt(cards[0], ['leader']);
    expect(out.origin).toBeUndefined();
    expect(out.portraits).toBeUndefined();
    expect(out.schema).toBeUndefined();
    expect(out.rolesInX).toEqual(['leader']);
  });
});

describe('the freeze rule', () => {
  it('does not change the prefix when live state mutates mid-scene', () => {
    const args = baseArgs();
    const frame = openScene(args);
    const before = prefixOf(frame);

    // Everything a scene does to live state while it is open:
    args.relations.irene.intimacy = 95;
    args.relations.irene.jealousy = 80;
    args.player.energy = 5;
    args.memory.ledger = appendLedger(args.memory.ledger, { text: 'something else happened' });
    args.memory.dossier = addDossierEntry(args.memory.dossier, 'irene', 'known_facts', 'new fact');

    expect(prefixOf(frame)).toBe(before);
    expect(buildMessages(frame)[0].content).toBe(before);
  });

  it('grows only the turns array as a scene proceeds', () => {
    let frame = openScene(baseArgs());
    const prefix = prefixOf(frame);

    for (let i = 0; i < 5; i++) {
      frame = appendTurn(frame, { role: 'user', content: `turn ${i}` });
      expect(prefixOf(frame)).toBe(prefix);
      expect(buildMessages(frame)).toHaveLength(i + 2);
    }
  });

  it('puts a mid-scene gift note at the tail, never in the header', () => {
    const frame = openScene(baseArgs());
    const withGift = appendSystemNote(frame, 'the player gave Irene a hand warmer');

    expect(prefixOf(withGift)).toBe(prefixOf(frame));
    const messages = buildMessages(withGift);
    expect(messages.at(-1).content).toContain('hand warmer');
    expect(messages[0].content).not.toContain('hand warmer');
  });

  it('puts a Read her request at the tail and rations it', () => {
    let frame = openScene(baseArgs());
    const prefix = prefixOf(frame);

    for (let i = 0; i < READ_HER_USES_PER_SCENE; i++) {
      frame = requestThought(frame);
      expect(frame).not.toBeNull();
      expect(prefixOf(frame)).toBe(prefix);
    }
    expect(requestThought(frame)).toBeNull();
  });

  it('freezes the frame object itself', () => {
    const frame = openScene(baseArgs());
    expect(Object.isFrozen(frame)).toBe(true);
  });
});

describe('block 3: dossier roster scoping', () => {
  it('omits an absent member entirely', () => {
    const args = baseArgs();
    args.memory.dossier = addDossierEntry(
      args.memory.dossier,
      'nana',
      'known_facts',
      'does her own makeup',
    );
    args.memory.dossier = addDossierEntry(
      args.memory.dossier,
      'irene',
      'known_facts',
      'hates cold hands',
    );

    const frame = openScene(args);
    expect(frame.dossier).toContain('hates cold hands');
    expect(frame.dossier).not.toContain('does her own makeup');
  });

  it('includes both members of a group scene', () => {
    const args = baseArgs();
    args.scene.rosterIds = ['irene', 'nana'];
    args.memory.dossier = addDossierEntry(args.memory.dossier, 'nana', 'known_facts', 'fact-n');
    args.memory.dossier = addDossierEntry(args.memory.dossier, 'irene', 'known_facts', 'fact-i');

    const frame = openScene(args);
    expect(frame.dossier).toContain('fact-n');
    expect(frame.dossier).toContain('fact-i');
  });
});

describe('block 4: the scene header', () => {
  it('names who is present and states that the others are absent', () => {
    const frame = openScene(baseArgs());
    expect(frame.header).toContain('Irene (irene)');
    expect(frame.header).toContain('Absent');
    expect(frame.header).toContain('Nana');
  });

  it('describes exposure qualitatively rather than as a number', () => {
    const priv = openScene(baseArgs());
    expect(priv.header).toContain('Private');
    expect(priv.header).not.toMatch(/exposure:\s*\d/i);

    const args = baseArgs();
    args.scene.exposure = 85;
    expect(openScene(args).header).toContain('public place');
  });

  it('surfaces jealousy as a state of mind, not a number', () => {
    const args = baseArgs();
    args.relations.irene.jealousy = 35;
    const frame = openScene(args);
    expect(frame.header).toContain('piqued');
    expect(frame.header).not.toContain('35');
  });

  it('states cross-awareness explicitly in a group scene', () => {
    const args = baseArgs();
    args.scene.rosterIds = ['irene', 'nana'];
    args.scene.crossAwareness = ['Irene is aware of and unsettled by your closeness to Nana.'];
    expect(openScene(args).header).toContain('unsettled by your closeness to Nana');
  });
});

describe('buildMessages', () => {
  it('sends blocks 1-4 as a single system message so the prefix hashes as one', () => {
    const frame = appendTurn(openScene(baseArgs()), { role: 'user', content: 'hi' });
    const messages = buildMessages(frame);
    expect(messages[0].role).toBe('system');
    expect(messages.filter((m) => m.role === 'system')).toHaveLength(1);
  });
});
