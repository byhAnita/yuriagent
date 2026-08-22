/**
 * An offline stand-in for the model, so the game is playable with no API key.
 *
 * Not an attempt at good writing - it exists so the VN layer, the meters, the
 * beat reveal, the summarizer path and the scene-exit pipeline can all be
 * exercised end to end by a person, on a plane, for free. It emits the same
 * contract format as a real model, including the occasional format failure so
 * the tolerant parser gets exercised in real use rather than only in tests.
 */

import { makeRng, deriveSeed, pick, clamp as clampMeter } from '../systems/rng.js';

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

/**
 * The player's side, for written chips (section 6). Short, in the player's
 * voice, and saying nothing the player could not already have seen - the same
 * constraint the live directive puts on the model.
 */
const PLAYER_LINES = {
  tease: ['You are enjoying this', 'That is not what you said yesterday', 'Say that again'],
  reassure: ['I am not going anywhere', 'You did fine out there', 'Take your time'],
  deflect: ['So. The schedule.', 'Ask about the fitting', 'Let it go for now'],
  press: ['Ask what she meant by that', 'Wait her out', 'Push once more'],
  confide: ['Tell her about the call', 'Admit you were nervous too', 'Say the true thing'],
  touch: ['Fix her collar', 'Reach for her hand', 'Stand closer'],
  retreat: ['Say goodnight', 'Leave before this goes further', 'Step back'],
  joke: ['Make it worse on purpose', 'Blame the choreographer', 'Do the voice'],
  apologize: ['Say you should have known', 'Own it, briefly', 'Apologise properly'],
  invite: ['Ask about Sunday', 'Suggest the late train', 'Offer to wait'],
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
 *
 * The real answer to "why does this reaction sound canned" is that a live model
 * writes it (section 11). This is the offline stand-in and it cannot invent
 * prose, so it does the two things a lookup table can do: name the actual
 * object, and pick its register from how close she already is. That is enough
 * that two different gifts at two different stages stop producing the same
 * sentence, which is what made the seams visible in play.
 *
 * Templates take the gift name, which is always a safe noun phrase. Dossier
 * facts are NOT spliced into her dialogue: they are written in the third person
 * ("hates cold hands"), a live model rephrases them and a template cannot, and
 * the result would read worse than the line it replaced.
 */
const OPENING = {
  knowledge: {
    reserved: [
      ['surprised', -16, 20, (it) => `*She turns the ${it} over once, and her face does something she does not let it do on camera.* "How did you know I needed this?"`],
      ['blush', -14, 18, (it) => `*She does not take the ${it} straight away.* "I only said that out loud once." *Beat.* "I did not think anyone was listening."`],
      ['shy', -15, 16, (it) => `"A ${it}." *She turns it over, then looks at you properly.* "You were paying attention."`],
    ],
    close: [
      ['blush', -18, 24, (it) => `*She takes the ${it} with both hands and does not let go of your fingers straight away.* "You remembered." *Quieter.* "Of course you remembered."`],
      ['happy', -17, 22, (it) => `*She laughs, once, and it comes out unsteady.* "A ${it}. You are so-" *She stops.* "Thank you. Really."`],
      ['surprised', -16, 21, (it) => `*She looks at the ${it}, then at you, and something in her shoulders drops.* "Nobody else would have thought of this."`],
    ],
  },
  generic: {
    reserved: [
      ['happy', -6, 8, (it) => `*She takes the ${it}, pleased and a little caught out.* "Oh - thank you. You did not have to."`],
      ['neutral', -4, 6, (it) => `*She accepts the ${it} with both hands, the polite way.* "That is kind of you. Really."`],
    ],
    close: [
      ['happy', -8, 11, (it) => `*She takes the ${it} without any of the polite performance.* "You always do this." *She is smiling.* "Thank you."`],
      ['shy', -7, 10, (it) => `"A ${it}?" *She shakes her head at you, fond about it.* "You did not have to. I am glad you did."`],
    ],
  },
  /**
   * She was handed nothing; the player led with something she once let slip.
   * The offline writer must not invent an object here either - that is the
   * whole point of the gesture note (section 11).
   */
  gesture: {
    reserved: [
      ['surprised', -13, 15, () => '*She stops what she is doing, completely.* "You remembered that."'],
      ['shy', -12, 14, () => '*A pause, and she does not fill it.* "I only said that once, I think."'],
      ['blush', -11, 13, () => '"That is - " *She starts again.* "You were listening."'],
    ],
    close: [
      ['blush', -16, 20, () => '*She looks at you for a moment too long.* "Of course you remembered."'],
      ['happy', -15, 19, () => '*She laughs, caught.* "You keep doing that." *Quieter.* "Do not stop."'],
      ['shy', -14, 18, () => '*She does not answer straight away, and does not look away either.* "You always notice."'],
    ],
  },
  plain: {
    reserved: [
      ['neutral', -3, 4, () => '*She glances up from her phone.* "You came."'],
      ['neutral', -2, 3, () => '*She does not look up straight away.* "Give me one second." *She does look up.*'],
      ['happy', -5, 6, () => '*She sees you first, before you see her.* "There you are."'],
    ],
    close: [
      ['happy', -7, 8, () => '*She was already watching the door, and does not pretend otherwise.* "You are late."'],
      ['shy', -6, 7, () => '*She moves her bag off the seat next to her before you ask.* "Sit."'],
      ['neutral', -5, 6, () => '*She keeps stretching, but the line of her shoulders changes.* "I wondered if you would come by."'],
    ],
  },
};

/** Which register: read off the standing sentence block 4 wrote (section 8). */
const CLOSE_MARKERS = /put a name to|said it out loud|stopped hiding|privately, and both of them know/i;

let counter = 0;

/**
 * @param {object} opts - { seed, failureRate, delay, chunkDelay }
 *   `failureRate` emits an unformatted reply, so the parser tolerance in
 *   section 9 is exercised in real play.
 *
 *   `delay: 0` means no pacing at all, including between stream chunks. It used
 *   to mean only "no think time" and the per-chunk 12ms stayed, so a headless
 *   campaign of ~950 turns spent seven minutes inside setTimeout pretending to
 *   type. A caller that wants the typing effect asks for it.
 */
export function createMockClient({
  seed = 7,
  failureRate = 0.08,
  delay = 260,
  chunkDelay = delay > 0 ? 12 : 0,
} = {}) {
  /**
   * One client instance is one scene (App memoises it on the scene number),
   * so the running meter reading lives here. It is reset by a new scene simply
   * getting a new client.
   */
  const state = {};

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

    // Written chips. The offline writer cannot make them scene-specific, but it
    // can honour the contract exactly - which is what the parser, the roster
    // rule and the backfill path need to be exercised in real play.
    if (preset === 'chips') {
      const asked = /Stances, once each: ([a-z, ]+)\./.exec(last)?.[1] ?? '';
      const stances = asked
        .split(',')
        .map((s) => s.trim())
        .filter((s) => PLAYER_LINES[s]);

      return stances
        .slice(0, 3)
        .map((s) => `${s}|${pick(rng, PLAYER_LINES[s])}`)
        .join('\n');
    }

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
    // the tier of the note decides how much of a moment it is, and how close she
    // already is decides the register.
    let pool = null;
    let item = 'thing';
    const conversation = messages.map((m) => m.content).join('\n');

    if (opening) {
      const knowledge = /paying very close attention/i.test(conversation);
      const generic = /an ordinary, thoughtful gesture/i.test(conversation);
      const gesture = /no gift and no object/i.test(conversation);
      const tier = gesture
        ? OPENING.gesture
        : knowledge
          ? OPENING.knowledge
          : generic
            ? OPENING.generic
            : OPENING.plain;

      item = /just handed \S+ an? ([a-z][a-z ]*?)\./i.exec(conversation)?.[1]?.trim() ?? item;
      pool = CLOSE_MARKERS.test(conversation) ? tier.close : tier.reserved;
    } else {
      pool = LINES[stance] ?? null;
    }

    const [emotion, guard, fluster, body] = pool ? pick(rng, pool) : FALLBACK;
    const prose = typeof body === 'function' ? body(item) : body;

    /**
     * The tables are written as movement; the contract wants state.
     *
     * Section 9's metadata line reports where she IS (0-100), so the offline
     * writer keeps a running reading and applies its own deltas to it. It has
     * to: the game is playable with no key and that is a supported mode, not a
     * degraded one, so the mock emitting a dialect the live model no longer
     * speaks would make offline play diverge from online play in the one system
     * the whole relationship model runs on.
     *
     * The opening value comes out of block 4, which now states it - the same
     * number the client seeds `newMeters` with. Falling back to a mid-scale
     * guess only matters for a caller that hands the mock no header at all,
     * which in practice means a unit test.
     */
    const stated = Number.parseInt(
      /starts this scene at guard(\d+)/.exec(conversation)?.[1] ?? '60',
      10,
    );
    // The opening beat IS the scene boundary, so reset there rather than
    // trusting one client to be one scene - a caller that reuses an instance
    // across scenes would otherwise carry her fluster from the last one into
    // the next, and a test that reuses one did exactly that.
    if (opening) {
      state.guard = stated;
      state.fluster = 0;
    } else {
      state.guard ??= stated;
      state.fluster ??= 0;
    }

    state.guard = clampMeter(state.guard + guard);
    state.fluster = clampMeter(state.fluster + fluster);

    const text = `@${id}|${emotion}|guard${state.guard}|fluster${state.fluster}\n${prose}`;

    if (onChunk) {
      for (let i = 0; i < text.length; i += 5) {
        onChunk(text.slice(i, i + 5));
        if (chunkDelay > 0) await new Promise((r) => setTimeout(r, chunkDelay));
      }
    }
    return text;
  };
}
