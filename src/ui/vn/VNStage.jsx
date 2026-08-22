/**
 * The scene. CLAUDE.md sections 6, 9, 14.
 *
 * Assembles the VN layer and drives one scene through sceneEngine. The stage
 * light takes its hue from the speaking member's palette, which is the one
 * place the character data is allowed to reach the visual layer directly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Portrait from './Portrait.jsx';
import PortraitRow from './PortraitRow.jsx';
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
  interject,
  isGroupScene,
  turnTo,
  speakerOnPass,
} from '../../agent/sceneEngine.js';
import { generateChips, suggestedStances, availableStances } from '../../systems/chips.js';
import { relanguage } from '../../agent/promptBuilder.js';
import { writeChips } from '../../agent/chipWriter.js';
import {
  READ_HER_USES_PER_SCENE,
  SCENE_TURN_LIMIT,
  CHIP_FAILURES_BEFORE_GIVING_UP,
  CHIP_COOLDOWN_TURNS,
} from '../../config/constants.js';
import { makeRng } from '../../systems/rng.js';

/**
 * What the player's turn says when they choose to say nothing.
 *
 * A model handed an empty turn writes the player a line, which breaks pillar
 * 3 - the player never writes her side and never has words put in their mouth.
 * Naming the silence instead keeps it the player's move.
 */
const PASS_DIRECTIVE = '(says nothing, and lets the room carry it)';

export default function VNStage({
  setup,
  client,
  giftNote,
  onSceneEnd,
  writtenChips = true,
  /**
   * A whole-day scene gets a longer budget and a different register
   * (proposal 13). Ordinary blocks stay terse on purpose - pillar 1 is 30-50
   * word bursts, and the contrast is what makes a date feel like one.
   */
  turnLimit = SCENE_TURN_LIMIT,
  /** True when the last call failed and the offline writer answered instead. */
  offline = false,
  t,
}) {
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

  /**
   * A language switch mid-scene has to reach the prefix.
   *
   * The session is initial state, so blocks 1-4 keep whatever language the
   * scene opened in - while the chip directive is rebuilt from live settings
   * every turn. That put Chinese buttons under English dialogue, which is what
   * was reported. `relanguage` rebuilds the prefix and carries block 5 over;
   * section 8's invariant 1 exists to stop the prefix churning every turn, not
   * to make a deliberate settings change silently not work.
   */
  const openedLang = useRef(setup.lang);
  useEffect(() => {
    if (openedLang.current === setup.lang) return;
    openedLang.current = setup.lang;
    setSession((s) => ({ ...s, frame: relanguage(s.frame, setup) }));
  }, [setup]);

  const focusCard = setup.cards.find((c) => c.id === session.focusId);
  const rel = setup.relations[session.focusId];

  /**
   * More than one member may answer, so the stage grows a row and the bar
   * grows a pass. A one-member scene is byte-for-byte what it was.
   */
  const group = isGroupScene(session);

  const emotion = queue.current?.emotion ?? 'neutral';

  /**
   * The deterministic set. Rendered instantly, every turn, no matter what, and
   * replaced in place if a written set arrives (CLAUDE.md section 6). Nothing
   * here ever waits on a model.
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
   * One turn, one token. A written set that comes back after the player has
   * already moved on belongs to a turn that no longer exists, so it is dropped.
   *
   * This used to ALSO require the bar to still be disabled, on the theory that
   * relabelling a live button is a misclick. That was backwards in practice: a
   * one-beat reply makes the bar live the instant the turn resolves, which is
   * about a second before the chip call returns, so the written set was thrown
   * away in the common case and the player only ever saw the static labels. The
   * geometry is stable now (the bar is always a stack), so a swap changes words
   * in place and never moves a button out from under a finger.
   */
  const turnToken = useRef(0);
  const chipFailures = useRef(0);
  const chipCooldown = useRef(0);

  /**
   * The stances currently on the bar, for backfilling a partial written set.
   * A ref, so it is read live rather than captured - `rel` cannot change
   * mid-scene, so whatever is in here is always a legal set.
   */
  const staticRef = useRef([]);
  staticRef.current = staticChips.map((c) => c.stance);

  const readHerLeft = READ_HER_USES_PER_SCENE - session.frame.readHerUsed;

  /** A scene occupies one time block, so it cannot run forever. */
  const turnsLeft = turnLimit - turn;
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
   * Fired at stream end and never awaited: it runs while the player is reading
   * the beats she just spoke. Two ways it comes to nothing, both silent - the
   * player already moved on, or the model gave us nothing usable and the static
   * set stands.
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

      if (ok) {
        chipFailures.current = 0;
      } else if ((chipFailures.current += 1) >= CHIP_FAILURES_BEFORE_GIVING_UP) {
        // Stand down for a few turns rather than for the rest of the scene.
        chipFailures.current = 0;
        chipCooldown.current = CHIP_COOLDOWN_TURNS;
      }

      if (token !== turnToken.current) return;
      if (got.some((c) => c.label)) setWritten(got);
    },
    [client, rel, setup.cards, setup.lang, setup.player.energy],
  );

  const send = useCallback(
    async ({ stance, text, opening = false, speakerId = null }) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setThought(null);
      setQueue(reset());
      setWritten(null);
      const token = (turnToken.current += 1);

      try {
        let next = await runTurn(session, {
          stance,
          text,
          client,
          speakerId,
          cast: setup.cards,
          onBeat: (beat) => setQueue((q) => enqueue(q, [beat])),
        });
        setSession(next);
        if (!opening) setTurn((n) => n + 1);

        /**
         * Somebody else may take it upon herself.
         *
         * `pending` is cleared FIRST, so her beats are readable while the
         * second call streams - the player is reading either way, and making
         * them wait on a call whose whole purpose is to feel spontaneous is
         * the wrong trade. `busy` stays set, so no new turn can start on top
         * of it.
         *
         * Nobody clears the bar on most turns, and that is the design: an
         * interjection every turn is a scene where nobody finishes a
         * sentence (INTERJECT_THRESHOLD).
         */
        if (isGroupScene(next)) {
          setPending(false);
          const { session: after } = await interject(next, {
            client,
            relations: setup.relations,
            cards: setup.cards,
            onBeat: (beat) => setQueue((q) => enqueue(q, [beat])),
          });
          next = after;
          setSession(after);
        }

        if (chipCooldown.current > 0) chipCooldown.current -= 1;
        else if (writtenChips) {
          // Deliberately not awaited. The turn is over as far as the UI cares.
          requestWrittenChips(next.frame, token);
        }
      } finally {
        setPending(false);
        busy.current = false;
      }
    },
    [session, client, writtenChips, requestWrittenChips, setup.cards, setup.relations],
  );

  /**
   * Turn to somebody else in the room.
   *
   * Costs no turn and makes no call. It changes who answers next, which is the
   * point: the addressee is sticky, so choosing is only paid for when the
   * player actually wants to change it.
   */
  const onTurnTo = useCallback(
    (id) => {
      if (busy.current) return;
      setSession((sn) => turnTo(sn, id, setup.relations));
      setWritten(null);
    },
    [setup.relations],
  );

  /**
   * Let the room breathe.
   *
   * Not a skip button. The player says nothing, and whoever has most at stake
   * fills the silence whether or not she clears the interjection bar - which
   * is how a group scene keeps moving without the player having to drive every
   * line of it.
   */
  const onPass = useCallback(() => {
    send({ text: PASS_DIRECTIVE, speakerId: speakerOnPass(session, setup.relations) });
  }, [send, session, setup.relations]);

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
      // Usually this unmounts, so clearing pending is moot - but if the exit
      // fails, leaving it set would strand the player on a scene whose chips
      // and Leave button are both dead. Nothing may end a turn stuck busy.
      setPending(false);
      busy.current = false;
    }
  }, [session, client, setup, onSceneEnd]);

  /**
   * Two different reasons the bar is not usable, and they need different words.
   * A call in flight is "wait"; unread beats are "your move, after you read
   * this" - and section 6 already learned that a disabled control with no
   * explanation reads as a frozen screen.
   */
  const awaitingRead = !pending && hasMore(queue);
  const barDisabled = pending || hasMore(queue);

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
          {group ? (
            <PortraitRow
              cards={setup.cards}
              rosterIds={session.frame.rosterIds}
              addresseeId={session.addresseeId}
              emotion={emotion}
              pulseKey={queue.shown}
              onTurnTo={onTurnTo}
              disabled={pending}
              t={t}
            />
          ) : (
            <Portrait card={focusCard} emotion={emotion} pulseKey={queue.shown} />
          )}
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

        {/*
          Say when the model did not answer.

          Without it the player reads a canned line in her voice and believes
          the model wrote it. Quiet rather than alarming: the beat is real,
          the scene continues, and section 3 treats the offline writer as a
          supported mode - this only marks that it was reached for when it
          was not supposed to be.
        */}
        {offline ? (
          <p className="mt-1.5 font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-warn">
            {t('vn.modelDown')}
          </p>
        ) : null}
      </div>

      <ChipBar
        chips={chips}
        suggested={suggested}
        exposure={session?.exposure ?? 0}
        onStance={(stance) => send({ stance })}
        onFreeText={(text) => send({ text })}
        onReadHer={onReadHer}
        onLeave={leave}
        readHerLeft={readHerLeft}
        turnsLeft={turnsLeft}
        outOfTurns={outOfTurns}
        awaitingRead={awaitingRead}
        onPass={group ? onPass : null}
        onAdvance={() => setQueue(advance)}
        disabled={barDisabled}
        t={t}
      />
    </div>
  );
}
