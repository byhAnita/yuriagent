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
import { generateChips, suggestedStances } from '../../systems/chips.js';
import { READ_HER_USES_PER_SCENE, SCENE_TURN_LIMIT } from '../../config/constants.js';
import { makeRng } from '../../systems/rng.js';

export default function VNStage({ setup, client, giftNote, onSceneEnd, t }) {
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

  const chips = useMemo(
    () => generateChips(rel, { energy: setup.player.energy, seed: setup.scene.seed ?? 1, turn }),
    [rel, setup.player.energy, setup.scene.seed, turn],
  );
  const suggested = useMemo(() => suggestedStances(rel), [rel]);

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

  const send = useCallback(
    async ({ stance, text, opening = false }) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setThought(null);
      setQueue(reset());

      try {
        const next = await runTurn(session, {
          stance,
          text,
          client,
          onBeat: (beat) => setQueue((q) => enqueue(q, [beat])),
        });
        setSession(next);
        if (!opening) setTurn((n) => n + 1);
      } finally {
        setPending(false);
        busy.current = false;
      }
    },
    [session, client],
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
        disabled={pending || hasMore(queue)}
        t={t}
      />
    </div>
  );
}
