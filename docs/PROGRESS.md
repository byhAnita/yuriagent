# Progress

Rolling state of the build. Updated **before** a milestone closes, never after.
`CLAUDE.md` is the design; this file is where the design currently stands in code.

---

## Current: M0 complete, M1 next

### M0 - scaffold (done)

| Item | State |
|---|---|
| git: `main` / `dev` / `feat/m0-scaffold` / `feat/assets` worktree | done |
| Tailwind 4 wired, `@theme inline` token mapping | done |
| 4 themes: night / day / dusk / bloom | done |
| `--font-scale` root rem, 4 steps | done |
| Settings store (localStorage, defensive reads) | done |
| i18n skeleton en / zh, dotted-key resolver with fallback | done |
| PWA manifest + iOS meta | done, icons pending assets branch |
| Folder skeleton per CLAUDE.md section 16 | done, modules stubbed |
| Card loader + 8 library cards | done |
| `data/locations.js`, `data/activities.js` | done |
| Scaffold harness proving tokens work | done |

Verified: `npm run lint` and `npm run build` clean; all four theme blocks, all
token utilities, the font-scale rule and the reduce-motion rule are present in
the built CSS.

### Known gaps leaving M0

- `public/portraits/*.svg` and `public/icons/*` do not exist yet - being built on
  `feat/assets`. The harness falls back to the card `emoji` in a palette circle.
- `src/App.jsx` is a **scaffold harness, not the game UI**. It is throwaway; the
  real VN interface arrives in M3 with a proper design pass.
- Vite boilerplate `src/App.css` and `src/assets/{react,vite}.svg`, `hero.png`
  are unused and still tracked. Awaiting the go-ahead to delete.
- No test runner yet. M1 needs one for the pure systems.

---

## Next: M1 - pure systems

No UI, no LLM. Everything in `systems/` is a pure function over state, which is
what makes the relationship model testable before a single token is spent.

Order:

1. `relationship.js` - stage resolution, strain bands, per-character endings
2. `jealousy.js` - bands, exclusivity curve, gain and decay
3. `exposure.js` - location x block x secrecy, plus `presence`
4. `rumor.js` - exposure to awareness; presence to witnessed events
5. `castBuilder.js` - any five cards to a coherent X lineup
6. `calendar.js` - deterministic seeded group + solo schedules
7. `chips.js`, `economy.js`, `tasks.js`
8. `balanceSim.js` - headless harness

Exit criterion: the simulator runs N scripted playthroughs and reports an
ending distribution with the balance ending under 10% of competent runs.

The exclusivity coefficients in `config/constants.js` are guesses. They are the
most load-bearing numbers in the design and they exist to be moved by the
simulator, not defended.

---

## Decision log

Design decisions live in `CLAUDE.md`. This is only for things that changed
after being written down.

| Date | Change |
|---|---|
| 2026-08-21 | Cast changed to group X: irene, nana, jisoo, hyewon, yeri. seulgi / wendy / joy retained as library cards. |
| 2026-08-21 | Calendar returned to `PREP / COMEBACK / REST` once X became a real in-fiction group. |
| 2026-08-21 | `focusId` became derived rather than stored, when all five became simultaneously romanceable. |
