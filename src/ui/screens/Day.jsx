/**
 * One time block of one day. CLAUDE.md section 10.
 *
 * The screen the player spends most of the game on: where is everyone, what
 * does work want from you today, and which of those two do you spend this block
 * on. The task is not a checkbox that ticks itself - discharging it costs the
 * block, which is the whole point.
 */

import { useState } from 'react';
import LocationGrid from '../map/LocationGrid.jsx';
import DormMap from '../map/DormMap.jsx';
import WeekCalendar from '../map/WeekCalendar.jsx';
import { resolveStage } from '../../systems/relationship.js';
import { jealousyBand } from '../../systems/jealousy.js';

function Stat({ label, value, tone = 'dim' }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <span className={`font-mono text-[0.6875rem] tabular-nums text-${tone}`}>{value}</span>
    </span>
  );
}

export default function Day({
  run,
  player,
  cards,
  relations,
  occupancy,
  weekPlan,
  task,
  taskState,
  identity,
  onEnter,
  onEnterSolo,
  onSkipBlock,
  onOpenSettings,
  canAskOut = false,
  onAskOut,
  t,
}) {
  const [showWeek, setShowWeek] = useState(false);
  const [inDorm, setInDorm] = useState(false);
  const taskDone = taskState?.done;
  const taskHere = task && !taskDone;

  return (
    <div className="stage mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col gap-3 px-5 py-4">
      <header className="flex items-baseline gap-2">
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
          W{run.week + 1} D{run.day + 1}
        </span>
        <span className="font-display text-[1.125rem] tracking-wide text-accent">
          {t(`block.${run.block}`)}
        </span>
        <span className="h-px flex-1 bg-hairline opacity-60" />
        <button
          type="button"
          onClick={() => setShowWeek((v) => !v)}
          className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim hover:text-accent"
        >
          {t('map.calendar')}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim hover:text-accent"
        >
          {t('map.settings')}
        </button>
      </header>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Stat label={t('game.energy')} value={player.energy} tone={player.energy < 25 ? 'danger' : 'dim'} />
        <Stat label={t('game.credits')} value={`${player.credits}c`} />
        <Stat label={t('game.competence')} value={player.competence} />
        <span className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-accent">
          {t(`phase.${run.phase}`)}
        </span>
      </div>

      {showWeek ? (
        <div className="rounded-[var(--radius)] border border-hairline bg-surface px-3 py-3">
          <WeekCalendar
            weekPlan={weekPlan}
            cards={cards}
            run={run}
            onClose={() => setShowWeek(false)}
            t={t}
          />
        </div>
      ) : null}

      {task ? (
        <div
          className={`flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 ${
            taskDone ? 'border-hairline opacity-60' : 'border-warn'
          }`}
        >
          <span className="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-warn">
            {t('game.task')}
          </span>
          <span
            className={`flex-1 font-body text-[0.875rem] ${taskDone ? 'text-faint line-through' : 'text-text'}`}
          >
            {t(`task.${task.taskId}`)}
          </span>
          <span className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-dim">
            {t(`location.${task.location}`)}
          </span>
        </div>
      ) : null}

      {inDorm ? (
        <DormMap
          cards={cards}
          relations={relations}
          occupancy={occupancy}
          onBack={() => setInDorm(false)}
          onEnterRoom={onEnter}
          onEnterSolo={onEnterSolo}
          t={t}
        />
      ) : (
        <LocationGrid
          occupancy={occupancy}
          cards={cards}
          run={run}
          player={player}
          identity={identity}
          taskLocation={taskHere ? task.location : null}
          /**
           * Every row opens the ROOM, not a scene.
           *
           * A room offers what it offers - talk to whoever is here, do the job,
           * be nosy - and the player chooses. Walking in used to commit you to a
           * conversation the moment anybody was standing there, which meant two
           * thirds of the map was only ever reachable when it was empty.
           *
           * The exception is the per-member button in a crowded row: that is
           * the player already saying who they are walking up to, so it skips
           * the middle step.
           */
          onPick={(locationId, present, addresseeId = null) =>
            addresseeId
              ? onEnter(locationId, present, addresseeId)
              : onEnterSolo(locationId, present)
          }
          onOpenDorm={() => setInDorm(true)}
          t={t}
        />
      )}

      <section className="mt-1">
        <ul className="flex flex-col gap-0.5">
          {cards.map((c) => {
            const rel = relations[c.id];
            const band = jealousyBand(rel.jealousy);
            const stage = resolveStage(rel.intimacy, rel.admissibility);
            /**
             * The plateau is the one state that demands a specific answer -
             * take her somewhere visible and make an overt move - and it is
             * the one the player cannot infer, because all it does is stop a
             * number they were not watching. It says so, in the same row.
             */
            const stalled = stage === 'confidante';
            return (
              <li key={c.id} className="flex items-baseline gap-2 font-mono text-[0.5625rem]">
                <span className="w-12 truncate text-dim">{c.name}</span>
                <span
                  className={`flex-1 truncate uppercase tracking-[0.1em] ${
                    stalled ? 'text-meter-exposure' : 'text-faint'
                  }`}
                >
                  {t(`stage.${stage}`)}
                  {stalled ? ` - ${t('stage.confidanteHint')}` : ''}
                </span>
                {band !== 'calm' ? (
                  <span
                    className={`uppercase tracking-[0.1em] ${
                      band === 'corrosive' ? 'text-danger' : 'text-warn'
                    }`}
                  >
                    {t(`jealousy.${band}`)}
                  </span>
                ) : null}
                <span className="w-6 text-right tabular-nums text-dim">
                  {Math.round(rel.intimacy)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-auto flex gap-2 pt-2">
        {/*
          Only at the weekend, and only once a day.

          It sits beside "move on" rather than above the map, because it is an
          alternative to the whole day rather than to one block: taking it means
          giving up all three, which is the trade that makes a date depth and a
          free weekend breadth.
        */}
        {canAskOut ? (
          <button
            type="button"
            onClick={onAskOut}
            className="flex-1 rounded-[var(--radius)] border border-accent px-4 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-accent"
          >
            {t('date.title')}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onSkipBlock}
          className="flex-1 rounded-[var(--radius)] border border-hairline px-4 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-dim"
        >
          {t('game.nextBlock')}
        </button>
      </div>
    </div>
  );
}
