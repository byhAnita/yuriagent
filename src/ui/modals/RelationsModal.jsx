/**
 * Where you stand with each of them. PROPOSALS 25.
 *
 * The report asked for two different things and they get two different answers.
 *
 * INSIDE A SCENE: no. Pillar 1 is the player READING hidden emotional state and
 * betting on it, and `Read her` is rationed precisely so that reading her costs
 * something. An affection readout on the scene screen hands over the answer key
 * for free and retires the rationed action in one stroke. The scene bar carries
 * STANDING IN WORDS beside the three volatile meters, and that is deliberate.
 *
 * OUTSIDE A SCENE: yes - and it mostly existed already. The day screen has
 * printed every member's stage and affection since M4. What it did not do was
 * EXPLAIN the number or make it findable, so the player went looking for a menu
 * that was already a row:
 *
 *   > And no UI display the character's affection value in the game... should
 *   > also find a place/menu in outside scene - the game main screen - to
 *   > present character's affection & emotion stage
 *
 * That is section 7's handbook lesson again: a thing the player has to discover
 * is a thing that does not exist.
 *
 * FREE, AND NOT A BLOCK. Same argument as the handbook - a room action reads as
 * costing a block, and reading what you already know must not.
 *
 * THE SECOND AXIS IS THE POINT. `admissibility` has never appeared anywhere in
 * the UI, and it is half the relationship model: it decides the plateau, the
 * public date, and four of the endings. A player who cannot see that there are
 * two numbers cannot be expected to work out that one of them is stuck.
 */

import Sheet from './Sheet.jsx';
import { resolveStage, strainBand } from '../../systems/relationship.js';
import { jealousyBand } from '../../systems/jealousy.js';

/**
 * A bar, in the same shape the scene meters use.
 *
 * The width is the one thing section 20 lets a component compute inline - it is
 * runtime data, not a design choice. Everything else is a token.
 */
function Axis({ label, value, tone, t }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-dim">
        {t(label)}
      </span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-alt">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone }}
        />
      </span>
      <span className="w-6 text-right font-mono text-[0.5625rem] tabular-nums text-dim">
        {Math.round(value)}
      </span>
    </div>
  );
}

export default function RelationsModal({ cards = [], relations = {}, onClose, t }) {
  return (
    <Sheet
      title={t('relations.title')}
      action={
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-dim hover:text-accent"
        >
          {t('relations.dismiss')}
        </button>
      }
      lede={
        <p className="pb-1 font-body text-[0.8125rem] leading-relaxed text-dim">
          {t('relations.lede')}
        </p>
      }
    >
      <div className="flex flex-col gap-5 py-1">
        {cards.map((c) => {
          const rel = relations[c.id];
          if (!rel) return null;

          const stage = resolveStage(rel.affection, rel.admissibility);
          const jband = jealousyBand(rel.jealousy ?? 0);
          const sband = strainBand(rel.strain ?? 0);

          return (
            <section key={c.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[1rem] tracking-wide">{c.name}</span>
                <span className="h-px flex-1 bg-hairline opacity-60" />
                <span
                  className={`font-mono text-[0.5625rem] uppercase tracking-[0.14em] ${
                    stage === 'confidante' || stage === 'reckless' ? 'text-meter-exposure' : 'text-accent'
                  }`}
                >
                  {t(`stage.${stage}`)}
                </span>
              </div>

              <Axis label="relations.close" value={rel.affection} tone="var(--meter-fluster)" t={t} />
              <Axis
                label="relations.nameable"
                value={rel.admissibility}
                tone="var(--meter-exposure)"
                t={t}
              />

              {/*
                The sentence, and it is the same one block 4 gives the model -
                in the player's language, and in the second person. Words rather
                than a number is the rule everywhere else this appears; here it
                is what turns two bars into a relationship.
              */}
              <p className="font-body text-[0.8125rem] leading-relaxed text-dim">
                {t(`standing.${stage}`).replace('{name}', c.name)}
              </p>

              {/*
                The plateau is the one state that demands a specific answer and
                the one the player cannot infer, because all it does is stop a
                number they were not watching.
              */}
              {stage === 'confidante' ? (
                <p className="font-body text-[0.8125rem] leading-relaxed text-meter-exposure">
                  {t('relations.stalled')}
                </p>
              ) : null}

              {(jband !== 'calm' || sband !== 'stable') && (
                <div className="flex gap-3 font-mono text-[0.5625rem] uppercase tracking-[0.14em]">
                  {jband !== 'calm' ? (
                    <span className={jband === 'corrosive' ? 'text-danger' : 'text-warn'}>
                      {t('relations.jealousy')} {t(`jealousy.${jband}`)}
                    </span>
                  ) : null}
                  {sband !== 'stable' ? (
                    <span className={sband === 'critical' ? 'text-danger' : 'text-warn'}>
                      {t('relations.strain')} {t(`strain.${sband}`)}
                    </span>
                  ) : null}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </Sheet>
  );
}
