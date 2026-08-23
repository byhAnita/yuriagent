/** @vitest-environment jsdom */
/**
 * The screen that printed English into a Chinese run.
 *
 * Both halves of a snoop had the same defect and the same cause: the only
 * string they had to print was the one memory keeps in English on purpose
 * (section 19 rule 2). A fact carries an id now and a rumor carries its shape,
 * so both can be rendered rather than echoed.
 *
 * Asserted end to end rather than on the resolver, because the resolver was
 * never the part that broke - the wiring was. The same is true of the bug this
 * replaces: `factDisplay` would have passed its own unit test on day one.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SoloAction from './SoloAction.jsx';
import { getCast } from '../../data/cast.js';
import { makeT } from '../../i18n/index.js';
import { FACTS } from '../../data/facts.js';
import { resolveSoloAction } from '../../systems/soloWork.js';
import { newMemory, addDossierEntry } from '../../agent/memory.js';
import { makeRng } from '../../systems/rng.js';
import { phraseRumor } from '../../systems/rumor.js';
import zh from '../../i18n/zh.js';

const cards = getCast();

afterEach(cleanup);

function show({ result, lang }) {
  render(
    <SoloAction
      locationId="wardrobe"
      task={null}
      result={result}
      present={[]}
      cards={cards}
      onTalk={() => {}}
      onChoose={() => {}}
      onDone={() => {}}
      lang={lang}
      t={makeT(lang)}
    />,
  );
}

const action = { id: 'read_fitting_notes', learns: true };
const delta = { credits: 0, competence: 0, energy: 0, secrecy: -5 };

const learnedIrene = {
  action,
  playerDelta: delta,
  learned: { memberId: 'irene', name: 'Irene', factId: 'cold_hands', fact: FACTS.cold_hands },
  heard: null,
};

/**
 * Built by the real resolver, not by hand.
 *
 * A hand-written result asserts that the SCREEN can render a shape, which was
 * never the half that broke. `resolveSoloAction` is what has to hand that
 * shape over, and the first version of this change quietly dropped everything
 * but `text` on its way out - the exact defect the screen was being fixed for,
 * one layer up. This is the same lesson as `markRisk`: both halves correct,
 * the join missing.
 */
function realRumorFind() {
  let dossier = newMemory(cards.map((c) => c.id)).dossier;
  dossier = addDossierEntry(dossier, 'yeri', 'heard_about', {
    text: phraseRumor('Irene', 'cafe'),
    kind: 'heard',
    subjectId: 'irene',
    subjectName: 'Irene',
    locationId: 'cafe',
  });
  /**
   * The SOCIAL room, because that is the only place rumors live now: a room
   * teaches what its slot says it teaches (`data/soloCoverage.test.js`). The
   * wardrobe is a workroom and can only ever hand back a fact.
   */
  const out = resolveSoloAction({
    locationId: 'drink_room',
    actionId: 'linger_by_the_urn',
    cards,
    dossier,
    rng: makeRng(1),
  });
  if (!out.heard) throw new Error('the fixture found no rumor');
  return out;
}

const heardFromYeri = realRumorFind();

describe('a snoop, in Chinese', () => {
  it('shows the fact translated, not the canonical English', () => {
    show({ result: learnedIrene, lang: 'zh' });

    expect(screen.getByText(new RegExp(zh.fact.cold_hands))).toBeTruthy();
    expect(screen.queryByText(new RegExp(FACTS.cold_hands))).toBeNull();
  });

  it('shows the rumor built from its shape, not the dossier line', () => {
    show({ result: heardFromYeri, lang: 'zh' });

    expect(screen.getByText(/Yeri/)).toBeTruthy();
    expect(screen.getByText(new RegExp(zh.location.cafe))).toBeTruthy();
    expect(screen.queryByText(/you heard the player/)).toBeNull();
  });

  /**
   * The blunt version, and the one that would have caught the original bug
   * without anybody knowing which string was wrong: no English sentence
   * anywhere on the screen.
   */
  it('puts no English sentence on the screen at all', () => {
    for (const result of [learnedIrene, heardFromYeri]) {
      cleanup();
      show({ result, lang: 'zh' });
      const text = document.body.textContent ?? '';
      const words = text.match(/[A-Za-z]{4,}/g) ?? [];
      // Names stay Latin in zh - the cast is named in roman letters on the
      // cards, and section 19 localizes prose rather than identity.
      const allowed = new Set(cards.map((c) => c.name));
      expect(words.filter((w) => !allowed.has(w))).toEqual([]);
    }
  });
});

describe('a snoop, in English', () => {
  it('still reads the way it always did', () => {
    show({ result: learnedIrene, lang: 'en' });
    expect(screen.getByText(new RegExp(FACTS.cold_hands))).toBeTruthy();
  });
});

/**
 * A room that has nothing left to teach says so, instead of charging a block
 * to find out.
 *
 * `soloWork` has always known - it refuses to charge secrecy for a search that
 * turned up nothing - and the screen never asked. It got sharper when rumors
 * became social-room-only: a run opens with 25 facts and NO rumors, so the
 * social snoop is guaranteed empty in week 1. That curve is intended; paying a
 * block to discover it is not.
 */
describe('a spent room says it is spent', () => {
  const room = (dossier) =>
    render(
      <SoloAction
        locationId="drink_room"
        cards={cards}
        dossier={dossier}
        onTalk={() => {}}
        onChoose={() => {}}
        onDone={() => {}}
        lang="en"
        t={makeT('en')}
      />,
    );

  it('offers no promise when there is nothing to overhear yet', () => {
    room(Object.fromEntries(cards.map((c) => [c.id, { known_facts: [], heard_about: [] }])));
    expect(screen.getByText(makeT('en')('solo.nothingHere'))).toBeTruthy();
    expect(screen.queryByText(makeT('en')('solo.mayLearn'))).toBeNull();
  });

  it('promises something once a rumor exists to find', () => {
    const dossier = Object.fromEntries(
      cards.map((c) => [c.id, { known_facts: [], heard_about: [] }]),
    );
    dossier.yeri.heard_about = [{ text: 'you heard the player was at Cafe with Irene', kind: 'heard' }];
    room(dossier);
    expect(screen.getByText(makeT('en')('solo.mayLearn'))).toBeTruthy();
  });
});
