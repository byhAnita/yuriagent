/**
 * A block spent alone.
 *
 * Choose what the assistant does with an empty room, see the result, move on.
 * Deliberately quiet next to a scene: no portrait, no meters, no stage light -
 * just the job. The contrast is the point, and it is what makes walking into a
 * room with someone in it feel like something.
 */

import { actionsFor } from '../../data/soloActions.js';
import { factDisplay } from '../../data/facts.js';
import { sharedActivityFor } from '../../data/sharedActivities.js';

export const TASK_ACTION = '__task';

function Effect({ label, value, tone }) {
  if (!value) return null;
  return (
    <span className={`font-mono text-[0.5625rem] uppercase tracking-[0.12em] ${tone}`}>
      {label} {value > 0 ? '+' : ''}
      {value}
    </span>
  );
}

export default function SoloAction({
  locationId,
  task,
  result,
  present = [],
  cards = [],
  onTalk,
  /** Talk to all of them at once. Group scenes, proposal 12. */
  onJoin = null,
  /** The dorm's own group scene - cooking, or a film. PROPOSALS 15. */
  onShared = null,
  onChoose,
  onDone,
  /**
   * The run language, for content that is not a UI string.
   *
   * `t` cannot answer for a fact: its canonical English lives in
   * `data/facts.js` rather than in a bundle, precisely so a UI reword cannot
   * unhook a gift. `factDisplay` needs the locale itself.
   */
  lang = 'en',
  t,
}) {
  const actions = actionsFor(locationId);
  const here = present.map((id) => cards.find((c) => c.id === id)).filter(Boolean);

  /**
   * The two shared dorm rooms offer the group and NOT the individuals.
   *
   * That is the rule rather than a limitation (PROPOSALS 15). The dorm is where
   * an unchosen 1v1 costs the most - nearly invisible outside, watched by
   * everyone who lives there - so removing the option is what turns the place
   * from a trap into somewhere the pressure comes off.
   */
  const shared = here.length > 0 ? sharedActivityFor(locationId) : null;
  const oneOnOne = shared ? [] : here;

  return (
    <div className="stage mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col gap-4 px-5 py-8">
      <header>
        <p className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
          {here.length > 0 ? t('solo.whoIsHere') : t('solo.alone')}
        </p>
        <h2 className="mt-1 font-display text-[1.5rem] leading-tight tracking-wide">
          {t(`location.${locationId}`)}
        </h2>
      </header>

      <hr className="rule" />

      {!result ? (
        <ul className="flex flex-col gap-2">
          {/*
            People first, because they are why you came - but the work is still
            right underneath, so a room with somebody in it never stops offering
            what it offers. Being locked out of a snoop because a bandmate
            walked in is agency lost for nothing.
          */}
          {oneOnOne.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => onTalk(card.id)}
                className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border border-hairline px-3 py-3 text-left transition-colors hover:border-accent"
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.875rem]"
                  style={{ background: card.palette.base, color: card.palette.accent }}
                >
                  {card.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body text-[0.9375rem] text-text">
                    {t('solo.talkTo').replace('{name}', card.name)}
                  </span>
                  {here.length > 1 ? (
                    <span className="mt-0.5 block font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-warn">
                      {t('solo.watched')}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}

          {/*
            All of them at once.

            Offered under the individual choices rather than above them,
            because a 1v1 is still the commonest thing a player wants and the
            group scene is the deliberate one. It only exists with two or more
            in the room - "join them" with one person in it is just talking to
            her.
          */}
          {/*
            Cooking, or a film. Concrete, which is what makes it read
            differently from a work scene: "what is in the fridge" and "this
            film is terrible" are topics five people can actually have, and
            neither is available anywhere else on the map.
          */}
          {shared && onShared ? (
            <li>
              <button
                type="button"
                onClick={() => onShared(shared)}
                className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border border-accent bg-accent-soft/20 px-3 py-3 text-left transition-colors"
              >
                <span className="flex -space-x-2">
                  {here.map((card) => (
                    <span
                      key={card.id}
                      className="grid h-6 w-6 place-items-center rounded-full text-[0.75rem]"
                      style={{ background: card.palette.base, color: card.palette.accent }}
                    >
                      {card.emoji}
                    </span>
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body text-[0.9375rem] text-text">
                    {t(`shared.${shared.id}`)}
                  </span>
                  <span className="mt-0.5 block font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-accent">
                    {t('shared.note')}
                  </span>
                </span>
              </button>
            </li>
          ) : null}

          {oneOnOne.length > 1 && onJoin ? (
            <li>
              <button
                type="button"
                onClick={onJoin}
                className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border border-accent px-3 py-3 text-left transition-colors"
              >
                <span className="flex -space-x-2">
                  {here.map((card) => (
                    <span
                      key={card.id}
                      className="grid h-6 w-6 place-items-center rounded-full text-[0.75rem]"
                      style={{ background: card.palette.base, color: card.palette.accent }}
                    >
                      {card.emoji}
                    </span>
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body text-[0.9375rem] text-text">
                    {t('solo.joinThem')}
                  </span>
                  <span className="mt-0.5 block font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-warn">
                    {t('solo.joinNote')}
                  </span>
                </span>
              </button>
            </li>
          ) : null}

          {/* The day's objective is discharged HERE, at its own location -
              never from a menu, because it has to cost the block. */}
          {task ? (
            <li>
              <button
                type="button"
                onClick={() => onChoose(TASK_ACTION)}
                className="w-full rounded-[var(--radius-sm)] border border-warn px-3 py-3 text-left transition-colors"
              >
                <span className="block font-body text-[0.9375rem] text-text">
                  {t(`task.${task.taskId}`)}
                </span>
                <span className="mt-1 flex flex-wrap gap-x-3">
                  <Effect label={t('game.credits')} value={task.credits} tone="text-accent" />
                  <Effect label={t('game.competence')} value={task.competence} tone="text-accent" />
                  <span className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-warn">
                    {t('game.task')}
                  </span>
                </span>
              </button>
            </li>
          ) : null}
          {actions.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onChoose(a.id)}
                className="w-full rounded-[var(--radius-sm)] border border-hairline px-3 py-3 text-left transition-colors hover:border-accent"
              >
                <span className="block font-body text-[0.9375rem] text-text">
                  {t(`solo.${a.id}`)}
                </span>
                <span className="mt-1 flex flex-wrap gap-x-3">
                  <Effect label={t('game.credits')} value={a.credits} tone="text-accent" />
                  <Effect label={t('game.competence')} value={a.competence} tone="text-accent" />
                  <Effect label={t('game.energy')} value={a.energy} tone="text-dim" />
                  <Effect label={t('solo.secrecy')} value={a.secrecy} tone="text-danger" />
                  {a.learns ? (
                    <span className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-warn">
                      {t('solo.mayLearn')}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <p className="beat-in font-body text-[1.0625rem] leading-[1.6] text-text">
            {t(`solo.${result.action.id}_result`)}
          </p>

          {result.learned ? (
            <div className="thought-in rounded-[var(--radius)] border border-warn/60 bg-surface px-4 py-3">
              <span className="mb-1 block font-mono text-[0.5rem] uppercase tracking-[0.18em] text-warn">
                {t('solo.learned')}
              </span>
              {/*
                The player's language, not memory's.

                `result.learned.fact` is the canonical English - it is what
                went into her dossier and what the gift needles match, and
                section 19 keeps it that way so a language switch cannot
                corrupt history. It is exactly the wrong thing to print, and
                printing it is how a Chinese run ended up saying "has extremely
                cold hands" (PROPOSALS 14). The id is what carries across.
              */}
              <p className="font-display text-[1rem] italic leading-snug text-text">
                {t('solo.learnedLine')
                  .replace('{name}', result.learned.name)
                  .replace('{fact}', factDisplay(result.learned.factId, lang) || result.learned.fact)}
              </p>
            </div>
          ) : result.heard ? (
            /*
              Not a fact about her - what somebody else has already heard about
              you. It buys no opener; it is the only way to see jealousy coming
              before it has turned into strain, so it gets its own colour.
            */
            <div className="thought-in rounded-[var(--radius)] border border-meter-exposure/60 bg-surface px-4 py-3">
              <span className="mb-1 block font-mono text-[0.5rem] uppercase tracking-[0.18em] text-meter-exposure">
                {t('solo.heard')}
              </span>
              {/*
                Rendered from the rumor's SHAPE, the way the aftermath screen
                already does it. `heard.text` is the dossier line and it is
                English on purpose; `kind`, `subjectName` and `locationId` are
                what the sentence is actually made of.
              */}
              <p className="font-display text-[1rem] italic leading-snug text-text">
                {t(`rumorLine.${result.heard.rumorKind ?? 'heard'}`)
                  .replace('{name}', result.heard.name)
                  .replace('{subject}', result.heard.subjectName ?? '')
                  .replace('{where}', result.heard.locationId ? t(`location.${result.heard.locationId}`) : '')}
              </p>
            </div>
          ) : result.action.learns ? (
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-faint">
              {t('solo.learnedNothing')}
            </p>
          ) : null}

          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            <li>
              <Effect
                label={t('game.credits')}
                value={result.playerDelta.credits}
                tone="text-accent"
              />
            </li>
            <li>
              <Effect
                label={t('game.competence')}
                value={result.playerDelta.competence}
                tone="text-accent"
              />
            </li>
            <li>
              <Effect label={t('game.energy')} value={result.playerDelta.energy} tone="text-dim" />
            </li>
            <li>
              <Effect
                label={t('solo.secrecy')}
                value={result.playerDelta.secrecy}
                tone="text-danger"
              />
            </li>
          </ul>

          <button
            type="button"
            onClick={onDone}
            className="mt-auto rounded-[var(--radius)] border border-accent px-4 py-3 font-mono text-[0.75rem] uppercase tracking-[0.2em] text-accent"
          >
            {t('game.nextBlock')}
          </button>
        </div>
      )}
    </div>
  );
}
