/**
 * The assistant's notes: what the campaign has decided. CLAUDE.md section 7.
 *
 * Canon reaches the model through block 4, and without this it would reach the
 * player through nothing at all - which is the exact failure pillar 4 exists to
 * forbid. *Memory that shows in mechanics, not only in prose.*
 *
 * ON THE DAY SCREEN, NOT IN A ROOM. A room action reads as costing a block, and
 * reading your own notes must not. Section 10's rule that privileging a thing
 * visually turns a choice back into an errand is about CHOICES; a reference
 * list is not one, and the opposite rule applies to it.
 *
 * It shows `display`, not `text`. Memory is English so a language switch cannot
 * corrupt a run (section 19 rule 2), and the whole reason a canon entry carries
 * two strings is that the player should not have to read their own campaign in
 * a language they are not playing in. `text` is the fallback, because the wrong
 * language beats a blank line.
 */

import Sheet from './Sheet.jsx';

/** Newest first: the last thing decided is the thing being lived with. */
function byCycleDesc(entries) {
  const groups = new Map();
  for (const e of entries) {
    const cycle = e.cycle ?? 0;
    if (!groups.has(cycle)) groups.set(cycle, []);
    groups.get(cycle).push(e);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

export default function HandbookModal({ canon = [], onClose, t }) {
  const groups = byCycleDesc(canon);

  return (
    <Sheet
      title={t('handbook.title')}
      action={
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-dim hover:text-accent"
        >
          {t('handbook.close')}
        </button>
      }
    >
      {groups.length === 0 ? (
        /*
         * A campaign in its first week has decided nothing, and saying so is
         * better than an empty panel - it also tells the player where these
         * lines will come from, which is the only hint the feature needs.
         */
        <p className="py-2 font-body text-[0.875rem] leading-relaxed text-dim">
          {t('handbook.empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-4 py-1">
          {groups.map(([cycle, entries]) => (
            <section key={cycle} className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-dim">
                  {t('handbook.cycle')} {cycle + 1}
                </span>
                <span className="h-px flex-1 bg-hairline opacity-60" />
              </div>
              {entries.map((e, i) => (
                <p
                  key={`${e.topic}-${i}`}
                  className="font-body text-[0.9375rem] leading-relaxed text-text"
                >
                  {e.display || e.text}
                </p>
              ))}
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}
