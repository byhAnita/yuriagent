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
import { DAY_NAMES } from '../../systems/calendar.js';
import { resolveStage } from '../../systems/relationship.js';

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
  /**
   * The anchor event on today, or null. `{ day, slot, location, content }`.
   *
   * Two jobs, and the second is the one that was broken: it names the day, and
   * it un-hides the event site on the map. `overworldFor` filters event slots
   * out of the overworld until their day, so without this the whole cast stood
   * somewhere the player could not reach and the day read as everyone having
   * vanished.
   */
  event = null,
  onEnter,
  onEnterSolo,
  onSkipBlock,
  onOpenSettings,
  onOpenSaves,
  onOpenHandbook,
  onOpenRelations,
  canAskOut = false,
  onAskOut,
  t,
}) {
  const [showWeek, setShowWeek] = useState(false);
  const [inDorm, setInDorm] = useState(false);
  const taskDone = taskState?.done;
  const taskHere = task && !taskDone;

  /**
   * An event day is the event, and nothing else (section 10).
   *
   * `content` may be null - a phase map is allowed to carry a slot nobody has
   * written for yet - and that day plays as an ordinary one, which is why this
   * tests the content rather than the placement.
   */
  const isEventDay = Boolean(event?.content);

  return (
    <div className="stage mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col gap-3 px-5 py-4">
      <header className="flex items-baseline gap-2">
        {/*
          The weekday by name, not by number.

          `D5` is arithmetic the player has to do before they can know whether
          the weekend is close - and the weekend is when dating lives, so it is
          the single most decision-relevant fact in this header. The calendar
          has named the days since M1; only this line was still counting.
        */}
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
          W{run.week + 1} {t(`dayFull.${DAY_NAMES[run.day]}`)}
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
        {/*
          The day screen is the only place a save can be written: section 15
          excludes `scene` from a save, so anywhere else is the room door.
        */}
        <button
          type="button"
          onClick={onOpenSaves}
          className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim hover:text-accent"
        >
          {t('save.open')}
        </button>
        {/*
          What the campaign has decided, free to read.

          A header control and not a room action: a room action reads as
          costing a block, and reading your own notes must not (section 7).
        */}
        <button
          type="button"
          onClick={onOpenHandbook}
          className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim hover:text-accent"
        >
          {t('handbook.open')}
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

      {/*
        A day the calendar already decided, said out loud.

        Above the task rather than below it, because it outranks one: an event
        replaces the day rather than competing for a block in it. It is a
        statement and not a control - the way in is walking to the site on the
        map, the same as anywhere else (section 10's argument about tasks:
        privileging a thing visually turns a choice back into an errand).
      */}
      {event?.content ? (
        <div className="rounded-[var(--radius-sm)] border border-accent bg-accent-soft/20 px-3 py-2.5">
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-accent">
              {t('event.today')}
            </span>
            <span className="flex-1 truncate font-display text-[1rem] tracking-wide text-text">
              {t(`event.${event.content.id}`)}
            </span>
            <span className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-dim">
              {t(`location.${event.location}`)}
            </span>
          </span>
          <p className="mt-1 font-body text-[0.8125rem] leading-snug text-dim">
            {t(`event.${event.content.id}Blurb`)} {t('event.wholeDay')}
          </p>
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
          cards={cards}
          run={run}
          player={player}
          identity={identity}
          taskLocation={taskHere ? task.location : null}
          eventSlot={event?.slot ?? null}
          eventOnly={isEventDay}
          /**
           * Every row opens the ROOM, not a scene, and the room is where the
           * player finds out who is in it (Part I.11).
           *
           * That is now the only shape, because the map no longer knows enough
           * to have another. v1 had a second path - the per-member button in a
           * crowded row - and it let the player choose a member before opening
           * the door, which is exactly the bet that is supposed to be made
           * blind. Walking in is free either way (section 10b), so guessing
           * wrong costs the walk and nothing else.
           *
           * One exception survives: the event site on an event day IS the event
           * (section 10). The room screen underneath it would offer a 1v1 and a
           * snoop on a day that is neither, and nothing about an anchor event is
           * hidden - the day screen says what today is.
           */
          onPick={(locationId) => {
            const present = Object.entries(occupancy)
              .filter(([, w]) => w.locationId === locationId)
              .map(([id]) => id);
            if (isEventDay && locationId === event.location) {
              return onEnter(locationId, present.map((id) => ({ id })), null, { group: true });
            }
            return onEnterSolo(locationId, present);
          }}
          onOpenDorm={() => setInDorm(true)}
          t={t}
        />
      )}

      {/*
        The row is a way in, not just a readout. PROPOSALS 25.

        Everything below has been on this screen since M4 and the player still
        went looking for a menu, which is section 7's handbook lesson: a thing
        you have to discover is a thing that does not exist. It also could not
        show `admissibility` - half the relationship model, and the half that
        decides the plateau, the public date and four endings - because a
        one-line row has no room for a second number.

        The button is the whole list, so there is nothing to find: whatever the
        player was already looking at opens into the panel that explains it.
        Free, and not a block - same rule the handbook follows.
      */}
      <section className="mt-1">
        <button
          type="button"
          onClick={onOpenRelations}
          className="mb-1 flex w-full items-baseline gap-2 text-left"
        >
          <span className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-dim hover:text-accent">
            {t('relations.open')}
          </span>
          <span className="h-px flex-1 bg-hairline opacity-60" />
        </button>
        <ul className="flex flex-col gap-0.5">
          {cards.map((c) => {
            const rel = relations[c.id];
            const stage = resolveStage(rel.affection, rel.admissibility);
            /**
             * The plateau is the one state that demands a specific answer -
             * take her somewhere visible and make an overt move - and it is
             * the one the player cannot infer from a stage name and a number.
             * It says so, in the same row.
             *
             * The jealousy band used to sit here beside it, and it is gone with
             * the number behind it (Part I.8). What a member has heard about the
             * player lands in her dossier and does nothing at all until she is in
             * front of them - so this row is CORRECTLY stale for anybody not
             * recently seen. That is the design rather than a gap: you do not
             * know how she took it until you see her.
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
                <span className="w-6 text-right tabular-nums text-dim">
                  {Math.round(rel.affection)}
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
