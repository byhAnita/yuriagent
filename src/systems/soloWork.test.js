import { describe, it, expect } from 'vitest';
import {
  learnableTargets,
  resolveSoloAction,
  soloLedgerText,
  applySoloPlayerDelta,
  goodwillTargets,
} from './soloWork.js';
import { actionsFor, SOLO_ACTIONS } from '../data/soloActions.js';
import { newMemory, addDossierEntry } from '../agent/memory.js';
import { getCast } from '../data/cast.js';
import { LOCATIONS } from '../data/locations.js';
import { KNOWLEDGE_GIFTS } from '../data/gifts.js';
import { isUnlocked } from './economy.js';
import { makeRng } from './rng.js';

const cards = getCast();
const castIds = cards.map((c) => c.id);
const fresh = () => newMemory(castIds).dossier;

describe('the action table', () => {
  it('only references locations that exist', () => {
    for (const id of Object.keys(SOLO_ACTIONS)) expect(LOCATIONS[id]).toBeDefined();
  });

  it('gives every location the player can stand in something to do', () => {
    for (const id of ['wardrobe', 'corridor', 'practice_room', 'cafe', 'dorm_player_room']) {
      expect(actionsFor(id).length).toBeGreaterThan(0);
    }
  });

  it('has no action that is free of cost and pure profit', () => {
    for (const list of Object.values(SOLO_ACTIONS)) {
      for (const a of list) {
        const gains = (a.credits ?? 0) + (a.competence ?? 0);
        const costs = -(a.energy ?? 0) - (a.secrecy ?? 0);
        expect(gains <= 0 || costs > 0 || a.rest).toBe(true);
      }
    }
  });
});

describe('learnableTargets', () => {
  it('offers every member while nothing is known', () => {
    expect(learnableTargets(cards, fresh())).toHaveLength(cards.length);
  });

  it('stops offering a member once you know everything about her', () => {
    let d = fresh();
    const irene = cards.find((c) => c.id === 'irene');
    for (const fact of irene.learnableFacts) {
      d = addDossierEntry(d, 'irene', 'known_facts', fact);
    }
    expect(learnableTargets(cards, d).map((t) => t.card.id)).not.toContain('irene');
  });

  it('never offers someone who is standing right there', () => {
    const out = learnableTargets(cards, fresh(), ['irene', 'nana']);
    expect(out.map((t) => t.card.id)).toEqual(['jisoo', 'hyewon', 'yeri']);
  });
});

describe('resolveSoloAction', () => {
  it('returns null for an action that does not belong to the room', () => {
    expect(
      resolveSoloAction({ locationId: 'cafe', actionId: 'read_fitting_notes', cards, dossier: fresh() }),
    ).toBeNull();
  });

  it('pays out the plain work action', () => {
    const out = resolveSoloAction({
      locationId: 'wardrobe',
      actionId: 'prep_fittings',
      cards,
      dossier: fresh(),
      rng: makeRng(1),
    });
    expect(out.playerDelta.credits).toBe(2);
    expect(out.playerDelta.energy).toBeLessThan(0);
    expect(out.learned).toBeNull();
  });

  it('trades secrecy for a fact when you snoop', () => {
    const out = resolveSoloAction({
      locationId: 'wardrobe',
      actionId: 'read_fitting_notes',
      cards,
      dossier: fresh(),
      rng: makeRng(3),
    });
    expect(out.playerDelta.secrecy).toBeLessThan(0);
    expect(out.learned).not.toBeNull();
    expect(out.dossierAdd[0].category).toBe('known_facts');
  });

  it('does not charge secrecy for a search that found nothing', () => {
    let d = fresh();
    for (const c of cards) {
      for (const fact of c.learnableFacts ?? []) {
        d = addDossierEntry(d, c.id, 'known_facts', fact);
      }
    }
    const out = resolveSoloAction({
      locationId: 'wardrobe',
      actionId: 'read_fitting_notes',
      cards,
      dossier: d,
      rng: makeRng(3),
    });
    expect(out.learned).toBeNull();
    expect(out.playerDelta.secrecy).toBe(0);
  });

  it('is reproducible from a seed', () => {
    const run = () =>
      resolveSoloAction({
        locationId: 'corridor',
        actionId: 'overhear',
        cards,
        dossier: fresh(),
        rng: makeRng(99),
      }).learned;
    expect(run()).toEqual(run());
  });

  it('marks the rest action so the day loop can treat it as sleep', () => {
    const out = resolveSoloAction({
      locationId: 'dorm_player_room',
      actionId: 'sleep_it_off',
      cards,
      dossier: fresh(),
      rng: makeRng(1),
    });
    expect(out.rest).toBe(true);
    expect(out.playerDelta.energy).toBeGreaterThan(0);
  });
});

describe('snooping actually opens a gift', () => {
  it('a learned fact unlocks the knowledge gift that matches it', () => {
    let d = fresh();
    let unlockedAny = false;

    for (let seed = 1; seed < 40 && !unlockedAny; seed++) {
      const out = resolveSoloAction({
        locationId: 'wardrobe',
        actionId: 'read_fitting_notes',
        cards,
        dossier: d,
        rng: makeRng(seed),
      });
      if (!out.learned) break;
      d = addDossierEntry(d, out.learned.memberId, 'known_facts', out.learned.fact);
      unlockedAny = KNOWLEDGE_GIFTS.some((g) => isUnlocked(g, d[out.learned.memberId]));
    }

    expect(unlockedAny).toBe(true);
  });
});

describe('soloLedgerText', () => {
  it('writes what was learned, in English, naming her', () => {
    const out = resolveSoloAction({
      locationId: 'corridor',
      actionId: 'overhear',
      cards,
      dossier: fresh(),
      rng: makeRng(5),
    });
    const line = soloLedgerText(out, { locationLabel: 'the corridor' });
    expect(line).toContain(out.learned.name);
    expect(line).toContain(out.learned.fact);
  });

  it('has a line for plain work and for sleep', () => {
    const work = resolveSoloAction({
      locationId: 'practice_room',
      actionId: 'tidy_room',
      cards,
      dossier: fresh(),
      rng: makeRng(1),
    });
    expect(soloLedgerText(work, { locationLabel: 'the practice room' })).toContain('worked alone');

    const sleep = resolveSoloAction({
      locationId: 'dorm_player_room',
      actionId: 'sleep_it_off',
      cards,
      dossier: fresh(),
      rng: makeRng(1),
    });
    expect(soloLedgerText(sleep, {})).toContain('slept');
  });
});

describe('applySoloPlayerDelta', () => {
  const player = { credits: 3, competence: 20, energy: 50, secrecy: 70 };

  it('applies every field and clamps', () => {
    const out = applySoloPlayerDelta(player, { credits: -2, competence: 1, energy: -4, secrecy: -5 });
    expect(out).toMatchObject({ credits: 1, competence: 21, energy: 46, secrecy: 65 });
  });

  it('never lets credits or secrecy go negative', () => {
    const out = applySoloPlayerDelta(player, { credits: -99, secrecy: -999 });
    expect(out.credits).toBe(0);
    expect(out.secrecy).toBe(0);
  });
});

describe('goodwillTargets', () => {
  it('names everyone standing where the kindness happened', () => {
    const occupancy = {
      irene: { locationId: 'cafe' },
      nana: { locationId: 'cafe' },
      jisoo: { locationId: 'drama_set' },
      hyewon: { locationId: 'dorm_living' },
      yeri: { locationId: 'dorm_living' },
    };
    expect(goodwillTargets(cards, occupancy, 'cafe').sort()).toEqual(['irene', 'nana']);
  });
});

/**
 * Which fact you learn, and about whom, has to move between runs.
 *
 * Reported from play: "we always get jisoo annotated script for jisoo, knee
 * injury for hyewon". The rng was never the problem - both picks were already
 * random - but every card carried exactly two facts, so each knowledge gift had
 * exactly one possible owner and the whole economy was a fixed lookup.
 */
describe('knowledge is not a fixed lookup', () => {
  it('learns different things about the same member on different seeds', () => {
    const learnedFor = (seed) => {
      const out = resolveSoloAction({
        locationId: 'wardrobe',
        actionId: 'read_fitting_notes',
        cards,
        dossier: fresh(),
        rng: makeRng(seed),
      });
      return out.learned ? `${out.learned.memberId}:${out.learned.fact}` : null;
    };

    const seen = new Set();
    for (let seed = 1; seed <= 40; seed += 1) {
      const got = learnedFor(seed);
      if (got) seen.add(got);
    }
    expect(seen.size).toBeGreaterThan(6);
  });

  it('spreads across members rather than always naming the same one', () => {
    const members = new Set();
    for (let seed = 1; seed <= 40; seed += 1) {
      const out = resolveSoloAction({
        locationId: 'wardrobe',
        actionId: 'read_fitting_notes',
        cards,
        dossier: fresh(),
        rng: makeRng(seed),
      });
      if (out.learned) members.add(out.learned.memberId);
    }
    expect(members.size).toBeGreaterThan(2);
  });
});

/**
 * One gift per fact, one fact per gift. CLAUDE.md sections 11 and 12.
 *
 * Reported as "we always get jisoo annotated script for jisoo". The snoop rng
 * was already even across members and across facts; the economy was a lookup
 * because eight shared objects sat behind two facts per member. Twenty-five
 * facts and twenty-five gifts is what gives the randomness something to do.
 */
describe('every fact buys its own gift', () => {
  const withFacts = cards.filter((c) => (c.learnableFacts ?? []).length > 0);
  const giftsFor = (fact) => KNOWLEDGE_GIFTS.filter((g) => isUnlocked(g, { known_facts: [fact] }));

  it('gives every member five facts', () => {
    for (const card of withFacts) {
      expect(card.learnableFacts.length, card.id).toBe(5);
    }
  });

  it('unlocks exactly one gift per fact - never none, never two', () => {
    for (const card of withFacts) {
      for (const fact of card.learnableFacts) {
        const hits = giftsFor(fact);
        expect(hits.length, `"${fact}" -> [${hits.map((h) => h.id).join(', ')}]`).toBe(1);
      }
    }
  });

  it('leaves no knowledge gift unreachable', () => {
    for (const gift of KNOWLEDGE_GIFTS) {
      const owners = withFacts.filter((c) =>
        c.learnableFacts.some((f) => isUnlocked(gift, { known_facts: [f] })),
      );
      expect(owners.length, `${gift.id} is unreachable`).toBeGreaterThan(0);
    }
  });

  /**
   * Not strict, but strongly preferred: a gift that answers two different
   * members is a gift that says nothing about either of them.
   */
  it('does not hand the same gift to two members', () => {
    for (const gift of KNOWLEDGE_GIFTS) {
      const owners = withFacts
        .filter((c) => c.learnableFacts.some((f) => isUnlocked(gift, { known_facts: [f] })))
        .map((c) => c.id);
      expect(owners.length, `${gift.id} <- ${owners.join(', ')}`).toBe(1);
    }
  });

  it('never repeats a fact across the cast', () => {
    const seen = new Map();
    for (const card of withFacts) {
      for (const fact of card.learnableFacts) {
        const key = fact.toLowerCase();
        expect(seen.has(key), `"${fact}" on ${card.id} and ${seen.get(key)}`).toBe(false);
        seen.set(key, card.id);
      }
    }
  });

  /** Which gift opens has to depend on what you turned up, not on who she is. */
  it('leaves every member several different gifts to reach', () => {
    for (const card of withFacts) {
      const reachable = new Set(card.learnableFacts.flatMap((f) => giftsFor(f).map((g) => g.id)));
      expect(reachable.size, card.id).toBeGreaterThan(2);
    }
  });
});
