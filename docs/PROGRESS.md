# Progress

Rolling state of the build. Updated **before** a milestone closes, never after.
`CLAUDE.md` is the design; this file is where the design currently stands in code.

---

## Current: M0-M4 complete plus a post-M4 pass, M5 next

**432 tests, lint and build clean.** The game is playable end to end for a day:
map -> empty room or scene -> opener -> dialogue -> exit -> rumor -> rollover,
with no API key required.

### The balance pass, 2026-08-22

A second post-M4 pass, driven by a **headless campaign harness**
(`src/agent/playthrough.test.js`) that plays all 189 blocks through the real
engine, and by **live quality measurement** against DeepSeek
(`src/agent/liveQuality.test.js`, `LIVE_QUALITY=1`). Four defects, all of the
same shape: two correct halves and a missing join, invisible to every unit test
and to any playtest shorter than a full campaign.

| | |
|---|---|
| **The second axis was dead** | `markRisk` was never called by anything. `riskTaken` was false in every scene ever played, so admissibility never left 0, every route plateaued, and **no good ending was reachable**. A risk is now a stance (`touch`/`invite`/`confide`) taken at exposure >= 60, marked on the chip. |
| **The plateau never plateaued** | `confidante` is called a stall in four places and stalled nothing - campaigns ended with all five at intimacy 100 and `confidante_end` for everybody. Closeness now stops while she is on it. Good endings went 0% -> 12-64% by policy. |
| **Scenes paid nothing live** | section 6's thresholds were calibrated against the mock. A live scene that plainly went well moved guard by a net 1. The format contract now states the per-beat scale; 4/6 sampled scenes now pay. |
| **Two members wrote the same line** | Irene and Hyewon at 90% shared vocabulary from an identical opening. Block 4 now repeats her speech style next to the instruction: 90% -> 27%. |
| **Conversation taught nothing spendable** | the summarizer's own phrasing never matched an opener's `requires`, so openers were reachable by snooping alone. The scene-exit call now carries the card wording as a checklist. |

**`docs/PROPOSALS.md` is new** and holds eight design-level findings from the
same pass that were deliberately *not* implemented, with the measurements behind
each. Read it before tuning anything.

### Measured, so it does not have to be re-derived

- **Endings by policy** after the balance pass, 5 seeds x 5 members: good
  endings per route are expert 88%, bold 84%, balanced 52%, spread 24%,
  devoted 20% - and devoted now reaches out_end for the one route it commits
  to. Reading the map beats spreading thin; spreading thin beats no plan.
- **All five good: 4/20 for expert, 0/20 for bold.** The balance ending, which
  additionally wants jealousy under 50 everywhere, is **0/20 for both** - so
  jealousy is now the binding constraint on it rather than admissibility. That
  is what section 5b intends, but reachability under the new coefficients has
  not been demonstrated and should be, with a policy that converts piqued
  deliberately rather than by luck.
- **Endings by policy**, 5 seeds x 5 members: `balanced` 64% good, `spread` 48%,
  `expert` 52%, `bold` 32%, `devoted` 12% (correctly - it gets `ours_end` for
  the one route and `drift_end` for the four it ignored).
- **Live**: prefix cache 1792/1794 tokens hit. Beat call 1.2-1.7s, chip call
  1.4s / 194 miss tokens. Metadata adherence 21/21 beats.

Since M4 closed, an earlier playtest-driven pass had already landed:

| | |
|---|---|
| **Live provider works** | `llmTool.js` has now been run against DeepSeek. Prefix caching engages (~1.6k of ~1.8k tokens cached). `src/tools/live.test.js` is opt-in and skips without a key. |
| **Written chips** | the chip label is model-written per turn; the stance underneath still comes from `chips.js`. Never awaited - the static set renders instantly and is replaced in place. |
| **Openers, not gifts** | every knowledge fact opens a scene two ways: buy the object, or say the thing. 8 buyable, 17 gesture-only. |
| **25 facts / 25 openers** | researched per member, one opener each, none shared. |
| **Snooping across the map** | 8 of 9 rooms teach something, priced by secrecy. |
| **Nothing may hang** | every model request runs under a deadline; a stalled one used to freeze a scene permanently. |
| **jsdom harness** | `VNStage.dom.test.jsx` - both dead-chip-bar bugs were invisible to pure-function tests. |

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

- **`balanceSim` has been superseded and should probably be retired.** It models
  a scene as a number and knows nothing about openers, chips, solo work, the
  calendar or energy, so its 2.8% figure has been stale since the opener economy
  grew. `src/agent/playthrough.test.js` now answers the same questions by
  playing the real loop, and it found two defects `balanceSim` structurally
  could not see. Keeping both means maintaining two sets of policies that
  disagree. Decide: teach `simulateScene` the rest of the game, or delete it and
  move the section 5b table to harness numbers.
- **The written-chip writer is not in the harness.** `playthrough.test.js`
  drives `chips.js` directly, so the campaign numbers assume static chips. That
  is the conservative direction (written chips should make a player better, not
  worse) but it is an assumption, not a measurement.
- **Group scenes.** Prompt and parser handle two members; `VNStage` renders one
  portrait, so `App` deliberately passes a roster of one. Needs the two-portrait
  stage plus the witnessed-gesture bonus in `computeDeltas`.
- **No retry / regenerate.** The rv-simulator snapshot pattern should be ported.
- **`data/identities/*.json` is empty.** The identity is a literal in `App.jsx`.
  Section 13 is the schema it should move into.
- **Mascot SVGs are placeholders**, to be replaced after a v1 pass.
- **Dead files awaiting permission to delete:** `ui/screens/SceneSetup.jsx`
  (superseded by `Day.jsx`), `src/App.css`, `src/assets/{react,vite}.svg`,
  `src/assets/hero.png`.
- **No `prefers-reduced-motion` audit** of the newer animations.
- **ko / pt** are stubbed in `i18n/index.js` and fall back to `en`. Note that
  `i18n/coverage.test.js` asserts en/zh parity only; adding a locale means
  adding it there too.
- **Only DeepSeek is measured live.** The beat call, chip call, summarizer, Read
  her and `zh` output have all now been exercised and are good (`zh` writes
  clean Chinese prose with ASCII metadata; Read her and the ledger lines are
  genuinely sharp). The other three router entries in `modelConfigs.js` have
  never been called, and neither has a group scene, because there is no way to
  start one.
- **The written-chip budget is provider-dependent.** A chip call measured 1.3s
  on a quiet provider and 8.1s on a busy one. `live.test.js` reports when it
  misses the 3s reading budget rather than failing, because that is DeepSeek's
  load and not this repo's contract.

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
| 2026-08-22 | Written chips added (section 6): model writes the label, `chips.js` still owns the stance. Static set renders instantly; a written set is accepted only while the bar is disabled. |
| 2026-08-22 | **First live-provider run.** `llmTool.js` works against DeepSeek; prefix caching engages (1536-1664 of ~1600-1835 tokens cached). `src/tools/live.test.js` is opt-in and skips without a key. |
| 2026-08-22 | Chip-call cost corrected from estimate to measurement: miss is ~140-210 tok (directive + her last beat), not ~20; wall time 1.3-1.7s, only modestly faster than a beat call. The premise still holds - the budget is reading time, not the beat call. |
| 2026-08-22 | **Beat segmentation bug, found live.** Splitting on any blank line tore one beat into two whenever the model put the action and the speech in separate paragraphs; the orphan carried no emotion and no deltas, so ~half of all beats moved nothing. Separator is now a blank line followed by `@`. |
| 2026-08-22 | **Every model request now runs under a deadline.** A stalled request never rejected, so the turn never ended: `pending` stayed true and the chips, free text, Read her and Leave were all disabled with nothing on screen to say why. `withRetry` never fired and the offline fallback never got its chance. 45s overall, 12s of stream silence. |
| 2026-08-22 | Added a jsdom harness (`jsdom`, `@testing-library/react`, `@testing-library/user-event`) and `VNStage.dom.test.jsx`. Both dead-chip-bar bugs were reported from play and invisible to pure-function tests; reasoning about them failed twice and rendering found it in minutes. |
| 2026-08-22 | Written chips stopped being discarded: the swap now gates on the turn token alone, and the misclick it used to guard against is prevented by the bar always being one geometry. Beats holding the bar now show an explicit continue control. |
| 2026-08-22 | Chip calls get their own 10s deadline (`timeoutMs` on the preset) against the 45s default - a late chip set is discarded anyway. |
| 2026-08-22 | **Facts and gifts rewritten together, grounded in real public habits.** 5 facts per card, 13 knowledge gifts written to the habits rather than the reverse. Every member now reaches 2-4 gifts, so which one opens depends on what you turned up first; previously each member had 2 facts and one gift, which made the snoop RNG inert. |
| 2026-08-22 | **25 facts, 25 gifts, one per fact, none shared.** Facts researched from each member public habits and kept distinct across the cast. Asserted: every fact unlocks exactly one gift, no gift is shared, no fact repeats. |
| 2026-08-22 | Block 1 gained a differentiation directive naming public image / personality / the unnamed thing as the primary differentiators. The fields were always in the prompt; a small model treated them as colour. |
| 2026-08-22 | The chip circuit breaker is a 3-turn cooldown rather than a per-scene latch. A live chip call measured 8.1s during a busy period, and a latch turned a slow patch into a whole conversation of plain stance names. |
| 2026-08-22 | **A fact can be spent as a line, not only as a purchase.** Every knowledge fact now opens the scene two ways: the object (credits, +5, repeatable) or the gesture (free, +3, once per run). Some facts are gesture-only - you cannot buy somebody the habit of naming everyone. The modal is titled "how you walk in". |
| 2026-08-22 | Facts re-researched for aspect spread rather than clustering on food and fandom: Irene the gym, Yeri pilates, Nana the ankle, Hyewon arithmetic, Jisoo the comics. 25 facts, 25 openers, one each. |
| 2026-08-22 | Added `src/i18n/coverage.test.js`. A bulk replace had overwritten `settings.title` with the gift heading in BOTH locales, so the en/zh parity check passed - identical is not the same as correct. |
| 2026-08-22 | Facts and openers replaced with a researched set supplied by the user: 25 facts, 25 openers, 7 buyable objects and 18 gestures. Only seven of the interactions were actually things you could buy, which is what the opener split is for. |
| 2026-08-22 | Snooping opened up to eight of nine rooms, priced by secrecy (-7 green room down to -1 dorm living). Three rooms funnelled the entire knowledge economy through the wardrobe. |
| 2026-08-22 | Nana's tattoo-removal fact replaced with her magical-girl figures. Publicly self-disclosed, but it is a real person's body rather than a habit - the same call as the invented knee injury. Section 22 now carries the rule so it is not re-litigated per fact. |
| 2026-08-22 | **The second axis was dead in the shipped game.** `markRisk` existed, was tested, and was called by nothing - so `riskTaken` was false in every scene ever played and admissibility never left 0. A risk is now a stance (`touch`/`invite`/`confide`) taken at exposure >= 60, marked on the chip so the bet is visible. |
| 2026-08-22 | **The plateau now plateaus.** `confidante` is described as a stall in four places and stalled nothing; campaigns ended with every member at intimacy 100 and `confidante_end` for all five. Intimacy gains are suppressed while she is on the plateau. Together with the risk fix, good endings went 0% to 12-64% depending on policy. |
| 2026-08-22 | Added `src/agent/playthrough.test.js`: a 189-block campaign through the real engine. It found both of the above in its first run. `balanceSim` structurally could not - it models a scene as a number. |
| 2026-08-22 | **Section 6's meter thresholds were calibrated against the mock.** Live, a scene that plainly went well moved guard by a net 1 and paid nothing, because the model anchored on the example beats. The format contract now states the per-beat scale. Stating a per-SCENE target instead overshot badly, because beat count per turn varies 1-3 and a scene budget silently multiplies. |
| 2026-08-22 | Block 4 repeats the present member's `speechStyle`. All five cards sit in block 1 ~1500 tokens above the instruction, and the model collapsed Irene and Hyewon onto the personality subset they share - identical opening line, 90% shared vocabulary. Now 27%. |
| 2026-08-22 | The scene-exit call carries the card's `learnableFacts` wording as a checklist. Openers match `requires` by substring and the summarizer wrote its own phrasing, so the `dialogue -> fact -> opener` arm of section 11 had never worked: every opener was reachable by snooping alone. |
| 2026-08-22 | `mockClient` honours `delay: 0` for stream chunks too. The per-chunk 12ms remained, so a headless campaign spent seven minutes inside setTimeout pretending to type. |
| 2026-08-22 | Added `docs/PROPOSALS.md` for design-level findings that were measured but deliberately not implemented - beat-count-dependent payouts, the secrecy ratchet, inert energy, the exhausted fact pool. |
| 2026-08-22 | **Block 4 gained the scene's own situation**: what she is doing here (from the calendar's activity, which had never reached the prompt), what the week feels like, and what job the player still owes. Every visit to a room used to open the same way because the header named only the location. Free in cache terms - block 4 is rebuilt per scene. |
| 2026-08-22 | Secrecy recovers 1/night toward the identity baseline (proposal 2). It was a one-way ratchet to 0 by week 3 of 9; campaign floor measured 0 -> 16. |
| 2026-08-22 | A snoop can turn up a rumor instead of a fact (proposal 4) - what another member has already heard about the player. Facts weighted 3:1, and there are no rumors to find early on, so the early game teaches facts and the late game teaches jealousy. Snoops that taught nothing: 12-21 per campaign -> 0. |
| 2026-08-22 | The day screen marks a stalled route and says what it needs (proposal 5). |
| 2026-08-22 | **Rumors were writing localized text into English memory.** `phraseRumor` took `scene.locationLabel`, which App builds with `t()`, so a `zh` run put "you heard the player was at 练习室 with Irene" into `heard_about`, block 3 and the save. Section 19 rule 2 exists so language can be switched mid-run. The name now comes from the location table. |
| 2026-08-22 | Section 10 corrected: **Read her is the energy sink, not the block.** A busy day that never reads her is energy-positive by 3-5, and a measured campaign never went below 77/100. |
| 2026-08-22 | **The scene-payout budget moved into the prompt** (proposal 1). Three settings were measured at 12 live scenes each: per-beat scale + sum (verbose pays), per-beat scale + mean (terse pays), per-reply budget + sum (verbose pays). The third shipped - not because it removed the bias, but because it is the only one that is CORRECT IF THE MODEL OBEYS, and averaging an already-apportioned total would get worse as the model improved. Thresholds recalibrated: 15 -> 12 and 60 -> 30. **Still wrong**: the guard branch fired 0/12, so only fluster pays. The durable fix is to report absolute state rather than deltas - a section 9 contract change, written up in PROPOSALS 1. |
| 2026-08-22 | **A survived public risk scales with intimacy** (proposal 9): `(3..6) x (1 + I/100 x 1.2)`, failure branch flat. Escaping the plateau costs 10 admissibility at intimacy 60 and 50 at 90, so a flat payout meant getting closer to her bought a worse ending. Good endings by policy: spread 24%, devoted 20%, balanced 52%, bold 84%, expert 88%. |
| 2026-08-22 | Added PROPOSALS 10: phase-specific maps and authored event scenes (Yuhan's design). Not implemented - written up for confirmation, with the two objections that matter (a whole-day location does not fit a three-block clock, and a map bigger than ~10 reachable rooms per phase is mostly empty). |
| 2026-08-22 | **The metadata line reports state, not movement** (proposals 1, final form). `guard58` is where she is; `guard-8` still means she moved eight, because format failures are guaranteed. The last beat of a reply is the state, so beat count stops mattering - which no client-side arithmetic could achieve, as three earlier settings proved. Guard drops over the same twelve live scenes went from `10, 8, -7, 11, 0, -3, -10, -23, 9, 9, 9, -20` to `17, 4, 8, 10, 13, 10, 7, 11, 10, 11, 9, 17`: every scene now moves her the right way. Block 4 states her opening reading so the absolute has a scale; the offline writer emits readings too, so no-key play does not diverge. |
