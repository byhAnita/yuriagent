/**
 * Playing in Chinese, against a real model. OPT-IN.
 *
 * `liveQuality.test.js` already had a `zh` check and it did not catch the bug
 * Yuhan reported, because it plays TWO turns. The failure was a flicker -
 * English, then Chinese for a few turns, then English again - which a two-turn
 * sample cannot see. So this file measures the Han ratio PER TURN across a long
 * scene and reports which turns fell back.
 *
 * Four questions, none of which an offline test can answer:
 *
 *   1. does a long `zh` scene stay in Chinese, turn by turn
 *   2. does the date register - sixteen turns, an English frame in block 4 -
 *      pull it back into English
 *   3. does the summarizer keep MEMORY English while writing DISPLAY in Chinese
 *   4. does a card whose semantic fields are all Chinese work at all
 *
 * Run: ZH_SMOKE=1 npm test -- zhSmoke
 */

import { describe, it, expect } from 'vitest';
import { stream, complete } from '../tools/llmTool.js';
import { liveConfig } from '../tools/liveEnv.js';
import { beginScene, runTurn, endScene, openingDirective, readHer, interject } from './sceneEngine.js';
import { newMemory, appendLedger, addDossierEntry } from './memory.js';
import { newRelation } from '../systems/relationship.js';
import { getCast } from '../data/cast.js';
import { buildLineup } from '../systems/castBuilder.js';
import { dateFrame, REGISTERS } from '../data/sceneFrames.js';

const { apiKey, modelId, live } = liveConfig();
const enabled = live && Boolean(process.env.ZH_SMOKE);
const log = (...a) => process.stdout.write(`${a.join(' ')}\n`);

const cards = getCast();



function client({ messages, preset, onChunk }) {
  if (onChunk) return stream({ messages, apiKey, modelId, preset, onChunk }).then((r) => r.text);
  return complete({ messages, apiKey, modelId, preset }).then((r) => r.text);
}

const HAN = /[一-鿿]/g;
const LATIN_WORD = /[A-Za-z]{3,}/g;

/** How Chinese is this, 0..1. Punctuation and spaces do not count either way. */
function hanRatio(text) {
  const han = (text.match(HAN) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return han + latin === 0 ? 1 : han / (han + latin);
}

function setup({ cast = cards, memberId = 'irene', intimacy = 45, date = null, memory = null } = {}) {
  const ids = cast.map((c) => c.id);
  return {
    cards: cast,
    lineup: buildLineup(cast),
    identity: { promptRole: 'an artist assistant', exposureModifier: {} },
    player: { name: '雨涵', energy: 80, secrecy: 70, credits: 20 },
    lang: 'zh',
    memory: memory ?? newMemory(ids),
    relations: Object.fromEntries(ids.map((id) => [id, newRelation(intimacy)])),
    scene: {
      id: 'zh',
      rosterIds: [memberId],
      presentIds: [memberId],
      focusId: memberId,
      week: 0,
      day: 1,
      block: 'evening',
      phase: 'prep',
      locationId: date ? 'bistro' : 'practice_room',
      locationLabel: date ? '小餐馆' : 'X 练习室',
      lang: 'zh',
      seed: 1,
      date,
      sceneFrame: date ? dateFrame(date, 'bistro') : null,
      register: date ? REGISTERS.date : REGISTERS.ordinary,
    },
  };
}

/**
 * A run that has already been played in English.
 *
 * THIS is the variable every earlier probe was missing. Yuhan's actual sequence
 * was: play several scenes in English, switch to Chinese OUTSIDE a scene, then
 * play on - and some members answered in English while others answered in
 * Chinese. New scenes are built with the new language, so the frozen-prefix
 * explanation does not cover it.
 *
 * What survives a scene boundary is MEMORY, and section 19 rule 2 keeps it
 * English on purpose so a language switch cannot corrupt history. So by the
 * time the model reaches the dialogue it has read a ledger of English summaries
 * and a dossier of English facts, with one sentence in block 1 asking for
 * Chinese.
 *
 * And block 3 is ROSTER-SCOPED, which is what makes it look like a per-member
 * problem: a member the player has spent time with carries several English
 * facts immediately above her line, and one they have neglected carries none.
 */
function playedInEnglish(ids, { entries = 6, factsFor = 'irene' } = {}) {
  let memory = newMemory(ids);

  const lines = [
    'Irene took the water bottle and said nothing about the schedule slipping.',
    'The player prepped the stage outfits alone while the others rehearsed.',
    'Nana noticed the player watching the run-through and made a joke about it.',
    'Irene stayed late in the practice room and did not explain why.',
    'The player ran the day schedule down and got the press kit out on time.',
    'Irene mentioned, without being asked, that she sleeps badly before a comeback.',
    'Jisoo balanced a bottle on her head until somebody laughed.',
    'The player waited at the table while Hyewon finished eating.',
  ];

  for (let i = 0; i < entries; i++) {
    const text = lines[i % lines.length];
    memory = {
      ...memory,
      ledger: appendLedger(memory.ledger, {
        id: `w0d${i}`,
        week: 0,
        day: i,
        block: 'evening',
        text,
        summary: text,
      }),
    };
  }

  for (const fact of [
    'cannot sleep the week before a comeback',
    'hates cold hands',
    'carries a pouch of vitamins everywhere',
  ]) {
    memory = {
      ...memory,
      dossier: addDossierEntry(memory.dossier, factsFor, 'known_facts', fact),
    };
  }

  return memory;
}

/** Play n turns and report the Han ratio of each one separately. */
async function playAndMeasure(args, stances) {
  let session = beginScene(args);
  const perTurn = [];

  session = await runTurn(session, { text: openingDirective(), client });
  perTurn.push(session.beats.map((b) => b.text).join(' '));

  let seen = session.beats.length;
  for (const stance of stances) {
    session = await runTurn(session, { stance, text: '', client });
    perTurn.push(session.beats.slice(seen).map((b) => b.text).join(' '));
    seen = session.beats.length;
  }

  return { session, perTurn };
}

function report(label, perTurn) {
  log(`\n[zh] --- ${label} ---`);
  const ratios = perTurn.map((t) => hanRatio(t));
  perTurn.forEach((text, i) => {
    const r = ratios[i];
    log(`  t${i} ${(r * 100).toFixed(0).padStart(3)}% han  ${text.slice(0, 90)}`);
  });
  const english = ratios.filter((r) => r < 0.5).length;
  log(`[zh] ${perTurn.length - english}/${perTurn.length} turns in Chinese`);
  return { ratios, english };
}

describe.skipIf(!enabled)('a Chinese run stays Chinese', () => {
  /**
   * The reported bug, at the length it was reported at.
   *
   * The fix under test: the language directive is repeated at the bottom of
   * block 4, because at the end of block 1 it sits ~1500 tokens and three
   * English blocks away from the dialogue.
   */
  it('holds Chinese across a whole scene, not just the first reply', async () => {
    const { perTurn } = await playAndMeasure(setup(), [
      'flirt',
      'care',
      'press',
      'confide',
      'deflect',
      'joke',
    ]);

    const { english } = report('ordinary scene, 7 turns', perTurn);
    expect(english).toBe(0);
  }, 300000);

  /**
   * The harder case: a date puts an English frame and an English style
   * directive into block 4, immediately before the model writes. If anything
   * pulls it back to English it should be this.
   */
  it('holds Chinese through a date, whose frame is English', async () => {
    const { perTurn } = await playAndMeasure(setup({ date: 'public', intimacy: 60 }), [
      'confide',
      'flirt',
      'invite',
      'care',
      'touch',
    ]);

    const { english } = report('public date, 6 turns', perTurn);
    expect(english).toBe(0);
  }, 300000);

  /**
   * The suspect.
   *
   * The reported reply was a reaction to the `ask_for_a_vitamin` gesture, and a
   * gift note is ENGLISH and appended at the TAIL of block 5 - so it is the
   * last thing the model reads before writing. Six turns of clean Chinese
   * without one (above) and English with one would say the note is the cause,
   * which is the same proximity argument as block 4, pointing the other way.
   *
   * Sharper now than when it was written. The note used to arrive with the
   * opening beat, where the model had a whole frozen header of Chinese
   * instruction immediately behind it; it arrives mid-scene now, on top of
   * several turns of Chinese dialogue, and it is the ONLY English in block 5.
   * If an English tail can pull the model out of the language, this is the
   * shape that does it.
   */
  it('holds Chinese when an English gift note lands mid-scene', async () => {
    const args = setup({ intimacy: 30 });
    const note =
      'the player opened the scene by asking Irene for something out of her vitamin pouch. ' +
      'She let this slip once: "carries a pouch of vitamins everywhere". There is no object; do not invent one. ' +
      'She has never told anyone she needed one - only somebody paying very close attention would have known.';

    let session = beginScene(args);
    session = await runTurn(session, { text: openingDirective(), client });
    session = await runTurn(session, { stance: 'flirt', text: '', client });
    session = await runTurn(session, { note, client });
    const perTurn = [session.beats.map((b) => b.text).join(' ')];

    let seen = session.beats.length;
    for (const stance of ['flirt', 'care', 'press']) {
      session = await runTurn(session, { stance, text: '', client });
      perTurn.push(session.beats.slice(seen).map((b) => b.text).join(' '));
      seen = session.beats.length;
    }

    const { english } = report('opened on an English gift note', perTurn);
    expect(english).toBe(0);
  }, 300000);

  /**
   * The reported sequence, reproduced.
   *
   * Several scenes in English, switch to Chinese from the day screen, keep
   * playing. The new scene is built with lang 'zh', so nothing is frozen wrong
   * - but blocks 2 and 3 are now a wall of English that the model reads on its
   * way to the dialogue.
   */
  it('holds Chinese for a member the player has a long English history with', async () => {
    const ids = cards.map((c) => c.id);
    const memory = playedInEnglish(ids, { entries: 6, factsFor: 'irene' });

    const { perTurn } = await playAndMeasure(setup({ memberId: 'irene', memory }), [
      'flirt',
      'care',
      'confide',
      'press',
    ]);

    const { english } = report('irene, 6 English ledger lines + 3 English facts', perTurn);
    expect(english).toBe(0);
  }, 300000);

  /**
   * The same run, a member with no dossier of her own.
   *
   * Block 3 is roster-scoped, so she carries none of those English facts - only
   * the shared ledger. If the two differ, the amount of English immediately
   * above her line is what decides it, which is what "some members English,
   * some Chinese" would mean.
   */
  it('holds Chinese for a neglected member in the same run', async () => {
    const ids = cards.map((c) => c.id);
    const memory = playedInEnglish(ids, { entries: 6, factsFor: 'irene' });

    const { perTurn } = await playAndMeasure(setup({ memberId: 'yeri', memory }), [
      'flirt',
      'care',
      'confide',
      'press',
    ]);

    const { english } = report('yeri, same ledger, no dossier of her own', perTurn);
    expect(english).toBe(0);
  }, 300000);

  /** A long run. The ledger compacts but it never stops being English. */
  it('holds Chinese deep into a run', async () => {
    const ids = cards.map((c) => c.id);
    const memory = playedInEnglish(ids, { entries: 24, factsFor: 'irene' });

    const { perTurn } = await playAndMeasure(setup({ memberId: 'irene', memory }), [
      'flirt',
      'confide',
      'press',
    ]);

    const { english } = report('irene, 24 English ledger lines', perTurn);
    expect(english).toBe(0);
  }, 300000);

  /**
   * Read her, which the harness had never called.
   *
   * It appends an English system note at the tail AND commits the model's
   * answer back into block 5. So if the thought comes back in English, every
   * later beat in that scene is written after a block of English assistant text
   * sitting immediately above it - which is a far stronger pull than anything
   * in blocks 1 to 4, because it is the model's own voice.
   *
   * The reported screenshot had the Read her control in it, and the reported
   * shape was "Chinese for a while, then English again".
   */
  it('holds Chinese after Read her', async () => {
    const args = setup({ intimacy: 45 });
    let session = beginScene(args);
    session = await runTurn(session, { text: openingDirective(), client });
    session = await runTurn(session, { stance: 'flirt', text: '', client });

    const before = session.beats.map((b) => b.text).join(' ');

    const read = await readHer(session, { client });
    session = read.session;
    log(`\n[zh] --- read her ---\n  ${read.thought}`);
    log(`[zh] thought han ratio ${(hanRatio(read.thought ?? '') * 100).toFixed(0)}%`);

    const perTurn = [before];
    let seen = session.beats.length;
    for (const stance of ['care', 'confide', 'press']) {
      session = await runTurn(session, { stance, text: '', client });
      perTurn.push(session.beats.slice(seen).map((b) => b.text).join(' '));
      seen = session.beats.length;
    }

    const { english } = report('after Read her', perTurn);

    // The thought is prose the player reads, so it is subject to section 19 too.
    expect(hanRatio(read.thought ?? '')).toBeGreaterThan(0.5);
    expect(english).toBe(0);
  }, 300000);

  /** The machine tokens must survive whatever the prose does (section 19). */

  /**
   * The reported failure, in the exact shape it was reported.
   *
   * Yuhan's zh run, week 1 day 2, drink room:
   *
   *   She stands at the counter, hand wrapped around the cup, watching the
   *   steam rise. She does not turn around when you enter.
   *   "茶水间的咖啡机今天特别慢。"
   *
   * The ACTION is English and the SPEECH is Chinese, in the same beat. Every
   * existing zh check measures a whole-beat Han ratio, which a beat that is
   * half Chinese passes comfortably - so none of them could see this.
   *
   * Measured separately here: the asterisked half and the quoted half.
   */
  it('writes the ACTION in Chinese too, not just the speech', async () => {
    const samples = Number(process.env.ZH_SAMPLES ?? 4);
    const rows = [];

    for (let i = 0; i < samples; i += 1) {
      const ids = cards.map((c) => c.id);
      const args = setup({ intimacy: 30, memory: playedInEnglish(ids, { entries: 6 }) });
      /**
       * The block 4 the GAME builds, not the bare one a unit fixture builds.
       * Activity, weather, the outstanding chore and the standing line are all
       * English, and they sit between the dialogue and the language directive.
       * The first version of this probe omitted them and could not reproduce
       * the bug at all.
       */
      args.scene = {
        ...args.scene,
        seed: 100 + i,
        locationId: 'drink_room',
        locationLabel: '茶水间',
        occupancy: { irene: { activity: 'group_practice' } },
        task: { taskId: 'prep_outfits', done: false },
      };
      let session = beginScene(args);
      session = await runTurn(session, { text: openingDirective(), client });
      session = await runTurn(session, { stance: 'flirt', text: '', client });

      for (const b of session.beats) {
        const actions = (b.text.match(/\*([^*]+)\*/g) ?? []).join(' ');
        const speech = (b.text.match(/[“"]([^”"]+)[”"]/g) ?? []).join(' ');
        rows.push({
          action: actions ? hanRatio(actions) : null,
          speech: speech ? hanRatio(speech) : null,
          text: b.text.replace(/\s+/g, ' ').slice(0, 100),
        });
      }
    }

    log('\n[zh] --- action vs speech, per beat ---');
    for (const r of rows) {
      const a = r.action === null ? ' -- ' : `${(r.action * 100).toFixed(0).padStart(3)}%`;
      const s = r.speech === null ? ' -- ' : `${(r.speech * 100).toFixed(0).padStart(3)}%`;
      log(`  action ${a}  speech ${s}   ${r.text}`);
    }

    const withAction = rows.filter((r) => r.action !== null);
    const englishActions = withAction.filter((r) => r.action < 0.5).length;
    log(`\n[zh] beats with an action: ${withAction.length}`);
    log(`[zh] actions written in ENGLISH: ${englishActions}`);

    expect(englishActions).toBe(0);
  }, 600000);

  it('never localizes a speaker id or an emotion', async () => {
    const { session } = await playAndMeasure(setup(), ['flirt', 'press']);
    for (const b of session.beats) {
      expect(b.speaker).toBe('irene');
      if (b.emotion) expect(/^[a-z]+$/.test(b.emotion)).toBe(true);
    }
  }, 300000);

  /**
   * The pronoun rule has to survive translation, and Chinese is where it is
   * hardest to check.
   *
   * Block 1 says "never he or she" in English, about prose the model writes in
   * Chinese. Spoken Chinese hides the problem - 他 and 她 are both `ta` - but
   * the written character does not, and 她 assigns the player a gender exactly
   * as "she" would. Nothing in the game states one.
   *
   * This is the `zh` half of the English check in `liveQuality.test.js`. It
   * only arises in a group scene, where one member talks to another ABOUT the
   * player, and it only became common the day a second voice started speaking
   * most turns.
   */
  it('does not gender the player in Chinese either', async () => {
    const room = ['irene', 'nana', 'jisoo'];
    const args = setup({ intimacy: 40 });
    args.scene = { ...args.scene, rosterIds: room, presentIds: room, focusId: 'irene' };

    let session = beginScene(args);
    session = await runTurn(session, { text: openingDirective(), client, cast: cards });

    for (const stance of ['joke', 'flirt', 'confide', 'care']) {
      session = await runTurn(session, { stance, text: '', client, cast: cards });
      const out = await interject(session, { client, relations: args.relations, cards });
      session = out.session;
    }

    const text = session.beats.map((b) => b.text).join('\n');
    /**
     * The masculine singular only, and it has to be matched carefully.
     *
     * 她 is everywhere legitimately - five women - so only the masculine one
     * signals that the player got gendered. But a bare /他/ also matches 其他
     * ("other") and 他们 ("they"), which are ordinary words and nothing to do
     * with the player. A first version flagged three of those and read as a
     * regression that had not happened.
     */
    const he = (text.match(/(?<!其)他(?!们)/g) ?? []).length;

    log('\n[zh] --- group scene, gendering the player ---');
    log(`[zh] beats ${session.beats.length}, "he" characters: ${he}`);
    for (const b of session.beats) {
      if (/他/.test(b.text)) log(`   !! @${b.speaker} ${b.text.replace(/\s+/g, ' ')}`);
    }

    expect(he).toBe(0);
  }, 600000);
});

describe.skipIf(!enabled)('memory stays English while the player reads Chinese', () => {
  it('writes an English ledger line and a Chinese display line', async () => {
    const args = setup({ intimacy: 55 });
    let session = beginScene(args);
    session = await runTurn(session, { text: openingDirective(), client });
    session = await runTurn(session, { stance: 'confide', text: '', client });
    session = await runTurn(session, { stance: 'press', text: '', client });

    const result = await endScene(session, {
      client,
      memory: args.memory,
      relations: args.relations,
      cards,
      scene: args.scene,
      rng: () => 0.5,
    });

    const { summary } = result;
    log('\n[zh] --- scene exit ---');
    log(`  summary (memory)  ${summary.summary}`);
    log(`  display (player)  ${summary.display}`);
    for (const d of summary.dossierAdd) log(`  dossier  ${d.memberId}: ${d.text}`);

    // Section 19 rule 2: memory is language-agnostic so the player can switch
    // language mid-run. If this drifts, a save silently mixes languages.
    expect(hanRatio(summary.summary)).toBeLessThan(0.2);
    for (const d of summary.dossierAdd) expect(hanRatio(d.text)).toBeLessThan(0.2);

    // And the thing the player actually reads.
    expect(hanRatio(summary.display)).toBeGreaterThan(0.5);
  }, 300000);
});

/**
 * The custom-card probe. PROPOSALS 14.
 *
 * Pretend to be a zh player writing their own character: every semantic field
 * typed in Chinese. The editor does not exist yet, so this feeds such a card
 * straight through the pipeline and asks whether it works at all - which is the
 * question the proposal turns on, and one no amount of design argument settles.
 *
 * The id stays ASCII deliberately. Speaker ids are machine tokens (section 9)
 * and a Han-character id would go into the metadata line and through the
 * parser's roster check, so if this is going to break, better to know that it
 * is the ID and not the card.
 */
const customZhCard = {
  id: 'yuna',
  schema: 1,
  name: '尹娜',
  emoji: '🦊',
  mascot: 'fox',
  mascotNote: '看起来什么都不在乎，其实什么都记得',
  palette: { base: '#e8c8a0', accent: '#a0522d' },
  mbti: 'INFP',
  birthday: '1999-11-02',
  preferredRoles: ['sub_vocalist'],
  activityProfile: { primary: 'actress', types: ['drama_shoot', 'photoshoot'] },
  publicImage: '综艺里话最少的那一个，被剪进去的镜头总是在笑别人的笑话',
  personality: '慢热，观察型。不喜欢先开口，但一旦开口就说得很准',
  speechStyle: '短句，句尾常常省略。很少用感叹号，会用停顿代替强调',
  queerTexture: '对亲近的界线格外敏感，会先退半步再看对方要不要跟上',
  hiddenConflict: null,
  styleHints: { zh: null, ko: null },
  likesSeed: ['凌晨的便利店'],
  learnableFacts: ['怕冷，但从不承认', '睡前一定要听完一整张专辑'],
  startIntimacy: 5,
  portraitMode: 'mascot',
  portraits: {},
};

describe.skipIf(!enabled)('a card written entirely in Chinese', () => {
  const cast = [customZhCard, ...cards.slice(1)];

  it('plays a scene at all', async () => {
    const { session, perTurn } = await playAndMeasure(
      setup({ cast, memberId: 'yuna' }),
      ['flirt', 'confide', 'press'],
    );

    report('custom zh card, 4 turns', perTurn);
    for (const b of session.beats) log(`  @${b.speaker}|${b.emotion}`);

    // The parser contract has to hold even though the card is not English.
    expect(session.beats.length).toBeGreaterThan(0);
    for (const b of session.beats) {
      expect(b.speaker).toBe('yuna');
      if (b.emotion) expect(/^[a-z]+$/.test(b.emotion)).toBe(true);
    }
  }, 300000);

  /**
   * The question the proposal turns on.
   *
   * If the model writes her memory in Chinese because her card is Chinese,
   * option 2 in PROPOSALS 14 - let memory drift into the authoring language -
   * is what happens BY DEFAULT rather than by choice, and a save silently mixes
   * languages. That would make translate-at-import mandatory rather than
   * preferred.
   */
  it('still writes her memory in English', async () => {
    const args = setup({ cast, memberId: 'yuna', intimacy: 50 });
    let session = beginScene(args);
    session = await runTurn(session, { text: openingDirective(), client });
    session = await runTurn(session, { stance: 'confide', text: '', client });

    const result = await endScene(session, {
      client,
      memory: args.memory,
      relations: args.relations,
      cards: cast,
      scene: args.scene,
      rng: () => 0.5,
    });

    log('\n[zh] --- custom card, scene exit ---');
    log(`  summary  ${result.summary.summary}`);
    log(`  display  ${result.summary.display}`);
    for (const d of result.summary.dossierAdd) log(`  dossier  ${d.memberId}: ${d.text}`);

    const drift = hanRatio(result.summary.summary);
    log(`[zh] memory han ratio ${(drift * 100).toFixed(0)}%`);
    expect(drift).toBeLessThan(0.2);
  }, 300000);

  /**
   * Her facts are Chinese on the card, so they reach block 3 as Chinese - which
   * is the whole of PROPOSALS 14 from the other direction. Reported, not
   * asserted: this is a reading about what a Chinese card does to memory, and
   * the fix is a schema decision rather than a bug to fail on.
   */
  it('reports what her Chinese facts do to the dossier', async () => {
    const words = customZhCard.learnableFacts.join(' ');
    log(`\n[zh] her facts as authored: ${words}`);
    log(`[zh] latin words in them: ${(words.match(LATIN_WORD) ?? []).length}`);
    expect(hanRatio(words)).toBeGreaterThan(0.9);
  });
});
