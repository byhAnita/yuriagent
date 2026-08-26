/**
 * Jealousy. CLAUDE.md section 5b.
 *
 * Jealousy is PRESSURE, not damage. It feeds strain only when left unaddressed,
 * and in its lower band it converts into affection - noticing that she minds and
 * visibly choosing her is one of the strongest gains available.
 *
 * The load-bearing idea is that gain scales with HER investment. A stranger does
 * not care who you had coffee with; someone at `nameless` cares enormously. That
 * makes breadth cheap while everything is shallow and punishing as any single
 * route deepens, which is what stops the harem from being the default outcome.
 *
 * Every coefficient here is a starting value for balanceSim to move.
 */

import {
  JEALOUSY_BANDS,
  JEALOUSY_DECAY_PER_ATTENTIVE_SCENE,
  JEALOUSY_CONVERT,
  EXCLUSIVITY,
  JEALOUSY_GAIN_SCALE,
} from '../config/constants.js';
import { clamp } from './rng.js';

export function jealousyBand(jealousy) {
  if (jealousy >= JEALOUSY_BANDS.corrosive) return 'corrosive';
  if (jealousy >= JEALOUSY_BANDS.sharp) return 'sharp';
  if (jealousy >= JEALOUSY_BANDS.piqued) return 'piqued';
  return 'calm';
}

export function exclusivity(stage) {
  return EXCLUSIVITY[stage] ?? 1;
}

/**
 * How much a piece of news costs, given how invested she already is.
 *
 * @param {number} rumorWeight - 1 for a heard rumor, higher for direct witness
 * @param {object} rel         - the relation of the member who is learning
 */
export function jealousyGain(rumorWeight, rel) {
  return rumorWeight * (rel.affection / 100) * exclusivity(rel.stage) * JEALOUSY_GAIN_SCALE;
}

/** Attention is the currency: a scene with her that produces no new rumor. */
export function decay(rel) {
  return { ...rel, jealousy: clamp(rel.jealousy - JEALOUSY_DECAY_PER_ATTENTIVE_SCENE) };
}

export function addJealousy(rel, amount) {
  return { ...rel, jealousy: clamp(rel.jealousy + amount) };
}

/**
 * The `piqued` band is an opportunity, not a tax. `reassure` or `confide` while
 * she is in it converts pressure into closeness. Outside that band it does
 * nothing - too early to matter, or too late to be enough.
 */
export function canConvert(rel) {
  return jealousyBand(rel.jealousy) === 'piqued';
}

export function convert(rel) {
  if (!canConvert(rel)) return rel;
  return {
    ...rel,
    jealousy: clamp(rel.jealousy + JEALOUSY_CONVERT.jealousy),
    affection: clamp(rel.affection + JEALOUSY_CONVERT.affection),
  };
}

/**
 * Strain charged at scene exit for jealousy that was not addressed.
 * Returns a strain delta, applied by relationship.applySceneOutcome.
 */
export function unaddressedStrain(rel) {
  switch (jealousyBand(rel.jealousy)) {
    case 'sharp':
      return 3;
    case 'corrosive':
      return 8;
    default:
      return 0;
  }
}

/** Scene-opening modifiers she brings in with her. */
export function sceneModifiers(rel) {
  const band = jealousyBand(rel.jealousy);
  return {
    guardBonus: band === 'sharp' || band === 'corrosive' ? 15 : 0,
    lockedStances: band === 'sharp' || band === 'corrosive' ? ['flirt', 'touch'] : [],
    probes: band === 'piqued',
    hostileGroupScene: band === 'corrosive',
    /** hiddenConflict is only injected from `piqued` upward (section 12). */
    revealHiddenConflict: band !== 'calm',
  };
}
