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
  openingDirective,
  closingDirective,
  interject,
  isGroupScene,
  turnTo,
  speakerOnPass,
} from '../../agent/sceneEngine.js';
import GiftModal from '../modals/GiftModal.jsx';
import { generateChips, suggestedStances, availableStances } from '../../systems/chips.js';
import { resolveStage } from '../../systems/relationship.js';
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
  /**
   * The knowledge economy, reachable from inside the scene.
   *
   * `{ dossierFor, credits, stock, usedGestures, give, say }`, where `give` and
   * `say` are App's spend functions and return the scene note to inject, or
   * null if the spend was refused. VNStage owns WHEN it happens and App owns
   * WHAT it costs - the same split the rest of the screen uses.
   *
   * Omitted, the control is simply not offered, which is what the tests that
   * do not care about openers get.
   */
  openers = null,
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
  const [session, setSession] = useState(() => beginScene(setup));
  const [queue, setQueue] = useState(newQueue);
  const [pending, setPending] = useState(false);
  const [thought, setThought] = useState(null);
  const [turn, setTurn] = useState(0);
  /** The opener sheet, over the scene rather than in front of it. */
  const [openerOpen, setOpenerOpen] = useState(false);
  /** Somebody in the room is answering, after the addressee already has. */
  const [roomPending, setRoomPending] = useState(false);
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
   * WHO IS SPEAKING and WHO THE PLAYER IS TALKING TO are not the same person,
   * and treating them as one was a bug the player would meet every turn.
   *
   * The stage used to draw `focusId` - the addressee - for everything: the big
   * portrait, the name over the dialogue, the stage light. So when somebody
   * else joined in, her line appeared under the addressee's face with the
   * addressee's name on it. Survivable while a second voice was rare; now that
   * one arrives most turns, most lines in a group scene would be attributed to
   * the wrong woman.
   *
   * The beat says who said it. The addressee stays where the player's attention
   * is pointed, and the row marks it so that stays visible while somebody else
   * has the floor.
   */
  const speakingId = queue.current?.speaker ?? session.addresseeId ?? session.focusId;
  const speakingCard = setup.cards.find((c) => c.id === speakingId) ?? focusCard;

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
  /**
   * The same roll, for whoever is asked about.
   *
   * A function rather than a value because `turnTo` needs the set belonging to
   * a member this render has not seen yet - and the fallback a chip call
   * backfills from has to be HER legal set, not the previous addressee's.
   */
  const stancesFor = useCallback(
    (r) => generateChips(r, { energy: setup.player.energy, seed: setup.scene.seed ?? 1, turn }),
    [setup.player.energy, setup.scene.seed, turn],
  );

  const staticChips = useMemo(
    () => stancesFor(rel).map((stance) => ({ stance, label: null })),
    [stancesFor, rel],
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
    const base = speakingCard.palette.base;
    const strength = emotion === 'blush' ? 30 : emotion === 'upset' ? 8 : 18;
    return `color-mix(in srgb, ${base} ${strength}%, transparent)`;
  }, [speakingCard.palette.base, emotion]);

  /**
   * Ask for written labels for the turn the player is about to take.
   *
   * Fired at stream end and never awaited: it runs while the player is reading
   * the beats she just spoke. Two ways it comes to nothing, both silent - the
   * player already moved on, or the model gave us nothing usable and the static
   * set stands.
   */
  const requestWrittenChips = useCallback(
    async (frame, token, { relFor = rel, addresseeId = session.addresseeId } = {}) => {
      /**
       * The relation is a PARAMETER because `turnTo` needs a set for somebody
       * this render has not seen yet. `rel` follows `session.focusId`, and
       * `setSession` has not landed when the turn handler runs - so reading it
       * off the closure would ask for Yeri's chips using Nana's stage, strain
       * band and jealousy band, and `parseChips` would then drop every stance
       * that is legal for one and not the other.
       */
      const { available } = availableStances(relFor, { energy: setup.player.energy });
      const absentNames = setup.cards
        .filter((c) => !frame.rosterIds.includes(c.id))
        .map((c) => c.name);

      /**
       * Who the player is talking to, in a group scene only.
       *
       * The labels are what the player SAYS to her, so after a turn the model
       * has to be told the room's attention moved - otherwise it writes the
       * next line at whoever last spoke. Six tokens, and a one-member scene
       * sends nothing extra, so an ordinary scene's directive is unchanged.
       */
      const toName =
        (frame.rosterIds ?? []).length > 1
          ? (setup.cards.find((c) => c.id === addresseeId)?.name ?? null)
          : null;

      const { chips: got, ok } = await writeChips({
        frame,
        client,
        available,
        fallback: relFor === rel ? staticRef.current : stancesFor(relFor),
        absentNames,
        addresseeName: toName,
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
    [client, rel, stancesFor, session.addresseeId, setup.cards, setup.lang, setup.player.energy],
  );

  /**
   * Run one turn against an EXPLICIT session, rather than the one in state.
   *
   * Every caller but one wants the current session and uses `send` below. The
   * exception is an opener, which moves the addressee and then immediately
   * sends - `setSession` has not landed by then, so reading state would send
   * the note to whoever the player was talking to before.
   */
  const sendFrom = useCallback(
    async (
      from,
      { stance, text, note = null, gesture = false, opening = false, speakerId = null },
    ) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setThought(null);
      setQueue(reset());
      setWritten(null);
      const token = (turnToken.current += 1);

      try {
        let next = await runTurn(from, {
          stance,
          text,
          note,
          gesture,
          client,
          speakerId,
          cast: setup.cards,
          onBeat: (beat) => setQueue((q) => enqueue(q, [beat])),
        });
        setSession(next);
        if (!opening) setTurn((n) => n + 1);

        /**
         * Somebody else joins in, or cuts in.
         *
         * `pending` is cleared FIRST, so the addressee's beats are readable
         * while the second call streams - the player is reading either way,
         * and making them wait on a call whose whole purpose is to feel
         * spontaneous is the wrong trade.
         *
         * `roomPending` is what replaces it, and it is not decoration. `busy`
         * already stopped a second turn starting on top of this one, but it is
         * a ref: the BAR did not know, so on any turn where the addressee
         * answered in a single beat the chips went live while the call was
         * still running and every tap was silently swallowed. That is exactly
         * the frozen screen section 6 keeps warning about, and it became the
         * common case the moment a second voice started arriving most turns
         * rather than almost never.
         */
        if (isGroupScene(next)) {
          setPending(false);
          setRoomPending(true);
          try {
            const { session: after } = await interject(next, {
              client,
              relations: setup.relations,
              cards: setup.cards,
              onBeat: (beat) => setQueue((q) => enqueue(q, [beat])),
            });
            next = after;
            setSession(after);
          } finally {
            setRoomPending(false);
          }
        }

        if (chipCooldown.current > 0) chipCooldown.current -= 1;
        else if (writtenChips) {
          // Deliberately not awaited. The turn is over as far as the UI cares.
          // The addressee comes off `next`, not off state, for the same reason
          // `sendFrom` exists: an opener moves it and `setSession` has not
          // landed yet.
          requestWrittenChips(next.frame, token, {
            relFor: setup.relations[next.addresseeId] ?? rel,
            addresseeId: next.addresseeId,
          });
        }
      } finally {
        setPending(false);
        busy.current = false;
      }
    },
    [client, writtenChips, requestWrittenChips, rel, setup.cards, setup.relations],
  );

  /**
   * The last turn of a scene says so.
   *
   * Only the client knows which turn is last - the model cannot see the budget,
   * and section 6 measured that handing it one makes the pacing worse. Saying
   * "this is the last one" once, on the turn that is, needs no budget and is
   * exactly the fact the model is missing.
   *
   * Appended to whatever note the turn already carries, so an opener spent on
   * the final turn still gets its reaction and still gets a goodbye.
   */
  const send = useCallback(
    (args) => {
      const last = turnLimit - turn <= 1 && !args.opening;
      const note = last
        ? [args.note, closingDirective()].filter(Boolean).join(' ')
        : args.note;
      return sendFrom(session, { ...args, note });
    },
    [sendFrom, session, turnLimit, turn],
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
      if (id === session.addresseeId) return;

      setSession((sn) => turnTo(sn, id, setup.relations));

      /**
       * Drop the old set AND ask for a new one.
       *
       * Only the first half existed, so tapping a portrait downgraded the
       * player to static labels until they had spent a turn - in a group
       * scene, where turning is the commonest move there is, that was most of
       * the scene. It read in play as the options going dead (section 6).
       *
       * The token moves so a set for the member the player just turned away
       * from is discarded when it lands, and the relation is passed rather
       * than read off the closure because `setSession` has not landed yet.
       */
      setWritten(null);
      const token = (turnToken.current += 1);
      if (chipCooldown.current === 0 && writtenChips) {
        requestWrittenChips(session.frame, token, {
          relFor: setup.relations[id],
          addresseeId: id,
        });
      }
    },
    [session, setup.relations, writtenChips, requestWrittenChips],
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

  /**
   * Hand something over, or bring something up, as this turn.
   *
   * Three things happen in one move and the order matters:
   *
   * 1. The addressee moves to whoever is being given to. A gift IS a way of
   *    addressing somebody (section 10c), so choosing her in the sheet and then
   *    still talking to the last person would be two contradictory answers to
   *    the same question.
   * 2. App spends the credits / the gesture / the dish and hands back the note.
   *    It may refuse - an opener that stopped being affordable between the sheet
   *    opening and the tap - in which case nothing at all happens, which is the
   *    right failure: the player is out a tap and not a turn.
   * 3. The note goes in as this turn, and she answers it.
   *
   * Note that `turnTo` returns a NEW session and `setSession` is asynchronous,
   * so the send has to be given the moved session directly rather than reading
   * it back off state - otherwise the note lands addressed to whoever the
   * player was talking to a moment ago, which in a group scene means giving
   * Nana's present to Irene.
   */
  const spendOpener = useCallback(
    (memberId, spend) => {
      if (busy.current) return;
      const note = spend();
      if (!note) return;

      setOpenerOpen(false);
      const moved = turnTo(session, memberId, setup.relations);
      if (moved !== session) setSession(moved);
      /**
       * `gesture` is what lifts the scene to witnessed, and it is passed here
       * rather than inferred from the note (section 5b). Handing something
       * over in front of the room is the overt move; the closing directive
       * travelling by the same door is not, and inferring it from the note
       * made every group scene in the game end witnessed.
       */
      sendFrom(moved, { note, gesture: true, speakerId: memberId });
    },
    [session, setup.relations, sendFrom],
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
  /**
   * Three reasons the bar is not usable and they are not the same reason.
   *
   * `pending` is "wait"; unread beats are "your move, after you read this";
   * `roomPending` is "somebody else is still answering". The third one used to
   * be invisible, which made the bar look live while it was not.
   */
  const roomSpeaking = roomPending && !hasMore(queue);
  const barDisabled = pending || roomPending || hasMore(queue);

  // Opening beat, so the player walks into something rather than a blank room.
  useEffect(() => {
    send({ text: openingDirective(setup.lang), opening: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Who may be handed something: whoever may speak.
   *
   * The roster and not the room, deliberately. Handing a present to somebody
   * who is standing there but cannot answer produces a gift nobody reacts to,
   * and section 9's roster rule would drop her beat anyway.
   */
  const openerRoster = useMemo(
    () => setup.cards.filter((c) => session.frame.rosterIds.includes(c.id)),
    [setup.cards, session.frame.rosterIds],
  );

  const openerCard =
    openerRoster.find((c) => c.id === session.addresseeId) ?? openerRoster[0] ?? focusCard;

  return (
    <div
      className="stage stage-fill mx-auto flex w-full max-w-[26rem] flex-col"
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
              speakingId={speakingId}
              addresseeId={session.addresseeId}
              emotion={emotion}
              pulseKey={queue.shown}
              onTurnTo={onTurnTo}
              disabled={pending}
              t={t}
            />
          ) : (
            <Portrait card={speakingCard} emotion={emotion} pulseKey={queue.shown} />
          )}
        </div>
        <div className="grain" />
      </div>

      <MeterBar
        meters={session.meters}
        exposure={session.exposure}
        // Only when somebody who is not the addressee might be on screen.
        ofName={group ? focusCard.name : null}
        /**
         * The one thing on this screen that does NOT reset at the door.
         *
         * Without it `fluster 0` at the top of a scene reads as her affection
         * having gone back to zero, which is how the first played anchor event
         * was reported: she ended the meeting at `fluster 28` and opened the
         * next afternoon at 0. Both numbers were right; nothing said they were
         * a different kind of thing from `intimacy`.
         */
        standing={t(`stage.${resolveStage(rel.intimacy, rel.admissibility)}`)}
        t={t}
      />

      <div className="px-5">
        <DialogueBox
          beat={queue.current}
          speakerName={speakingCard.name}
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
        toName={group ? focusCard?.name ?? null : null}
        outOfTurns={outOfTurns}
        awaitingRead={awaitingRead}
        roomSpeaking={roomSpeaking}
        onPass={group ? onPass : null}
        onOpener={openers ? () => setOpenerOpen(true) : null}
        onAdvance={() => setQueue(advance)}
        disabled={barDisabled}
        t={t}
      />

      {openerOpen && openers ? (
        <GiftModal
          card={openerCard}
          dossier={openers.dossierFor(openerCard.id)}
          credits={openers.credits}
          stock={openers.stock}
          usedGestures={openers.usedGestures}
          roster={openerRoster}
          onChoose={onTurnTo}
          onPick={(giftId) => spendOpener(openerCard.id, () => openers.give(giftId, openerCard))}
          onGesture={(giftId) => spendOpener(openerCard.id, () => openers.say(giftId, openerCard))}
          onSkip={() => setOpenerOpen(false)}
          t={t}
        />
      ) : null}
    </div>
  );
}
