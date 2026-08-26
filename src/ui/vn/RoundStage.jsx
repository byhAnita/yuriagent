/**
 * The scene. CLAUDE.md Part I.3.
 *
 * Replaces `VNStage.jsx`, and the difference is one sentence: v1 ran up to
 * twenty-five model calls a scene and this runs five. There is no chip call, no
 * interjection call, no summarizer call and no beat queue - the prose, the four
 * options, her emotion, every delta and the scene's one summary all come out of
 * the same request, which is the whole saving and the reason the wire format is
 * not JSON.
 *
 * WHAT IS ON SCREEN, AND WHY IT IS NOT HIDDEN. Both axes, for the woman whose
 * portrait is up, plus everything else one tap away (Part I.2). v1 concealed the
 * numbers and handed the player a labelled lever instead, which is the worst of
 * both. `Read her` is the only hidden state left.
 *
 * STREAMING IS THE LATENCY STRATEGY. Prose is shown from the first token and the
 * options land when the round closes - about 1.2s to first word against ~4s for
 * a complete round. There is no beat reveal because there is nothing to hide
 * behind any more.
 *
 * ONE SCREEN, AND THE PROSE IS THE ONLY THING THAT SCROLLS.
 *
 * Reported from play: the scene ran about 1.5 viewports tall at font scale 1, so
 * every single round had to be scrolled past before it could be answered. The
 * cause is that `.stage-fill` is a FIXED height and every child here was sized by
 * its own content - a flex item defaults to `min-height: auto`, so nothing could
 * give and the whole column simply overflowed the page.
 *
 * The fix is to name which element yields. Header, value strip and options are
 * fixed; the portrait takes the slack and falls to a floor; the dialogue box is
 * the one thing whose length the code does not control - ~80 words of instruction
 * comes back as 240-330 characters in `zh` - so it shrinks last and scrolls
 * inside itself. A long round costs a scroll in the text box; it never costs the
 * options their place under the player's thumb.
 *
 * The root keeps `overflow-y-auto` rather than `hidden`, and that is a belt
 * rather than the fix. The column below is what removes the routine scroll; this
 * is what happens when it is not enough - a `zh` string at font scale 1.25 that
 * pushes the fixed rows past the viewport gets a scrollbar instead of being
 * clipped. Section 20 has the version of this that shipped: a sheet that grew off
 * the top of the screen took its close button with it, and the run stopped there.
 * Nothing on this screen may become unreachable.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Portrait from './Portrait.jsx';
import PortraitRow from './PortraitRow.jsx';
import DialogueBox from './DialogueBox.jsx';
import SceneHeader from './SceneHeader.jsx';
import ThoughtBubble from './ThoughtBubble.jsx';
import ValueBar from './ValueBar.jsx';
import OptionBar from './OptionBar.jsx';
import GiftModal from '../modals/GiftModal.jsx';
import { beginScene, runRound, readHer, endScene, roundsLeft, isOver } from '../../agent/roundEngine.js';
import { READ_HER_USES_PER_SCENE } from '../../config/constants.js';

export default function RoundStage({
  setup,
  client,
  /**
   * The knowledge economy, reachable from inside the scene (Part I.10).
   * `{ dossierFor, credits, stock, give }`, where `give` is App's spend function
   * and returns the scene note to inject, or null if the spend was refused.
   * Omitted, the control is simply not offered.
   */
  openers = null,
  onSceneEnd,
  offline = false,
  t,
}) {
  const [session, setSession] = useState(() => beginScene(setup));
  const [prose, setProse] = useState('');
  const [options, setOptions] = useState([]);
  const [emotion, setEmotion] = useState('neutral');
  const [pending, setPending] = useState(false);
  const [thought, setThought] = useState(null);
  const [readsLeft, setReadsLeft] = useState(READ_HER_USES_PER_SCENE);
  const [giftOpen, setGiftOpen] = useState(false);
  const busy = useRef(false);

  const present = setup.scene.present ?? [];
  const focusCard = setup.cards.find((c) => c.id === present[0]) ?? null;

  /**
   * One round.
   *
   * `busy` is a ref rather than state because the guard has to hold WITHIN a
   * render - two taps in the same frame both see the old `pending`.
   */
  const advance = useCallback(
    async ({ choice = null, note = null } = {}) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setThought(null);
      setOptions([]);
      setProse('');

      try {
        const out = await runRound(session, {
          client,
          choice,
          note,
          onChunk: (chunk) => setProse((p) => p + chunk),
        });
        // The stream emits raw; the parsed prose is what stands (Part I.4).
        setProse(out.round.prose);
        setOptions(out.round.options);
        if (out.round.emotion) setEmotion(out.round.emotion);
        setSession(out.session);
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [session, client],
  );

  /** The scene opens on her, unprompted. Nobody spent a round walking in. */
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    advance();
    // Deliberately once. `advance` closes over the session it ran with, and
    // re-firing on a new session would restart the scene on every round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onReadHer = async () => {
    if (busy.current || readsLeft <= 0) return;
    busy.current = true;
    setPending(true);
    try {
      const line = await readHer(session, { client });
      setThought(line);
      setReadsLeft((n) => n - 1);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  const over = isOver(session);
  const left = roundsLeft(session);

  /**
   * Leaving is the same act whether the block ran out or the player walked. The
   * block is paid either way, which is what makes the rounds inside it free.
   */
  const exit = () => {
    if (busy.current) return;
    onSceneEnd(endScene(session));
  };

  return (
    <div className="stage-fill flex flex-col overflow-y-auto">
      <SceneHeader
        week={setup.scene.week}
        day={setup.scene.day}
        block={setup.scene.block}
        phase={setup.scene.phase}
        locationLabel={setup.scene.locationLabel}
        onExit={exit}
        t={t}
      />

      {/*
        The portrait takes the slack: `flex-1` off a zero basis, so it grows into
        whatever a short round leaves over and falls to its floor on a long one.
        It is the right thing to sacrifice - a mascot at 5.5rem still reads, and
        a paragraph clipped at the bottom of the screen does not.

        `PortraitRow` draws the speaker AND the others in one relative frame, the
        strip floating over the portrait's empty lower edge so company costs no
        vertical space. Rendering both it and a bare `Portrait` put the same woman
        on screen twice, one of them collapsed to nothing - two correct halves
        with nothing deciding between them, which is this project's own recurring
        shape.
      */}
      <div className="relative min-h-[5.5rem] flex-1 overflow-hidden px-5">
        {focusCard ? (
          present.length > 1 ? (
            <PortraitRow
              cards={setup.cards}
              rosterIds={present}
              speakingId={present[0]}
              addresseeId={present[0]}
              emotion={emotion}
              t={t}
            />
          ) : (
            <Portrait card={focusCard} emotion={emotion} />
          )
        ) : (
          <div className="flex h-full items-end justify-center pb-6">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-faint">
              {t('game.alone')}
            </p>
          </div>
        )}
        {thought ? (
          <ThoughtBubble
            text={thought}
            label={t('vn.readHer')}
            onDismiss={() => setThought(null)}
          />
        ) : null}
      </div>

      <ValueBar
        cards={setup.cards}
        present={present}
        focusId={focusCard?.id ?? null}
        relations={session.relations}
        player={session.player}
        t={t}
      />

      <DialogueBox
        beat={prose ? { text: prose } : null}
        speakerName={focusCard?.name ?? null}
        pending={pending}
        placeholder={offline ? t('vn.modelDown') : t('vn.thinking')}
      />

      <OptionBar
        options={options}
        disabled={pending}
        over={over}
        roundsLeft={left}
        readHerLeft={readsLeft}
        onReadHer={focusCard ? onReadHer : null}
        onGive={openers && focusCard ? () => setGiftOpen(true) : null}
        onChoose={(choice) => advance({ choice })}
        onLeave={exit}
        t={t}
      />

      {giftOpen && openers && focusCard ? (
        <GiftModal
          card={focusCard}
          dossier={openers.dossierFor(focusCard.id)}
          credits={openers.credits}
          stock={openers.stock}
          usedGestures={openers.usedGestures}
          onPick={(giftId) => {
            const note = openers.give(giftId, focusCard);
            setGiftOpen(false);
            // A refused spend costs nothing, including the round.
            if (note) advance({ note });
          }}
          onGesture={(factId) => {
            const note = openers.say?.(factId, focusCard);
            setGiftOpen(false);
            if (note) advance({ note });
          }}
          onSkip={() => setGiftOpen(false)}
          t={t}
        />
      ) : null}
    </div>
  );
}
