/**
 * The offline round writer. CLAUDE.md Part I.4, section 3.
 *
 * The game is playable with no API key, and that is a supported mode rather than
 * a degraded one - it is what keeps the loop free to play and what lets
 * development continue without spending tokens. So this has to emit the REAL
 * wire format, sentinel and all, including the failures a small model actually
 * makes: a full-width pipe, a missing field, a round with no options at all.
 * The tolerant parser is then exercised in play rather than only in tests.
 *
 * It is not trying to write well. It is trying to be wrong in the same ways.
 */

import { SENTINEL } from '../config/rules.js';
import { makeRng, deriveSeed, pick } from '../systems/rng.js';

/**
 * Rounds, as `[emotion, prose, [four options]]`.
 *
 * Written to be composable rather than continuous - the mock cannot know what
 * the last round said, so every one of these has to work as an opening and as a
 * middle. That is why they are all about the room and none of them resolve
 * anything.
 */
const ROUNDS_EN = [
  [
    'neutral',
    'The mirror wall is still fogged at the bottom from whoever ran the routine before. She is folded over one leg, counting under her breath, and does not stop when the door goes. The count reaches eight before she looks up. "You are still here." It is not quite a question. Somewhere down the corridor a door closes twice, the way that door always does.',
    ['Say you were passing', 'Ask how long she has been at it', 'Sit down and wait', 'Offer to run the music'],
  ],
  [
    'shy',
    'She pulls her sleeve down over her hand before she takes the cup, which is a thing she does and probably does not know she does. The tea is too hot. She holds it anyway. "You did not have to." A pause that goes on slightly too long for the sentence it follows. "Thank you."',
    ['Tell her it was on the way', 'Say nothing and stay', 'Ask if she has eaten', 'Change the subject'],
  ],
  [
    'happy',
    'The playback cuts out three bars early and she laughs before she can stop herself - the real one, not the one she does on camera. "Every time. Every single time." She reaches past you for the laptop and her shoulder is briefly against yours and neither of you says anything about it.',
    ['Laugh with her', 'Fix the file properly', 'Step back a little', 'Tease her about the take'],
  ],
  [
    'upset',
    'She has read the same line on the schedule four times. "It is fine." The pen goes down harder than she meant it to and she notices, and puts it down again more carefully, which is worse. "It is a long week. That is all it is."',
    ['Ask what happened', 'Let it go', 'Say you are around', 'Take the schedule off her'],
  ],
  [
    'blush',
    'It is late enough that the building has gone quiet in the particular way it does after the last van leaves. She is sitting on the floor with her back against the mirror, and she has stopped pretending to stretch. "Sit down. You are making the room look busy."',
    ['Sit next to her', 'Sit across from her', 'Say you should both go home', 'Ask what she is thinking'],
  ],
  [
    'surprised',
    'A hairpin has worked its way loose and is on the floor between you. You both reach. She gets there first, and then holds it without doing anything with it. "I have been losing these all week." She looks at the pin rather than at you. "I keep thinking somebody must be collecting them."',
    ['Say you found one on Tuesday', 'Ask if she wants it back', 'Laugh it off', 'Wait'],
  ],
];

const ROUNDS_ZH = [
  [
    'neutral',
    '镜子下半截还留着上一批人练完的雾。她压着腿，嘴里小声数拍子，门响了也没停。数到八，才抬头。“你还没走。”不太像在问。走廊尽头那扇门又关了两次，它一直都这样。',
    ['说只是路过', '问她练了多久', '坐下来等', '说你来放音乐'],
  ],
  [
    'shy',
    '她先把袖子拉下来盖住手，才接那杯茶。这个动作她常做，大概自己不知道。茶太烫了，她也没放下。“你不用的。”停了一下，比那句话本身需要的时间长。“谢谢。”',
    ['说顺路', '什么也不说，留下来', '问她吃了没有', '转个话题'],
  ],
  [
    'happy',
    '伴奏提前三小节断了，她没忍住先笑出来——是真的那种，不是镜头前那种。“每次。每一次都这样。”她越过你去拿电脑，肩膀蹭了一下，两个人都没提。',
    ['跟着她笑', '认真把文件修好', '往后退半步', '拿刚才那条取笑她'],
  ],
  [
    'upset',
    '日程表上同一行她已经看了四遍。“没事。”笔放下时比她想要的重，她自己也发现了，又重新轻轻放了一次，那反而更难看。“只是这周太长了。”',
    ['问出了什么事', '不追问', '说你一直在', '把日程表拿过来'],
  ],
  [
    'blush',
    '晚到楼里已经安静下来了，是最后一辆车开走之后那种安静。她靠着镜子坐在地上，已经不再装作在拉筋。“坐下。你站着显得这屋子很忙。”',
    ['坐到她旁边', '坐到她对面', '说都该回去了', '问她在想什么'],
  ],
  [
    'surprised',
    '一枚发夹松了，掉在你们中间的地上。两个人同时伸手。她先拿到，然后只是握着，没再做别的。“这周一直在丢这个。”她看的是发夹，不是你。“总觉得是不是有人在收。”',
    ['说周二捡到过一枚', '问她要不要拿回去', '笑着带过去', '等她接着说'],
  ],
];

/** She was handed something. Answered before anything else, in either language. */
const HANDED_EN = [
  'blush',
  'She takes it with both hands and then does not seem to know where to put it down, so she keeps holding it. "You remembered." The words come out slightly flatter than she meant them to, which is how you know they landed.',
  ['Say it was nothing', 'Tell her why you thought of it', 'Watch her', 'Change the subject quickly'],
];

const HANDED_ZH = [
  'blush',
  '她用两只手接过去，然后似乎不知道该放哪里，就一直拿着。“你还记得。”语气比她想要的平一点——你就是这么知道这句话落到了地上。',
  ['说没什么', '告诉她为什么会想到', '看着她', '赶紧转开话题'],
];

const SUMMARIES = [
  'They talked, and neither of them said the thing.',
  'An ordinary hour that neither of them will describe accurately later.',
  'She let something slip and then talked over it.',
];

/** An empty room. No `emo|` line, per the format rules - nobody is there to have one. */
const EMPTY_EN =
  'Nobody is here. The lights are on the low setting the last person out always forgets to change, and there is a water bottle on the speaker cabinet with a name half worn off it. The room is warmer than the corridor.';
const EMPTY_ZH =
  '没人。灯还开在最后走的人总忘记改回去的那个档，音箱上面放着一瓶水，名字磨掉了一半。屋里比走廊里暖。';

const EMPTY_OPTIONS_EN = ['Wait a while', 'Tidy up', 'Look around', 'Go'];
const EMPTY_OPTIONS_ZH = ['等一会儿', '收拾一下', '四处看看', '走'];

/** Which member the tail says is in the room, so the delta line names somebody real. */
function presentId(tail) {
  return /Present: [^(]*\(([a-z0-9_]+)\)/.exec(tail)?.[1] ?? null;
}

/**
 * Write one round.
 *
 * @param {string} tail - tier 3, which carries everything this needs to know
 * @param {object} opts - { rng, zh, failureRate }
 */
export function mockRound(tail, { rng, zh = false, failureRate = 0.08 } = {}) {
  const first = /first round of the scene/i.test(tail);
  const last = /This is the LAST round/i.test(tail);
  const handed = /^System note:/im.test(tail);
  const who = presentId(tail);

  const [emotion, prose, options] = handed
    ? (zh ? HANDED_ZH : HANDED_EN)
    : who
      ? pick(rng, zh ? ROUNDS_ZH : ROUNDS_EN)
      : [null, zh ? EMPTY_ZH : EMPTY_EN, zh ? EMPTY_OPTIONS_ZH : EMPTY_OPTIONS_EN];

  const lines = [];

  /**
   * The failures, deliberately.
   *
   * Full-width punctuation is the measured one: about one `zh` round in ten came
   * back with its options written the way a list is DISPLAYED in Chinese. The
   * parser accepts it, and the only way to know it still does is to keep
   * producing it. Dropping the sentinel is the other half - then the whole reply
   * is prose and the player gets the fallback options, which must also be a
   * survivable round rather than a broken screen.
   */
  const wide = zh && rng() < 0.15;
  const sep = wide ? '｜' : '|';
  const noSentinel = rng() < failureRate / 2;

  lines.push(prose);
  if (noSentinel) return lines.join('\n');

  lines.push(SENTINEL);
  options.forEach((o, i) => lines.push(`${'ABCD'[i]}${sep}${o}`));
  if (emotion) lines.push(`emo${sep}${emotion}`);

  /**
   * 0 is the normal answer, and the first round of a scene is always 0. The mock
   * holds both rules itself rather than relying on the engine to refuse it -
   * offline play should read like online play, not like the safety net.
   */
  if (!first && who) {
    const roll = rng();
    if (roll > 0.55) lines.push(`${who}+${roll > 0.9 ? 2 : 1}`);
    else if (roll < 0.08) lines.push(`${who}-1`);
  }

  if (last) lines.push(`sum${sep}${pick(rng, SUMMARIES)}`);

  return lines.join('\n');
}

/** A standalone writer, for harnesses that do not want the whole client. */
export function createRoundWriter({ seed = 7, failureRate = 0.08 } = {}) {
  let n = 0;
  return function write(tail, { zh = false } = {}) {
    return mockRound(tail, {
      rng: makeRng(deriveSeed(seed, `round:${n++}`)),
      zh,
      failureRate,
    });
  };
}
