# Progress

Rolling state of the build. Updated **before** a milestone closes, never after.
`CLAUDE.md` is the design; this file is where the design currently stands in code.

---

## Current: M4 complete, M5 next

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

## M2 - prompt pipeline (done)

211 tests total. A whole scene runs end to end with no network and no API key.

| Module | Notes |
|---|---|
| `memory.js` | append-only ledger with in-place compaction; slot-capped dossier |
| `promptBuilder.js` | 5 blocks; `openScene` returns a **frozen** frame |
| `responseParser.js` | streaming state machine; roster enforcement |
| `summarizer.js` | scene-exit call, 4-level fallback, never throws |
| `sceneEngine.js` | turn loop, meters, micro-to-macro, exit pipeline |
| `llmTool.js` | OpenAI-compatible router, SSE streaming, retry, key scrubbing |
| `config/modelConfigs.js` | 4 providers, 3 call presets |

### The freeze rule is structural, not a convention

`openScene` computes blocks 1-4 and returns a frozen frame holding **strings**,
not references to game state. There is no way to rebuild the prefix from live
state mid-scene because the frame does not keep any. `sceneEngine.test.js`
mutates relations, player energy, ledger and dossier while a scene is open and
asserts the prefix stays byte-identical across every turn, including in the
messages actually handed to the client.

### Member bleed has three layers and the last one is not a hope

1. Block 3 carries dossier entries only for the roster.
2. Block 4 names absent members as absent.
3. **The parser drops an off-roster beat entirely** - not remapped onto the
   focus character, dropped. Tested both single-shot and mid-stream, and tested
   that the dropped beat's meter deltas do not leak into the scene either.

### Known gaps leaving M2

- `llmTool.js` has no test against a live provider. Its shape is exercised only
  through the mock client in `sceneEngine.test.js`.
- `sceneEngine` handles a 1-member roster properly; the 2-member group scene
  path builds correct prompts but the witnessed-gesture bonus is not wired into
  `computeDeltas` yet. That lands with group scenes in v1.
- No scene-level retry / regenerate yet. The rv-simulator snapshot pattern
  should be ported when the VN layer lands.

---

## M3 - the VN layer (done)

218 tests. One full scene is playable end to end, with no API key.

### Art direction: backstage monitor

The chrome is production equipment - monospace timecode, VU-style meters,
hairline rules - and the dialogue box is the only warm, soft surface in the
frame. Feelings under instrumentation. Type is `Instrument Serif` for names,
`Newsreader` for dialogue prose, `DM Mono` for every piece of chrome.

Deliberately not pastel otome: the game is about a thing that cannot be named,
and a cute palette would have argued against its own premise.

| Component | Notes |
|---|---|
| `Portrait.jsx` | one asset, six CSS emotion states, palette recolour |
| `DialogueBox.jsx` | beat reveal on tap; parses `*action*` vs `"speech"` |
| `ChipBar.jsx` | three stance chips, suggested marker, free text, Read her |
| `MeterBar.jsx` | guard and fluster as levels, exposure as a hazard read |
| `ThoughtBubble.jsx` | rationed Read her result, floats over the portrait |
| `SceneHeader.jsx` | timecode strip |
| `beatQueue.js` | pure reveal-pacing logic, tested without a DOM |
| `VNStage.jsx` | drives one scene through `sceneEngine` |

### The stage light does work

A radial pool behind the portrait takes its hue from the speaking member's
palette and shifts with emotion - warmer on `blush`, colder on `upset`. That is
one CSS variable doing what would otherwise need per-emotion art, and it is the
same data the `bloom` theme already uses.

### Offline mock client

`tools/mockClient.js` emits the real contract format, streams chunk by chunk,
and fails the format on about 8% of turns on purpose - so the tolerant parser is
exercised in real play rather than only in tests. The whole loop is playable
with no key, which also makes M4 development possible without spending tokens.

### Known gaps leaving M3

- No real API key path in the UI yet. `llmTool.js` is written and unused; the
  key input and model picker land with the settings modal in M4.
- Group scenes (2 portraits, dimmed non-speaker) are built for in `Portrait`
  via the `speaking` prop but `VNStage` only renders the focus member.
- `SceneSetup.jsx` is a stand-in for the map and calendar. It exists so a scene
  is reachable and so the two choices that matter romantically - who, and how
  visible - are already the choices the player makes.
- Still no retry / regenerate.
- The mascot SVGs remain placeholders, to be replaced after a v1 pass.

---

## M4 - the shell (done)

232 tests. A full in-game day is playable: map, task, scene, rollover.

| Module | Notes |
|---|---|
| `systems/clock.js` | block / day / week / phase advance, energy, campaign end |
| `ui/screens/Day.jsx` | the block screen: who is where, what work wants |
| `ui/map/LocationGrid.jsx` | occupancy from the calendar, both risks per row |
| `ui/map/WeekCalendar.jsx` | the whole week up front, weekends marked |
| `ui/modals/GiftModal.jsx` | locked knowledge gifts shown, not hidden |
| `ui/modals/SettingsModal.jsx` | theme, scale, language, model, API key |
| `store/apiKey.js` | its own storage key so it can never be serialised with a save |
| `tools/client.js` | real router with a mock fallback per call |

### Contrast fix

The chrome was drawn in `--text-faint`, which sat around 3:1 against the
background and was reported as unreadable. `--text-dim` and `--text-faint` were
both lifted across all four themes, and every label that carries meaning -
meter names and values, Read her, Say something, the timecode strip - moved
from faint to dim. `faint` is now reserved for genuinely tertiary decoration.

### Time actually passes

`SCENE_TURN_LIMIT = 8`. A scene occupies one block and cannot run forever;
without a cap a player could grind one block indefinitely and the opportunity
cost that makes three-blocks-a-day work would evaporate. The remaining count
shows in the scene header and turns amber at two.

Energy drains per block and only comes back from sleeping, so a day has a
natural shape rather than being an unlimited menu.

### Known gaps leaving M4

- **`balanceSim` has not been re-run meaningfully.** Gifts are now in the UI but
  `simulateScene` does not model them, so the numbers are unchanged rather than
  re-validated. Modelling gift purchases and chip choice in the sim is real work
  and belongs with M5.
- No save/load yet. Closing the tab loses the run.
- `ui/screens/SceneSetup.jsx` is now unused - superseded by `Day.jsx`. Kept
  pending permission to delete.
- Group scenes still render one portrait. `onEnter` already caps the roster at
  `MAX_INTERACTIVE_MEMBERS` and the prompt handles two, but `VNStage` shows only
  the focus member and the witnessed-gesture bonus is still not in
  `computeDeltas`.
- No endings screen; the campaign can run past its last week without resolving.
- Repair events and event anchors are still unimplemented.

---

## Next: M5 - the run layer

Full 3-week x 3-cycle campaign, event anchors on weekend blocks, endings screen
reporting all five routes, save/load, PWA install. Exit criterion: a full
playthrough reaches an ending.

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
