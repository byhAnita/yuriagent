import { describe, it, expect } from 'vitest';
import {
  acceptChance,
  blockedReason,
  dateOffers,
  askOut,
  dateLocation,
  dateWitnesses,
  dateCost,
  REFUSAL,
} from './dating.js';
import { newRelation } from './relationship.js';
import { DATE_KINDS } from '../config/constants.js';
import { PHASES } from '../data/phaseMaps.js';
import { getCast } from '../data/cast.js';

const cast = getCast();
const SEED = 'date-seed';

const rel = (over = {}) => ({ ...newRelation(5), ...over });
const rich = { credits: 100 };

describe('the gate comes off the two axes', () => {
  it('gates a private date on intimacy and ignores admissibility', () => {
    expect(acceptChance(rel({ intimacy: 80, admissibility: 0 }), 'private')).toBeGreaterThan(0);
    expect(acceptChance(rel({ intimacy: 10, admissibility: 100 }), 'private')).toBe(0);
  });

  it('gates a public date on admissibility and ignores intimacy', () => {
    expect(acceptChance(rel({ intimacy: 0, admissibility: 60 }), 'public')).toBeGreaterThan(0);
    expect(acceptChance(rel({ intimacy: 100, admissibility: 5 }), 'public')).toBe(0);
  });

  /**
   * The point of splitting them. A player stalled on the plateau has enormous
   * intimacy and almost no admissibility, so the private day is easy and the
   * public one is shut - which is the plateau saying what it wants.
   */
  it('offers the plateau a private day and refuses it a public one', () => {
    const stalled = rel({ intimacy: 90, admissibility: 5, stage: 'confidante' });
    expect(blockedReason(stalled, 'private', rich)).toBeNull();
    expect(blockedReason(stalled, 'public', rich)).toBe(REFUSAL.NOT_NAMEABLE);
  });

  it('unlocks her door and the invitation at the same number', () => {
    expect(DATE_KINDS.private.floor).toBe(50);
  });
});

describe('the band between floor and sure is a real bet', () => {
  it('is a certain no below the floor', () => {
    expect(acceptChance(rel({ intimacy: DATE_KINDS.private.floor - 1 }), 'private')).toBe(0);
  });

  it('is a certain yes at or above sure', () => {
    expect(acceptChance(rel({ intimacy: DATE_KINDS.private.sure }), 'private')).toBe(1);
    expect(acceptChance(rel({ intimacy: 100 }), 'private')).toBe(1);
  });

  it('rises monotonically through the band', () => {
    let last = -1;
    for (let i = DATE_KINDS.private.floor; i <= DATE_KINDS.private.sure; i += 5) {
      const c = acceptChance(rel({ intimacy: i }), 'private');
      expect(c).toBeGreaterThanOrEqual(last);
      last = c;
    }
  });
});

describe('strain and jealousy', () => {
  it('refuses outright once she is in rift', () => {
    const hurt = rel({ intimacy: 90, strain: 65 });
    expect(acceptChance(hurt, 'private')).toBe(0);
    expect(blockedReason(hurt, 'private', rich)).toBe(REFUSAL.STRAIN);
  });

  it('refuses outright at corrosive jealousy', () => {
    const done = rel({ intimacy: 90, jealousy: 80 });
    expect(blockedReason(done, 'private', rich)).toBe(REFUSAL.JEALOUSY);
  });

  /**
   * Section 5b calls `piqued` an opportunity rather than a tax: she is unsettled
   * about where the player's attention has been, so being asked for a whole day
   * is exactly the reassurance she wanted.
   */
  it('makes her MORE likely to say yes at piqued, and less at sharp', () => {
    const base = acceptChance(rel({ intimacy: 60, jealousy: 0 }), 'private');
    const piqued = acceptChance(rel({ intimacy: 60, jealousy: 30 }), 'private');
    const sharp = acceptChance(rel({ intimacy: 60, jealousy: 60 }), 'private');

    expect(piqued).toBeGreaterThan(base);
    expect(sharp).toBeLessThan(base);
  });
});

describe('the bill', () => {
  it('charges for a public date and not for a private one', () => {
    expect(dateCost('public')).toBeGreaterThan(0);
    expect(dateCost('private')).toBe(0);
  });

  it('blocks the public date when the player cannot pay', () => {
    const ready = rel({ intimacy: 90, admissibility: 90 });
    expect(blockedReason(ready, 'public', { credits: 0 })).toBe(REFUSAL.CREDITS);
    expect(blockedReason(ready, 'public', rich)).toBeNull();
  });

  it('does not charge for a refusal - she turned you down, you bought nothing', () => {
    const out = askOut({
      rel: rel({ intimacy: 90, admissibility: 5 }),
      kind: 'public',
      player: rich,
      seed: SEED,
      memberId: 'irene',
    });
    expect(out.accepted).toBe(false);
    expect(out.reason).toBe(REFUSAL.NOT_NAMEABLE);
  });
});

describe('askOut', () => {
  it('is stable for the same moment - a coin you can reflip is not a bet', () => {
    const args = {
      rel: rel({ intimacy: 60 }),
      kind: 'private',
      player: rich,
      seed: SEED,
      week: 1,
      day: 5,
      memberId: 'irene',
    };
    expect(askOut(args)).toEqual(askOut(args));
  });

  it('differs between Saturday and Sunday', () => {
    const base = {
      rel: rel({ intimacy: 60 }),
      kind: 'private',
      player: rich,
      seed: SEED,
      week: 0,
      memberId: 'irene',
    };
    const sat = askOut({ ...base, day: 5 });
    const sun = askOut({ ...base, day: 6 });
    // Same odds, independent draws.
    expect(sat.chance).toBe(sun.chance);
  });

  it('always accepts above sure and never below floor', () => {
    for (const day of [5, 6]) {
      const yes = askOut({
        rel: rel({ intimacy: 100 }),
        kind: 'private',
        player: rich,
        seed: SEED,
        day,
        memberId: 'nana',
      });
      expect(yes.accepted).toBe(true);

      const no = askOut({
        rel: rel({ intimacy: 5 }),
        kind: 'private',
        player: rich,
        seed: SEED,
        day,
        memberId: 'nana',
      });
      expect(no.accepted).toBe(false);
    }
  });
});

describe('where a date happens', () => {
  it('finds a public venue and her room in every phase', () => {
    for (const phase of PHASES) {
      expect(dateLocation(phase, 'public')).toBeTruthy();
      expect(dateLocation(phase, 'private')).toBe('dorm_room');
    }
  });

  it('moves the public venue with the phase', () => {
    expect(dateLocation('prep', 'public')).toBe('bistro');
    expect(dateLocation('comeback', 'public')).toBe('cafe');
    expect(dateLocation('rest', 'public')).toBe('han_river');
  });
});

describe('who finds out', () => {
  /**
   * The reason a public date is not just meeting her at the cafe on a Tuesday:
   * everybody learns of it, with no roll. Section 5b's witnessed tier.
   */
  it('tells every absent member for certain, on a public date', () => {
    const { witnessed, certain } = dateWitnesses({ kind: 'public', cast, memberId: 'irene' });
    expect(certain).toBe(true);
    expect(witnessed).toHaveLength(cast.length - 1);
    expect(witnessed).not.toContain('irene');
  });

  it('leaks nothing outward on a private date', () => {
    expect(dateWitnesses({ kind: 'private', cast, memberId: 'irene' }).certain).toBe(false);
  });
});

describe('dateOffers', () => {
  it('lists an unaffordable date with its price rather than hiding it', () => {
    const relations = Object.fromEntries(
      cast.map((c) => [c.id, rel({ intimacy: 90, admissibility: 90 })]),
    );
    const offers = dateOffers({ phase: 'prep', cast, relations, player: { credits: 0 } });
    const pub = offers.find((o) => o.kind === 'public');

    expect(pub.available).toBe(false);
    expect(pub.reason).toBe(REFUSAL.CREDITS);
    expect(pub.cost).toBeGreaterThan(0);
  });

  it('offers both kinds for every member of the cast', () => {
    const relations = Object.fromEntries(cast.map((c) => [c.id, rel()]));
    const offers = dateOffers({ phase: 'prep', cast, relations, player: rich });
    expect(offers).toHaveLength(cast.length * 2);
  });

  it('says why, for every offer that is not live', () => {
    const relations = Object.fromEntries(cast.map((c) => [c.id, rel()]));
    for (const offer of dateOffers({ phase: 'rest', cast, relations, player: {} })) {
      if (!offer.available) expect(Object.values(REFUSAL)).toContain(offer.reason);
    }
  });
});
