# Progress

Rolling state of the build. Updated **before** a milestone closes, never after.
`CLAUDE.md` is the design; this file is where the design currently stands in code.

---

## Current: M0-M5 complete, deployed, four sessions played

**1062 tests, lint and build clean.** Everything is on `dev`; `main` is well
behind and should stay there until a full campaign has been played by hand.

**It is live and playable on a phone:** https://byhAnita.github.io/yuriagent/
Published from `dev` by `bash deploy.sh` (section 17: the Pages site is the
hand-test build, a tag from `main` is what players get). Add `?debug=1` for an
in-page console on iOS, where no browser has devtools.

A campaign runs **cover -> nine weeks -> endings screen**, saves itself, and
installs. In English or Chinese, with or without an API key.

**Four sessions have been played by a human, all on 2026-08-23**, one in
English and three in Chinese. Between them they produced **thirty-one** fixes.
Every single one was in code that had tests and passed them.

| | |
|---|---|
| day one, `en`, desktop | 8 fixes, all in or around the group scene, invisible to its 27 tests |
| day two, `zh`, desktop | 7 fixes, including two premises nobody had ever written down |
| the first anchor event, `zh` | 8 fixes, four of them the missing-join shape again |
| **the first phone session, `zh`** | 8 fixes, and **the language split finally reproduced** |

The phone session is the one that changes what to trust. Three of its eight
were invisible on a desktop by construction - they are what a fixed viewport
height does to a layout when the text is Chinese - and one of them ended the
run outright. **Playing on the target device is not the same as playing.**

**Picking this up cold?** Read **"Still open" first** - item 1 is a live
instruction with a plan attached, not a survey. Then "What M5 shipped" for the
shape of the thing, and the playtest sections for why it is shaped that way.
The design is in `CLAUDE.md`; this file is where it stands in code.
`docs/PROPOSALS.md` holds arguments for changing the design and is worth
reading before touching any coefficient.

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

## Between days: chasing the language split, and what fell out

No new play happened here. This is what came of working item 2 from the code
side while the game was not being played, and it is recorded because two of the
three results are things a playtest would never have produced.

### Three suspects eliminated from the code, not by guessing

Yuhan's hypothesis was that the UI starts in English, the player switches to
`zh` on the cover, and something keeps the English. It is a good hypothesis and
it is wrong, in three separate places:

| suspect | verdict |
|---|---|
| a render happens before settings load | **no.** `App` is `useState(loadSettings)` - a *lazy* initializer, so the very first render already has `zh`. There is no English frame to leak, even on a reload |
| blocks 1 and 4 disagree | **no.** Both `lang` inputs come from the same `settings.lang` |
| a load drags an old language back | **no**, and this was the sharpest version of it: `meta.lang` IS in every save and the game autosaves at day rollover, so a load that pushed it into settings would produce English on **day 2**, exactly when it was seen. `onContinue` does not touch settings |

Worth keeping from that last one: **`meta.lang` is written into every save and
read by nobody.** Harmless today, and the same dangling-half shape as
`campaignOver` and `applyRepair`.

The fourth suspect - the default model - is weaker than it was, because
`DEFAULT_SETTINGS.model` is DeepSeek, the same one the harness uses.

### The offline writer had a real language defect

Not the reported shape, and in the one path no live probe can reach.

`mockClient` scrapes the gift name out of the note, and the note is
**model-facing English by design** (section 8 keeps every system note English).
Ten `zh` opening beats interpolated it:

```
*她没有马上接过hand warmer。*
```

A Chinese player with no key, handed a gift, read that - and section 3 calls
offline a supported mode rather than a degraded one. There is nowhere to get a
Chinese name from: the gift tables are English and a fallback writer must never
need a model call. She is holding the thing and the player just chose it, so the
lines refer to it instead of naming it.

**The part worth remembering is why it survived.** Every language check in the
project measures *how Chinese a beat is*. All ten lines had the defect and only
**five** crossed a 50% threshold, because the amount of Han around the noun
decided whether it got reported. The new guard is categorical - no string in the
Chinese tables may contain an English word, machine tokens excepted - and it was
run against the pre-fix file to confirm it catches all ten rather than trusting
a green test.

> A ratio hides half of any defect that is local to part of a string. Where a
> rule is absolute, assert it absolutely.

### The instrument: every model call is now recorded

`tools/debugLog.js`. Two facts decide most of this project's bugs and neither
reaches the screen: **which writer answered**, and **the raw text before the
parser touched it**. A player cannot see either, so a hand-played report cannot
contain them.

`client.js` is the only layer that knows, so it is the only layer that records.
`source` is `live` / `mock` / `fallback`, and the third is invisible in play for
every preset except chips.

**Recording is unconditional; printing is opt-in.** That way round because a bug
found by hand is found once, and asking the player to switch logging on and hit
it again is asking for what they cannot promise. `yuri.dump()` renders the last
forty calls as pasteable text; `yuri.debug()` also prints each as it happens.

The key is never in a record - it travels as its own argument and is not in
`messages` - and `redact()` is a belt on top, tested harder than the feature,
because a log written to be pasted is the likeliest way a key leaves a device.

### Save slots

Section 15 used to argue for one automatic slot: nothing for the player to
decide, and a save screen would be the only bookkeeping in a game with none. The
first half is still true. The second was wrong about what a slot is **for** - a
campaign is nine weeks and every route is a decision that cannot be taken back,
so one slot means never looking at a fork twice, in a game whose content is
forks.

Six now: `auto`, unchanged and still never a decision, plus five the player
writes from the day screen - the only moment the schema permits, since a save
taken mid-scene is a save taken at the room door.

Three rules, all asserted:

1. **Manual slots survive a restart.** `restart` clears only `auto`, which
   belongs to the run that wrote it. The single-slot build wiped the only save
   there was; under six that would silently destroy five kept campaigns.
2. **A slot is legible before it is loaded** - name, week, day, and whoever
   holds the highest intimacy, derived at read time and never stored. Without it
   six saves of one campaign are indistinguishable.
3. **Overwrite and delete arm on the first tap and act on the second.** They are
   the only destructive actions in the game. Writing into an empty slot destroys
   nothing and takes one tap.

A save from the single-slot build is **adopted as the auto slot** rather than
discarded, so a run in progress survives the change.

---


## The first anchor event (2026-08-23, `zh`, live DeepSeek V4 Flash)

Week 1, days 2 to 5, in Chinese, on a live model, with `yuri.dump()` attached to
every report. **Eight fixes.** The slot UI passed, and so did the one thing that
was deliberately stress-tested: tapping the static chips before the written ones
arrive, mixed live and offline turns in one scene, no defects.

The dump earned its keep immediately. Every report arrived with `source`, the
model, the exact prompt tail and the raw text before the parser touched it, so
none of the eight needed a reproduction step - which is the whole argument for
recording unconditionally rather than asking a player to switch logging on and
hit the bug again.

### Four of the eight are the same shape, again

The missing join. Two correct halves, nothing calling between them.

**`singledOut` was read off `Boolean(note)`.** True while an opener was the only
thing that appended a system note mid-scene. Then the closing directive arrived -
a note the stage adds to the LAST turn of every scene - and **every group scene
in the game started ending witnessed**: four absent members took
`WEIGHT_WITNESSED` and a dossier entry each for a conversation in which nothing
happened. Played, it is four lines of *"Nana saw you with Irene"* at the end of a
quiet scene; the number was correct and the question it answered was wrong.

That is precisely the defect the three-tier weight table was introduced to fix
in the first place, arriving eight weeks later through a different door. The
flag is passed now, never inferred. A note is a transport, and what a scene
costs may not be read off which transport it happened to use.

**A lit bedroom door meant "she is somewhere in the dorm".** `DORM_OCCUPANCY`
answers that question correctly for the dorm row on the overworld, and it is the
wrong question for a door - so a member standing in the kitchen lit her own door
as well, and the map showed Nana in two rooms at once. The routine layer has
always known the exact answer.

**`turnTo` dropped the written chips and nothing asked for new ones.** So
tapping a portrait downgraded the player to static labels until they had spent a
turn, and in a group scene, where turning is the commonest move there is, that
is most of the scene. Reported as the options going dead, which is exactly what
it looked like. The call is on the same prefix and costs no turn - it was
already priced at that.

**A room had no way out.** The block is paid by the action, so until one is
picked nothing has happened - but opening a door to see who was inside was a
commitment. A map is only a search if looking is free, which is the sentence
section 10b is built on.

### The event day was not a day at all

*"It takes the whole day"* has been on the day screen since the first build and
**nothing enforced it.** Played, the concept meeting was one row on a map that
still offered four other rooms and the dorm, a daily task in the wardrobe, and
five per-member chips at the meeting-room door. The whole cast stood in a room
the player could walk past.

Three rules now, and each is the same sentence said to a different part of the
code: no daily task, the map is the site, and walking in is joining them.

The third has an argument behind it and not only a bug. Section 10c's addressee
already lets a player spend an event on one member - **inside** the scene, in
front of the other four, where it costs what it should. Offering her at the door
is the bet placed before the room is visible, which is what PROPOSALS 11 said
about the old gift modal in a different costume.

### One report that was not a bug, and the fix it earned anyway

*"The next morning after the meeting, Irene's affection shows 0."* It did not:
she ended the meeting at `fluster 28` and opened the next afternoon at 0,
because guard and fluster are volatile by design and reset at every door.
`guard 85` was likewise exactly `100 - intimacy` for an intimacy of 15.

Both numbers were right and the screen was still wrong, because those three
meters were the **only** relationship numbers a player sees during a scene, so
there was nothing to read them against. The bar carries `standing` now - the
same sentence block 4 gives the model, under the same words-not-numbers rule.
One fixed thing beside three moving ones is what makes the moving ones legible.

Worth keeping as a category: **a correct number can still be a defect if
nothing on screen says what kind of number it is.**

### What the report asked for that was NOT built

Two quality items, both marked not urgent by the person raising them, both
written up rather than implemented:

- **PROPOSALS 20** - an anchor event has to decide something. The concept
  meeting read as ordinary group chat because its authored movements are all
  emotional situations and not one of them says a title track gets chosen today;
  and even had the room decided, there is nowhere to put it. This is the largest
  quality lever left in the game, and the part with real cost (a run-level
  canon) is a save-schema change that wants doing deliberately.
- **PROPOSALS 21** - dating is unreachable in week 1. The observation is right
  and scaling the gate by week is the wrong fix: `intimacy >= 50` is the same
  number as the `touch` stance and her bedroom door, on purpose. The entry says
  what to test first.

---

## The first phone session (2026-08-23, `zh`, iPhone, live DeepSeek V4 Flash)

The first time the game was played on the device it is designed for. **Eight
fixes**, and the shape of them is different from every session before it:
**three were invisible on a desktop by construction**, one ended the run
outright, and one was the bug that has been open since day two.

### The language split, reproduced and fixed

Opening beat of the concept meeting, in a `zh` run that had never switched
language:

```
She is already at the table, a printout held at an angle, and it takes her a
second to look up. "坐吧。咖啡刚倒的，还热。"
```

English action, Chinese speech - the exact reported shape. **And then it never
recurred in that scene**, which is the whole diagnosis rather than a footnote.

**Block 5 is empty on the opening beat and on no other turn.** Every later
generation has her last beat and the player's line sitting immediately above it
in the right language, and the model continues in what it can see. On turn one
there is nothing to continue: everything above block 5 is English *by design*
(section 19 keeps memory language-agnostic), and the last thing read is an
English instruction asking for an opening beat.

An anchor event is the worst case, which is why it surfaced there - block 4
also carries `## The day` and `## How to write this one`.

Block 4's `## Language` reminder was written for exactly this failure and
**cannot reach it**: it sits above the frame, above the register, and above the
opening directive. So `openingDirective` takes the language and states it
inline. One turn has the problem; one turn gets the fix.

Worth keeping: eight live probes and a 25/25 harness pass could not find this,
because none of them opened a scene with an event frame in a non-English run.
**The reproduction needed a real anchor event, in `zh`, played by hand.**

### What a fixed viewport height does to a layout

Three fixes exist only on a phone, and they are the same mistake in three
places: something was allowed to take the height it wanted, and something else
was the side that gave.

- **The speaker's portrait vanished in every group scene.** The scene is a
  fixed viewport height, the portrait was `min-h-0 flex-1` and the card row
  `shrink-0`; with a header, three meters, a Chinese dialogue box and a
  four-row chip bar all taking their fixed share, `flex-1` had nothing left to
  divide. The row now floats over the portrait and costs no height at all.
- **`Portrait`'s small size was a hardcoded `h-24` inside an `h-14` wrapper**,
  so the row was ~96px while its markup claimed 56px. Every estimate of that
  budget was wrong by 40px, in the direction that hurt.
- **The date sheet had no height cap and no scroll.** Bottom-anchored, so it
  did not overflow downward where a scrollbar would have rescued it - it grew
  *upward*, off the top of the screen, taking the close button with it. Five
  members times two kinds of date, on a 390x844 screen: **no reachable option
  and no way out.** The session stopped there.

`ui/modals/Sheet.jsx` is now the only bottom sheet - cap, scroll, a header
pinned above that scroll, and the safe-area inset, once. Asserted structurally,
and the assertion was run against the pre-fix file to confirm it fails.

Section 20 has said "verify at `fontScale` 1.25 with `zh` strings" since M0.
This is what it looks like when nobody does.

### The vocabulary complaint that was a distribution bug

*"tease, apologize, reassure don't give the option we want in most cases."*
Both halves of that were true and the second was mechanical:

```js
available.filter(...).sort(() => rng() - 0.5)   // not a shuffle
```

`Array.prototype.sort` with a random comparator has no uniformity guarantee and
barely permutes a short array, so **position in `STANCES` decided how often a
stance was offered**. Measured over 2400 sets: element 0 in **41%**, element 9
in **23%**. The player had been shown the top of an array every turn for a
campaign and reasonably concluded the game had three verbs.

Fixed with seeded Fisher-Yates, and the vocabulary was rewritten on top of it:
`tease -> flirt`, `reassure -> care`, `+casual`. One slot on every bar is
**reserved** for something outside the common four, because `touch`, `invite`
and `confide` are the only stances that move admissibility - an all-common bar
is the `markRisk` bug arriving by a different door.

**The lesson, and it is new:** the report named a symptom two layers above the
cause. Fixing only what was reported would have shipped three *new* stances
stuck at the top of a *new* array.

### The rest

- **Presence is now reported at scene exit.** Section 5b gives it no dossier
  entry, the aftermath rendered only rumors, so a 1v1 in an occupied room ended
  silent while three people's jealousy moved. What she knows and what the
  player is told are different questions.
- **The chip bar names the addressee** in a group scene. A chip, free text and
  an opener all silently target her while the labels say "her".
- **`心动` -> `心乱`.** Reported as "her affection resets every scene". It does
  not: `心动` means *moved to love*, so a momentary meter was wearing the name
  of the persistent one. Affection is `intimacy` and it does persist. The word
  was the bug.
- The scene header names the weekday, as the day screen already did.

---

## Still open

**In recommended order**, and the order is an argument rather than a list: each
item is placed where it is because of what it would cost to do the ones after
it first.

> The ordering principle, earned four times now: **playing beats reasoning, and
> playing at full size beats playing.** Four sessions produced thirty-one
> fixes, every one in code that had tests and passed them.
>
> The corollary: **reasoning that eliminates a suspect is worth doing while
> nobody is playing, and it is not a substitute for playing.** Three of the
> four candidates for the language split were closed from the code in an
> afternoon. None of that found the bug; a played anchor event did.
>
> From the anchor event: **a rule stated on screen and nowhere else is not a
> rule.** "It takes the whole day" was on the day screen from the first build,
> and the day it named offered four other rooms, a task, and the dorm.
>
> From the phone: **the target device is not a detail of the test, it is the
> test.** Three defects existed only at 390x844, and one of them ended the run.
>
> And the newest: **a report names a symptom, and the cause is often two layers
> below it.** "These stances are wrong" was a broken shuffle. "Her affection
> resets" was one Chinese word. Fix what was reported and you ship the same bug
> wearing different clothes.

---

### 1. PROPOSALS 20 - make an anchor event decide something  <- PICK UP HERE

**This is the agreed next task**, on Yuhan's instruction, ahead of further hand
testing. The full argument is `docs/PROPOSALS.md` entry 20; what follows is the
plan, so a cold context can execute it without re-deriving the design.

**The problem, in one line:** every scene in the game - ordinary, group, event,
date - is pleasant small talk that advances nothing, and a campaign cannot
remember anything it decided. Reported three times, most sharply of the concept
meeting: *"not distinguishable from ordinary group chat."* Fifteen turns that
were supposed to choose a comeback concept produced a joke about ear colour and
a plate of food, and the ledger line for the whole day was about the food.

**Three deficits, and they must not be conflated.** Doing only (a) and (b)
produces a livelier meeting that still forgets itself by Tuesday.

#### (a) Nothing establishes the day - cheap

Every scene opens with `openingDirective`: one member's beat, *what she does in
the moment she notices the player has walked in*. Right for a wardrobe on a
Tuesday, wrong for a room the whole cast is sitting in for a stated purpose.

Add an **establishing beat** for `kind: 'event'` - one beat, no speaker, what
the room looks like and what is about to happen in it. Then the ordinary loop.
The `event` register already exists (`data/sceneFrames.js`, `REGISTERS.event`)
and events already get sixteen turns.

**Not** rv-simulator's 350-450 words of narration per round. Pillar 1 rules
that out, and a story generator is what this project stopped being. One beat,
about forty words.

One trap, freshly learned: an establishing beat IS the opening beat, so it must
carry `lang` the way `openingDirective(lang)` now does. This is the exact turn
the language split lives on, and an event is its worst case.

#### (b) The agenda is atmosphere, not business - cheap

Look at what `data/events/index.js` actually gives the model for
`concept_meeting`:

```
the boards going up, and which one she reacts to before she can stop herself
the part of the concept that asks something of her specifically
an idea getting cut, and the room going carefully polite
```

Every movement is an emotional situation. **Not one of them says a title track
gets chosen today.** The model was asked for feelings in a meeting room and it
delivered feelings in a meeting room - a content bug wearing the costume of a
model failure.

Add an `agenda` field beside `movements`: two to four things the day must
decide. For the concept meeting - the concept, the title track, the styling,
the MV idea. Model-facing English, never localized (section 19). Keep the
existing rule that a **movement sets the SITUATION and never the OUTCOME**;
`agenda` is a separate field precisely so that rule survives intact.

The closing directive for an event should say it too: *before this ends, the
room settles what it came to settle.*

#### (c) Nothing is recorded - the part with real cost

Even if the room decided, there is nowhere to put it. `dossier` is per member.
`ledger` is chronology - one sentence, compacted and eventually dropped - and
the summarizer spends that sentence on whatever the scene was emotionally
about. The played transcript is the evidence: it chose the plate of food.

Add a run-level **canon**: `run.canon`, a short list of decided facts, each
with the cycle it was decided in.

- Written by an extra field on the **event** scene-exit call (`decisions[]`),
  parsed through the same four-level tolerant fallback as the rest of the
  summarizer (section 9) - a failure returns no decisions and never throws.
- Injected into **block 4** as one or two lines. Block 4 is rebuilt at every
  scene start anyway, so it is free in cache terms (section 8).
- **English**, like all memory (section 19 rule 2), so a language switch cannot
  corrupt it.
- `schemaVersion` bump plus a `fromSave` default, so an existing save loads
  with an empty canon rather than `undefined`.

Three reasons it is run-level rather than one of the two stores that exist:

1. **It is not chronology.** "The title track is X" is true from the moment it
   is decided until the campaign ends. The ledger compacts and drops; canon
   must not.
2. **It is not per member**, so the dossier's roster scoping is the wrong shape
   - everybody knows what the group decided.
3. It is the missing input for **cycles 2 and 3** (item 7). An event that can
   read what the last cycle decided is an event that can escalate.

**Do not implement (c) by widening the ledger.** A summary that must carry both
a feeling and a fact will carry the feeling every time.

#### (d) The second PREP event - content, do it last

PREP carries only `event_a` (`meeting_room`); `comeback` and `rest` carry two
each, so this is a hole rather than a preference. The group activity `mv_shoot`
has been on the calendar since M1 with no authored day behind it, and Yuhan
asked for it by name.

Needs `event_b: 'mv_set'` on the prep map, a location with a high
`exposureBase` and full `presence`, an entry in `data/events/index.js`,
`event.*` keys in **both** locales, and a pass against the map assertions -
`data/soloCoverage.test.js` and `data/phaseMaps.test.js` are what will catch a
mistake here, which is what they are for.

It is also the best possible test of canon: an MV shoot that reads back the
concept the meeting chose is the shortest demonstration that a campaign
remembers itself.

#### Order, and where it is safe to stop

**(a) + (b) first**, and they ship on their own - a directive and a data field,
no schema change, testable offline. **(c) second**, deliberately, with the save
migration done properly. **(d) last**, as content.

Ordinary scenes are the larger share of the game and the same complaint covers
them (*"all dialogues are random and shallow small talks"*). Whatever (b)
establishes for events is worth looking at again for ordinary blocks - section
8's `ACTIVITY_DOING` already gives a scene a reason to exist, and it may need
agenda-shaped sharpening rather than new machinery.

### 2. Play the rest of it, on the phone, in both languages

Four sessions of nine weeks, and the last one changed what "played" means:
three of its eight defects could not exist on a desktop. **Play on the phone.**

**Play `zh` at least as much as `en`.** It is the primary locale and has found
twenty-three of the thirty-one fixes, including several the English day could
not surface at all.

**When anything looks wrong, tap `yuri.dump()` in the Snippets tab** and keep
the output with the report. Two things about the ring: it is **per page load**,
so a reload wipes it, and bare `yuri.dump()` prints only the last 10 - the
Snippets button asks for 40.

What has still never been touched by a human:

- **a date**, public or private, and therefore the whole weekend loop. The date
  sheet was unreachable until this session; it is fixed and untested.
- **the endings screen**, reached by playing rather than by fixture.
- **week 3 onward**: strain bands, `rift`, jealousy above `piqued`, the plateau.
- **a save reloaded mid-campaign** and played on.
- **a devoted week** - three blocks a day on one member, five days running. The
  run neither the harness nor any player has ever made, and the one the dating
  gate is tuned for. It settles item 4 and PROPOSALS 21 at the same time.

When it survives a full nine weeks, merge `dev` to `main` and tag it.

### 3. The four proposals still open

- **PROPOSALS 21 - dating is unreachable in week 1.** Right observation, wrong
  fix: `intimacy >= 50` is deliberately the same number as the `touch` stance
  and her bedroom door. Test a devoted week first.
- **PROPOSALS 16 - the chime has no brake.** A second voice on every turn, at
  three members and at five. Nobody has read nine weeks of it.
- **PROPOSALS 17 - nobody reacts to a gift they watched change hands.** The
  chime already fires on that turn, so it may be half-solved by accident.
- **PROPOSALS 19 - turning to somebody is live while reading, and invisible.**
  Partly answered since: the chip bar now names the addressee.

### 4. The plateau, measured against a real campaign

The harness reports **three `confidante_end` of five** on the balanced seed:
intimacy climbs to 80-90 and admissibility stalls at 26-36. Either correct or
too harsh, and **the harness cannot settle it** - it never takes a date and
never spends a dorm evening, and a public date is the largest admissibility
lever in the game. Do not move `RISK_PAYOFF_SCALE` on harness numbers alone.

Related and probably the same problem: **36 "facts with nothing to spend them
on"** per campaign, with credits ending at 0-2.

### 5. Harness fidelity

- **`presentIds` is unset for every ordinary harness scene**, so co-presence
  jealousy and `riskExposure` are under-modelled everywhere except at events.
- **It never dates and never spends a dorm evening**, which is what makes item
  4 unanswerable from it. The single most valuable harness change available.
- **It picks rooms without knowing rumors are social-room-only.** Rumors found
  per campaign fell 21 -> 7 when that rule landed; it now models a worse player
  than it used to.
- **`balanceSim` is superseded and still maintained.** `playthrough.test.js`
  answers the same questions by playing the real loop. Retire it.

### 6. Repair events

`applyRepair` is implemented and tested, `flags.repairUsed` is in the schema,
and **nothing calls either.** The classic join, still sitting there. It is here
rather than higher because `rift` needs sustained neglect to reach and no
played day has been near it - building the entry point now means building it
blind.

### 7. Events do not recur, and week 9 is the emptiest week in the game

Five anchor events fire per **campaign**, so cycles 2 and 3 have no authored
beat and the end of the game is its quietest stretch. The engine already
supports the escalating reading: key `firedEvents` on `phase:slot:cycle` and
give each event a per-cycle stakes clause.

**Item 1's canon is the missing input.** An event that can read what the last
cycle decided is an event that can raise the stakes.

### 8. Content and polish

- **Card picker UI.** The cover renders the fixed five. v1: choose any five.
- **Other identities.** Three stubs, asserted well-formed, disabled in the
  picker. Their `promptRole` lines already reach block 1 correctly.
- **`corridor` and `drama_set` are off every phase map** but keep their solo
  actions. Harmless, and content nobody can reach.
- **The block-4 language reminder is unjustified rather than wrong.** It was
  added for a cause that turned out not to be the cause - the real one was the
  opening beat. Delete it if anything ever needs the space.

Three dangling halves, all small, all the shape this project keeps producing:

- **`meta.lang` is written into every save and read by nobody.**
- **`promptBuilder` spreads `...scene` after `lang`**, so `scene.lang` silently
  overrides the argument. A footgun, not a bug.
- **Save slots have no names and no export.**

### Deferred by design

- Multi-portrait `single` / `multi` modes (section 14) - v2, and IndexedDB.
- `ko` / `pt` (section 19) - v2. The pronoun rule already survives the jump: it
  names masculine pronouns **in any language** rather than listing English
  words.

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
| 2026-08-23 | **Ten `zh` opening beats put the English gift name inside Chinese prose** - `*她没有马上接过hand warmer。*` - because `mockClient` scrapes the item out of a note that is model-facing English by design. Offline is a supported mode (section 3), so the lines refer to the object instead of naming it. Survived because every language check measures how Chinese a beat IS: all ten were wrong and only five crossed a 50% threshold. Guard is now categorical, and was run against the pre-fix file to confirm it catches all ten. |
| 2026-08-23 | **Every model call is recorded** (`tools/debugLog.js`), because which writer answered and the raw pre-parser text are the two facts that decide most bugs here and neither reaches the screen. `client.js` is the only layer that knows, so it is the only layer that records. Recording is unconditional and printing is opt-in - a bug found by hand is found once. The key is never in a record; `redact()` is tested harder than the feature. |
| 2026-08-23 | **Save moved from one automatic slot to six**, on Yuhan's instruction. Section 15 argued that there was nothing for the player to decide, which was right about saving and wrong about what a slot is for: a nine-week campaign of irreversible choices needs to be able to look at a fork twice. `auto` is unchanged; five manual slots sit beside it, `restart` clears only `auto`, and a single-slot save is adopted rather than discarded. |
| 2026-08-23 | Three of four suspects for the language split eliminated from the code: settings use a lazy initializer so there is no English first render, both `lang` inputs share one source, and a load never overrides settings. `meta.lang` is consequently written into every save and read by nobody - logged as a dangling half rather than fixed. |
| 2026-08-23 | **`singledOut` is passed, never inferred from a note.** It read `Boolean(note)`, which was correct while an opener was the only thing appending one - then the closing directive made every group scene in the game end witnessed, with four `WEIGHT_WITNESSED` hits and four dossier entries for a conversation. Exactly the defect the three-tier weights were introduced to fix, arriving eight weeks later by another door. A note is a transport; what a scene costs may not be read off which transport it used. |
| 2026-08-23 | **An event day is the event and nothing else**, on Yuhan's report. "It takes the whole day" was on screen from the first build and nothing enforced it: the concept meeting was one row among four other rooms, the dorm, a daily task, and five per-member chips at its own door. No task, one row, and walking in joins them - choosing one member in front of the others belongs inside the scene, where it costs what it should. |
| 2026-08-23 | A lit bedroom door now means she is BEHIND it. It was drawn from `DORM_OCCUPANCY` - anywhere in the dorm - so a member in the kitchen lit her own door and the map showed her in two rooms at once. One constant was answering two different questions; the dorm row on the overworld still asks the first one. |
| 2026-08-23 | **`turnTo` asks for a fresh chip set.** It dropped the written one and nothing requested another, so tapping a portrait downgraded the player to static labels until they spent a turn - most of a group scene. The directive now names the addressee too, since the label is what the player says TO somebody and after a turn that is no longer whoever last spoke. |
| 2026-08-23 | A room can be left without spending the block. The block is paid by the action, so opening a door to see who was in it was a commitment - and a map is only a search if looking is free (section 10b). |
| 2026-08-23 | **The scene meter bar carries `standing`.** Reported as "her affection shows 0" the morning after an anchor event: she ended at `fluster 28` and opened the next scene at 0, which is the design working. The defect was that three volatile meters were the only relationship numbers on screen, so nothing said they were a different kind of thing from intimacy. A word, not a number, under section 8's rule. **A correct number can still be a defect if nothing says what kind of number it is.** |
| 2026-08-23 | Day header names the weekday instead of counting (`W1 Friday` / `W1 周五`). `dayFull` is a separate key set from `day`, which lives in a seven-column grid and must stay one or two characters wide. |
| 2026-08-23 | **Deployed.** `bash deploy.sh` publishes `dev` to GitHub Pages from a `gh-pages` branch. Not Actions: that route needs Pages enabled, a `pages: write` token, AND a `github-pages` environment whose branch policy permits the branch - GitHub hardcodes that policy to `main`, so deploying `dev` failed at environment resolution in two seconds, before step one, with nothing in the log, while `configure-pages` above it reported success. Section 17 now names the two deployments separately: the Pages site is the hand-test build, a tag from `main` is what players get. |
| 2026-08-23 | **A console on the phone** (`tools/eruda.js`, `?debug=1`). The call record had been desktop-only since it shipped, on a mobile-first PWA: iOS runs WebKit under every browser, so Chrome on an iPhone has no devtools and no way to call `yuri.dump()`. Dynamic import, its own 491KB chunk, sticky flag (an installed PWA opens at `start_url` and drops query strings), every failure path silent. |
| 2026-08-23 | **The chip shuffle was not a shuffle.** `.sort(() => rng() - 0.5)` gives no uniformity guarantee and barely permutes a short array, so position in `STANCES` decided how often a stance was offered: element 0 in 41% of 2400 sets, element 9 in 23%. Reported as the vocabulary being wrong - the player had been shown the top of an array every turn for a campaign. Seeded Fisher-Yates. **A report names a symptom; the cause can be two layers below it.** |
| 2026-08-23 | **Stance vocabulary rewritten** on Yuhan's report: `tease -> flirt` (barbed by construction, and a game about two women falling for each other had no way to simply be warm - `touch` is gated at 50), `reassure -> care` (fit one situation only; `care` keeps the piqued conversion and is safe in `rift`, which finally gives the strain bands a recovery move that is not `apologize`), and `casual` added. One bar slot is RESERVED for a non-common stance, because `touch`/`invite`/`confide` are the only stances that move admissibility - an all-common bar is `markRisk` by another door. |
| 2026-08-23 | **One bounded `Sheet` for every modal.** The date sheet had no height cap and no scroll, and being bottom-anchored it grew UPWARD off the top of the screen, taking the close button with it - five members times two kinds of date on a 390x844 phone, no reachable option and no way out. The run stopped there. Header now sits above the scroll; the safe-area inset belongs to the sheet because a `fixed` overlay is laid out against the viewport, not the padded body. Asserted structurally and verified against the pre-fix file. |
| 2026-08-23 | **The language split, reproduced and fixed.** Opening beat of an anchor event in `zh`: English action, Chinese speech, then perfectly Chinese for the rest of the scene. Block 5 is EMPTY on the opening beat and on no other turn - every later generation has Chinese immediately above it and the model continues; on turn one there is nothing to continue and everything above is English by design. Block 4's `## Language` reminder cannot reach it (it sits above the frame, the register and the English directive), so `openingDirective` takes the language and states it inline. Eight live probes and a 25/25 harness could not find this: none of them opened a scene with an event frame in a non-English run. |
| 2026-08-23 | **The speaker's portrait collapsed in every group scene**, on a phone only. The scene is a fixed viewport height; the portrait was `min-h-0 flex-1` and the card row `shrink-0`, so with a header, meters, a Chinese dialogue box and a four-row chip bar there was nothing left to divide and `flex-1` is the side that gives. The row now floats over the portrait and costs no height. `Portrait`'s small size was also a hardcoded `h-24` inside an `h-14` wrapper, making every estimate of that budget wrong by 40px in the direction that hurt. |
| 2026-08-23 | **Presence is reported at scene exit.** Section 5b gives it no dossier entry, and the aftermath rendered only rumors, so a 1v1 in an occupied room ended completely silent while three people's jealousy moved. What SHE knows and what the PLAYER is told are different questions; `propagate` now returns `noticed` alongside `rumors`. |
| 2026-08-23 | **`心动` -> `心乱`.** Reported as "her affection resets at the start of every scene". It does not - `心动` means *moved to love*, so a volatile scene meter was wearing the name of the persistent one. Affection is `intimacy` and it persists; guard only looks persistent because it opens at `100 - intimacy`. The word was the bug, not the number. |
