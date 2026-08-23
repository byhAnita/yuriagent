/**
 * The offline writer, in Chinese.
 *
 * Section 3: "The game is playable with no API key... That is a supported mode,
 * not a degraded one." It was not true for `zh`. The offline writer had one
 * English table, so a Chinese player with no key got an entirely English game -
 * and, worse, a Chinese player WITH a key got an occasional English reply,
 * because `tools/client.js` falls back to this writer for any turn the live
 * call fails and says nothing about having done so.
 *
 * That is what was actually behind the reported "some members speak English".
 * Eight live probes could not reproduce it because they call the router
 * directly and never take the fallback path.
 *
 * Kept in its own file rather than inlined so adding `ko` or `pt` later is a
 * content task and not a refactor. Same keys as the English table; anything
 * missing falls back to English rather than to nothing.
 */

export const LINES_ZH = {
  tease: [
    ['blush', -8, 14, '*她把视线移开，又移回来，嘴角出卖了她。* “你真是没救了。”'],
    ['shy', -5, 11, '*一声短促的、几乎算是笑的呼气。* “别闹。我十分钟后还要试装。”'],
  ],
  reassure: [
    ['neutral', -10, 6, '*她整个人静了一下，像是有什么落到了实处。* “……嗯。好。”'],
    ['shy', -12, 9, '“你其实不用说这些的。” *停了一下。* “谢谢。”'],
  ],
  deflect: [
    ['neutral', 2, -3, '*她很明显地把话题放下了。* “行。那说行程吧。”'],
    ['upset', 4, -2, '“随你。” *她转回去面对镜子。*'],
  ],
  press: [
    ['upset', 8, 5, '*她下颌绷紧。* “这跟你有什么关系？”'],
    ['surprised', -6, 16, '*她话说到一半停住。* “……你怎么知道的？”'],
  ],
  confide: [
    ['shy', -14, 12, '*她一句都没打断，这不太像她。* “这些事我以前不知道。”'],
    ['blush', -11, 15, '“你现在跟我说这个？” *声音低下去。* “在练习室里。”'],
  ],
  touch: [
    ['blush', -9, 20, '*她没有躲开。* “……会有人进来的。”'],
    ['surprised', -4, 18, '*她的手收紧了半秒，才想起来这是什么地方。*'],
  ],
  retreat: [
    ['neutral', 5, -6, '*她看着你走。* “明天见。”'],
    ['upset', 7, -4, '“就这样？行。” *她先转过了身。*'],
  ],
  joke: [
    ['happy', -6, 8, '*一声真笑，是她在镜头前藏起来的那种。* “太冷了。”'],
    ['happy', -4, 6, '“这个你憋很久了吧。” *她摇摇头。* “看得出来。”'],
  ],
  apologize: [
    ['neutral', -7, 4, '*她认真想了一下才回答。* “我知道。没事。”'],
    ['shy', -9, 7, '“这种事你不用道歉。” *顿了一下。* “不过谢谢。”'],
  ],
  invite: [
    ['surprised', -6, 13, '*她先看了一眼门口，这本身就是回答。* “什么时候？”'],
    ['shy', -3, 10, '“我得挪一下安排。” *她已经在想怎么挪了。*'],
  ],
};

export const PLAYER_LINES_ZH = {
  tease: ['你挺得意的', '昨天可不是这么说的', '你再说一遍'],
  reassure: ['我不会走', '你刚才做得很好', '慢慢来'],
  deflect: ['那，说说行程', '问问试装的事', '这事先放着'],
  press: ['问她刚才那句什么意思', '等她自己开口', '再问一次'],
  confide: ['跟她说那通电话', '承认你也紧张', '说真话'],
  touch: ['替她理一下衣领', '去牵她的手', '站近一点'],
  retreat: ['道晚安', '在更进一步之前离开', '退开一步'],
  joke: ['故意讲得更烂', '甩锅给编舞', '学那个腔调'],
  apologize: ['说你早该知道', '干脆认了', '认真道个歉'],
  invite: ['问她周日有没有空', '提议坐末班车', '说你可以等'],
};

export const THOUGHTS_ZH = [
  '她在想，你有没有注意到她的手在抖。',
  '她在数这栋楼里还剩下几个人。',
  '她正在决定，此刻不要说出那句想说的话。',
  '她知道这看上去像什么，而她没有走开。',
];

export const FALLBACK_ZH = ['neutral', -3, 4, '*她从手机上抬起头。* “你来了。”'];

/**
 * Opening beats, keyed the same way as the English table: how she is greeted
 * depends on what she was handed and on how close the two of you already are.
 */
export const OPENING_ZH = {
  /**
   * The item is NEVER named here, and the English table's `(it) =>` shape is
   * deliberately not mirrored.
   *
   * `item` is scraped out of the gift note, and that note is model-facing
   * English by design (section 8 keeps memory and every system note English).
   * So interpolating it put a raw English noun inside Chinese prose - a player
   * with no key, handed a hand warmer, read `*她没有马上接过a hand warmer。*`.
   * Offline is a supported mode (section 3), not a degraded one.
   *
   * There is nowhere to get a Chinese name from: the gift tables are English
   * and a fallback writer must never need a model call. Referring to it rather
   * than naming it costs nothing - she is holding the thing, and the player
   * just chose it.
   */
  knowledge: {
    reserved: [
      ['surprised', -16, 20, '*她把东西翻过来看了一眼，脸上出现了一个她在镜头前不会有的表情。* “你怎么知道我正需要这个？”'],
      ['blush', -14, 18, '*她没有马上接过去。* “这话我只说过一次。” *停顿。* “我以为没人在听。”'],
      ['shy', -15, 16, '*她翻来覆去看了看，然后认真地看向你。* “你一直有在注意。”'],
    ],
    close: [
      ['blush', -18, 24, '*她双手接过，指尖没有马上从你手上移开。* “你记得。” *更轻。* “你当然记得。”'],
      ['happy', -17, 22, '*她笑了一声，笑得不太稳。* “你真是——” *她停住了。* “谢谢。真的。”'],
      ['surprised', -16, 21, '*她低头看了看，又看看你，肩膀松了下来。* “不会有别人想到这个。”'],
    ],
  },
  generic: {
    reserved: [
      ['happy', -6, 8, '*她接过去，高兴，又有点被抓包的样子。* “哎——谢谢。你不用这样的。”'],
      ['neutral', -4, 6, '*她很规矩地双手接了过去。* “你有心了。真的。”'],
    ],
    close: [
      ['happy', -8, 11, '*她接过去，没有那套客气。* “你老是这样。” *她在笑。* “谢了。”'],
      ['shy', -7, 10, '*她冲你摇头，语气是纵容的。* “不用带的。带了我也高兴。”'],
    ],
  },
  gesture: {
    reserved: [
      ['surprised', -13, 15, () => '*她手上的动作完全停了。* “你记得这个。”'],
      ['shy', -12, 14, () => '*一段她没有去填的沉默。* “这话我大概只说过一次。”'],
      ['blush', -11, 13, () => '“这——” *她重新开口。* “你有在听。”'],
    ],
    close: [
      ['blush', -16, 20, () => '*她看了你一会儿，久了一点。* “你当然记得。”'],
      ['happy', -15, 19, () => '*她被逗笑了。* “你老是这样。” *更轻。* “别停。”'],
      ['shy', -14, 18, () => '*她没有马上回答，也没有移开视线。* “你总是能注意到。”'],
    ],
  },
  plain: {
    reserved: [
      ['neutral', -3, 4, () => '*她从手机上抬起头。* “你来了。”'],
      ['neutral', -2, 3, () => '*她没有立刻抬头。* “等我一下。” *她还是抬起了头。*'],
      ['happy', -5, 6, () => '*她先看见了你，在你看见她之前。* “你在这儿。”'],
    ],
    close: [
      ['happy', -7, 8, () => '*她本来就在看着门口，也不打算掩饰。* “你迟到了。”'],
      ['shy', -6, 7, () => '*她把包从旁边的位子上挪开，没等你开口。* “坐。”'],
      ['neutral', -5, 6, () => '*她继续拉伸，但肩膀的线条变了。* “我还在想你会不会来。”'],
    ],
  },
};

export const SUMMARY_ZH = '她们说了话，而谁都没有说那件事。';
