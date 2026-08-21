# Progress

Rolling state of the build. Updated **before** a milestone closes, never after.
`CLAUDE.md` is the design; this file is where the design currently stands in code.

---

## Current: M0-M4 complete, M5 next

260 tests, lint and build clean. The game is playable end to end for a day:
map -> empty room or scene -> gift -> dialogue -> exit -> rumor -> rollover,
with no API key required.

**Read "Still open" at the bottom before starting anything.**

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

_(superseded by **Still open** at the end of this file.)_

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

_(superseded by **Still open** at the end of this file.)_

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

_(superseded by **Still open** at the end of this file.)_

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

## Post-M4 playtest fixes

Four bugs came out of playing it, and all four were mine rather than tuning.

1. **The scene froze when the block ran out.** `outOfTurns` disabled the chips,
   but the notice explaining why only rendered while pending with no beat on
   screen - so the player saw dead buttons and no reason. The chip bar is now
   *replaced* by a notice and a Leave button. Turn limit 12 -> 8; the opening
   beat no longer consumes one.
2. **A carefully chosen gift got answered with "You came."** Two causes, and the
   worse one would have hit a real model too: the scene opened by sending
   `*enters*` as a fake player action, which gave the model nothing to react to;
   and the note did not say what *tier* of gift it was. The opening turn is now
   an instruction, the first beat is hers, and the note distinguishes an iced
   coffee from something she never told anyone she needed. Nine tests pin it.
3. **The task completed silently.** Clicking an empty task location just
   advanced the clock with no feedback. The objective moved into the solo-work
   screen at its own location, so it costs the block and always shows a result.
4. **Chrome was unreadable.** `--text-faint` sat near 3:1 (2.3:1 in `day`).
   Both dim tokens lifted across all four themes and every label carrying
   meaning moved from faint to dim.

Also added, from the same session: solo work in empty rooms, the two-step dorm
with a player bedroom, the energy rebalance, and an in-room picker so a room
with several people lets you choose who you walk up to.

---

## Still open

The list to work from. Roughly in the order they should be picked up.

### M5 proper

- **Save/load.** Closing the tab loses the run. `store/save.js` is an empty stub
  and the state schema in CLAUDE.md section 15 is the contract.
- **Endings screen.** The campaign can run past its last week without resolving.
  `resolveEnding` and `isBalanceEnding` exist and are tested; nothing calls them.
- **Event anchors.** `eventWindows()` returns the six weekend blocks and nothing
  uses them. `data/events/` is empty.
- **Repair events.** `applyRepair` is implemented and tested; nothing calls it,
  and `flags.repairUsed` is unused.
- **PWA install / service worker.** Manifest and icons exist; no SW.

### Known gaps that are not M5

- **`balanceSim` is out of date.** It does not model gifts, chips, solo work or
  the energy economy, all of which now exist. The 2.8% figure is therefore
  stale rather than wrong. Re-running it honestly means teaching
  `simulateScene` about them first - real work, and worth doing before any
  further coefficient tuning.
- **Group scenes.** Prompt and parser handle two members; `VNStage` renders one
  portrait, so `App` deliberately passes a roster of one. Needs the two-portrait
  stage plus the witnessed-gesture bonus in `computeDeltas`.
- **`llmTool.js` has never talked to a live provider.** Its shape is exercised
  only through the mock. The first real call will surface something.
- **No retry / regenerate.** The rv-simulator snapshot pattern should be ported.
- **`data/identities/*.json` is empty.** The identity is a literal in `App.jsx`.
  Section 13 is the schema it should move into.
- **Mascot SVGs are placeholders**, to be replaced after a v1 pass.
- **Dead files awaiting permission to delete:** `ui/screens/SceneSetup.jsx`
  (superseded by `Day.jsx`), `src/App.css`, `src/assets/{react,vite}.svg`,
  `src/assets/hero.png`.
- **No `prefers-reduced-motion` audit** of the newer animations.
- **ko / pt** are stubbed in `i18n/index.js` and fall back to `en`.

---

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
| 2026-08-21 | Locked knowledge gifts hidden rather than shown; the earlier "show them as a pull" argument was overruled in playtesting. |
| 2026-08-21 | A scene opens with an instruction and her beat, never a synthesised `*enters*` player action. |
| 2026-08-21 | The daily task is discharged at its own location inside the solo-work screen, not from a global button. |
| 2026-08-21 | Empty rooms became solo work; snooping trades `secrecy` for a `known_facts` entry. |
| 2026-08-21 | Overnight energy 34 -> 24 so a rest block has to compete for the day. |
| 2026-08-21 | `.gitattributes` added (`eol=lf`) after mixed CRLF/LF broke multi-line edits to CLAUDE.md. |
| 2026-08-22 | Gift note now quotes the dossier fact the gift was bought on. The fact was in block 3, but connecting `knee_brace` to it was left as an inference the model tier cannot be trusted with. |
| 2026-08-22 | Block 4 gained a per-member **standing** sentence. Section 7 always listed "stats" in the header; it had never been implemented, so the model wrote every scene at the same emotional distance. |
| 2026-08-22 | `settings.model` is now persisted. It was written by the settings modal and read by `createClient` but dropped by `loadSettings`, so every reload silently reverted to the default provider. |
