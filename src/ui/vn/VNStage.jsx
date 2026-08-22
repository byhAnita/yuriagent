/**
 * The scene. CLAUDE.md sections 6, 9, 14.
 *
 * Assembles the VN layer and drives one scene through sceneEngine. The stage
 * light takes its hue from the speaking member's palette, which is the one
 * place the character data is allowed to reach the visual layer directly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Portrait from './Portrait.jsx';
import MeterBar from './MeterBar.jsx';
import DialogueBox from './DialogueBox.jsx';
import ChipBar from './ChipBar.jsx';
import ThoughtBubble from './ThoughtBubble.jsx';
import SceneHeader from './SceneHeader.jsx';
import { newQueue, enqueue, advance, hasMore, reset } from './beatQueue.js';
import {
  beginScene,
  runTurn,
  readHer,
  endScene,
  openWithGift,
  openingDirective,
} from '../../agent/sceneEngine.js';
import { generateChips, suggestedStances, availableStances } from '../../systems/chips.js';
import { writeChips } from '../../agent/chipWriter.js';
import {
  READ_HER_USES_PER_SCENE,
  SCENE_TURN_LIMIT,
  CHIP_FAILURES_BEFORE_GIVING_UP,
} from '../../config/constants.js';
import { makeRng } from '../../systems/rng.js';

export default function VNStage({ setup, client, giftNote, onSceneEnd, writtenChips = true, t }) {
  // A gift is injected at the head of block 5, before the first call, so the
  // model opens the scene by reacting to it (CLAUDE.md section 11).
  const [session, setSession] = useState(() => {
    const opened = beginScene(setup);
    return giftNote ? openWithGift(opened, giftNote) : opened;
  });
  const [queue, setQueue] = useState(newQueue);
  const [pending, setPending] = useState(false);
  const [thought, setThought] = useState(null);
  const [turn, setTurn] = useState(0);
  const busy = useRef(false);

  const focusCard = setup.cards.find((c) => c.id === session.focusId);
  const rel = setup.relations[session.focusId];

  const emotion = queue.current?.emotion ?? 'neutral';

  /**
   * The deterministic set. Rendered instantly, every turn, no matter what.
   * Written chips replace it only if they arrive before the bar goes live
   * (CLAUDE.md section 6), so nothing here ever waits on a model.
   */
  const staticChips = useMemo(
    () =>
      generateChips(rel, { energy: setup.player.energy, seed: setup.scene.seed ?? 1, turn }).map(
        (stance) => ({ stance, label: null }),
      ),
    [rel, setup.player.energy, setup.scene.seed, turn],
  );

  const [written, setWritten] = useState(null);
  const chips = written ?? staticChips;
  const suggested = useMemo(() => suggestedStances(rel), [rel]);

  /**
   * Relabelling a button under the player's finger is a misclick, so a written
   * set is only accepted while the bar is still disabled. `barLive` is a ref
   * rather than state because it is read inside an async callback, where a
   * captured value would be stale - the same trap that once cost a task its
   * credits in `advance()`.
   */
  const barLive = useRef(false);
  const turnToken = useRef(0);
  const chipFailures = useRef(0);

  /**
   * The stances currently on the bar, for backfilling a partial written set.
   * A ref, so it is read live rather than captured - `rel` cannot change
   * mid-scene, so whatever is in here is always a legal set.
   */
  const staticRef = useRef([]);
  staticRef.current = staticChips.map((c) => c.stance);

  const readHerLeft = READ_HER_USES_PER_SCENE - session.frame.readHerUsed;

  /** A scene occupies one time block, so it cannot run forever. */
  const turnsLeft = SCENE_TURN_LIMIT - turn;
  const outOfTurns = turnsLeft <= 0;

  /** The stage light warms or cools with what she is feeling. */
  const stageGlow = useMemo(() => {
    const base = focusCard.palette.base;
    const strength = emotion === 'blush' ? 30 : emotion === 'upset' ? 8 : 18;
    return `color-mix(in srgb, ${base} ${strength}%, transparent)`;
  }, [focusCard.palette.base, emotion]);

  /**
   * Ask for written labels for the turn the player is about to take.
   *
   * Fired at stream end and never awaited: it runs while the player taps
   * through the beats she just spoke. Three ways it comes to nothing, all
   * silent - the bar went live first, the player already moved on, or the model
   * gave us nothing usable and the static set stands.
   */
  const requestWrittenChips = useCallback(
    async (frame, token) => {
      const { available } = availableStances(rel, { energy: setup.player.energy });
      const absentNames = setup.cards
        .filter((c) => !frame.rosterIds.includes(c.id))
        .map((c) => c.name);

      const { chips: got, ok } = await writeChips({
        frame,
        client,
        available,
        fallback: staticRef.current,
        absentNames,
        lang: setup.lang,
      });

      chipFailures.current = ok ? 0 : chipFailures.current + 1;

      if (token !== turnToken.current || barLive.current) return;
      if (got.some((c) => c.label)) setWritten(got);
    },
    [client, rel, setup.cards, setup.lang, setup.player.energy],
  );

  const send = useCallback(
    async ({ stance, text, opening = false }) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setThought(null);
      setQueue(reset());
      setWritten(null);
      const token = (turnToken.current += 1);

      try {
        const next = await runTurn(session, {
          stance,
          text,
          client,
          onBeat: (beat) => setQueue((q) => enqueue(q, [beat])),
        });
        setSession(next);
        if (!opening) setTurn((n) => n + 1);

        if (writtenChips && chipFailures.current < CHIP_FAILURES_BEFORE_GIVING_UP) {
          // Deliberately not awaited. The turn is over as far as the UI cares.
          requestWrittenChips(next.frame, token);
        }
      } finally {
        setPending(false);
        busy.current = false;
      }
    },
    [session, client, writtenChips, requestWrittenChips],
  );

  const onReadHer = useCallback(async () => {
    if (busy.current || readHerLeft <= 0) return;
    busy.current = true;
    setPending(true);
    try {
      const { session: next, thought: got } = await readHer(session, { client });
      setSession(next);
      setThought(got);
    } finally {
      setPending(false);
      busy.current = false;
    }
  }, [session, client, readHerLeft]);

  const leave = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const result = await endScene(session, {
        client,
        memory: setup.memory,
        relations: setup.relations,
        cards: setup.cards,
        scene: setup.scene,
        rng: makeRng(setup.scene.seed ?? 1),
      });
      onSceneEnd(result);
    } finally {
      busy.current = false;
    }
  }, [session, client, setup, onSceneEnd]);

  // The bar is live exactly when it is not disabled, so the two can never drift.
  const barDisabled = pending || hasMore(queue);
  useEffect(() => {
    barLive.current = !barDisabled;
  }, [barDisabled]);

  // Opening beat, so the player walks into something rather than a blank room.
  useEffect(() => {
    send({ text: openingDirective(Boolean(giftNote)), opening: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="stage mx-auto flex h-dvh w-full max-w-[26rem] flex-col"
      style={{ '--stage-glow': stageGlow }}
    >
      <SceneHeader {...setup.scene} turnsLeft={turnsLeft} onExit={leave} t={t} />

      <div className="relative min-h-0 flex-1">
        <ThoughtBubble text={thought} onDismiss={() => setThought(null)} label={t('vn.readHer')} />
        <div className="h-full pb-2 pt-2">
          <Portrait card={focusCard} emotion={emotion} pulseKey={queue.shown} />
        </div>
        <div className="grain" />
      </div>

      <MeterBar meters={session.meters} exposure={session.exposure} t={t} />

      <div className="px-5">
        <DialogueBox
          beat={queue.current}
          speakerName={focusCard.name}
          hasMore={hasMore(queue)}
          onAdvance={() => setQueue(advance)}
          pending={pending}
          placeholder={outOfTurns ? t('vn.outOfTurns') : t('vn.thinking')}
        />
      </div>

      <ChipBar
        chips={chips}
        suggested={suggested}
        onStance={(stance) => send({ stance })}
        onFreeText={(text) => send({ text })}
        onReadHer={onReadHer}
        onLeave={leave}
        readHerLeft={readHerLeft}
        turnsLeft={turnsLeft}
        outOfTurns={outOfTurns}
        disabled={barDisabled}
        t={t}
      />
    </div>
  );
}
