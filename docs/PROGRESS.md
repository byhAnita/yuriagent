# Progress

Rolling state of the build. Updated **before** a milestone closes, never after.
`CLAUDE.md` is the design; this file is where the design currently stands in code.

---

## Current: M1 complete, M2 next

### M0 - scaffold (done)

| Item | State |
|---|---|
| git: `main` / `dev` / `feat/m*` / `feat/assets` worktree | done |
| Tailwind 4 wired, `@theme inline` token mapping | done |
| 4 themes: night / day / dusk / bloom | done |
| `--font-scale` root rem, 4 steps | done |
| Settings store (localStorage, defensive reads) | done |
| i18n skeleton en / zh, dotted-key resolver with fallback | done |
| PWA manifest + iOS meta | done, icons pending assets branch |
| Folder skeleton per CLAUDE.md section 16 | done |
| Card loader + 8 library cards | done |
| `data/locations.js`, `data/activities.js`, `data/gifts.js` | done |

### M1 - pure systems (done)

All of `systems/` is pure: no React, no network, no `Math.random`. 126 tests.

| Module | Notes |
|---|---|
| `rng.js` | seeded mulberry32, injected everywhere so runs replay |
| `relationship.js` | stage, strain bands, per-character endings, balance ending |
| `jealousy.js` | bands, exclusivity curve, convert, scene modifiers |
| `exposure.js` | location x block x phase x secrecy; presence resolution |
| `rumor.js` | propagation, witnessing, the bedroom-approach beat |
| `castBuilder.js` | any N cards to a coherent lineup |
| `calendar.js` | two-layer deterministic schedules, weekends protected |
| `tasks.js` `chips.js` `economy.js` | conflicts, stance gating, knowledge-gated gifts |
| `balanceSim.js` | headless harness; `npm test -- balanceSim` prints the report |

### What the simulator found

Three real defects, none of which were visible on paper. This is the return on
building M1 before M2.

1. **The balance ending was unreachable.** A single 3-week cycle is 63 blocks -
   about 12 scenes per member across five routes, which cannot lift anyone out
   of `drift_end`. Every multi-route policy returned 100% drift on every seed.
   Fix: `CYCLES_PER_CAMPAIGN = 3`.

2. **Stage `nameless` had no ending.** The signature zone of the whole game fell
   through to `drift_end`, so 58% of runs reported "it never started" at a mean
   intimacy of 65. Fix: `unnamed_end`, plus `friends_end` and `reckless_end`.

3. **Jealousy was inert.** `weight * intimacy/100 * exclusivity` tops out near
   2.5, against bands at 25/50/75 and decay of 5 per attentive scene. Mean
   jealousy across an entire campaign was 1.7. A competent spread player reached
   the balance ending 31.8% of the time because the pressure system was doing
   nothing at all. Fix: `JEALOUSY_GAIN_SCALE = 6`, found by sweeping 4/5/6/8/12.

### Calibration, 400 runs per policy

| Policy | Balance ending | Reads as |
|---|---|---|
| `balanced` | 2.8% | competent multi-route player |
| `spread` | 1.5% | naive round-robin |
| `random` | 0.3% | no plan |
| `devoted` | 0.0% | one route; gets `out_end` about 18% instead |

Re-run this at M4. Gifts, chips and the dossier will make a real player more
efficient than the stand-in scene model, which will push these numbers up.

### Known gaps leaving M1

- `simulateScene` in `balanceSim.js` is a **stand-in** for the LLM turn loop. It
  drives the same state transitions but makes no claim to model conversation.
- `data/identities/*.json` is still empty. `generateDayTask` falls back to the
  full `TASKS` table when no identity is supplied.
- `applyRepair` exists but nothing calls it, and `flags.repairUsed` is unused
  until the event system lands in M5.
- Vite boilerplate `src/App.css` and `src/assets/{react,vite}.svg`, `hero.png`
  are unused and still tracked. Awaiting the go-ahead to delete.
- `public/portraits/*.svg` and `public/icons/*` pending on `feat/assets`.

---

## Next: M2 - prompt pipeline

`promptBuilder`, `llmTool`, `responseParser`, `memory`. Exit criterion: a scene
runs in a console harness with the cache invariants and the roster rule
asserted.

Two things to get right, both of which are tests rather than hopes:

1. **The freeze rule** (CLAUDE.md section 8). Nothing above block 5 may change
   while a scene is open. A test should open a scene, mutate live meters, and
   assert the rendered prefix is byte-identical.
2. **Roster enforcement.** The parser drops any beat whose speaker is not in the
   current scene roster. That is the hard guarantee against member bleed, and
   prompting alone will not hold it.

---

## Decision log

Design decisions live in `CLAUDE.md`. This is only for things that changed
after being written down.

| Date | Change |
|---|---|
| 2026-08-21 | Cast changed to group X: irene, nana, jisoo, hyewon, yeri. seulgi / wendy / joy retained as library cards. |
| 2026-08-21 | Calendar returned to `PREP / COMEBACK / REST` once X became a real in-fiction group. |
| 2026-08-21 | `focusId` became derived rather than stored, when all five became simultaneously romanceable. |
| 2026-08-21 | Weekends carry no group slot, no solo slot and no task; they are the event-anchor window. |
| 2026-08-21 | Campaign length raised from 1 cycle to 3, after balanceSim showed the balance ending was unreachable. |
| 2026-08-21 | Balance ending bar lowered from `unspoken` to `nameless` - five unnameable relationships is the truer version of that ending. |
