# Progress

Rolling state of the build. Updated **before** a milestone closes, never after.
`CLAUDE.md` is the design; this file is where the design currently stands in code.

---
## Current: v2 engine, phase 3 built. On `feat/v2-engine`.

**A day plays.** Map to room to scene to aftermath to map, offline, asserted end
to end - and live against DeepSeek in `zh`, four rounds, four options each.

Deployed from `feat/v2-engine` to https://byhAnita.github.io/yuriagent/ - the
hand-test build, not a release (section 17). `?debug=1` for the in-page console.

**What is on that URL right now: `e85067a`** - the one-screen scene, the
collapsed value strip, and phase 3a. A report against an older build will still
show two-line value rows for everybody in the room, a page that scrolls every
round, and strain and jealousy in the relationship panel; all three are fixed,
so check the build before triaging any of them.

### Read these three, in this order

1. **`CLAUDE.md` Part 0 and Part I** - the v2 design. Part II is v1, with the
   superseded sections banner-marked.
2. **`docs/PROPOSALS.md` §27** - the decision record: 21 decisions from a
   `grill-with-docs` interview, why each was taken, what was measured.
3. **`~/.claude/plans/sequential-splashing-falcon.md`** - the build order,
   phases 0 to 5.

### Why v2 exists

A `zh` hand test returned two verdicts: the Chinese read machine-translated, and
the stance chips were rigid and wrong about the genre.

> As a Lesbian myself, I got to remind you Yuri relationship contains lots of
> 试探、心动、克制 texture, not direct flirting in a work place at a very early
> stage.

Both came from one decision: **v1 made the code the author and the model a
renderer.** The reference is Yuhan's own `rv-simulator`.

### What is built

| phase | | |
|---|---|---|
| 0 | the spike | `config/rules.js`, `agent/tiers.js`, `agent/roundParser.js`, Irene in Chinese |
| 1 | the docs | `CLAUDE.md` Part 0 and Part I |
| 2 | **the loop** | everything below |

**Engine.** `agent/roundEngine.js` (4-6 rounds, Leave forfeits the rest),
`agent/pool.js` (the stepped window, plus `noteScene` for solo work),
`systems/values.js` (the ±2 bound, the ±6 scene net, the admissibility veto,
only-present-members-move).

**Screen.** `ui/vn/RoundStage.jsx`, `ValueBar.jsx` (both axes visible - Part
I.2), `OptionBar.jsx` (four options, backfilled, one geometry).
`LocationGrid.jsx` **no longer renders occupancy**: the map names rooms, the room
is where you find out who is in it.

**Offline.** `tools/mockRound.js` speaks the real wire format including the
failures a small model makes. `tools/mockClient.js` is a tenth of its old size,
because v1 asked a model five questions a scene and v2 asks one.

**Cast.** All five members have `profileLocal.zh`. Jisoo, Hyewon and Yeri are
adapted from `rv-simulator`'s own group files - adapted, not lifted, because the
source names real groups (§1b), its mascots differ from ours, and the English
cards carry detail it does not. Nana is authored. `data/profileLocal.test.js`
asserts all of it.

**Deleted: 15,900 lines.** `sceneEngine`, `promptBuilder`, `responseParser`,
`summarizer`, `chipWriter`, `chips`, `dialogue`, `speaker`, `balanceSim`,
`VNStage`, `ChipBar`, `MeterBar`, `beatQueue`, `SceneSetup`, and ~500 tests for
an engine the game no longer has.

### Three defects found by running it, not by designing it

**A missing percent sign was costing the whole round.** About one live `zh`
round in six came back with `%%` instead of `%%%`. With no sentinel found,
`splitRound` calls the whole response prose - and `cleanProse` then *deletes*
exactly the lines it should have parsed. Good paragraph, no options, no emotion,
no movement, and nothing said why. Ruled out as a client bug first by teeing the
raw SSE bytes past a wrapped `fetchImpl`: `stream()` reassembles them
byte-perfect. The parser now accepts a degraded sentinel and falls back to the
option block as a boundary; the machine lines are ordered by importance, because
a response that stops early stops from the bottom.

**The aftermath was still reporting v1's computed numbers** and would have
crashed on the first scene to end. 1366 tests were green, because nothing walked
past the last option. `App.dom.test.jsx` now plays a whole block.

**`buildTier2`'s `(nothing yet)` placeholder** made the first append a full cache
miss instead of the cheapest one in the run.

### The hand test that is running against this

Deployed from `feat/v2-engine` to https://byhAnita.github.io/yuriagent/ - the
hand-test build, not a release (section 17).

**Play Monday and Wednesday of week 1.** Tuesday and Thursday are the two
authored event days and events are unwired until phase 5: five people in a room
with no agenda and no establishing beat. It does not crash; it is simply flat.
Same for a weekend date and a shared dorm evening.

**Jealousy and strain are not inert any more - they are GONE** (phase 3a, above).
If a played build still shows either, it is the older deploy.

Five questions, none of which has a test and none of which anybody but Yuhan can
answer:

1. Is ~80 words the right size *in play*? So far it is a transcript decision.
2. Do model-written options beat stances? The failure mode to watch for is four
   ways of agreeing - the rules forbid it, which is not the same as it not
   happening.
3. Is the genre there - 试探/心动/克制 - or is it a well-observed workplace drama?
4. Hidden occupancy: a search, or a lottery? Walking in is free but costs a tap.
5. ~~The value bar: too many numbers?~~ **Answered: yes.** Phase 3b, above.

### Phase 3a, built: the second and third numbers are gone

`strain` and `jealousy` are both deleted, on one argument stated twice in
Part I.8: **a damage axis only code can read is the hidden machinery v2 exists to
remove.** With that, `applySceneOutcome` had one line left worth keeping.

| gone | what took over |
|---|---|
| `strain`, `strainBand`, `applyRepair`, `criticalScenes` | a bad scene moves affection down. That IS the damage |
| `systems/jealousy.js` entirely - bands, decay, exclusivity, `JEALOUSY_GAIN_SCALE` | the rumor sits in `heard_about` and does nothing until she is in front of the player, then the model reads it |
| `applySceneOutcome` | `systems/values.js` for anything a scene decided; `addAffection` for the two things the WORLD decides - a shared dorm evening, and an opener paid for in credits |
| the plateau BRAKE | `confidante` survives as a reading. Code silently refusing a gain the model chose is the v1 arrangement |
| `failTask`'s per-member strain map | player deltas only. `affectsMembers` stays on the task; letting somebody down belongs in a scene, which is phase 4 |
| the strain/jealousy date refusals | two axes decide a date, which is what §10 always claimed |

**`stage` is no longer stored either, and that was a live bug.**
`applySceneOutcome` used to keep the field current; `applyDeltas` replaced it and
never wrote it, so from the moment v2 landed every relation carried the stage it
was created at while the day screen happened to look right because it calls
`resolveStage` itself. Derived now, like `focusId`, and `stageOf()` ignores a
stale field left by an old save.

**`propagate` is called again.** It had not been since `onSceneEnd` was rewritten
for v2 - correct, tested, and joined to nothing, which is the `markRisk` shape
for the second time in this project. `systems/rumorJoin.test.js` reads the caller
rather than the callee, because no unit test can see a missing call: a unit test
supplies the call itself.

**The aftermath says who found out**, and says that it has not cost anything
*yet*. Every one of those lines used to be a jealousy hit landing as it printed;
a player shown four names and no note reads four penalties.

### Phase 3b, from the hand test: the scene is one screen

Reported after the first phone session, and the two halves had one cause.

**Too many values** - every member in the room on two lines each plus four player
stats. Collapsed to the woman whose portrait is up, one line, the rest behind a
tap that carries the count of who else is there.

**1.5 viewports tall at font scale 1**, so every round had to be scrolled past
before it could be answered. `.stage-fill` is a fixed height and a flex item
defaults to `min-height: auto`, so nothing could give and the column overflowed.
Now every row states how it yields - `shrink-0` or a `min-h-` floor, asserted in
`RoundStage.dom.test.jsx` - the options never move, and the prose scrolls inside
its own box with the name plate pinned.

Also fixed there: `RoundStage` rendered `Portrait` **and** `PortraitRow`, so a
group scene drew the same woman twice with one of them collapsed to nothing.

### Phase 3c, built: Read her is priced in energy

**Answered by Yuhan during the hand test: energy, not uses.** Which turned out
to be another unwired constant rather than a preference.

`ENERGY_PER_READ` has been in `config/constants.js` since M1 under the comment
*"Read her costs one on top"*, section 10 has called Read her "the energy sink,
not the block" for just as long, and **nothing ever read it** - the scene screen
counted down a per-scene allowance of two and charged no energy at all. Every
number in section 10's pacing arithmetic was correct and none of it was
happening. The `markRisk` shape in its quietest form: a number being ignored
looks exactly like a number being small, and no test could see it because every
test supplied its own count.

`READ_HER_USES_PER_SCENE` is deleted. Two counters for one action was one too
many and the per-scene one was the wrong half: **an allowance that resets at
every door can never be a decision**, because nothing about it survives the
block to trade against anything.

| rule | why |
|---|---|
| the ENGINE charges it, not the screen | `session.player` is the scene's only copy of energy and `endScene` hands it back. A screen spending it would be writing state it does not own - the `affection` lesson |
| charged on the ANSWER, never on the ask | a failed call is not a look inside her head. Same rule as the date bill: she turned you down, you did not buy her dinner |
| refuses rather than going negative | the one rationed action in the game must never strand the player at zero |

The control shows the **price** now (`-1`), not a count: the same number every
time, dead when it cannot be afforded.

### PICK UP HERE: phase 4

**Do it in this order.** Gifts and tier 3 both read the dossier, so cutting the
dossier second means touching it twice.

**1. `agent/memory.js` - the dossier goes from five categories to three.**

| keep | drop |
|---|---|
| `known_facts` -> **`facts`** (what the player knows about her) | `shared_moments` - duplicated the pool, which is now the stepped window and does it better |
| `player_told_her` -> **`told_her`** (what she knows about the player) | `open_threads` - existed only to feed `strain`, including `countOpenThreads` and `resolveThread` |
| `heard_about` (what she has heard and not yet reacted to) | |

Renaming is optional and the shorter names are Part I.10's; if it costs more
than it buys, keep the long ones and cut the two. **It is a `schemaVersion`
bump** - Yuhan has confirmed v1 saves may break, they were all test saves.
Consumers to walk: `App.jsx`, `systems/economy.js`, `systems/soloWork.js`,
`data/soloActions.js`, plus `memory.test.js`, `economy.test.js`,
`soloWork.test.js`, `snoopCost.test.js`, `save.test.js`,
`sharedActivities.test.js`, `SoloAction.lang.test.jsx`.

**2. `systems/economy.js` - gifts stop being knowledge-gated.**

Delete the `requires` substring matching. It broke twice, and it existed only
because CODE had to decide whether the player had earned a gift - the model reads
her `facts` in tier 3 and reacts accordingly. Watch for: the gift modal's "locked
gifts are not shown" rule loses its reason to exist, and `data/gifts.js` has a
test asserting every knowledge gift has an owner among the cast, which becomes
meaningless. The **gesture** half (§11's "two ways to spend a fact") is the part
worth keeping - free, once per fact, and it is still the natural move.

**3. tier 3 carries the failed task**, when `affectsMembers` is set. That is
where the beat `failTask` used to buy with strain now belongs, and phase 3a left
the flag on the task deliberately so this has something to read.

**4. `systems/soloWork.js` - snooping's best prize becomes access.**

A routine, not an object: *she practises alone on Wednesday nights*. §10.11 has
wanted this since M1 and could never have it, because the map already told you
where everyone was. Hidden occupancy is what makes it worth buying.

### Then phase 5

Events, canon injection into tier 3, endings.

**What a collapse IS in v2 is an open question.** `criticalScenes` used to
trigger `resolveBadEnd` off two consecutive critical-strain scenes, and there is
no strain. `resolveBadEnd` is kept, correct, and called by nothing; it says so in
its own header, because an unwired function that looks wired is this project's
most expensive recurring bug - and this file now records three of them
(`markRisk`, `propagate`, `ENERGY_PER_READ`).

**Currently unwired, pending phase 5, and each is a live import that was
removed from `App.jsx`:** canon injection into tier 3 (the parser and engine
already carry `canon|` through), `eventFrame`, `dateFrame`/`REGISTERS`,
`sharedFrame`.

### Things a fresh session must not lose

**The live suites.** `LIVE_PROVIDER=1 LIVE_ROUND=1 npx vitest run liveRound`
drives the shipped engine; `SPIKE=1` drives `tiers.js` by hand. The first is the
one that found the sentinel bug, because it is the only one on the real path.

**Measured live, after the fix:** 4/4 rounds with four options, first word
~700-1300ms against ~3-4s rounds, affection 12 → 16, and admissibility held at 0
unaided in a low-exposure room with `irene_adm+1` asked for and vetoed.

**The model writes `irene+0`** rather than omitting a zero line as the rules ask.
It costs three tokens and `applyDeltas` drops it. Not worth another instruction.

**`.env.local` still holds a live DeepSeek key that wants revoking.**

---

## Previously (v1): M0-M5 complete, plus PROPOSALS 20 and 22-26. Five sessions played.

**1278 tests, lint and build clean.** Everything is on `dev`; `main` is well
behind and should stay there until a full campaign has been played by hand.

**Newest: PROPOSALS 22-26, all five, built 2026-08-24.** Yuhan read the entries,
took the recommended option in each, and asked for a plan. The plan is
`~/.claude/plans/sequential-splashing-falcon.md`; what shipped is the
"PROPOSALS 22-26" section below. **None of it has been played** - item 1 of
"Still open" says what to look at, and every one of the five is a judgement no
test can make.

Before that: the day-three playtest, and it was the most valuable session the
project has had - the first one to play the same feature across two cycles, in
`zh`, on the phone, with the call log attached. Ten defects fixed, five
questions sent to PROPOSALS 22-26. The report is `docs/playtests/TestReport3.txt`
and the triage is the "Day-three playtest" section below.

**The one to remember: written chips were deleting the reserved risk slot on
every turn the model answered**, so `touch`, `invite` and `confide` - the only
three stances that move admissibility - could not be reached except by
out-racing an API call. Third occurrence of the `markRisk` shape, and neither
harness could see it because neither calls `writeChips`. The sweep says what it
cost: bold play reaches a good ending 64% of the time against balanced's 32%.

Before that, PROPOSALS 20 landed: six authored events across fourteen event
days, each opening with a paragraph of room, each carrying an agenda of what
the day must settle, chained so the MV shoot shoots the concept the meeting
chose. `run.canon` holds the answers and the handbook shows them.

**Item 1 of "Still open" is the pick-up point**, and the next thing that
happens is a played session on the phone.

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

## PROPOSALS 22-26, built 2026-08-24

The five questions the day-three playtest left open. Yuhan read the entries and
took the recommended option in each, so this section is what shipped rather
than what was argued - `docs/PROPOSALS.md` still holds the arguments and now
carries a BUILT banner on each.

Built in value-per-unit-of-work order, one commit each.

### 24. Cycle 2 cannot be cycle 1

Two mechanisms doing different jobs, and they are not alternatives.

- **`data/comebackStyle.js`** - three pools (a sound, an occasion, a place),
  eight entries each, **drawn without replacement across the campaign**. That
  last part is a change to the design as written: three independent draws from
  an eight-entry pool collide about a third of the time, and a collision is the
  exact defect. A shuffle indexed by cycle makes it impossible instead.
- **`stakes[]`** on the four recurring events - one authored line per cycle,
  twelve in all. This is PROPOSALS 20 step 6, finally.

`eventFrame(event, { cycle, seed })` is the join, and `App` calls it instead of
handing over the static frame off the table. Derived, never stored.

**The pools reach the model as pressure, never as three nouns** - what the label
wants, what A&R keep bringing up, what is in the director's reference folder.
Same rule the agenda follows: name what is at stake, never which way.

### 22. A stance for doing the job

`work` is the twelfth stance: **common** (at work most turns are work), **safe**
(never locked by strain, jealousy or low energy), and **worth little** - there
is no stance-to-payout table anywhere, so a stance is worth what it is written
worth, and the offline tables give it the smallest numbers in the game.

`deflect` gave up the fourth common slot and **only** the slot. Four is
load-bearing: `generateChips` fills two of three from the set and reserves the
third, so a fifth dilutes every other one by a fifth - including `care`, which
the `piqued` conversion runs through.

#### What the re-measure actually said

The plan said to re-run the harness, because a new safe common stance changes
every scene's payout. It does not, and the reason is worth keeping:

> **Neither harness calls `generateChips`.** Both pick a stance uniformly out of
> `availableStances`, so `COMMON_STANCES` changing cannot reach them at all. The
> only thing they saw was a twelfth entry in a list they draw from - which
> reshuffles which stance every rng draw lands on.

On the default five seeds that moved `spread` 28 -> 40 and `balanced` 32 -> 16,
**in opposite directions**, and only for the two policies that pick uniformly.
That is seed noise wearing a result's clothes, and at five seeds there was no
way to say so - which is why `HARNESS_SEEDS` now exists and why the sweep's
timeout scales with it.

### 23. The shoot shoots

`physical: true` on the MV shoot, Music Bank and the fan meeting, and one more
establishing-shaped beat two thirds of the way through: `speaker: null`, no name
plate, no roster entry, no jealousy, **zero new rules**. `establish` and
`interlude` are one `narrate` with a different sentence in it.

Live, at the MV shoot:

> The first setup finally rolls: a slow dolly shot across a white void, the five
> of them in muted tones, moving through a blocked sequence. The director calls
> cut twice, adjusts a fan, and they reset. A PA carries armfuls of black fabric
> past you toward the rigging.

The `zh` one is genuinely Chinese and about the lighting rig, the monitor and
the playback. **The NPC stays unbuilt**, and PROPOSALS 23 stays the argument for
what it would cost.

### 26. The Chinese

Memory stays English - rule 2 stands, and writing it in `zh` trades a prose
problem for a data-integrity one. Two cheaper things instead:

1. The `zh` block says **how** to write, not only which language: as a Chinese
   novelist writes rather than as a translator does, the notes above are a brief
   and not a text to render, prefer the concrete verb, never carry an English
   simile across word for word.
2. **`styleHints` is read.** It has been on the card schema since M0, section 12
   described what it was for, and **nothing in `agent/` had ever looked at it** -
   eight cards, every hint `null`, one comment mentioning the field. A designed
   slot with no consumer, mild only because the absence was invisible. All five
   MVP cast are now voiced in `zh`.

Recommendation 3 - authoring `REGISTERS` and frame `setting` lines in the target
language - is deliberately not built and is the next step if a native reader
still finds it translated. **The measure is a native reader**, and no test here
stands in for one.

### 25. Legibility, and nothing on the scene screen

- **A refusal names its axis.** `REFUSAL.TOO_SOON` became `NOT_CLOSE` and
  `NOT_NAMEABLE`, derived from the kind's own axis rather than hardcoded, worded
  without a number. That is pillar 1 working: the hidden state becomes legible
  through a decision the player made.
- **The day-screen relationship row is a button** into a `Sheet` panel - free,
  no block, the handbook's shape. It is **the first place `admissibility` has
  ever appeared in the UI**: half the relationship model, six milestones,
  invisible, because a one-line row had no room for a second number.

Nothing on the scene screen. `Read her` stays rationed.

### Two live assertions that were testing the wrong thing

Both surfaced by running the live suites against the five, and neither fix is a
loosening - each replaces a proxy with the claim it was named after.

**A name is not prose.** The `zh` concept meeting settled a title track and gave
it a Chinese name inside the English memory line, with the same name in
`display`. That is correct: demanding an English title invents a **second name
for one song**, so the model would say the English one in Chinese prose and the
handbook would show a different title from the one Irene says out loud. Exactly
the failure `learnableFacts` had before ids. The check now strips quoted and
bracketed spans; a bare Chinese word in an English sentence still fails. Section
19 has the rule.

**"Nobody speaks as somebody else" was asserted by searching the prose for
another member's name**, which is a different claim entirely. Caught live on
*"Practice room's free. Yeri took the last of the good towels, so don't bother
looking."* - five women who share a dorm being written as five women who share a
dorm, which block 4 names the absent members as absent to make possible. The
proxy failed on good writing and never tested its own rule: the parser drops an
off-roster beat before it can reach `s.beats`. Now asserted against the speaker
of every beat, which is strictly stronger.

### Where the numbers stand

**20 seeds x 5 policies x 5 members, current code**, which is the widest reading
this harness has ever been given:

| policy | good | endings |
|---|---|---|
| `expert` | **75%** | ours 36, unspoken 21, out 16, severance 10, exposure 8, confidante 7, unnamed 2 |
| `bold` | **61%** | ours 40, confidante 23, out 15, severance 11, unspoken 6, exposure 5 |
| `spread` | 39% | confidante 60, unnamed 20, unspoken 19, severance 1 |
| `balanced` | 22% | confidante 78, unspoken 14, unnamed 6, ours 2 |
| `devoted` | 20% | drift 80, out 20 |

**The balance ending is 0/20 for every policy**, which is what section 5b wants
of it and is unchanged. The dedicated reachability run (`HARNESS_BALANCE=1`,
three policies x 20 seeds) says more than that, and it is worth reading
carefully:

| policy | balance ending | all five good | what the fifth member got |
|---|---|---|---|
| `bold` | 0/20 | **5/20** | confidante 4, severance 1, nameless 1 |
| `expert` | 0/20 | **3/20** | exposure 3, confidante 3, nameless 1 |
| `balanced` | 0/20 | 0/20 | - |

**The blocker is jealousy, not intimacy.** `bold` gets all five members to a
good ending in a quarter of its runs and clears the balance bar in none of
them, so what stops it is the `jealousy < 50` condition rather than anybody
falling short of `nameless`. That is a coherent story rather than a bug: the
behaviour that produces good endings here is public risk, public risk produces
rumors, and rumors are what produce jealousy. Section 5b designed exactly that
tension - *breadth is cheap while everything is shallow, and becomes punishing
as any single route deepens.*

What it does **not** yet establish is whether the ending is very rare or
actually unreachable, and 0/60 cannot tell those apart. The honest caveat is
the one open item 5 already makes: **no harness policy takes a date**, and a
date is both the largest admissibility lever in the game and - for a public one
- a witnessed-tier jealousy event for all four absent members. The policy that
would test this properly is one that converts `piqued` aggressively while
taking risks, and it does not exist. Do not move a jealousy coefficient on
these numbers.

Two things to read out of that table.

**`expert` finally beats `bold`**, 75 to 61, which is the design working and
which five seeds could not show - the same two policies read 56 and 64 on the
narrow list. Understanding both axes should beat betting on one, and now it
does.

**But `spread` beats `balanced`, 39 to 22, and section 5b says the opposite.**
That is open item 4, and the A/B below settles who is responsible for it.

#### The A/B: `work` changes nothing here, and that is the answer

Both arms at 20 seeds, differing by exactly one thing -
`HARNESS_EXCLUDE=work` withholds the stance from the harness rather than
reverting the code, so the rng stream and every other input are identical.

| policy | with `work` | withheld | delta |
|---|---|---|---|
| `expert` | 75% | 74% | +1 |
| `bold` | 61% | 62% | -1 |
| `spread` | 39% | 38% | +1 |
| `balanced` | 22% | 24% | -2 |
| `devoted` | 20% | 20% | 0 |

**Every delta is inside +/-2 points on 100 endings a cell.** `work` is not
measurable here, which is exactly what it should be: it is a cheap, safe verb,
and the harness cannot see the one thing about it that is not cheap - the
weighting, which needs `generateChips`.

So the five-seed reading of `balanced` 32 -> 16 was **entirely** noise, and
`spread` beating `balanced` is a **pre-existing property of the two policies**
rather than anything this session did.

This is the shape to reuse. A before/after across a stance ADDITION compares two
different questions, because a twelfth entry in a uniform pool reshuffles which
stance every draw lands on. Withholding it from one arm is the only version of
the experiment that isolates the variable.

#### What the harness can and cannot say about a stance

Worth writing down once, because the plan for PROPOSALS 22 asked this harness a
question it structurally cannot answer.

| | reaches the harness? |
|---|---|
| `work` added to `STANCES` | **yes** - and badly: the harness picks UNIFORMLY out of `available`, so a twelfth entry dilutes every other stance AND changes which one each rng draw lands on |
| `work` added to `COMMON_STANCES` | **no** - the harness never calls `generateChips`, so the weighting that the player actually experiences is invisible to it |

So a naive before/after measures the first and misses the second entirely. The
guards for the part that matters are `systems/workStance.test.js` and
`ui/vn/VNStage.dom.test.jsx`.


---

## Day-three playtest, 2026-08-24 (`zh`, live DeepSeek V4 Flash)

A nine-week campaign played by hand on the phone, with `?debug=1` on and the
call log pasted into the report. Fifteen numbered observations, four of them
carrying several defects, and the most valuable session the project has had -
because it is the first one that played the SAME feature across two cycles.

**The headline: the `markRisk` bug has now happened three times.** Twice in
this document already, and once more below, by a door nobody had checked.

### 1. Written chips delete the reserved risk slot  <- the important one

`generateChips` reserves the last of its three slots for a stance outside the
common four, and the comment above that loop says exactly why:

> `touch`, `invite` and `confide` are the only stances that can move
> admissibility, so a bar filled entirely with warm everyday verbs is a bar on
> which the second axis cannot move. That is precisely the shape of the
> `markRisk` bug - the whole second half of the relationship model quietly
> unreachable - arriving by a different door.

`writeChips` then threw that reservation away on every turn the model answered,
because its candidate field was `available.slice(0, 6)` - the HEAD of the
`STANCES` array, which is `flirt, care, casual, deflect, joke, press`. Every
chip request in the whole report carries that same six, in that same order, in
every scene of a nine-week campaign.

`touch`, `invite` and `confide` sit at indices 7, 6 and 10. **They could never
be written.** The static set could still deal one - and the written set
replaced it the moment the call returned. The player's own words:

> I saw the option with a small circle noted on it to be seen, but the option
> is changed to LLM options on common flirting, caring etc. **We now need to
> click the need to be seen option very fast before LLM options come.**

That is the second axis of the relationship model being reachable only by
beating an API call in a footrace. Same defect as `markRisk` and as the old
`sort(() => rng() - 0.5)`: **a deterministic slice of an ordered array,
standing in for a choice.** The project has now shipped this three times.

Fixed by building the field from what `chips.js` actually dealt plus a sampled
remainder, and by keeping a risk chip the static set offered when the model's
three do not include one - degrading chip by chip, which is the rule the
written-chip design already follows everywhere else.

### 2. An anchor event charged four bystanders for attending it

Reported five separate times, once per event played:

> A witness error here, I didn't give Irene anything or do special interaction.
> Player just join the special event group chat, there shouldn't be a witness.

`propagate` gives every present non-addressee the `WEIGHT_PRESENT` tier and a
line on the aftermath screen. That is right for a practice room, where the
player chose to spend the block on one of the three women in it. It is wrong
for an anchor event, where **the company put all five in the room and the
player is staff attending a meeting.** Nobody chose anybody, and the client
picks an addressee by construction - so the event ended with four "she watched
you give your time to Irene" lines every single time, fourteen times a
campaign.

This is the argument `shared` already won for the dorm, in the same file:
*without it the release valve is its own tax.* An event is not a release valve,
but it is the same fact - collective attendance is not a choice - so it takes
the same exemption, and only the presence tier. A **gesture** at an event is
still witnessed at the full weight, because section 10 is explicit that
choosing one member in front of the other four is the loudest act in the game.

### 3. The chip directive contradicted itself

`Give exactly three options` followed by `Stances, once each: <six of them>`.
The model resolved that ambiguity differently from turn to turn: the report
contains replies with **two** lines and replies with **six**. Two is what the
player saw as "2 live options and 1 offline option", reported twice as a bug.

### 4. The player is addressed in the third person, in `zh`

`Player` reached the scene-summary line as a literal noun. The `display` string
is the only model-written text a player reads outside a scene, and section 15's
cover screen already promises the opposite: *the narration always calls you
"you"; only they use your name.*

### 5. The cast have no Chinese names

The model transliterates, so the summary called Irene `Yilin` and Hyewon
`Huiyuan`. Both are wrong, and section 12 has said since M0 that localized
display names live in `i18n/` - they simply never reached a prompt.

### 6. Traditional characters leak into a Simplified run

One `記` for `记`, in the middle of an otherwise clean scene. Cheap to state and
impossible for a player to read as anything but a bug.

### 7. Manual save slots are invisible on the cover

The cover offered only the autosave. `App.dom.test.jsx` asserts the opposite
and passes, which makes this the most interesting bug in the report after the
first one - see the fix note, because the test was right and the screen was
still wrong.

### 8. Canon reaches the model and comes back as the word "concept"

Verified injected, verified read - and spoken as `the concept board` rather
than as `Day Dream`. The player had to ask point-blank before a member would
name a decision:

> Seems the problem is prompt - need tell character to say concrete fact
> instead the word "concept".

### 9. Canon has no tense, so a finished day is spoken as tomorrow

`tomorrow at the beach` said a week after the beach shoot happened, and a
music-bank stage discussed in week 3 as though it were still ahead. The entries
are true; nothing says WHEN, so the model guesses and guesses forwards.

### 10. Nobody told the model the cast are women

An Adam's apple, on Irene. Section 1b established that the player is a young
woman and never said the same about the five women she works with, for exactly
the reason section 1b gives about itself: it was too obvious to write down.


### What the chip bug was actually costing, measured

**Run after the day-three fixes, 5 seeds x 5 members per policy**
(`HARNESS_REPORT=1 HARNESS_SWEEP=1 HARNESS_BALANCE=1`):

| policy | good endings | what it produced |
|---|---|---|
| `devoted` | 20% | `drift_end:20 out_end:5` |
| `spread` | 28% | `confidante_end:18 unspoken_end:7` |
| `balanced` | 32% | `confidante_end:17 unspoken_end:6 unnamed_end:2` |
| **`bold`** | **64%** | **`ours_end:7 out_end:7`** confidante_end:5 severance_end:2 ... |
| `expert` | 56% | `ours_end:9` exposure_end:5 severance_end:4 out_end:4 |

`bold` is the policy that takes the overt move whenever the room allows one.
**It doubles `balanced`**, and `ours_end` / `out_end` - the two best endings in
the game - are produced almost exclusively by it and by `expert`. Every policy
that does not deliberately reach for risk piles up `confidante_end`.

So the reserved risk slot is not a nicety. It is the difference between a 32%
run and a 64% run, and the written-chip defect was deleting it from the bar on
every turn the model answered - which left a real player somewhere in the
`spread`/`balanced` band whatever they intended.

### ...and no harness could have told us

`playthrough.test.js` and `balanceSim` pick stances straight out of
`availableStances`. **Neither has ever called `generateChips`, let alone
`writeChips`**, so a risk stance was always available to them and `bold` could
always play boldly. The table above describes a game the player could not
actually reach.

That is failure mode 9 for the third time - a harness wrong in the player's
favour hides a bug rather than finding it - and it has a consequence worth
stating for next time: **every admissibility figure measured before 2026-08-24
is an upper bound**, not a measurement.

The guard for this therefore lives at the layer where the defect was, not in a
harness: `VNStage.dom.test.jsx` holds the chip call open, reads the
deterministic bar, releases it, and reads the bar again. Against the pre-fix
code it prints the bug in the player's own terms:

```
before: ["stance.press", "stance.invite vn.risk", "stance.confide vn.risk"]
after:  ["stance.care I am here", "stance.joke ...", "stance.casual ..."]
```

### One number that has still never been seen

**The balance ending is 0/5 under every policy, and 0/20 in the dedicated
reachability run.** `CLAUDE.md` section 5b quotes 2.8% for `balanced`, which is
from the older `balanceSim` and predates the plateau brake and the dead risk
flag. Twenty runs at ~3% expects 0.6 hits, so this is not yet evidence of
anything - but the engine harness has never once produced the ending the game
is named after, and nobody should quote 2.8% as though it had.

### What went RIGHT, because it is evidence too

- The establishing beat landed every time and was singled out as good in four
  separate places.
- The handbook works, and the player used it unprompted to check the campaign.
- Canon crossed a cycle boundary: week 4's meeting opened on the previous
  cycle's concept, which is the chain doing its job even though the same
  property produced defect 9.
- Yeri named her own locked dossier fact at the second MV shoot, unprompted -
  memory showing in prose, which is pillar 4.
- A member mentioned the group's first album at the fan meeting. The player's
  note: *Surprise! Very good.*

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
>
> And from day three, the sharpest one yet: **ask what the harness does not
> call.** The written-chip defect made the game's second axis unreachable for a
> whole campaign, and neither harness could see it, because neither has ever
> called `generateChips` or `writeChips` - they pick stances straight out of
> `availableStances`. A harness that is wrong in the player's favour does not
> merely miss a bug, it *certifies* the code around it.

---

### 1. Play PROPOSALS 22-26 on the phone  <- PICK UP HERE

**All five are built and none of them has been played.** Yuhan went through the
entries, took the recommended option in each, and they shipped the same day. The
offline suite, both live suites and a wide sweep are green - and every one of
these five is a judgement no test can make.

#### What to look for, in the order it is worth looking

| | what should have changed | what would mean it did not work |
|---|---|---|
| **a comeback, twice** | cycle 2's concept meeting is pushed toward a different sound, occasion and place, and knows it is the second | the room recites the three nouns at each other instead of arguing about them |
| **an MV shoot / Music Bank / fan meeting** | two thirds of the way in, a paragraph of the work: a take, a reset, the light going | it reads as a second establishing beat, or as furniture the player taps past |
| **the chip bar, at an event** | a `work` option most turns, and picking it moves the day's business | `work` is on the bar every turn and nothing else is |
| **a `zh` scene** | the prose reads written rather than translated - this is the one that needs a native reader and has no test | the stage directions still carry English metaphors |
| **a date you cannot get** | the refusal says which axis was short, in words | it still reads as a flat "not yet" |
| **the day screen** | the relationship row opens into a panel with BOTH axes | the player still cannot find it |

#### The two that would be new defects rather than misses

1. **`work` crowding the bar.** It is common and safe, which means it is legal
   in every band - so it is the one stance that can appear when nothing else
   can. If the bar reads as `work` plus two warm verbs for a whole scene, the
   fix is its weighting, not its existence.
2. **The interlude firing in the wrong place.** It is pinned to two thirds of
   the turn limit, which is turn 10 of 16 at an event. If a scene ends before it
   fires, or it lands on the closing turn, that is the client's arithmetic and
   not the model's.

#### And the things that were already waiting

Everything under (b) of the previous pick-up is still unplayed, because that
session ended in this one. **The risk chip is still the one that matters most**:
play until the bar deals a marked option, WAIT for the written labels, and check
it survives. If admissibility never moves across a played campaign, stop - that
would be the fourth time this axis has been unreachable.

| | |
|---|---|
| **an anchor event** | ends with NO "she watched you give your time to Irene" lines - unless you actually hand somebody something, which should still produce four |
| **the chip bar** | three written labels, not two-and-a-static |
| **a scene summary** | addresses you as *you*, and spells her name the way the card does |
| **an event decision** | names a song and a concept, never "the third demo" |
| **an ordinary block after an event** | she says the title by name, and does not put a finished shoot in the future |
| **the cover** | the save list is a bordered control now; the five manual slots were always behind it |

#### Do NOT reach for the harness for anything about chips

It cannot see them. `playthrough.test.js` and `balanceSim` pick stances straight
out of `availableStances` and **never call `generateChips` or `writeChips`** -
which is why the written-chip bug survived two harnesses and four played
sessions, and why adding `work` to `COMMON_STANCES` is invisible to both. The
guards live in `VNStage.dom.test.jsx` and `systems/workStance.test.js`.

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

### 3. The older proposals still open

**PROPOSALS 22-26 are NOT here** - they are item 1, because they came out of
the newest played session and Yuhan has asked to decide them first. These four
are the ones that were already waiting.

- **PROPOSALS 21 - dating is unreachable in week 1.** Right observation, wrong
  fix: `intimacy >= 50` is deliberately the same number as the `touch` stance
  and her bedroom door. Test a devoted week first.
- **PROPOSALS 16 - the chime has no brake.** A second voice on every turn, at
  three members and at five. Nobody has read nine weeks of it.
- **PROPOSALS 17 - nobody reacts to a gift they watched change hands.** The
  chime already fires on that turn, so it may be half-solved by accident.
- **PROPOSALS 19 - turning to somebody is live while reading, and invisible.**
  Partly answered since: the chip bar now names the addressee.

### 4. `spread` beats `balanced`, and it is not the work stance

**Open, and new on 2026-08-24.** The twenty-seed sweep puts `spread` at 39% good
endings and `balanced` at 22%. CLAUDE.md section 5b's whole claim about policy
ordering is *skill beats spreading, spreading beats chance* - so a competent
multi-route player losing to a naive round-robin is either a real regression or
a statement that `balanced` is not the policy its name claims.

Two things point at the second reading. Both are **non-risk** policies -
neither sets `preferRisk` - so neither is playing the second axis at all, and
both drown in `confidante_end` (60 and 78 of 100). And chasing jealousy
*concentrates* attention where spreading it does not, which is a plausible
mechanism rather than a measurement.

**`work` is not responsible, and that is measured rather than argued.** Both
arms at 20 seeds, differing by `HARNESS_EXCLUDE=work` alone: `balanced` 22%
with it and 24% without, `spread` 39% and 38%, every policy inside +/-2 points.
The inversion is there in both arms, so it predates this session and the
five-seed `32 -> 16` was noise start to finish.

What is left is a question about the policy rather than about the game: **is
`balanced` doing what its name claims?** It converts jealousy first and takes
no risks, so it concentrates attention on whoever is unsettled and never
touches the axis that would let anyone off the plateau. If that is what a
competent multi-route player actually does, section 5b's ordering claim needs
rewording; if it is not, the policy needs rewriting. **It is not evidence about
a coefficient either way** - do not move one over it.

### 5. The plateau, measured against a real campaign

The harness reports **three `confidante_end` of five** on the balanced seed:
intimacy climbs to 80-90 and admissibility stalls at 26-36. Either correct or
too harsh, and **the harness cannot settle it** - it never takes a date and
never spends a dorm evening, and a public date is the largest admissibility
lever in the game. Do not move `RISK_PAYOFF_SCALE` on harness numbers alone.

Related and probably the same problem: **36 "facts with nothing to spend them
on"** per campaign, with credits ending at 0-2.

### 6. Harness fidelity

Two of these were fixed on 2026-08-24 and are recorded below the line, because
**a harness that is wrong in the player's favour hides bugs rather than causing
them** - and both of them were doing exactly that.

- **`presentIds` is unset for every ordinary harness scene**, so co-presence
  jealousy and `riskExposure` are under-modelled everywhere except at events.
- **It never dates and never spends a dorm evening**, which is what makes item
  4 unanswerable from it. The single most valuable harness change available.
- **It picks rooms without knowing rumors are social-room-only.** Rumors found
  per campaign fell 21 -> 7 when that rule landed; it now models a worse player
  than it used to.
- **`balanceSim` is superseded and still maintained.** `playthrough.test.js`
  answers the same questions by playing the real loop. Retire it.

Fixed, and both mattered more than they looked:

- **It handed out a daily task on all 45 weekdays**, never passing `eventDay` to
  `generateDayTask`, so it reported a credit supply the player does not have.
- **It played the afternoon and evening of every event day**, which `Aftermath`
  consumes. That one hid a shipped bug: the harness was still standing in the
  same "today" when the week plan reshuffled, so it walked into a relocated
  event a block later and never noticed that a real player could not.

### 7. Repair events

`applyRepair` is implemented and tested, `flags.repairUsed` is in the schema,
and **nothing calls either.** The classic join, still sitting there. It is here
rather than higher because `rift` needs sustained neglect to reach and no
played day has been near it - building the entry point now means building it
blind.

### 8. Events recur - BUILT 2026-08-24

Kept as a stub because the reasoning is worth finding from this direction too.
This entry and item 1 were each waiting for the other: canon needs a second
cycle of events to escalate into, and a second cycle of events needs canon to
escalate from. Neither was doable alone, and neither entry could see that.

`firedEvents` keys on `phase:slot:cycle`; four events recur, the cruise and the
island are one-offs in cycles 1 and 2. Fourteen event days a campaign. **Week 9
is no longer the quietest week - it is the island trip.**

What remains of this entry is the per-cycle stakes clause, which is item 1's
step 6 and is deliberately unbuilt until somebody has played the chain.

### 9. Content and polish

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
| 2026-08-24 | **An anchor event opens with the room** (PROPOSALS 20 a). `establishingDirective(lang)` + `establish()`, its own preset, one paragraph of about forty words before anybody speaks. Its OWN CALL rather than a second beat shape, so section 9's contract is untouched and the parser's roster rule is not asked to grow a case for prose with no speaker - the client knows this is narration because the client asked for it. `speaker: null` is the whole of the render, and `DialogueBox` draws no name plate over it. |
| 2026-08-24 | **The establishing call inherited the empty block 5, so it carries `lang`.** Flagged as a trap before the build and it was the real thing: the language split lived on whichever turn has nothing above it, and that is now this call rather than the opening beat. The opening beat is no longer a scene's first generation and has this paragraph's prose above it, which is the condition under which the model continues in the right language. |
| 2026-08-24 | **`REGISTERS.event` stopped asking for atmosphere.** With the establishing beat in front of it, "open with one or two sentences that establish the atmosphere" made the first TWO beats of every anchor event both open by describing the room. A date keeps the line, because her opening beat is still the scene's first thing. |
| 2026-08-24 | **`frame.agenda`** (PROPOSALS 20 b): two to four things the day must decide, on all five events. A separate field from `movements` on purpose - a movement sets the situation and never the outcome, and an agenda item names WHAT gets settled and never WHICH WAY, so the section 11 rule survives intact. Rendered as an obligation where movements are offered, and repeated once by `closingDirective({ settles })` on the turn the client knows is last. |
| 2026-08-24 | **The rendered agenda says outright that not everything has to go anyone's way.** Not padding: a room told to decide four things will otherwise agree pleasantly about all four, which is the same small talk in a suit. |
| 2026-08-24 | **(a) and (b) do not fix (c), and shipping them is the evidence for that rather than an argument against it.** A livelier meeting still forgets itself by Tuesday: the dossier is per member and the ledger is chronology that compacts. `run.canon` is designed before it is built, on Yuhan's instruction - five open questions are written into "Still open" item 1. |
| 2026-08-24 | **(c) designed, and the design reordered the work.** Reading the code rather than the docs: `PHASE_MAP.prep` has no `event_b` and `eventKey` is `phase:slot`, so the chain canon implies has a hole at its first link and cycles 2-3 have no events to escalate into. (d) and open item 7 are therefore PREREQUISITES, not follow-ups - and item 7 had been saying the same thing from the other side since it was written. Each was waiting for the other. |
| 2026-08-24 | **Four recurring events per cycle, not six.** The cruise and the island stay once-per-campaign punctuation. REST is the repair week; and more sharply, **an event day generates no daily task**, so event days are a supply line - six would take 40% of the working weekdays and cut the credit economy by roughly the same, against a campaign that already ends at 0-2 credits with 36 unspent facts. The connection between event frequency and the gift economy was not visible from either entry alone. |
| 2026-08-24 | **Storage and injection are separate, which is what dissolved "what happens when canon fills up".** Only the ledger has to fit inside a prompt, so only the ledger needs a compaction rule. Canon storage is complete and permanent (it is what the player reads); injection is filtered to ~6 lines of block 4. |
| 2026-08-24 | **A canon entry is an id and two texts** - `text` English for the prompt, `display` in `meta.lang` for the handbook. Section 19 rule 2 keeps memory English, so without this a `zh` player would read their own campaign's decisions in English. Section 12 made this exact mistake once with `learnableFacts`; the fix is the same one. |
| 2026-08-24 | **A decision whose topic is not in the event's `agenda` is dropped entirely.** The parser's roster rule in a new place, and there for the same reason - prompting alone will not hold it. A topic the day never reached is simply absent: a decision recorded for nothing is worse than one never recorded. |
| 2026-08-24 | **Canon reaches ordinary scenes, not only events.** Two or three lines of the current cycle in block 4, which is rebuilt every scene anyway. Irene mentioning the title track in a wardrobe on a Tuesday is pillar 4 - memory that shows - and it is the half of the feature the original sketch left out. |
| 2026-08-24 | **The handbook goes on the day screen, not in a room.** A room action reads as costing a block, and reading your own notes must not. Section 10's "do not privilege it visually" argument is about choices; a reference list is not one. |
| 2026-08-24 | **Checked, already built:** the prompt names the player by chosen identity rather than assuming assistant, and states she is a young woman drawn to women. Block 1 has done both since the pronoun fix. Asked for, and no change needed. |
| 2026-08-24 | **The MV shoot** (PROPOSALS 20 d, step 1). `mv_set` at `exposureBase` 70 fills PREP's missing `event_b`, which gives the four working-cycle events a visibility ramp of **35 -> 70 -> 90 -> 88** - a gesture is cheap at the concept meeting and loudest at the fan meeting, which is the cycle's shape stated as one number per site. Four assertions had encoded the hole as a rule (`eventSlots('prep')` equals `['event_a']`, `eventFor('prep','event_b')` is null, exactly five events, `resolveSlot` null example); each was rewritten to assert the new rule rather than have its number bumped. |
| 2026-08-24 | **The harness handed out a task on all 45 weekdays.** `generateDayTask` has taken `eventDay` since "an event day is the event, and nothing else" landed, and `playthrough.test.js` never passed it - so it reported a credit supply the player does not have. 45 -> 39. Found while sanity-checking step 1, and it matters because the **only** evidence for whether fourteen event days are affordable is what this harness says about credits. |
| 2026-08-24 | **The harness also played the afternoon and evening of every event day.** `Aftermath` consumes the rest of the day for a date or an event; the harness advanced one block at a time and did not. Two phantom blocks per event, each with a task and a snoop in it. At six events that was noise; at fourteen it is 28 blocks of 189, and they are exactly the blocks the credit question turns on. The loop is now bounded by the clock as well as by its counter, because a block is no longer always one iteration. |
| 2026-08-24 | **Checked and NOT a bug: the App does not give the map back after an event.** Worth recording because the harness defect above looked like one - `weekPlan` depends on `firedEvents`, so marking an event fired mid-day does drop it from the plan and would restore the task and the full map. `Aftermath` eats the remaining blocks first, so the player never reaches that state. The rule holds by a mechanism two files away from the rule, which is the fragile kind. |
| 2026-08-24 | **Events recur per cycle** (PROPOSALS 20, step 2). `flags.firedEvents` keys on `phase:slot:cycle`; four working-cycle events come back, the cruise and the island stay one-offs authored to cycles 1 and 2. Six authored events, **fourteen event days a campaign**. `cycle` is one field doing two jobs - an event that names one fires there only, an event that names none fires in all of them - rather than a `recurs` boolean that could disagree with it. |
| 2026-08-24 | **`eventKey` throws without a cycle rather than defaulting to 0.** A default would let a caller that forgot compile, run, and quietly key every cycle's event to one string - the single guarantee the function exists to provide, broken silently, in this project's favourite shape. It earned its keep in the same commit: it caught both stale call sites as a failing test rather than as a campaign where the second Music Bank never happened. |
| 2026-08-24 | **A SHIPPED BUG: firing one event moved the other onto its day.** `eventDays` filtered slots and then took that many days off the shuffle, so a slot's day depended on how many were still unfired. An event eats its whole day, so the relocated day was always in the past - **the fan meeting was unreachable once Music Bank had been played, and the island trip once the cruise had.** Deal the days to every slot first, then filter. |
| 2026-08-24 | **...and it survived because two bugs hid it.** PREP was the only phase hand-tested and it had one slot, so nothing could move; and the harness did not consume the rest of an event day, so it was still standing in the same "today" when the plan reshuffled and walked into the relocated event a block later. Fixing the harness in step 1 is what uncovered it. **A harness that is wrong in the player's favour hides bugs rather than causing them.** |
| 2026-08-24 | **The credit cost of recurrence, measured rather than predicted.** Task days 39 -> 31, and across four policies: credits at campaign end {1,13,2,1} -> {2,0,0,0}, facts with nothing to spend them on {31,37,22,17} -> {36,38,43,31}. The design predicted this and asked for the measurement here. Verdict: recurrence **aggravates** a problem it did not cause - credits already ended near zero - so the fix belongs in the economy (open item 4) and not in cutting events. Recorded rather than acted on. |
| 2026-08-24 | **`run.canon`** (PROPOSALS 20 c, step 3). `systems/canon.js`: agenda items gained `{ id, text }`, the event scene-exit call gained `decisions[]`, and block 4 gained `## Where the cycle stands`. Persisted at `schemaVersion` 3 with a `fromSave` default. **Storage and injection are separate** - storage is complete and never compacts, injection is superseded-by-topic and capped at 6 lines - which is what makes "what happens when canon fills up" a question nobody has to answer. |
| 2026-08-24 | **A decision whose topic is not on the event's agenda is dropped**, in `parseDecisions`, not in the prompt. The prompt lists the ids so the model is likely to comply; the drop rule makes compliance not matter. Section 9's roster rule, in a new place, for the same reason. A topic the day never reached is simply absent - no filler, and the only consequence is that a later event reads one line fewer. |
| 2026-08-24 | **Canon reaches ORDINARY scenes, not only events**, which is the half the original sketch left out and most of the felt value: Irene mentioning the title track in a wardrobe on a Tuesday is memory that shows in the scene rather than in plumbing. Free, because block 4 is rebuilt at every scene start anyway. |
| 2026-08-24 | **`latestByTopic` had to delete before set.** `Map.set` on an existing key keeps the ORIGINAL insertion position, so a topic settled again in a later cycle kept its old place - and `canonForCycle` caps by taking the tail, so the freshest decision in the campaign could be the one trimmed away. Caught by a test written from the docstring rather than from the code, which is the only reason it was caught at all. |
| 2026-08-24 | **The store and its reader shipped together on purpose.** The design staged them as steps 3 and 4, and a step that writes canon nobody reads is `markRisk` by definition - implemented, tested, and never called. The `reads` chain and the handbook are what remain. |
| 2026-08-24 | **Harness: canon accumulates 28 entries across 12 topics** in a 14-event campaign, and the two numbers staying apart is the assertion - entries prove storage never compacts, topics prove superseding works. If they ever converge, one half has stopped working. |
| 2026-08-24 | **The `reads` chain** (PROPOSALS 20 c, step 4). Each event names topic ids from earlier ones, and block 4 hands it the current answer for each - looked up across ALL cycles, which is the point: a cycle-2 concept meeting reading `fandom_focus` wants what the cycle-1 fan meeting made of it, because there is no cycle-2 fan meeting yet. `concept_meeting` reads its OWN previous answers too, or a second meeting picks the same concept again and calls it a comeback. |
| 2026-08-24 | **Named topics, not the whole store.** A small model given eighteen lines of world facts uses none of them; given "the title track is X" immediately above an agenda that mentions the title track, it uses it. Same argument as block 4 repeating her `speechStyle` - proximity and selection are what make a fact load-bearing rather than decorative. |
| 2026-08-24 | **The cap bites the current cycle, never the chain.** Four reads plus six current-cycle entries is ten lines for a six-line budget, and trimming from the wrong end would quietly delete the one thing the day was authored to have while keeping six facts it never asked for. |
| 2026-08-24 | **An older decision says it is older** (`- earlier in the campaign: ...`). A stale fact with no timestamp is worse than no fact: a model states last cycle's title track in the present tense, and the player reads a continuity error rather than a callback. |
| 2026-08-24 | **A `reads` id that matches no agenda is a dead reference and fails silently** - the line simply never appears and the chain has a hole nobody notices, which is exactly what a rename produces. Asserted against the catalogue. |
| 2026-08-24 | **The handbook** (PROPOSALS 20 c, step 5). `ui/modals/HandbookModal.jsx`, on the day screen and free to open - a room action reads as costing a block, and reading your own notes must not. Grouped by cycle, newest first, showing `display` and falling back to `text` because the wrong language beats a blank line. Without it canon reached the model and never the player, which is the failure pillar 4 exists to forbid. |
| 2026-08-24 | **Two guards picked the new modal up for free**, which is what those tests are for: `Sheet.test.js` walks `ui/modals/` and asserted the handbook uses the shared sheet rather than rolling its own `fixed inset-0` shell, and the en/zh parity check caught nothing because both locales were written together. The named-key assertion (`handbook.*`) is the one that would catch a bulk replace, per the note on `settings.title`. |
