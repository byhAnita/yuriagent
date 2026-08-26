import { describe, it, expect } from 'vitest';
import {
  learnableTargets,
  availableFinds,
  FACT_WEIGHT,
  RUMOR_WEIGHT,
  resolveSoloAction,
  soloLedgerText,
  applySoloPlayerDelta,
  goodwillTargets,
  routineKey,
  ROUTINE_WEIGHT,
} from './soloWork.js';
import { roomRoutine } from './calendar.js';
import { actionsFor, SOLO_ACTIONS } from '../data/soloActions.js';
import { newMemory, addDossierEntry, entryText } from '../agent/memory.js';
import { getCast } from '../data/cast.js';
import { LOCATIONS } from '../data/locations.js';
import { makeRng } from './rng.js';
import { factCanonical } from '../data/facts.js';

/** A dossier entry shaped the way a snoop writes one: English plus the id. */
const snooped = (id) => ({ text: factCanonical(id), factId: id });

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
      d = addDossierEntry(d, 'irene', 'facts', snooped(fact));
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
    expect(out.dossierAdd[0].category).toBe('facts');
  });

  it('does not charge secrecy for a search that found nothing', () => {
    let d = fresh();
    for (const c of cards) {
      for (const fact of c.learnableFacts ?? []) {
        d = addDossierEntry(d, c.id, 'facts', snooped(fact));
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

/**
 * WHAT A SNOOP IS WORTH, NOW THAT NOTHING IS GATED. Part I.10.
 *
 * This used to assert that a learned fact unlocked the knowledge gift matching
 * it - the payoff was an item in a shop. Gifts are ungated, so the payoff is
 * the only one that was ever interesting: the fact reaches the model, in her
 * dossier, in the block it reads before writing her next line.
 *
 * The category is asserted rather than assumed, because the category name is
 * where this exact join broke once already: `memory.js` wrote `known_facts`
 * while `tiers.js` read `facts`, so every fact a snoop awarded landed
 * somewhere the prompt never looked. `agent/memory.test.js` holds the other
 * half of that assertion.
 */
describe('a snoop writes where the prompt reads', () => {
  it('awards the fact into the category tier 3 renders', () => {
    let d = fresh();
    let learned = null;

    for (let seed = 1; seed < 40 && !learned; seed++) {
      const out = resolveSoloAction({
        locationId: 'wardrobe',
        actionId: 'read_fitting_notes',
        cards,
        dossier: d,
        rng: makeRng(seed),
      });
      if (out.learned) learned = out.learned;
    }

    expect(learned).toBeTruthy();
    for (const add of [learned]) {
      d = addDossierEntry(d, add.memberId, 'facts', add.fact);
    }
    expect(d[learned.memberId].facts.length).toBe(1);
    expect(entryText(d[learned.memberId].facts[0])).toBeTruthy();
  });

  /** The find carries its id, so the screen can render it in the player's language. */
  it('carries the id alongside the English', () => {
    const out = resolveSoloAction({
      locationId: 'wardrobe',
      actionId: 'read_fitting_notes',
      cards,
      dossier: fresh(),
      rng: makeRng(3),
    });
    expect(out.learned?.fact?.factId ?? out.learned?.factId).toBeTruthy();
  });
});

describe('soloLedgerText', () => {
  it('writes what was learned, in English, naming her', () => {
    // A workroom, because only those teach facts now - the corridor snoop is
    // an overhearing one and turns up rumors, of which a fresh run has none.
    const out = resolveSoloAction({
      locationId: 'practice_room',
      actionId: 'watch_the_playback',
      cards,
      dossier: fresh(),
      rng: makeRng(5),
    });
    const line = soloLedgerText(out, { locationLabel: 'the practice room' });
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
/**
 * An empty room is worth entering almost anywhere.
 *
 * Only three rooms could teach you anything at first, which quietly funnelled
 * the whole knowledge economy through the wardrobe and turned the rest of the
 * map into credit dispensers. What varies room to room is the secrecy price,
 * not whether there is anything to find.
 */
describe('most of the map can teach you something', () => {
  const rooms = Object.entries(SOLO_ACTIONS);

  it('offers a way to learn in all but one room', () => {
    const without = rooms.filter(([, as]) => !as.some((a) => a.learns)).map(([id]) => id);
    expect(without).toEqual(['dorm_player_room']);
  });

  it('charges secrecy for every one of them', () => {
    for (const [room, actions] of rooms) {
      for (const a of actions.filter((x) => x.learns)) {
        expect(a.secrecy, `${room}/${a.id}`).toBeLessThan(0);
        expect(a.energy, `${room}/${a.id}`).toBeLessThan(0);
      }
    }
  });

  /** Where you snoop is a real choice only if the rooms cost different amounts. */
  it('prices the rooms differently', () => {
    const prices = rooms
      .flatMap(([, as]) => as.filter((a) => a.learns).map((a) => a.secrecy));
    expect(new Set(prices).size).toBeGreaterThan(3);
  });

  it('makes the most public room the most expensive to be nosy in', () => {
    const priceOf = (room) =>
      SOLO_ACTIONS[room].find((a) => a.learns).secrecy;
    expect(priceOf('broadcast_studio')).toBeLessThan(priceOf('corridor'));
    expect(priceOf('broadcast_studio')).toBeLessThan(priceOf('dorm_living'));
  });
});

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
 * THE FACT POOL ITSELF. CLAUDE.md section 12.
 *
 * This block used to assert a bijection between facts and gifts - one gift per
 * fact, never none and never two, no gift answering two members. All of that
 * was scaffolding for the `requires` gate, and it went with it (Part I.10).
 *
 * What survives is the half that was always about the CAST rather than the
 * shop, and it is the half that matters more: five facts each, and no two
 * members sharing one. Two members with the same habit is two members with the
 * same character, and that is true whether or not anything is for sale.
 */
describe('the fact pool', () => {
  const withFacts = cards.filter((c) => (c.learnableFacts ?? []).length > 0);

  it('gives every member five facts', () => {
    for (const card of withFacts) {
      expect(card.learnableFacts.length, card.id).toBe(5);
    }
  });

  it('never repeats a fact across the cast', () => {
    const seen = new Map();
    for (const card of withFacts) {
      for (const fact of card.learnableFacts) {
        // The English, not the id. Ids cannot collide inside an object
        // literal; two members with the same habit is the real hazard.
        const key = factCanonical(fact).toLowerCase();
        expect(seen.has(key), `"${fact}" on ${card.id} and ${seen.get(key)}`).toBe(false);
        seen.set(key, card.id);
      }
    }
  });

  /**
   * Every fact must resolve to canonical English, because that English IS what
   * tier 3 prints. A fact that resolves to its own id would put `cold_hands`
   * in front of the model as though it were a sentence.
   */
  it('resolves every fact to English the model can read', () => {
    for (const card of withFacts) {
      for (const fact of card.learnableFacts) {
        const text = factCanonical(fact);
        expect(text, fact).toBeTruthy();
        expect(text, fact).not.toBe(typeof fact === 'string' ? fact : fact.id);
        expect(text.length, fact).toBeGreaterThan(8);
      }
    }
  });
});

/**
 * Rumors as a find.
 *
 * The 25-fact pool empties around week 6 of 9, after which 12-21 of ~40 snoop
 * blocks in a measured campaign returned nothing at all - half the map went
 * back to being a credit dispenser, which is the state section 10b exists to
 * prevent. `heard_about` was already sitting in state and the player had no way
 * to look at it: jealousy was invisible until it had turned into strain.
 */
describe('an empty room can also tell you what she has heard', () => {
  const cards = [
    { id: 'irene', name: 'Irene', learnableFacts: ['hates cold hands'] },
    { id: 'nana', name: 'Nana', learnableFacts: ['drinks five litres of water'] },
  ];
  const blank = { irene: { facts: [] }, nana: { facts: [] } };
  const withRumor = {
    irene: { facts: ['hates cold hands'], heard_about: ['you heard the player was at Cafe with Nana'] },
    nana: { facts: ['drinks five litres of water'] },
  };

  it('offers facts and rumors together', () => {
    const finds = availableFinds({ cards, dossier: withRumor });
    expect(finds.map((f) => f.kind).sort()).toEqual(['rumor']);
  });

  it('weights a fact above a rumor, so the early game teaches facts', () => {
    expect(FACT_WEIGHT).toBeGreaterThan(RUMOR_WEIGHT);
    const finds = availableFinds({ cards, dossier: blank });
    expect(finds.every((f) => f.weight === FACT_WEIGHT)).toBe(true);
  });

  it('never tells you what somebody in the room has heard', () => {
    // Same rule as facts: you do not snoop on a woman standing next to you.
    const finds = availableFinds({ cards, dossier: withRumor, present: ['irene'] });
    expect(finds.every((f) => f.memberId !== 'irene')).toBe(true);
  });

  it('does not turn up the same rumor twice', () => {
    const found = ['you heard the player was at Cafe with Nana'];
    const finds = availableFinds({ cards, dossier: withRumor, foundRumors: found });
    expect(finds.every((f) => f.kind !== 'rumor')).toBe(true);
  });

  it('returns a rumor from a snoop without writing to her dossier', () => {
    // It changes what the PLAYER knows, not what she knows.
    //
    // The SOCIAL room, because that is the only place rumors live now: a
    // room teaches what its slot says it teaches, and the wardrobe is a
    // workroom. See `data/soloCoverage.test.js`.
    const result = resolveSoloAction({
      locationId: 'drink_room',
      actionId: 'linger_by_the_urn',
      cards,
      dossier: withRumor,
      rng: () => 0.5,
    });
    expect(result.heard).toMatchObject({
      memberId: 'irene',
      name: 'Irene',
      text: 'you heard the player was at Cafe with Nana',
    });
    /**
     * And the shape it needs to be RENDERED, not just echoed. The dossier line
     * is English on purpose (section 19), so the screen has to rebuild the
     * sentence from `rumorKind` and the ids rather than print the entry.
     */
    expect(result.heard.rumorKind).toBeTruthy();
    expect(result.dossierAdd).toEqual([]);
    expect(result.playerDelta.secrecy).toBe(-3);
  });

  it('re-points the sentence at the player in the ledger', () => {
    const result = {
      heard: { name: 'Irene', text: 'you heard the player was at Cafe with Nana' },
    };
    const line = soloLedgerText(result, { locationLabel: 'Wardrobe Room' });
    expect(line).toContain('Irene has heard the player was at Cafe with Nana');
    expect(line).not.toContain('you heard');
  });

  it('still charges nothing when there is neither a fact nor a rumor left', () => {
    const empty = {
      irene: { facts: ['hates cold hands'] },
      nana: { facts: ['drinks five litres of water'] },
    };
    const result = resolveSoloAction({
      locationId: 'wardrobe',
      actionId: 'read_fitting_notes',
      cards,
      dossier: empty,
      rng: () => 0.5,
    });
    expect(result.learned).toBeNull();
    expect(result.heard).toBeNull();
    expect(result.playerDelta.secrecy).toBe(0);
  });
});

/**
 * ACCESS. CLAUDE.md section 10, Part I.10.
 *
 *   > a fact that tells you where she will be is more interesting than one that
 *   > tells you what to purchase.
 *
 * Section 10 has said that since M1 and it was never true, because a fact could
 * only ever buy an object. Now that gifts are ungated there is nothing left to
 * purchase with one - so the second kind of find is which evenings she is in her
 * own room, and it is the one thing no screen in the game will tell you.
 *
 * The map shows occupancy again after the I.11 reversal, and that does NOT make
 * this redundant: the map says where she is now, a routine says where she will
 * be on an evening nobody has reached yet, and the week grid shows scheduled
 * work slots and never idle ones.
 */
describe('a routine is the other thing a room can teach you', () => {
  const SEED = 4242;
  const clock = { phase: 'prep', week: 0, seed: SEED };
  const routines = (extra = {}) =>
    availableFinds({ cards, dossier: fresh(), ...clock, ...extra }).filter(
      (f) => f.kind === 'routine',
    );

  it('offers one per member, matching what the calendar will actually do', () => {
    const found = routines();
    expect(found).toHaveLength(cards.length);

    for (const find of found) {
      expect(find.nights).toEqual(
        roomRoutine({ cardId: find.memberId, phase: 'prep', seed: SEED, week: 0 }),
      );
      expect(find.nights.length).toBeGreaterThan(0);
    }
  });

  /** Rarer than a fact, dearer than a rumor: five of them against twenty-five. */
  it('sits between the two weights', () => {
    expect(ROUTINE_WEIGHT).toBeGreaterThan(RUMOR_WEIGHT);
    expect(ROUTINE_WEIGHT).toBeLessThan(FACT_WEIGHT);
  });

  it('stops being offered once it is known', () => {
    const first = routines()[0];
    const again = routines({ foundRoutines: [first.routineKey] });

    expect(again.map((f) => f.memberId)).not.toContain(first.memberId);
    expect(again).toHaveLength(cards.length - 1);
  });

  /**
   * Never about somebody standing in the room, the same rule facts and rumors
   * follow - and never about a week she is not home, because `roomRoutine`
   * returns no evenings during COMEBACK and "she is never home this week" is
   * already on a phase table every player can read.
   */
  it('is silent about whoever is in the room, and about comeback week', () => {
    expect(routines({ present: ['irene'] }).map((f) => f.memberId)).not.toContain('irene');
    expect(routines({ phase: 'comeback' })).toHaveLength(0);
  });

  /**
   * A caller with no clock in hand cannot ask about a specific week and must
   * not be handed one at random. Without this the balance harness - and the
   * snoop screen, before it was threaded through - would draw routines for
   * week 0 forever.
   */
  it('is not offered at all to a caller with no clock', () => {
    expect(availableFinds({ cards, dossier: fresh() }).some((f) => f.kind === 'routine')).toBe(
      false,
    );
  });

  it('keys on the member, the phase and the week', () => {
    expect(routineKey({ memberId: 'irene', phase: 'prep', week: 2 })).toBe('irene:prep:2');
    // A key learned last week resolves to nothing this week, which is what
    // makes "this week's access" true without needing an expiry pass.
    expect(routines({ foundRoutines: ['irene:prep:1'] })).toHaveLength(cards.length);
  });
});

describe('resolving a routine find', () => {
  /**
   * It changes what the PLAYER knows, not what she knows - so no dossier entry,
   * and nothing that could reach a prompt. Telling the model would be handing
   * it a fact about the player's plans rather than about her.
   */
  it('writes nothing to any dossier', () => {
    const found = [];
    for (let seed = 1; seed <= 60; seed += 1) {
      const out = resolveSoloAction({
        locationId: 'wardrobe',
        actionId: 'read_fitting_notes',
        cards,
        dossier: fresh(),
        phase: 'prep',
        week: 0,
        seed: 4242,
        rng: makeRng(seed),
      });
      if (out.routine) found.push(out);
    }

    expect(found.length, 'no routine ever came up in 60 draws').toBeGreaterThan(0);
    for (const out of found) {
      expect(out.dossierAdd).toEqual([]);
      expect(out.learned).toBeNull();
      expect(out.heard).toBeNull();
      expect(out.routine.routineKey).toContain(':prep:0');
      expect(out.routine.nights.length).toBeGreaterThan(0);
      // It still costs secrecy - it is a snoop that found something.
      expect(out.playerDelta.secrecy).toBeLessThan(0);
    }
  });

  it('says what it found, in the English the ledger keeps', () => {
    let out = null;
    for (let seed = 1; seed <= 60 && !out?.routine; seed += 1) {
      out = resolveSoloAction({
        locationId: 'wardrobe',
        actionId: 'read_fitting_notes',
        cards,
        dossier: fresh(),
        phase: 'prep',
        week: 0,
        seed: 4242,
        rng: makeRng(seed),
      });
    }

    const line = soloLedgerText(out, { locationLabel: 'the wardrobe' });
    expect(line).toContain(out.routine.name);
    expect(line).toMatch(/own room/i);
  });
});
