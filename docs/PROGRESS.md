# Progress

Rolling state of the build. Updated **before** a milestone closes, never after.
`CLAUDE.md` is the design; this file is where the design currently stands in code.

---

## Current: M0-M5 complete, two days played

**955 tests, lint and build clean.** Everything is on `dev`; `main` is well
behind and should stay there until a full campaign has been played by hand.

A campaign runs **cover -> nine weeks -> endings screen**, saves itself, and
installs. In English or Chinese, with or without an API key.

**Two in-game days have been played by a human, both on 2026-08-23**, one in
English and one in Chinese. Between them they produced **fifteen** fixes. Every
single one was in code that had tests and passed them.

| | |
|---|---|
| day one, `en` | 8 fixes, all in or around the group scene, invisible to its 27 tests |
| day two, `zh` | 7 fixes, including two premises nobody had ever written down |

**If you are picking this up cold, read "What M5 shipped", then the two playtest
sections, then "Still open".** The design is in `CLAUDE.md`; this file is where
it stands in code. `docs/PROPOSALS.md` holds arguments for changing the design
and is worth reading before touching any coefficient.

---

## What M5 shipped

| | |
|---|---|
| phase maps | `data/phaseMaps.js` - slots, roles, three maps, coverage asserted |
| tasks and activities bind to a **slot** | resolved per phase, never a location id |
| calendar | event day first, phase-scoped group density, free evenings, her-room routine |
| the map on screen | `LocationGrid` reads `overworldFor(phase)`; a crowded row opens the room as well as the people |
| the room screen | every action in every room; task competing in the same list |
| witnessed 1v1 | others in the room take jealousy with no roll, and lift `riskExposure` |
| snoop pricing | secrecy cost scales with how many people are watching |
| dating | weekend invitation, refusal, credit bill, whole-day cost |
| scene registers | a date or an event runs 16 turns with a literary register and a spine |
| the pronoun rule | narration is "you"; only dialogue uses the player's name |
| **the cover screen** | name field, identity picker, cast; the run's fixed inputs, set once |
| **identities as data** | `data/identities.js`, one shipped and three stubs, all asserted well-formed |
| **facts have ids** | canonical English in `data/facts.js`, display in `i18n/`; dossier entries are objects |
| **anchor events** | five, one per event slot, each firing once in the campaign |
| **group scenes** | addressee + a second voice in two registers; section 9's two-member cap retired |
| **openers in-scene** | handing something over is a turn, and it turns to her |
| **dorm activities** | cook together, watch a film; no 1v1, no jealousy, a small gain for everyone |
| **the dish** | an opener paid in a block rather than in credits |
| **endings screen** | per character, best first, balance ending called out |
| **save / load** | one slot, written at day rollover; continue from the cover |
| **PWA** | relative everywhere, a real service worker, iOS/Android safe areas |

### The one lesson worth carrying forward

**Every serious bug this milestone was a JOIN** - two correct halves with
nothing calling between them. Five of them, all found by writing a test that
crossed a layer rather than by reasoning about either side:

1. `markRisk` was implemented and tested for two milestones while nothing
   called it, so `admissibility` never left 0 and every good ending was
   unreachable in the shipped game.
2. `eventDays()` placed event days and `overworldFor` hid event sites, and
   nothing passed the live slot between them - so on an event day the whole
   cast stood somewhere the player could not reach.
3. A crowded map row rendered only per-member chips, so section 10b's "every
   action in every room" was false whenever two members stood in one.
4. `commitSummary` passed `add.text` alone, dropping the `factId` and the rumor
   shape one line before they landed.
5. `advanceBlock` returned `campaignOver` from M1 and nobody read it, so the
   clock rolled past nine weeks and the game kept going.

A sixth, caught in the tests themselves: three group-scene tests were asserting
against an empty array, because `runTurn` and `interject` only feed the parser
through `onChunk` and a client that merely resolves a string produces no beats.

The rule this suggests, and the reason `App.dom.test.jsx` and `pwa.test.js`
now exist: **a unit test cannot see a missing call. Test across the seam.**

### The language bug, and what it cost to find

Four symptoms from one `zh` session. Three were UI printing memory and are
fixed: rumors render from `kind` + `subjectName`, the summarizer returns
`display` beside `summary`, and facts now carry an id whose display form lives
in `i18n/`. Memory itself stays English - section 19 rule 2 - so a language
switch cannot corrupt a save.

The fourth, "some members answer in English", took **eight live probes and two
wrong hypotheses**, both of which looked extremely plausible:

1. *The directive is too far from the dialogue.* Repeated it at the bottom of
   block 4. Measured with it disabled: **7/7 turns still Chinese.** Not the
   cause. The line stays because it is cheap, but it was a guess.
2. *Accumulated English memory drags it.* Measured with 6 and then 24 English
   ledger lines, three English dossier facts, a neglected member, an English
   gift note, an English date frame, and Read her mid-scene. **All 100% Han.**

The actual cause was `tools/client.js`: a failed live call falls back to the
offline writer, silently, and that writer had one English table. Every probe
missed it because they call the router directly and never take that path.
**A harness that bypasses a layer cannot find bugs in that layer** - the same
lesson as the joins above, from the other direction.

`src/agent/zhSmoke.test.js` (`ZH_SMOKE=1`) measures the Han ratio **per turn**;
a flicker is invisible at two turns.

### The custom-card probe

A card with every semantic field in Chinese played four clean turns, the parser
held, emotions stayed ASCII - and **memory came back 0% Han.** That settled
PROPOSALS 14's open question: the summarizer keeps memory English because its
instruction says so, regardless of the card's language. Translate-at-import is
a v2 convenience, not a correctness requirement, so a custom card authored
offline is simply single-locale.

---

## The balance pass, 2026-08-22

A post-M4 pass, driven by the headless campaign harness
(`src/agent/playthrough.test.js`) that plays all 189 blocks through the real
engine, and by live quality measurement against DeepSeek
(`src/agent/liveQuality.test.js`, `LIVE_QUALITY=1`). Five defects, all of the
same shape as the joins above: two correct halves and a missing call between
them, invisible to every unit test and to any playtest shorter than a full
campaign.

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

**2026-08-23, after events and shared activities.** `HARNESS_REPORT=1 npx
vitest run playthrough`. All five anchor events fire once per campaign; scenes
that paid nothing fell to 6-14 of ~95; the fact pool empties and rumors take
over as designed.

The number to look at, and the reason item 2 under "Still open" exists:
**four `confidante_end` out of five** on both `balanced` seeds and on
`spread` - intimacy reaches 70-80 while admissibility stalls at 10-40. Either
the plateau is correct or it is too harsh, and the harness **cannot tell**,
because it never takes a date and never spends a dorm evening. A public date is
the single largest admissibility lever in the game.


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

## Day-one playtest fixes (2026-08-23)

Yuhan played one in-game day and reported two bugs. Fixing them turned up six
more, and every one of the eight was in the same place: **the group scene, which
until that day had only ever been exercised by tests.**

### What was reported

1. **The gift panel opened at the door of every scene**, group scenes included.
   So the player was asked what they were giving somebody before they had been
   given any reason to want to, and in a group scene before they had seen who
   was in the room.
2. **Pass was a 10px text link in the corner.** The one move that lets a group
   scene breathe read as chrome, so it went unused and every scene was driven
   turn by turn off the chips.

Both are the same mistake: **a move that ends the player's turn was not shaped
like one.** Everything that spends the turn - say it, give, pass - is now a
bordered control at a real touch target, in one row at the weight of the
options. The thin row below keeps exactly what does not end the turn: the turn
counter and Read her.

The opener became a turn (PROPOSALS 11, CLAUDE.md section 11). It costs one of
the eight, lands mid-conversation, sets `singledOut`, and moves the addressee to
whoever it was handed to. In a group scene the sheet asks who, defaulting to the
member the player is already talking to.

### Three more, found on the way

**3. A group scene could be silent or it could be jealous.** There was one
interjection bar and it was priced for jealousy, and the arithmetic made
ordinary conversation impossible: a week-1 bystander at intimacy 10 who had said
nothing for four turns scored **0.66 against a bar of 1.0**, and the jealousy
term was the only thing in the formula big enough to clear it alone. Yuhan
reported both ends of this - "others are silent" and "characters shouldn't be
too hostile" - as two complaints. They were one number.

Split into a **chime** (priced on silence, no jealousy term, warm by default)
and a **cut_in** (gated on an actual `sharp`/`corrosive` band). Silence
dominates the chime, which makes the room circulate with no rota: whoever speaks
has her counter reset. Two quiet turns clears the bar, which scales with room
size for free.

**4. Being in the room was treated as a gesture.** `propagate` charged a full
`WEIGHT_WITNESSED` hit - the heaviest event in the game - to everybody present,
for a conversation. Five women who have shared a dorm for years came out of
every group scene resenting each other. Three tiers now (present 0.5, hearsay 1,
witnessed 2.5), where witnessed requires `singledOut`. Yuhan's own phrasing was
the specification: "should not raise jealousy, **or only raise a little**".

**5. The stage named the wrong woman.** It drew the addressee for the big
portrait, the name over the dialogue and the stage light, so a beat from anybody
else appeared under her face with her name on it. Survivable while a second
voice was rare; it would have mislabelled most of a group scene the moment
chimes started arriving most turns. The beat says who spoke; the addressee is
marked in the row instead, and the meters carry her name.

Two smaller ones fell out of that: the chip bar went live while the second call
was still running (`busy` is a ref, so the bar never knew) and swallowed every
tap; and the speaker, being the big portrait, was the one member in the room who
could not be turned to.

### Measured live afterwards

Three members, practice room, six turns, `LIVE_QUALITY=1` against DeepSeek V4
Flash:

| | |
|---|---|
| voices | all three |
| chimes | 6 |
| cut-ins | 0 |
| resentful lines | 0 |
| two members in one reply | 0 |

Under the old single bar the same scene produced **no second voice at all**. A
cut-in at `corrosive` still reads pointedly and visibly differently, which is
the whole reason for keeping two registers rather than just softening one.

### And then three more, from a bigger live probe

Six turns at three members was not the hard case. `LIVE_BIG_ROOM=1` plays
**five members over a full eight-turn block**, and it paid for itself three
times on its first run:

**6. Yeri never spoke.** Not once, in the whole block - Irene nine beats, three
others two to three each, Yeri zero. The chime's silence term had copied
`stakeOf`'s four-turn clamp, and with four bystanders and one speaking per turn
three of them sit at the ceiling permanently, so the sort falls through to the
id tie-break and the **alphabetically last member can never get ahead**.
Uncapped, all four speak exactly four times. A defect that only exists at a room
size no test used.

**7. Every chime was two beats.** The directive said "write one beat" and the
model wrote two, so a block ran to 34 beats and an interjection was as long as
the reply it cut into. "Write one beat" did not take; **naming the form did** -
*"a single metadata line and what follows it, no second metadata line"* - and
the block halved to 17 with a visibly tighter transcript. Same fix applied to
the cut-in.

**8. The model gendered the player.** A cut-in came back with *"He's just
standing there"*, about a player the game has never assigned a gender and never
will: the name is free text and no field anywhere carries one. Block 1's pronoun
rule covered narration (`you`) and being addressed (her name for the player) and
missed the third case entirely - one member talking to **another** about the
player. Always possible; common only once a second voice started speaking most
turns. Checked in both locales afterwards, English and `zh`: zero.

| | three members, six turns | five members, eight turns |
|---|---|---|
| chimes | 6 of 6 | 8 of 8 |
| members who spoke | 3 of 3 | 5 of 5 (was 4 of 5) |
| beats | 21 | 17 (was 34) |
| resentful lines | 0 | 0 |

The chime rate - every turn, at both room sizes - is the top of the range rather
than the middle, and nobody has played nine weeks of it. PROPOSALS 16 holds the
brake to fit if it turns into wallpaper, and the argument for why the obvious
brake (raise the threshold) is the wrong one.

### The lesson, again

Some of these were joins, which is this project's usual shape. But the more
useful pattern is a different one, and it is worth naming because it will
happen again:

**Every one of them was in code that had tests and had never been run at full
size.** The group scene shipped with 21 engine tests and 6 DOM tests, and still
had the addressee mislabelled on screen, a jealousy model that made everybody
hostile, an interjection bar that could not fire, a member who could never
speak, and a directive the model ignored.

Three of the eight are specifically **size** defects - they do not exist at the
two or three members every test used, and appear only at five:

- the silence clamp freezing out the alphabetically-last member needs four
  bystanders to bite
- the two-beat chime is only a problem when a second voice speaks every turn
- one member talking to another *about* the player barely happens in a room of
  two

A test asserts the thing you thought of, at the size you happened to pick. What
found these was **playing it, and then building a probe at the size the game
actually runs at** (`LIVE_BIG_ROOM=1`). Both are cheap. Neither was being done.

---

## Day-two playtest fixes (2026-08-23, `zh`)

A second day, played in Chinese this time, one in-game day again. Seven fixes,
and **two of them were premises the design had never written down** - not bugs
in code so much as things everybody knew and nothing said.

### The two premises

**1. The player is a young WLW woman, and block 1 never said so.**

This is a yuri visual novel. Every route in it is between two women. Block 1
introduced the player by name and job and stopped, and the name is free text -
so the model had nothing to go on and guessed. One Chinese run in three had a
member refer to the player as `他`; an English cut-in produced *"He's just
standing there."*

It went in the **World block**, not in the pronoun rule, and that distinction is
the whole lesson: the model was not mistaken about a pronoun, it was mistaken
about who the player is. A pronoun rule can only patch the symptom. The words
that follow (`her name or "she"`, never a masculine pronoun **in any language**)
sit underneath it, because a model writing Chinese will not infer `她` from an
English sentence about her job.

Measured after: 3/3 `zh` runs and an English five-member block, zero.

**2. The identity is not fixed to the assistant.** It already came from the
chosen identity, but the phrasing said "at the agency" and the fallback
hardcoded a second copy of the assistant line that could drift from the table.
Roles name the company now, and the fallback is the shipped default itself.

### Seven rooms with nothing to do in them

Reported as *"no rumor option in the drink room"*. It was **seven rooms**: drink
room, bistro, make-up room, green room, photo studio, hair salon and Han River -
every room the phase maps brought onto the map after `soloActions.js` was
written. Four of its nine entries pointed at rooms that had *left* the map. In
PREP, two of the four working rooms offered nothing at all, empty or occupied,
against section 10b's "almost every room can teach you something".

Exactly the failure that made tasks bind to slots, one file over and a milestone
later. It is asserted against the phase maps now rather than against a copy of
the room list (`data/soloCoverage.test.js`, 75 assertions).

### A room teaches what its SLOT says it teaches

Yuhan's rule: *"get rumor should be placed and only placed in the social room."*

`data/phaseMaps.js` had already said exactly that since phase maps shipped -
`social` carries `rumor`, the workrooms and venue carry `knowledge` - and
**nothing read it**. Every snoop drew from one pool weighted 3:1, so the rumor
room taught facts, the wardrobe taught rumors, and the role table was
decoration.

It reads better as well as cleaner: a rumor is something people say about you,
so you hear it where people talk; a fact is about her, so you find it where her
work is. The player learns the grammar once and it holds in every phase.

One consequence, handled: a run opens with 25 facts and **no rumors at all**, so
the social snoop is guaranteed empty in week 1. That curve is intended - the
early game teaches you about them, the late game teaches you what they know -
but paying a block to discover it is not, so the room now says so. `soloWork`
had always known, because it refuses to charge secrecy for a search that found
nothing. The screen had never asked it.

### "Irene interrupted herself"

Reported twice, in two different rooms, both with exactly one member in them -
where an interjection is impossible by construction.

She never did. What the player was reading was the beat queue, framed badly: the
whole option set rendered **dimmed and dead** with a button underneath saying
"she is still speaking". Reported the other way round in the same message:
*"3 options, custom text, gift, skip, read her are all not clickable, but they
all present on the screen."* Same defect, two symptoms.

The bar **is** the continue control now, the treatment a spent block already
got, and the label is neutral - in a group scene the next beat is often somebody
else, and the dialogue box already names whoever is talking.

Turning to somebody stays live throughout, because it costs no turn and makes no
call. That was already true and invisible; PROPOSALS 19 says it should be made
visible rather than built again.

### Scenes ended mid-thought

```
*The door closes fully. A beat later, it opens again - just a crack.*
"对了。"
[ this block is over ]
```

She was starting something and the budget ran out underneath her.

The model cannot pace a scene whose end it cannot see, and section 6 measured
that handing it a budget makes it *worse* - it overshot badly, because a scene
is many replies and it cannot track its position in one. But the **client** knows
exactly which turn is last. So it says so, once, on the turn that is.

It does not script the parting: a goodbye at `colleague` and at `unspoken` are
different scenes, the same argument section 11 makes for generating a gift
reaction rather than authoring one. Measured live: *"She holds your gaze a second
longer than necessary, then nods once and turns back to the mirror."*

### One shape for every conversation

Yuhan's proposal, built as specified (`systems/dialogue.js`):

```
count who may SPEAK
  -> one member: no second voice. more: one per turn.
  -> turn limit = base for the kind + 2 per extra member, capped at 16
  -> then the ordinary turn loop
```

All five kinds read it - ordinary block, date, shared dorm evening, anchor
event, group scene. Before, `App` picked a turn limit from a lookup keyed on
scene kind and `sceneEngine` decided the second voice several call sites away,
so nothing stated the two rules together and nothing could check them.

Eight turns across five members is a turn and a half each, which is not a
conversation with anybody. A five-member room now lands on **16** - exactly
where dates and anchor events already sat by hand, so three separate decisions
became one formula. It does not make breadth better value than depth, which is
the thing to watch since both cost one block: 16 split five ways is ~3 turns of
attention each against a private scene's 8.

### One thing NOT fixed, and it is the one worth knowing

**An English action with Chinese speech, in the same beat:**

```
She stands at the counter, hand wrapped around the cup, watching the steam rise.
"茶水间的咖啡机今天特别慢。"
```

Two consecutive turns of it, in a run that never left Chinese.

**It could not be reproduced.** 25 beats across 12 scenes against DeepSeek, with
a realistic block 4 (activity, weather, an outstanding chore, an English ledger)
- every action Chinese, 0/25. A first probe with a bare block 4 was also 0/9, so
the extra English context is not it either.

What that means: the harness bypasses something the app does. The leading
suspect is a **different model selected in settings** - the app reads
`settings.model` and the harness reads `.env.local`, and they only agree by
coincidence. Next `zh` report should say which model was selected.

Two things changed anyway:

- The language rule now names **both halves of a beat** in the same words the
  format contract uses - `the *action* between asterisks and the "speech" in
  quotes`. Same shape of fix as the chime directive: "write one beat" did not
  take and naming the form did.
- `zhSmoke` measures the action and the speech **separately**. Every existing
  `zh` check measured a whole-beat Han ratio, and a beat that is half English
  sits near the threshold - the instrument could not see the failure it was
  pointed at.

### The lesson, and it is a different one from day one

Day one's was about **size**: defects that exist only at five members, in code
whose tests all used two or three.

Day two's is about **premises**. Two of the seven were things everybody involved
knew and no file said:

- the player is a young woman, in a game where every route is between two women
- a room teaches what its slot says it teaches, which `phaseMaps.js` had
  literally written down and nothing read

Neither is a coding mistake. Both are the same failure: **a fact so obvious it
was never written became a fact the model, or the code, could not know.** The
model does not share the room with us. `soloActions.js` does not read
`phaseMaps.js` unless somebody makes it.

The practical form of it, worth applying deliberately: when something is
obvious, check whether it is obvious *to the code*. Three of the seven fixes
were a table that already held the answer, being read for the first time.

There is a corollary about locale. Seven of the fifteen fixes came from the
`zh` day, and two of them **could not have surfaced in English at all** - a model
writing Chinese does not inherit an English instruction. `zh` is the primary
locale (section 19) and it should get at least half the playtesting.

---

## Still open

Nothing here blocks a playthrough. **In recommended order**, and the order is an
argument rather than a list: each item is placed where it is because of what it
would cost to do the ones after it first.

> The ordering principle, earned twice this week: **playing beats reasoning, and
> playing at full size beats playing.** Two in-game days produced fifteen fixes,
> every one in code that had tests and passed them. Nothing below is worth doing
> before more of the game has been played.

### 1. Play the rest of it, in both languages

Two days of nine weeks. Days 1 and 2 produced fifteen fixes; there is no reason
to think day 3 produces zero, and every hour of it is cheaper than any analysis
in this file.

**Play `zh` at least as much as `en`.** It is the primary locale (section 19)
and it found seven of the fifteen, including two the English day could not
surface at all - a model writing Chinese does not inherit an English
instruction, and every locale-specific failure is invisible until somebody
plays that locale.

What has still never been touched by a human:

- **an anchor event** - five in the campaign, sixteen turns each, all-cast, and
  no one has played one. The longest authored thing in the game.
- **a date**, public or private. The largest admissibility lever there is.
- **a weekend**, and therefore the whole dating loop and the shape of a week.
- **the endings screen**, reached by playing rather than by test fixture.
- **week 3 onward**: strain bands, `rift`, jealousy above `piqued`, the plateau.
- **a save reloaded mid-campaign** and played on.

When it survives a full nine weeks, merge `dev` to `main` and tag it.

### 2. The unreproduced language split

The one day-two report not fixed: an English action with Chinese speech in the
same beat, twice in a row. 25/25 clean on DeepSeek with a realistic block 4, so
the harness cannot see it.

**Three of the four suspects are now eliminated from the code, and the fourth
has a defect in it.**

- **Settings threading is clean.** `App` is `useState(loadSettings)` - a lazy
  initializer, so the very first render already has `zh` and there is no English
  frame to leak, even on a reload. Both `lang` inputs to the prompt come from
  the same `settings.lang`, so blocks 1 and 4 cannot disagree.
- **A load never overrides the language.** This was the best version of the
  guess: `meta.lang` is in the save and the game auto-saves at day rollover, so
  a load that pushed it back into settings would drag English in on day 2 -
  exactly when it was seen. `onContinue` does not touch settings. (`meta.lang`
  is therefore **written and read by nobody** - harmless, another dangling
  half.)
- **The default model is DeepSeek**, the same one the harness uses, so the
  original "a different provider was selected" theory is weaker than it was. It
  is still worth confirming from a report rather than assumed.
- **The offline writer had a real language defect** - ten `zh` opening beats
  interpolating the English gift name. Fixed. It is not the reported shape, but
  it is the same family, and it is in the one path no live probe can reach.

**So the next step is now a call record rather than a question.**
`tools/debugLog.js` records which writer answered every call - `live`, `mock` or
`fallback` - with the raw text before the parser touched it, and `yuri.dump()`
renders the last forty as pasteable text. If the split beat came from a
`fallback`, that narrows it to a path we now know had a language bug in it; if
it came from `live`, the record carries the model and the exact prompt.

Ranked above the balance work because it is a **correctness** bug in the primary
locale, and it is now one *dump* away from being understood.

### 3. The plateau, measured against a real campaign

Measured after this week's changes, `balanced` seed 7, 189 blocks:

```
irene   I 61  A 15  S 31  J  0   nameless    -> unnamed_end     (good)
nana    I 79  A 11  S 12  J 64   confidante  -> confidante_end
jisoo   I 75  A 24  S 32  J 24   confidante  -> confidante_end
hyewon  I 73  A 23  S  0  J 24   confidante  -> confidante_end
yeri    I 73  A 31  S  5  J 28   unspoken    -> unspoken_end    (good)
```

**Two good endings and three stalls.** Intimacy reaches 61-79 and admissibility
stalls at 11-31, which is the plateau doing exactly what section 5 says. It is
either correct or too harsh and the harness cannot tell you which.

**That is why this is item 3 and not item 1**: the harness never takes a date
and never spends a dorm evening, and a public date is the single largest
admissibility lever in the game. Item 1 produces the evidence. Doing this first
means tuning against a model of the game rather than against the game.

Do not move `RISK_PAYOFF_SCALE` on harness numbers alone.

Related and probably the same problem: **36 "facts with nothing to spend them
on"** per campaign, credits ending at 0.

One number that moved for a known reason and is not a regression: **rumors found
per campaign 21 -> 7**, because rumors are social-room-only now and the harness
picks rooms without regard to what slot they fill. A player who knows the rule
will do better than that; the harness does not know it. Fixing that belongs with
item 5.

### 4. The three questions the day-one fixes opened

All written up, none blocking, all wanting a played campaign rather than an
argument:

- **PROPOSALS 16 - the chime has no brake.** A second voice on every turn, at
  both three and five members. It reads well in isolation; nobody has read nine
  weeks of it. The obvious brake (raise the threshold) is the wrong one and the
  entry says why.
- **PROPOSALS 17 - nobody reacts to a gift they watched change hands.** The
  chime already fires on that turn, so it may be half-solved by accident. Look
  before writing a third directive.
- **PROPOSALS 18 - `shared` beats `singledOut`**, so a dorm evening is the cheap
  place to spend openers. Deliberate and small; visible in the ledger if it
  starts to matter.

Plus one from day two:

- **PROPOSALS 19 - turning to somebody is live while reading, and invisible.**
  The recommendation is to make the portrait row visibly tappable during a read,
  not to build a new move. Cheap, and it answers the feeling behind the report.

### 5. Harness fidelity

- **`presentIds` is unset for every ordinary harness scene**, so co-presence
  jealousy and `riskExposure` are under-modelled everywhere except at anchor
  events. Fixing it moves every number in the report, which is why it wants
  doing deliberately and attributed.
- **The harness never dates and never spends a dorm evening**, which is what
  makes item 3 unanswerable from it. This is the single most valuable harness
  change available.
- **The harness picks rooms without regard to slot**, so it finds a third of the
  rumors it used to (21 -> 7 per campaign) now that rumors are social-room-only.
  It is modelling a player who has not learned the map. Teaching it the rule
  would also give item 3 a cleaner jealousy signal.
- **`balanceSim` is superseded and still maintained.** It models a scene as a
  number and knows nothing about openers, chips, solo work, the calendar or
  energy, and it needed a hand-patched `singledOut` this week to keep reporting
  anything sensible. `playthrough.test.js` answers the same questions by playing
  the real loop. Retire it.

### 6. Events do not recur, and week 9 is the emptiest week in the game

Five anchor events fire per **campaign**, on Yuhan's instruction, which is
reading one of the three in PROPOSALS 10. That entry recommended reading three -
five situations recurring across three cycles with escalating stakes - and
warned about exactly this: cycles 2 and 3 have no authored beat, so the end of
the game is its quietest stretch.

Not pre-empted, because it is a content decision and the structure underneath is
fine. The engine already supports the escalating reading: key `firedEvents` on
`phase:slot:cycle` and give each event a per-cycle stakes clause. A small change,
not a redesign.

**Watch for it in item 1** - it is a week-7-to-9 problem and nobody has played
that far.

### 7. Repair events

`applyRepair` is implemented and tested, `flags.repairUsed` is in the schema,
and **nothing calls either.** Section 5 gives it once per cycle per character
while in `rift`.

The classic join, still sitting there. It is item 7 rather than item 2 because
`rift` needs sustained neglect to reach and no played day has been near it - so
building the entry point now means building it blind.

### 8. Content and polish

- **Card picker UI.** The cast section of the cover screen renders the fixed
  five. v1: choose any five from the library. v2: the custom card editor, for
  which `data/facts.js` already takes the inline shape.
- **Other identities.** Three stubs in `data/identities.js`, asserted
  well-formed, disabled in the picker. Their `promptRole` lines are written and
  reach block 1 correctly; flipping `available` is most of the rest.
- **`corridor` and `drama_set` are off every phase map** but keep their solo
  actions. Harmless - the coverage test only requires the reverse - but they are
  content nobody can reach.
- **The block-4 language reminder is unjustified** rather than wrong. It was
  added for a cause that turned out not to be the cause. Delete it if anything
  ever needs the space.

### Deferred by design

- Multi-portrait `single` / `multi` modes (section 14) - v2, and IndexedDB.
- `ko` / `pt` (section 19) - v2. `fact.*` and every other content table needs a
  full set per locale, which the i18n coverage test enforces. Note that the
  pronoun rule is already written to survive the jump: it names masculine
  pronouns **in any language** rather than listing English words.

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
| 2026-08-23 | Fact canonical text lives in `data/facts.js`, NOT `i18n/en.js`. The proposal put it in the bundle for symmetry; symmetry is the wrong thing to optimise for a string that gift needles match by substring. |
| 2026-08-23 | English has no `fact.*` keys at all and falls back to canonical; every other locale must have all of them. Both halves asserted. |
| 2026-08-23 | Custom cards default to single-locale rather than translate-at-import - the live probe showed memory stays English regardless, so translation buys portability, not correctness. |
| 2026-08-23 | Section 9's two-member interactive cap RETIRED, replaced by "one call, one speaker". The roster may be the whole room; the answer may not. |
| 2026-08-23 | Group scenes use an addressee + one optional interjection, not the rota sketched in 10c. A rota cannot say who the player was talking to. |
| 2026-08-23 | Shared dorm activities generate no jealousy at all, and pay a small intimacy gain to everyone present. |
| 2026-08-23 | The dorm shared rooms offer no 1v1. The one documented exception to 10b, and the whole point of the release valve. |
| 2026-08-23 | An identity names role SLOTS, not location ids. The old inline list named three rooms that had never existed. |
| 2026-08-23 | Save is automatic at day rollover, one slot, no save screen. The day boundary is also the only moment section 15 permits. |
| 2026-08-23 | `base: './'` and relative paths everywhere, after checking how rv-simulator deploys to GitHub Pages. |
| 2026-08-23 | `npm test` no longer bills a provider: `tools/live.test.js` needs `LIVE_PROVIDER=1` on top of a key, matching liveQuality and zhSmoke. |
| 2026-08-23 | **The opener is a turn, not a door** (PROPOSALS 11). The gift panel opened at the door of every scene, so the player chose before there was any reason to want to, in a group scene before seeing the room, and it always landed as the first thing that happened. It costs a turn now, lands mid-conversation, and moves the addressee to whoever it was handed to. |
| 2026-08-23 | Everything that spends the player turn - say it, give, pass - is a bordered control at the weight of the options. All three were 10px text links, and two of them were reported as bugs on the same day for the same reason: a move that ends the turn has to look like one. |
| 2026-08-23 | **A group scene could be silent or jealous, with nothing in between.** One interjection bar priced for jealousy: a week-1 bystander silent for four turns scored 0.66 against a bar of 1.0, so the jealousy term was the only thing that could ever clear it. Split into a warm `chime` (priced on silence, no jealousy term) and a `cut_in` (gated on sharp/corrosive). Measured live at three members: six chimes, zero cut-ins, zero resentful lines, all three voices - where the old bar produced no second voice at all. |
| 2026-08-23 | **Being in the room stopped counting as a gesture.** `propagate` charged the full witnessed hit to everyone present for an ordinary conversation, so every group scene ended with the cast resenting each other. Three tiers now (present 0.5, hearsay 1, witnessed 2.5); witnessed needs `singledOut` - a risk stance, a gift or a gesture. Yuhan's phrasing was the spec: "should not raise jealousy, or only raise a little". |
| 2026-08-23 | The stage drew the addressee for the portrait, the name and the light, so a second voice appeared under the wrong face with the wrong name. It follows the beat now; the addressee is marked in the row and the meters carry her name. The big portrait is also a button, or the member who just spoke would be the only one who could not be answered. |
| 2026-08-23 | The chip bar went live while the second call was still streaming and swallowed every tap - `busy` is a ref, so the bar never knew. Rare while a second voice was rare; the common case once chimes arrive most turns. |
| 2026-08-23 | The chime silence term is UNCAPPED, unlike `stakeOf`. A live pass at five members over eight turns had Irene speak nine times and **Yeri not once** - three bystanders sat at the four-turn clamp permanently, so the sort fell through to the id tie-break and the alphabetically-last member could never get ahead. Uncapped: all four speak exactly four times. |
| 2026-08-23 | Both second-voice directives name the FORM - "ONE beat, a single metadata line, no second metadata line". "Write one beat" alone did not take: every chime came back as two, so a five-member block ran to 34 beats and an interjection was as long as the reply it cut into. Now exactly one, and the transcript is tighter for it. |
| 2026-08-23 | **Block 1 forbids assigning the player a gender.** One member talking to ANOTHER about the player is neither narration nor being addressed, so neither existing pronoun rule reached it - and a live cut-in came back with "He's just standing there", about a player the game never assigns a gender and never will. Always possible; became common the day a second voice started speaking most turns. Measured after: 22 beats, zero. |
| 2026-08-23 | **The player is a young woman and block 1 never said so.** A yuri VN introduced the player by name and job; the name is free text, so one zh run in three had a member call the player by a masculine pronoun and an English cut-in produced "He is just standing there". Stated in the World block, because the model was not wrong about a pronoun - it was wrong about who the player is. 3/3 zh runs and an English group block clean afterwards. |
| 2026-08-23 | The player role in block 1 comes from the chosen identity and its fallback is the shipped default rather than a copy, so it cannot drift. Roles now name the company ("of X Entertainment") instead of "the agency". |
| 2026-08-23 | **Seven rooms on the map had nothing to do in them** - drink room, bistro, make-up room, green room, photo studio, hair salon, Han River. Phase maps rotated the map and `soloActions.js` was still keyed to the pre-rotation location ids. Same failure as tasks bound to location ids, now asserted against the phase maps rather than a copy of the room list. |
| 2026-08-23 | **A room teaches what its slot says it teaches.** `social` carries `rumor`, workrooms and venue carry `knowledge`, and `phaseMaps.js` has said so since phase maps shipped with nothing reading it - every snoop drew one 3:1 pool, so the rumor room taught facts. Yuhan: "get rumor should be placed and only placed in social room". |
| 2026-08-23 | While beats are unread the bar IS the continue control, rather than six dead controls with a continue button under them. Reported twice in one day: as dead options on screen, and as "Irene interrupted herself" in a one-to-one scene where an interjection cannot happen. Turning to somebody stays live throughout - it costs no turn and makes no call. |
| 2026-08-23 | The last turn of a scene tells the model it is the last turn. Scenes ended mid-thought - she reopened the door to say one more thing and the block ended on the notice. The model cannot see the budget and section 6 measured that giving it one is worse; the client knows exactly which turn is last, so it says so once. |
| 2026-08-23 | **One shape for every conversation** (`systems/dialogue.js`), on Yuhan proposal: count who may speak, one member means no second voice, turn limit follows the count (+2 each, capped at 16). A five-member room now runs 16 turns, which is where dates and events already sat by hand. Depth still belongs to the 1v1 - 16 split five ways is ~3 each against 8. |
