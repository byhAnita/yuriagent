/**
 * An offline stand-in for the model, so the game is playable with no API key.
 *
 * Not an attempt at good writing - it exists so the VN layer, the meters, the
 * beat reveal, the summarizer path and the scene-exit pipeline can all be
 * exercised end to end by a person, on a plane, for free. It emits the same
 * contract format as a real model, including the occasional format failure so
 * the tolerant parser gets exercised in real use rather than only in tests.
 */

import { makeRng, deriveSeed, pick } from '../systems/rng.js';

const LINES = {
  tease: [
    ['blush', -8, 14, '*She looks away, then back, and the corner of her mouth gives her away.* "You are unbelievable."'],
    ['shy', -5, 11, '*A short exhale that is almost a laugh.* "Do not start. I have a fitting in ten minutes."'],
  ],
  reassure: [
    ['neutral', -10, 6, '*She goes very still, the way she does when something lands.* "...Right. Okay."'],
    ['shy', -12, 9, '"You did not have to say that." *A pause.* "Thank you."'],
  ],
  deflect: [
    ['neutral', 2, -3, '*She lets it go, visibly.* "Sure. The schedule, then."'],
    ['upset', 4, -2, '"Fine." *She turns back to the mirror.*'],
  ],
  press: [
    ['upset', 8, 5, '*Her jaw sets.* "Why does it matter to you?"'],
    ['surprised', -6, 16, '*She stops mid-sentence.* "...How did you know that?"'],
  ],
  confide: [
    ['shy', -14, 12, '*She listens without interrupting, which is not like her.* "I did not know that about you."'],
    ['blush', -11, 15, '"You are telling me this now?" *Quieter.* "In a practice room."'],
  ],
  touch: [
    ['blush', -9, 20, '*She does not move away.* "...Someone could come in."'],
    ['surprised', -4, 18, '*Her hand tightens for half a second before she remembers where they are.*'],
  ],
  retreat: [
    ['neutral', 5, -6, '*She watches you go.* "See you tomorrow."'],
    ['upset', 7, -4, '"That is it? Okay." *She turns away first.*'],
  ],
  joke: [
    ['happy', -6, 8, '*A real laugh, the ugly one she hides on camera.* "That was terrible."'],
    ['happy', -4, 6, '"You have been saving that one." *She shakes her head.* "It shows."'],
  ],
  apologize: [
    ['neutral', -7, 4, '*She considers it properly before answering.* "I know. It is fine."'],
    ['shy', -9, 7, '"You do not have to apologise for that." *A beat.* "But thank you."'],
  ],
  invite: [
    ['surprised', -6, 13, '*She checks the door before she answers, which is its own answer.* "When?"'],
    ['shy', -3, 10, '"I would have to move things." *She is already thinking about how.*'],
  ],
};

const THOUGHTS = [
  'She is wondering whether you noticed her hands were shaking.',
  'She is counting how many people are still in the building.',
  'She is deciding, right now, not to say the thing she wants to say.',
  'She is aware this looks like something, and she has not moved away.',
];

const FALLBACK = ['neutral', -3, 4, '*She glances up from her phone.* "You came."'];

/**
 * Opening beats. A gift is answered before anything else, and the size of the
 * answer is the whole point of the knowledge economy: an iced coffee is nice,
 * and a hand warmer she never told anyone she needed is not the same event.
 */
const OPENING = {
  knowledge: [
    ['surprised', -16, 20, '*She turns it over once. Then she looks up at you completely differently.* "How did you..." *She stops, and starts again, quieter.* "Thank you."'],
    ['blush', -14, 18, '*A long pause with the thing still in both hands.* "I never said that out loud." *Beat.* "To anyone."'],
    ['shy', -15, 16, '"You were paying attention." *She says it like an accusation and does not let go of it.*'],
  ],
  generic: [
    ['happy', -6, 8, '*She takes it, pleased and a little caught out.* "Oh - thank you. You did not have to."'],
    ['neutral', -4, 6, '*She accepts it with both hands, the polite way.* "That is kind of you. Really."'],
  ],
  plain: [
    ['neutral', -3, 4, '*She glances up from her phone.* "You came."'],
    ['neutral', -2, 3, '*She does not look up straight away.* "Give me one second." *She does look up.*'],
    ['happy', -5, 6, '*She sees you first, before you see her.* "There you are."'],
  ],
};

let counter = 0;

/**
 * @param {object} opts - { seed, failureRate } failureRate emits an unformatted
 *   reply, so the parser tolerance in section 9 is exercised in real play.
 */
export function createMockClient({ seed = 7, failureRate = 0.08, delay = 260 } = {}) {
  return async function mockClient({ messages, preset, onChunk }) {
    const rng = makeRng(deriveSeed(seed, `mock:${counter++}`));
    await new Promise((r) => setTimeout(r, delay));

    if (preset === 'summarize') {
      return JSON.stringify({
        summary: 'They talked, and neither of them said the thing.',
        dossier_add: [],
      });
    }

    if (preset === 'thought') {
      return pick(rng, THOUGHTS);
    }

    const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const stance = /^\[(\w+)\]/.exec(last)?.[1];
    const speaker = /@([a-z0-9_]+)/.exec(messages[0]?.content ?? '')?.[1] ?? 'irene';
    const rosterMatch = /Present: ([A-Za-z]+) \(([a-z0-9_]+)\)/.exec(messages[0]?.content ?? '');
    const id = rosterMatch?.[2] ?? speaker;

    const opening = /write her opening beat/i.test(last);

    // Occasionally ignore the format contract entirely, the way a small model
    // does. The parser must render it as prose and move nothing. Never on the
    // opening beat - swallowing a gift reaction is the one failure that reads
    // as the game being broken rather than the model being small.
    if (!opening && rng() < failureRate) {
      const text = 'She does not answer straight away. The room is very quiet.';
      if (onChunk) for (let i = 0; i < text.length; i += 6) onChunk(text.slice(i, i + 6));
      return text;
    }

    // The opening beat is hers. If she was handed something, that comes first,
    // and the tier of the note decides how much of a moment it is.
    let pool = null;

    if (opening) {
      const conversation = messages.map((m) => m.content).join('\n');
      const knowledge = /paying very close attention/i.test(conversation);
      const generic = /an ordinary, thoughtful gesture/i.test(conversation);
      pool = knowledge ? OPENING.knowledge : generic ? OPENING.generic : OPENING.plain;
    } else {
      pool = LINES[stance] ?? null;
    }

    const [emotion, guard, fluster, prose] = pool ? pick(rng, pool) : FALLBACK;
    const text = `@${id}|${emotion}|guard${guard >= 0 ? '+' : ''}${guard}|fluster${fluster >= 0 ? '+' : ''}${fluster}\n${prose}`;

    if (onChunk) {
      for (let i = 0; i < text.length; i += 5) {
        onChunk(text.slice(i, i + 5));
        await new Promise((r) => setTimeout(r, 12));
      }
    }
    return text;
  };
}
