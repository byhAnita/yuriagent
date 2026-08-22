/**
 * A block spent alone.
 *
 * Choose what the assistant does with an empty room, see the result, move on.
 * Deliberately quiet next to a scene: no portrait, no meters, no stage light -
 * just the job. The contrast is the point, and it is what makes walking into a
 * room with someone in it feel like something.
 */

import { actionsFor } from '../../data/soloActions.js';
import { phraseDiscovered } from '../../systems/rumor.js';

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

export default function SoloAction({ locationId, task, result, onChoose, onDone, t }) {
  const actions = actionsFor(locationId);

  return (
    <div className="stage mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col gap-4 px-5 py-8">
      <header>
        <p className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
          {t('solo.alone')}
        </p>
        <h2 className="mt-1 font-display text-[1.5rem] leading-tight tracking-wide">
          {t(`location.${locationId}`)}
        </h2>
      </header>

      <hr className="rule" />

      {!result ? (
        <ul className="flex flex-col gap-2">
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
              <p className="font-display text-[1rem] italic leading-snug text-text">
                {result.learned.name} {result.learned.fact}.
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
                English, like the fact above it and like the ledger line in the
                aftermath - memory is English whatever the UI language
                (section 19, rule 2).
              */}
              <p className="font-display text-[1rem] italic leading-snug text-text">
                {phraseDiscovered(result.heard.name, result.heard.text)}.
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
