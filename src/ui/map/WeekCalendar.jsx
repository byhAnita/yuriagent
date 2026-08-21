/**
 * The week at a glance. CLAUDE.md section 10.
 *
 * The calendar is deterministic specifically so it can be shown in full before
 * the player commits anything. Opportunity cost only bites when it is visible -
 * knowing Wendy is at the studio all Thursday is what makes choosing Friday a
 * decision instead of a guess.
 *
 * Weekends are drawn differently because they are structurally different: no
 * group slot, no solo slot, no task.
 */

import { DAY_NAMES, isWeekend } from '../../systems/calendar.js';
import { BLOCKS, DAYS_PER_WEEK } from '../../config/constants.js';

export default function WeekCalendar({ weekPlan, cards, run, onClose, t }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
          {t('map.week')} {run.week + 1}
        </span>
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-accent">
          {t(`phase.${run.phase}`)}
        </span>
        <span className="h-px flex-1 bg-hairline opacity-60" />
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim hover:text-accent"
          >
            {t('map.close')}
          </button>
        ) : null}
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-8" />
            {Array.from({ length: DAYS_PER_WEEK }, (_, d) => (
              <th
                key={d}
                className={`pb-1 font-mono text-[0.5rem] uppercase tracking-[0.1em] ${
                  isWeekend(d) ? 'text-accent' : 'text-dim'
                } ${d === run.day ? 'underline underline-offset-4' : ''}`}
              >
                {t(`day.${DAY_NAMES[d]}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BLOCKS.map((block) => (
            <tr key={block}>
              <th className="pr-1 text-right align-middle font-mono text-[0.5rem] uppercase tracking-[0.1em] text-faint">
                {t(`block.${block}`).slice(0, 3)}
              </th>
              {Array.from({ length: DAYS_PER_WEEK }, (_, day) => {
                const group = weekPlan.group.find((s) => s.day === day && s.block === block);
                const solo = cards.filter((c) =>
                  (weekPlan.members[c.id] ?? []).some((s) => s.day === day && s.block === block),
                );
                const now = day === run.day && block === run.block;
                const weekend = isWeekend(day);

                return (
                  <td key={day} className="p-[0.0625rem]">
                    <div
                      title={group ? t(`activity.${group.activity}`) : undefined}
                      className={`flex h-6 items-center justify-center gap-px rounded-[0.1875rem] border ${
                        now ? 'border-accent' : 'border-transparent'
                      } ${
                        group
                          ? 'bg-accent-soft'
                          : weekend
                            ? 'bg-surface'
                            : solo.length
                              ? 'bg-surface-alt'
                              : 'bg-transparent'
                      }`}
                    >
                      {group ? (
                        <span className="h-1 w-1 rounded-full bg-accent" />
                      ) : (
                        solo.slice(0, 3).map((c) => (
                          <span
                            key={c.id}
                            className="h-1 w-1 rounded-full"
                            style={{ background: c.palette.base }}
                          />
                        ))
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.5rem] uppercase tracking-[0.1em] text-faint">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {t('map.groupSlot')}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-dim" /> {t('map.soloSlot')}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-3 rounded-[0.125rem] bg-surface" /> {t('map.free')}
        </span>
      </div>
    </div>
  );
}
