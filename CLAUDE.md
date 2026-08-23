# YuriAgent - Project Blueprint

> Status: **design locked, pre-implementation**. No game code written yet.
> Read this file before touching anything. Update this file *before* changing code, never after.

---

## 1. Goal & Pillars

An LLM-driven yuri visual-novel / life-sim PWA set in the K-pop industry. Non-profit, fan-made.
Successor to `rv-simulator`, but **a game instead of a story generator**.

Four pillars, in priority order:

1. **Legible tension over long prose.** The player reads hidden emotional state and bets on it. 30-50 word dialogue bursts, not 300-word narration.
2. **The yuri layer is a system, not flavor.** Closeness and admissibility are separate axes. The interesting zone is "deeply close, cannot be named."
3. **Verbs, not a chat box.** Quick-action chips are the primary input; free text is the escape hatch.
4. **Memory that shows.** What she remembers about you must surface in mechanics, not only in prose.

### Explicit non-goals

- Not a SillyTavern clone (no failure state, no objective -> not a game).
- Not a text adventure with A/B/C/D branches (that was rv-simulator).
- Not a stat-optimization sim. Numbers exist to make feelings readable, not to be maximized.

---

## 1b. Fictional Setting

The cast are five members of the girl group **X**, under **X Entertainment**. They share a dorm. The player is staff at the agency - Artist Assistant in MVP, other identities later.

**The player is a young woman, and so is everyone else.** Every route in the
game is between two women; that is what the whole thing is. Obvious enough that
it went unwritten for six milestones, and **block 1 never said it** - the player
was introduced by name and job, the name is free text, and the model had nothing
else to go on. One Chinese run in three had a member refer to the player as
`他`; an English cut-in produced *"He's just standing there."*

It is a fact about the world, so it lives in the World block and not in a
pronoun rule. A pronoun rule can only patch the symptom: the model was not
mistaken about a pronoun, it was mistaken about who the player is. The rule
about which words follow (`her name or "she"`, never a masculine pronoun **in
any language**) sits underneath it, because a model writing Chinese will not
infer `她` from an English sentence about her job.

**The cast is cross-group in source, single-group in fiction.** Cards are built from members of different real groups, but inside the game world all five debuted together in X, hold roles within X, and share one comeback cycle. Each also runs an individual career alongside it - soloist, actress, host - which is what scatters them across the map outside comeback weeks.

Two consequences for the code:

- A card's `origin` field (`"Red Velvet"`, `"BLACKPINK"`) is **library metadata for the card picker only. It is never injected into a prompt.** In fiction there is no Red Velvet; there is X. Leaking `origin` into the prompt makes the model narrate the wrong world.
- Group roles are **not** fixed on the card, because any five cards must be able to form a coherent X. A card declares `preferredRoles`; `systems/castBuilder.js` resolves the lineup at run start - leader and maknae from birthdays unless a card prefers otherwise, remaining roles filled from preferences without duplicates.

MVP cast: Irene (leader, lead rapper), Nana (main dancer, main rapper), Jisoo (visual, lead vocalist), Hyewon (lead dancer, sub vocalist), Yeri (maknae, sub rapper).

`seulgi`, `wendy` and `joy` remain in `data/characters/` as library cards. They are not in the MVP cast.

---

## 2. Scope

| Milestone | Contents |
|---|---|
| **MVP** | 1 identity (Artist Assistant), 5 prebuilt cards all present and all romanceable, zh/en, one 3-week company cycle, chips + free text, 2-axis relationship + jealousy, exposure-driven rumor propagation, dossier memory, two-layer deterministic calendar, knowledge-gated gifts, balance simulator, save/load, PWA |
| **v1** | Event anchor nodes, confrontation events, bad ends + endings screen incl. the balance ending, repair events, group scenes (2 members interactive), retry/copy, card picker UI |
| **v2** | More identities, 50+ card library, custom card editor, player-uploaded portraits (`single` / `multi` modes), ko/pt, multi-model expansion |

Everything in v2 must have its **interface stubbed in MVP** (identity config, card loader, language keys) so adding content later requires no refactor.

---

## 3. Tech Stack

- React 19 + Vite 8 (already scaffolded), Tailwind CSS 4
- Plain React hooks. No Redux/Zustand.
- LLM: OpenAI-compatible router - DeepSeek V4 Flash (default), Gemini 3.5 Flash-Lite, GPT-5.6 Luna, Qwen 3.8 Max
- PWA: manifest + service worker, mobile-first 390x844. **Every path is
  relative** - `base: './'` in `vite.config.js`, `./` in the manifest and in
  `index.html`, and `./sw.js` at registration - so the build works from a
  GitHub Pages project subpath as well as from a domain root. An absolute path
  looks perfectly correct in `npm run dev` and 404s on deploy day, which is
  what makes it worth a test rather than a habit.
  The worker is hand-rolled and small: **network first for navigations**, so a
  new build is picked up rather than pinned; **cache first for everything
  else**, because hashed assets are immutable by construction. It caches only
  GETs from its own origin and the two font hosts, which is what keeps model
  traffic - a cross-origin POST carrying the player's prompt - off the disk.
- Persistence: localStorage
- Tests: vitest (`npm test`). Lint: oxlint (`npm run lint`). Build: `npm run build`.
- **The game is playable with no API key.** `tools/mockClient.js` emits the real
  contract format and `tools/client.js` picks between it and the live router.
  That is a supported mode, not a degraded one: it keeps the loop free to play
  and lets development continue without spending tokens.

---

## 4. Architecture

```
                     +---------------------+
   player input ---> |    Scene Engine     | <--- systems/ (pure, testable)
   (chip / text)     |  turn loop, stream  |      relationship, calendar,
                     +----------+----------+      tasks, economy, exposure
                                |
                     +----------v----------+
                     |   Prompt Builder    |  5 blocks, cache-stable order
                     +----------+----------+
                                |
                     +----------v----------+
                     |     llmTool.js      |  multi-model router, streaming
                     +----------+----------+
                                |
                     +----------v----------+
                     |  Response Parser    |  tolerant streaming state machine
                     +----------+----------+
                                |
              +-----------------+-----------------+
              |                                   |
     +--------v--------+                +---------v---------+
     |    VN Layer     |                |   Memory Layer    |
     | portrait/meters |                | ledger + dossier  |
     +-----------------+                +-------------------+
```

**Hard rule:** `systems/` contains pure functions over state. No React, no LLM calls, no I/O.
All LLM traffic goes through `tools/llmTool.js`. Nothing else calls a model endpoint.

---

## 5. Relationship Model (core system)

Per romanceable character:

| Quantity | Range | Meaning | Rises from |
|---|---|---|---|
| `intimacy` | 0-100 | how emotionally close | good scenes, Guard drops, Fluster peaks |
| `admissibility` | 0-100 | how nameable / showable it is | surviving deliberate risk at high Exposure |
| `strain` | 0-100 | accumulated damage | suspicion spikes, dropped threads, reckless pushes, failed tasks that hurt her |
| `peakIntimacy` | 0-100 | high-water mark, monotonic | decides which Bad End applies |
| `peakAdmissibility` | 0-100 | high-water mark, monotonic | decides which Bad End applies |

`strain` decays -3 per good scene, floor 0. `intimacy` never decays passively; it only drops on hard events.

### The map

```
 Intimacy
  100 | confidante | unspoken |  ours   |  OUT *
      |  (plateau) |          |         |
   85 | confidante | unspoken |  ours   | /
      |            |          |       /   RECKLESS
   70 | confidante | NAMELESS |     /      (A > I+20)
      |            |  <- core |   /        strain +5 / scene
   50 |   "very good friends" | /
      |                      /
   30 |   colleague        /
      |                  /
   15 | stranger       /
    0 +------------------------------------------> Admissibility
      0        20        40        60        86      100
```

### Stage resolution

```js
resolveStage(intimacy, admissibility) {
  if (admissibility > intimacy + 20) return 'reckless';        // hazard
  const tier =
    intimacy <= 15 ? 'stranger'
  : intimacy <= 30 ? 'colleague'
  : intimacy <= 50 ? 'good_friends'
  : intimacy <= 70 ? 'nameless'
  : intimacy <= 85 ? 'unspoken'
  : admissibility >= 86 ? 'out' : 'ours';
  const aMin = { stranger: 0, colleague: 0, good_friends: 10,
                 nameless: 20, unspoken: 40, ours: 60, out: 86 };
  if (admissibility < aMin[tier] - 10) return 'confidante';    // plateau
  return tier;
}
```

| Stage id | Note |
|---|---|
| `stranger` | start |
| `colleague` | professional proximity only |
| `good_friends` | the euphemism zone |
| `nameless` | **signature zone** - high intimacy, unnameable |
| `unspoken` | both know, neither says |
| `ours` | named, private |
| `out` | true end, hardest |
| `confidante` | plateau: intimacy outran admissibility and stalled |
| `reckless` | hazard: pushed public before private was ready |

Display names for all locales live in `i18n/`. Never hardcode stage text in components.

### The plateau actually stops her

`confidante` is not a label on a position, it is a **brake**. While she is on
it, `applySceneOutcome` refuses intimacy *gains*: admissibility still moves,
strain still decays, losses still land, and the scene that walks her onto the
plateau is still paid in full - a wall you can watch yourself hit is a rule, one
that catches you mid-step is a bug.

Without the brake the word meant nothing. A full campaign ended with all five
members at `intimacy` 100, `admissibility` near zero and `confidante_end` for
everybody, under every policy including one that took a public risk in every
scene it could. With it, good endings became reachable at 12-64% depending on
how the player plays, and the balance ending sits near 5%.

This is also the clearest statement the game makes of its own thesis. Privacy is
safe and stagnant; the only way forward is to be seen. When she stalls, the move
is to take her somewhere public and make an overt one.

### Strain bands

| Band | Range | Effect |
|---|---|---|
| stable | 0-39 | normal |
| tense | 40-59 | UI tint shifts, one chip slot locked |
| **rift** | 60-89 | scenes shorten, aggressive chips locked, repair event unlocks |
| critical | 90-100 | 2 consecutive scenes here -> Bad End |

**Repair event:** available once per 3-week cycle per character while in `rift`. Success drops strain by 30.

### Bad Ends

Bad Ends are exits from the map, not regions on it. Low/low is where every run starts. Which ending fires is decided by high-water marks at the moment of collapse:

| Condition | Ending |
|---|---|
| `peakAdmissibility >= 60` | `exposure_end` - it got seen; company/fandom wins |
| `peakIntimacy >= 70 && admissibility < 30` | `nameless_end` - she stays, permanently as "a friend" |
| stage was `reckless` at collapse | `severance_end` - she cuts contact |
| `peakIntimacy < 40` | no BE; `drift_end` at campaign end (neutral) |

Endings resolve **per character**. A run can end with one route at `ours`, one at `nameless_end`, and three at `drift_end`. The campaign ending screen reports all five.

### Ending ids

| id | Condition | Kind |
|---|---|---|
| `out_end` | stage `out` | good |
| `ours_end` | stage `ours` | good |
| `unspoken_end` | stage `unspoken` | good |
| `unnamed_end` | stage `nameless` | **good** - deeply close, never nameable, not broken |
| `confidante_end` | stage `confidante` | neutral - it stalled |
| `friends_end` | stage `good_friends` | neutral |
| `reckless_end` | stage `reckless` at campaign end | neutral - public, hollow, unresolved |
| `drift_end` | `peakIntimacy < 40` | neutral - it never started |
| `nameless_end` `exposure_end` `severance_end` | collapse (above) | bad |

`unnamed_end` and `nameless_end` are deliberately close and deliberately distinct: the first is the signature zone reached and held, the second is the signature zone reached and then broken.

### The campaign is three cycles, not one

**Found by `balanceSim`.** One 3-week cycle is 63 blocks, which across five routes is ~12 scenes each - not enough to lift any of them out of `drift_end`. One cycle is a good length for a single devoted route and far too short for the multi-route game. `CYCLES_PER_CAMPAIGN = 3`.

`peakIntimacy` also reframes the map: bottom-left with `peakIntimacy = 0` is **Stranger**; with `peakIntimacy = 75` it is **Aftermath** - same coordinates, different scene framing and a different chip set.

---

## 5b. Multi-Route & Jealousy

Every cast member is simultaneously romanceable and carries a full independent track. `run.focusId` is **derived, not chosen** - it is whoever currently holds the highest intimacy, and it drives UI emphasis and the `bloom` theme only. It gates nothing.

One additional value per character:

| Quantity | Range | Meaning |
|---|---|---|
| `jealousy` | 0-100 | pressure from believing your attention is elsewhere |

Jealousy is **pressure, not damage**. It feeds `strain` only when left unaddressed, and in its lower band it converts into intimacy.

### How she finds out: exposure doubles as leakage

A member cannot be jealous about something she does not know about. Rather than making every member omniscient, awareness propagates from the `exposure` value the scene already computes:

```
at scene exit, for each absent cast member M:
  p(M learns of it) = clamp((exposure - 30) / 70) * proximity(M, location)
  if learned -> append a rumor to M's dossier.heard_about
```

The rumor is written **from her point of view**, never as a transcript:
`"you heard the player was at the cafe with Wendy"`.
Member separation (section 9) is preserved - Irene's prompt never contains Wendy's scene.

`exposure` therefore carries three jobs at once, which is the central strategic tension of the game:

| Scene exposure | Admissibility | Scandal risk | Rival awareness |
|---|---|---|---|
| low (practice room, night) | cannot rise | safe | safe |
| high (cafe, noon) | rises | rises | rises |

Privacy is safe and stagnant. Visibility is the only route to a relationship that can be named - and the same property that makes it real makes it contested.

### Jealousy scales with her own investment

```
jealousyGain = rumorWeight * (intimacy / 100) * exclusivity(stage) * SCALE

exclusivity: stranger 0.2, colleague 0.4, good_friends 0.7,
             nameless 1.2, unspoken 1.6, ours 2.2, out 2.5
SCALE = 6
```

`SCALE` exists because the raw formula tops out near 2.5 while the bands sit at 25 / 50 / 75 and decay is 5 per attentive scene. Unscaled, jealousy could never reach even `piqued` and the entire pressure system was inert. The shape of the formula was right; the magnitude was not. `balanceSim` found this.

A stranger does not care who you had coffee with. Someone at `nameless` cares enormously.

The intended consequence: **breadth is cheap while everything is shallow, and becomes punishing as any single route deepens.** One deep route is the easy path. Holding all five in love at once is reachable, but it demands keeping five tracks inside a narrow band against escalating exclusivity pressure - the hardest ending in the game, not the default one.

Decay: `jealousy -= 5` per scene spent with her that produces no new rumor. Attention is the currency.

### Jealousy bands

| Band | Range | Effect |
|---|---|---|
| calm | 0-24 | none |
| **piqued** | 25-49 | she probes about it; `reassure` or `confide` converts: `jealousy -20, intimacy +2` |
| sharp | 50-74 | scene `guard` starts +15; `tease` and `touch` locked; `strain += 3` per unaddressed scene |
| corrosive | 75-100 | `strain += 8` per scene; group scenes turn hostile; unlocks a confrontation event |

The `piqued` band is the point of the system: jealousy there is an **opportunity**, not a tax. Noticing it and visibly choosing her is one of the strongest intimacy gains available.

### Group scenes

Two members present is where jealousy becomes visible rather than inferred.

- **A gesture** toward one member is **witnessed** by the others at
  `exposure = max(sceneExposure, 80)` - direct observation, no probability roll.
- Witnessed gestures give a larger admissibility gain and a larger jealousy hit
  than rumors. High-risk, high-reward is the mechanical identity of a group
  scene.
- Block 4 states cross-awareness explicitly when it applies: `Irene is aware of
  and unsettled by your closeness to Wendy.`
- The parser roster rule (section 9) still applies.

#### Being in the room is not a gesture

The word above is *gesture*, and for a while the code did not read it that way:
`witnessed` fired on mere co-presence, so an afternoon in the practice room in
which the player talked to Irene about the choreography handed the other four a
full `WEIGHT_WITNESSED` hit each - **the heaviest event in the game, for a
conversation.** Every group scene ended with five women who have shared a dorm
for years resenting one another, which is both bad fiction and the exact
opposite of what a group scene is for. Found in play, on day one.

Three tiers, not two:

| | weight | when |
|---|---|---|
| `WEIGHT_PRESENT` | 0.5 | she was in the room while the player spent it on somebody else |
| `WEIGHT_RUMOR` | 1 | she found out afterwards |
| `WEIGHT_WITNESSED` | 2.5 | she watched the player make an overt move |

Zero would have been wrong too. Watching the player spend every evening with
Irene is not nothing - it is simply not the same as watching the player reach
for her. Hearsay sits *above* presence rather than below it, because finding out
later carries a small betrayal of not having been told.

What lifts a scene to `witnessed` is `singledOut`, set by the turn loop on a
**risk stance, a gift, or a gesture** - the same list section 6 uses for what a
witness can *describe*, and the right test here for the same reason: what is
nameable is what makes somebody jealous. Presence writes **no dossier entry**;
`heard_about` is for things she found out, and a note every group scene saying
she was in the room would flush its four-entry FIFO of anything that mattered.

The group scene is still the loudest place in the game to make a move, at five
times the price of simply being there. It now requires a move.

`shared` still beats `singledOut` where they disagree, so an opener handed over
during a shared dorm evening costs nothing. That is the weaker half of the rule
and it is deliberate - the dorm needs one thing that is unambiguously
restorative, and a release valve with an asterisk is not one.

### Balance is a simulation problem

Five interacting tracks cannot be tuned on paper. `systems/balanceSim.js` runs N scripted playthroughs with no UI and no LLM and reports the distribution of reachable endings.

**There are now two harnesses, and the newer one is the authority.**
`src/agent/playthrough.test.js` plays 189 blocks through the *real* engine -
calendar, occupancy, openers, snooping, energy, the prompt pipeline against the
offline writer, rumors, day rollover - where `balanceSim` models a scene as a
number. That difference is not academic: the engine harness found two defects on
its first run (the dead risk flag and the plateau that did not plateau) that
`balanceSim` structurally could not see, because in `balanceSim` those code
paths do not exist. Its own numbers below are from the older harness and predate
both fixes; treat them as history. See `docs/PROGRESS.md` for current figures
and `docs/PROPOSALS.md` for whether `balanceSim` should be retired.

The **balance ending** is every member at `nameless` or above (`GOOD_ENDINGS`), with jealousy under 50 and nothing collapsed. `nameless` rather than `unspoken` is the right bar: five relationships that are deeply close and cannot be named is the truest version of this game's best outcome, and considerably more interesting than five public girlfriends.

Four policies stand in for player skill. Measured at 400 runs each:

| Policy | Balance ending | Reads as |
|---|---|---|
| `balanced` | **2.8%** | a competent multi-route player - converts `piqued` before it hardens |
| `spread` | 1.5% | naive round-robin |
| `random` | 0.3% | no plan |
| `devoted` | 0.0% | one route; correctly cannot reach it, and gets `out_end` ~18% instead |

The ordering is the design working: skill beats spreading, spreading beats chance, and single-route devotion trades the balance ending for a reliable real relationship.

`npm test -- balanceSim` prints the full report. **Every coefficient in this section is a starting value that belongs to this harness.** When a number here moves, the report is the evidence for whether it moved the right way - and the numbers above will shift again once gifts, chips and the dossier are wired in at M4, so re-run it then.

---

## 6. Interaction Loop

### Scene meters (volatile, reset every scene)

| Meter | Direction | Source |
|---|---|---|
| `guard` | down = good | opens at `100 - intimacy`, and the LLM reports where it is on every beat |
| `fluster` | up = you landed | opens at 0, and the LLM reports where it is on every beat |
| `exposure` | up = risky | **derived from location + time block + secrecy, not from the LLM**; also drives rumor propagation (section 5b) |

`exposure` being deterministic is what makes map choice matter romantically instead of only logistically: practice room at night is low, cafeteria at noon is high.

### Micro -> macro mapping (computed client-side at scene exit)

```
guard dropped >= 12 over the scene         -> intimacy      += 2..4
fluster peaked >= 30                       -> intimacy      += 1..3
risk action at exposure >= 60, survived    -> admissibility += (3..6) x (1 + I/100 x 1.2)
risk action at exposure >= 60, failed      -> strain        += 10..20
stage == 'reckless'                        -> strain        += 5 / scene
daily task failed and it affected her      -> strain        += 8
scene exit, per absent member              -> rumor roll    (section 5b)
scene exit, per member in the room         -> jealousy      x0.5, no entry
gesture witnessed in a group scene         -> larger admissibility gain,
                                              larger jealousy hit, no roll
```

A **gesture** is a risk stance, a gift or a knowledge gesture - `singledOut` in
the engine. Sharing a room without making one is the `x0.5` line above and not
the witnessed one; section 5b has the argument.

Deltas are computed by `systems/relationship.js` from accumulated per-turn metadata.
**The LLM never reports macro deltas** - only per-turn `guard` / `fluster` movement and emotion. Fewer things for a small model to get wrong.

### What a "risk action" is

An **overt stance taken where somebody could see**: `touch`, `invite` or
`confide` at `exposure >= 60`. `chips.js` owns the list (`RISK_STANCES`), the
turn loop sets the flag, and the chip carries a marker so the player knows they
are placing a bet.

Those three and not the others, because a witness has to be able to *describe*
what they saw. Reaching for her, asking her somewhere, and saying the unsayable
within earshot are all nameable. `tease` and `press` are loud and deniable, and
deniable is precisely what cannot move admissibility.

This was the largest bug the project has had. `markRisk` existed and was tested,
`computeDeltas` priced the outcome and was tested, and **nothing ever called
`markRisk`** - so `riskTaken` was false in every scene ever played,
`admissibility` never left 0, every route plateaued at `confidante`, and all
four good endings plus the balance ending were unreachable in the shipped game.
Both halves were correct; only the join was missing. No unit test could see it,
and a headless campaign found it on the first run
(`src/agent/playthrough.test.js`).

### The metadata line reports where she is, not how far she moved

`guard58` is a reading. `guard-8` is a movement. The contract is the reading.

The model writes **one to three beats per reply** and picks how many for prose
reasons, not as a measure of how far the conversation got. While the line
carried a delta, the client had to reassemble a quantity out of however many
pieces the model chose to write, and **no arithmetic survives that.** Three
settings were measured at twelve live scenes each before the shape of the
problem was clear:

| what the prompt asked for | what the client did | result |
|---|---|---|
| a scale per BEAT | sum | verbose paid: every 21-beat scene, no 7-beat one |
| a scale per BEAT | mean | the bias **flipped**: 5/6 terse paid, 1/5 verbose |
| a budget per REPLY | sum | verbose paid again: 6/7 verbose, 0/5 terse |
| **a reading, 0-100** | **take the last** | guard fell in **12 of 12** scenes |

The middle row is the instructive failure. Averaging looks like the obvious fix
and is not, because the problem is upstream of the arithmetic: handed a per-beat
range, the model uses the small end of it when it writes three beats and a big
number when it writes one, so a verbose reply moves her *less* in its own
numbers however the client adds them up.

An absolute has no such problem. **The last beat of a reply is the state**, so
three beats say precisely what one says, and the client stops doing arithmetic
it has no basis for. It also needs no budget instruction at all, which removes
the thing the model kept failing to do.

What it bought, on the same twelve-scene script: guard drops went from
`10, 8, -7, 11, 0, -3, -10, -23, 9, 9, 9, -20` - fluctuating, half of them
negative, the branch effectively dead - to `17, 4, 8, 10, 13, 10, 7, 11, 10, 11,
9, 17`. **Every scene now moves her the right way**, the spread is tight, and
guard behaves like something that trends across a scene instead of jittering
inside one.

Two things this requires, both deliberate:

1. **Block 4 states her opening reading** (`Irene starts this scene at guard55,
   fluster0`), because an absolute needs a scale to sit on. This does not break
   section 8's invariant 2, which forbids re-injecting a *refreshed* stat block
   mid-scene: the opening value is stated once, in the frozen header, and never
   updated. It is also not the thing section 8's "words, not numbers" rule
   forbids - that exists so the model does not narrate a relationship stat, and
   this is the opening value of a reading it is already required to emit.
2. **A signed value is still read as movement.** Section 9 assumes format
   failures rather than forbidding them, and a model slipping back into deltas
   must move the meter sensibly rather than have `-8` read as an absolute and
   slam guard to zero.

The offline writer emits readings too, converting its own delta tables against a
running state that resets on each opening beat. It has to: the game is playable
with no key and that is a supported mode, so a mock speaking a dialect the live
model no longer speaks would make offline play diverge from online play in the
one system the whole relationship model runs on. Its magnitudes are still
roughly twice DeepSeek's, so **harness payout numbers remain an upper bound.**

A per-SCENE budget was tried first and is the one thing that must not be
repeated: it overshot to a 55-point drop with fluster pegged at 100 by turn
four, because a scene is many replies and the model cannot see how many are
left.

### A public risk is worth more the closer you already are

`admissibility += (3..6) x (1 + intimacy/100 x RISK_PAYOFF_SCALE)`, and the
failure branch is deliberately flat.

A fixed 3-6 inverted the game's incentive at the worst possible moment.
`STAGE_A_MIN` steps the requirement up in 20-point jumps as intimacy crosses
each tier, so escaping the `confidante` plateau costs 10 admissibility at
intimacy 60, 30 at 75 and 50 at 90 - while the payout stayed the same size. Two
measured campaigns on one seed:

| intimacy | admissibility | endings |
|---|---|---|
| 54-69 | 0-12 | two good |
| 71-77 | 12-23 | none |

The run that got **closer to her did worse**, because the same admissibility
that clears the `nameless` bar is eighteen short of the `unspoken` one. Getting
closer was buying a worse ending, which is the opposite of what this game is
about.

Scaling the payout is also the truer sentence: being seen with someone you are
obviously close to says more than being seen with a colleague, so it moves the
needle further. The punishment is not scaled, because a failed public risk
already costs 10-20 strain and doubling that at high intimacy would hand the
problem straight back the other way.


### A scene occupies one block

`SCENE_TURN_LIMIT = 8`. Past that the block ends on its own. Without a cap a
player could grind a single block indefinitely and the opportunity cost that
makes three-blocks-a-day work would evaporate.

The opening beat does not count against it - nobody spent a turn walking through
a door. When the count reaches zero the chip bar is **replaced** by a notice and
a Leave button. Disabled chips with no explanation read as a frozen screen.

### One shape for every conversation

`systems/dialogue.js`, and it is the whole of it:

```
count who may SPEAK
  -> one member:  no second voice
     more:        one second voice per turn
  -> turn limit = base for the kind + 2 per extra member, capped at 16
  -> then the ordinary turn loop
```

Every dialogue in the game runs through it - an ordinary block, a date, a shared
dorm evening, an anchor event, a group scene. Both answers come from the same
number, which is why they belong in the same function: before this, `App` picked
a turn limit from a lookup keyed on scene kind and `sceneEngine` decided the
second voice several call sites away, so nothing stated the two rules together
and nothing could be checked against them.

**Eight turns across five members is a turn and a half each**, which is not a
conversation with anybody, so a room buys length from how many people are in it.
A five-member scene lands on 16 - exactly where dates and anchor events already
sat by hand, so three separate decisions became one formula.

It does **not** make breadth better value than depth, which is the thing to
watch, because both cost one block: 16 turns split five ways is ~3 turns of
attention each against a private scene's 8. Section 5b wants breadth cheap and
shallow and this keeps it that way.

### While she is still speaking, the bar is one control

Beats are revealed a tap at a time, and the bar is held throughout - choosing a
stance mid-reply would skip her line.

It used to render the whole set **dimmed and dead** with a continue button
underneath, and that was reported twice in one day as two different bugs:

- *"3 options, custom text, gift, skip, read her are all not clickable, but they
  all present on the screen."* Six dead controls is worse than one live one.
- *"Irene interrupted herself"* - in a one-to-one scene, where an interjection
  is impossible by construction. The player read "she has not finished speaking"
  followed by the same woman speaking again as somebody cutting in. The label
  was accurate and the framing was wrong.

So the bar **becomes** the continue control, the same treatment a spent block
gets, and the label is neutral rather than "she is still speaking" - in a group
scene the next beat is often somebody else, and the dialogue box already names
whoever is talking.

**Turning to somebody stays live while reading**, because it costs no turn and
makes no call. Answering whoever just cut in is the natural move and it should
not have to wait.

### Player input

Three **chips** per turn plus optional free text. A chip is a **stance**: the
player commits to a posture, and what she actually says back is the model's
answer. The player never writes her side and never picks a scripted line.

The baseline set is the stance names themselves, which is what ships when there
is no key, no budget, or no response:

```
[ Tease                                        ]
[ Reassure                                     ]
[ Change the subject                           ]
[ (pen) Say it ] [ (env) Give ] [ (...) Let it be ]
   turns left 5                        (eye) Read her 2
```

#### Everything that spends the turn looks like it does

The fourth row is not chrome, and it used to be. Saying it yourself, handing
something over and letting the room carry it were all 10px text links in a
corner under the chips - so **two of them were reported as bugs on the first day
of play**, in the same breath: the player never used pass, and never found the
opener.

They were the same mistake made twice. A move that ends the player's turn has to
be shaped like one, so all of them are bordered controls at a real touch target,
in one row, at the weight of the options above them.

What stays in the thin row below is exactly what **does not** end the turn: the
turn counter, and `Read her`. That split is the information.

`Give` is absent in a scene with no opener economy attached; `Let it be` is
group scenes only, because a one-to-one scene has no room to carry it.

Stance vocabulary: `tease, reassure, deflect, press, confide, touch, retreat, joke, apologize, invite`.
Locking: `press` / `touch` / `confide` unavailable in `rift`; `touch` requires `intimacy >= 50`.

`systems/chips.js` resolves which stances are legal from stage, strain band,
jealousy band and energy, and which the situation is actively asking for. That
resolution is pure, deterministic and free, and it is the source of truth for
what may be offered. Nothing below is allowed to widen it.

### Written chips

A bare `[ Tease ]` is legible but generic - it reads the same in week 1 and in
the middle of a fight. So the label may be **written by the model for this
moment**, while the stance underneath stays exactly what `chips.js` decided:

```
[ You're doing that thing with your hands again ]     -> tease
[ I'm not going anywhere ]                            -> reassure
[ So. The schedule. ]                                 -> deflect
```

The stance is what the game acts on. The label is what the player reads. Keeping
those separate is what lets the writing improve without any mechanic changing.

#### Latency: the static chips are already on screen

This is the whole design. Chips are **never awaited**. `chips.js` renders its set
the instant the turn resolves, and the written ones replace them if and when they
arrive. There is no spinner and no empty bar, so a slow call, a failed call and a
disabled feature are all invisible.

The call itself is the `Read her` shape (below): it branches off the prefix that
just finished streaming, so it is a near-total cache hit.

**Measured** against DeepSeek V4 Flash, single-member practice-room scene
(`src/tools/live.test.js`, which needs `LIVE_PROVIDER=1` as well as a key -
the default suite is free and offline):

| | beat call | chip call |
|---|---|---|
| prefix | cache hit | **same prefix, same hit** |
| miss | ~60 tok | **~140-210 tok** |
| output | ~160 tok | ~45 tok |
| wall time | 1.4-2.8 s | **1.3-1.7 s** |

Two things that estimate got wrong, both corrected here because the arithmetic
was more optimistic than reality:

- **The directive is the miss.** Not ~20 tokens - the instruction plus her last
  beat, and the beat is not optional because the chips have to answer it. An
  early wordy directive cost 171 tokens of miss on its own and pushed the call
  to 1725ms; trimming it to ~90 tokens took it to ~1370ms. The directive has a
  length test for exactly this reason.
- **The chip call is not six times faster.** It is modestly faster, and against
  a warm beat call it was once *slower*. That does not matter, because the thing
  it has to beat is not the beat call - it is the player's reading time, and
  1.5s against three beats of 30-50 words is comfortable.

It cannot run *concurrently* with the beat call - it has to know what she said -
so it fires at stream end and runs while the player is tapping through beats.

**One turn, one token.** A written set belonging to a turn the player has
already left is discarded; nothing else gates the swap.

An earlier version also required the bar to still be disabled, reasoning that
relabelling a live button is a misclick. In play that was backwards, and it
broke the feature outright: a one-beat reply makes the bar live the instant the
turn resolves, roughly a second *before* the chip call returns, so the written
set was computed, paid for and thrown away in the commonest case. The only
written chips that ever survived were the ones arriving while the bar was still
disabled - which is exactly when they could not be clicked. The player saw
static labels most turns and dead labels the rest.

The misclick is prevented structurally instead: **the chip bar is always a stack
of full-width options, labelled or not.** One geometry means a swap changes only
the words, never the position or the size of the target under a finger.

Do not route chips to a different, faster model. That abandons the shared prefix
and turns a 20-token miss into 2200. Same model is what makes this cheap.

The chip call also carries **its own, shorter deadline** (`timeoutMs` on the
preset, 10s against the 45s default). A chip set that arrives after the player
has taken their turn is discarded anyway, so waiting the full request timeout
for one only holds a slot open and delays the circuit breaker noticing that the
provider is struggling.

#### While she is still speaking

Chips are held while beats remain unread - choosing a stance mid-reply would
skip her line. That hold needs to *say so*. Section 6 already learned this for a
spent block: a disabled control with no explanation reads as a frozen screen,
and a small caret in the corner of the dialogue box is not an explanation. The
bar therefore grows an explicit continue control whenever beats are outstanding,
and the dimmed options above it are visibly waiting rather than broken.

#### Contract

One line per chip, pipe-delimited, same house style as section 9. Not JSON -
more tokens, and small models break it more often.

```
tease|You're doing that thing with your hands again
reassure|I'm not going anywhere
deflect|So. The schedule.
```

Validated client-side, never trusted:

1. The stance must already be in `availableStances().available`. Every lock rule
   is preserved for free, and the model cannot unlock `touch` by asking.
2. Deduplicate stances. Trim and cap the label - it must survive `zh` at
   `fontScale` 1.25 on a 390px screen.
3. Fewer than three survive -> **backfill from `generateChips`**, keeping the
   ones that did. Degrading chip by chip beats degrading all at once.
4. None survive -> the static set stands, and the player never knows.

Labels are prose, so they are written in `meta.lang`. Stance ids are machine
tokens and stay ASCII English in every locale (section 19).

#### Chips must not hand over the answer key

The pillar is that the player *reads* hidden state and bets on it, which is why
`Read her` is rationed rather than streamed. A chip reading *"Ask why she's upset
about Wendy"* hands over jealousy the player never detected, for free, and
bypasses that economy entirely. The chip writer can see blocks 3 and 4, so it
holds the material to do exactly that.

The rule:

> **The stance may be informed by everything the model knows. The label may only
> contain what the player could have seen or heard.**

That keeps the value - the model knowing `reassure` is the live move is the point
of writing chips at all - while forbidding it to narrate what it knows. Two
consequences, both enforced in code rather than hoped for:

- A label naming a member who is not in the scene is **rejected**, mirroring the
  parser's roster rule (section 9).
- Chips are intentions, never outcomes. *"Kiss her"*, not *"Kiss her and she
  melts."* The chip is what the player tries; what happens is the model's answer.

#### Failure budget

Token cost is negligible, but request count roughly doubles - about 500 extra
calls per campaign - which matters for free-tier rate limits, not for money. Two
consecutive chip failures in a scene disables the writer for the rest of that
scene, and a setting disables it entirely. Both fall back to `chips.js`, which is
a complete input system on its own and must stay that way.

`agent/chipWriter.js` owns the call, the parse and the validation. It lives in
`agent/` and not `systems/` because it touches a model (section 4). Its request
frame is **ephemeral and never committed**: unlike `Read her`, a chip request must
not append to block 5, or the transcript fills with chip requests and every later
turn loses its prefix.

### "Read her"

Inner thought is **not** streamed on every line - that hands the player the answer key and kills the tension.
`Read her` is a limited action: 2 uses per scene, or 1 Energy. It appends a system note at the tail of the scene buffer and requests a thought-only response (~30 output tokens, full prefix cache hit).
---

## 7. Memory Architecture

Five prompt blocks; four of them frozen while a scene is open.

| Block | Structure | Lifetime | Size |
|---|---|---|---|
| 1 | **Static system** - rules, format contract, identity, all cast cards | whole run, byte-stable | ~2200 tok |
| 2 | **Ledger** - append-only one-sentence scene summaries + macro state | whole run | ~1200 tok |
| 3 | **Dossier** - learned facts, **only for members present in this scene** | rebuilt at scene start | ~60 tok / char |
| 4 | **Scene header** - roster, time, location, exposure, standing, gift note | rebuilt at scene start | ~150 tok |
| 5 | **Scene buffer** - dialogue turns in the current room | **purged on exit** | grows |

### Dossier

The addition that makes memory visible instead of invisible plumbing.

```js
dossier: {
  irene: {
    known_facts:     [],  // max 8, LRU   - "hates cold hands"
    shared_moments:  [],  // max 5, LRU   - "you fixed her mic pack before showtime"
    open_threads:    [],  // max 3, FIFO  - "she asked if you are free Sunday"
    player_told_her: [],  // max 5, LRU   - "you are from Busan"
    heard_about:     []   // max 4, FIFO  - "you heard the player was at the cafe with Wendy"
  }
}
```

Unresolved `open_threads` at cycle end cost `strain += 5` each. The model is instructed to reference them.

Two rules that are not optional:

1. **Roster scoping.** Block 3 contains dossier entries only for members present in the current scene. An absent member's facts are simply not in the prompt, which is the cheapest possible defence against member bleed. `heard_about` is the one channel by which a member knows anything about another member's scene, and it is always phrased from her point of view - never as a transcript (section 5b).
2. **English always.** Ledger entries and dossier entries are written in English regardless of the player's UI language (see section 19). Memory stays language-agnostic, the player can switch language mid-run without corrupting history, and block 1 stays byte-stable across the switch.

### Scene exit pipeline

```
1. Enter room  -> build blocks 1-4; block 5 empty
2. Interact    -> append turns to block 5 only
3. Exit        -> one summarizer call: { summary, dossier_add[], dossier_resolve[] }
4. Commit      -> summary appended to ledger; dossier updated; block 5 discarded
5. Deltas      -> systems/relationship.js applies macro changes from accumulated turn meta
```

Ledger compaction (kept from rv-simulator): when full entries exceed `LEDGER_FULL_MAX = 6`, mutate older entries **in place** (`type: 'full' -> 'summary'`, `text -> summary`). Never reorder, never delete - the prefix must stay byte-identical.

---

## 8. Prompt Assembly & Cache Rules

```
[ block 1  system       ]  byte-stable for the whole run
[ block 2  ledger       ]  append-only; gains an entry at every scene boundary
[ block 3  dossier      ]  present members only; rebuilt at every scene boundary
[ block 4  scene header ]  roster, time, location, exposure, standing, gift note
[ block 5  turns        ]  the ONLY thing that grows during a scene
```

### Why this order

The ledger gains an entry after *every* scene. So on the first turn of a new scene, everything after block 1 is a cache miss no matter how blocks 2-4 are arranged - moving the dossier earlier or later changes nothing.

Ordering is therefore chosen for **salience, not cache**: the most decision-relevant material sits closest to the dialogue. Dossier facts about the woman in the room matter more to the next line than a summary of week 1, so the dossier goes after the ledger.

### Standing: what block 4 says about closeness

Block 4 names, for every present member, **where the two of you stand** - as a
sentence, never as a number:

```
Irene: the two of you are close in a way neither of you has put a name to.
Irene has been on edge about where your attention has been lately.
```

This is the input the model needs to make *any* reaction proportionate - a gift,
a joke, a hand on a shoulder. Without it every scene is written at the same
emotional distance, which is the single most obvious way a generated line reads
as canned.

Two rules:

1. **Words, not numbers.** A stat block invites the model to narrate the stat,
   and section 9 forbids numbers in prose. A sentence cannot be quoted back.
2. **Standing is macro state, not a meter.** It is fixed for the whole scene, so
   it belongs in the frozen header. `guard` and `fluster` move *during* a scene
   and therefore stay client-side - putting them here would break invariant 2.

### Why this scene is not the last one

Block 4 also carries **what she is doing here**, **what the week feels like**,
and **what the player still owes today**.

All three already existed in state and none of them reached the model. The
calendar has known since M1 that Irene is in the practice room for
`group_practice`; block 4 said `Location: X Practice Room` and stopped. So the
model had to invent a reason for her to be standing in a room, every visit to
that room opened the same way, and she could never say the obvious natural
thing - that the new choreography is giving her trouble.

| line | source | changes |
|---|---|---|
| `Irene is running the new choreography with the other four.` | `occupancyAt().activity` -> `ACTIVITY_DOING` | every block |
| `Comeback week. Cameras on everything...` | `PHASE_WEATHER[phase]` | every week |
| `The player still owes the agency one job today: the stage outfits still need prepping.` | `generateDayTask` -> `TASK_CHORE` | every day |

This is the cheapest variety in the game: it costs about forty tokens in a block
that is rebuilt every scene anyway, so it is **free in cache terms**, and it is
what makes the same room in week 1 and week 7 a different scene. Measured live,
the same member in the same practice room opened three different ways under
`group_practice`, `late_practice` and `solo_recording`.

Order inside block 4 is by immediacy, which is section 8's salience rule applied
within a block: time and weather, location, who is here, **what she is doing**,
how visible it is, where the two of you stand, what she has been unsettled by,
**what the player owes**, and last of all what they walked in holding. The gift
note stays at the bottom because it is the most immediate thing in the room.

Both new strings are **model-facing English** and never localized - the
player-facing labels are separate keys in `i18n/` (section 19).

### And her voice, said again

Block 4 also repeats one line of card for every present member: her
`speechStyle`.

It is duplicated from block 1 on purpose. All five cards live up there, roughly
1500 tokens above the instruction, and selecting the right one out of five is a
step a small model does not reliably take. Given an identical practice-room
opening, **Irene and Hyewon came back with the same line** - "You are early. The
others won't be here for another hour" - at 90% shared vocabulary, while the
three louder cards stayed distinct. Neither card is at fault; the model
collapsed the two reserved women onto the subset they share. Repeating the line
here took the overlap to 27%.

Costs ~25 tokens in a block that is rebuilt every scene anyway, so it is free in
cache terms. This is the cheap version of a general rule: **when two cards are
adjacent in temperament, distance from the instruction is what flattens them.**

### Cache accounting

| Call | Blocks hit | Miss size |
|---|---|---|
| turn 1 of a scene | block 1 only | ~1550 tok |
| turns 2..N | everything up to the tail | last turn only, ~60 tok |
| "Read her" | everything up to the tail | ~20 tok |
| scene summarizer | everything up to the tail | ~40 tok |

Roughly 63 scene openings per 3-week playthrough, so about 230k uncached input tokens for a full run. Cost is not the binding constraint; latency is (see section 6).

### Cache invariants - violating any of these breaks the design

1. Nothing above block 5 may change while a scene is open.
2. Live meter values are **client-side only** during a scene. Never re-inject a refreshed stat block mid-scene.
3. New information mid-scene (a gift, an interruption, a "Read her" request) is appended as a new message at the tail, never edited into the header.
4. Block 1 must exceed 1024 tokens for automatic prefix caching to engage on most providers.

Result: turn 1 of a scene is a cache miss; every subsequent turn is a near-total hit.

---

## 9. LLM Output Contract

Metadata on the **first line**, machine-readable, then prose. Metadata first means the portrait reacts before the text arrives.

```
@irene|blush|guard47|fluster18
*I take the water bottle with a slight blush.* "Thanks... you really saved me back there."
```

Grammar: `@<speaker_id>|<emotion>|guard<0-100>|fluster<0-100>`
Emotions (MVP set): `neutral, happy, blush, shy, upset, surprised`.

The two numbers are **readings, not movements** - where she is at the end of
that beat. Section 6 has the argument and the measurements; the short version is
that the model chooses how many beats to write for prose reasons, and no
client-side arithmetic can turn an unknown number of deltas into a quantity.
With a reading, the last beat of a reply is the state.

**A signed value is still accepted and read as movement.** `guard-8` means she
moved eight, not that she is at minus eight. Format failures are guaranteed at
this tier (see the parser rules below), and a model slipping back into deltas
must move the meter sensibly instead of slamming guard to zero. The offline
writer emits readings, so both paths run in every test.

**All machine-readable tokens stay ASCII English in every language.** Speaker ids, emotion names, and field names are never localized. Only the prose after the metadata line is written in the player's language. A localized emotion name kills the parser.

Up to **3 beats** per response, each with its own metadata line. The client reveals beats one tap at a time. This halves call count and hides latency behind player pacing.

**A beat ends where the next metadata line begins - not at the next blank line.**
Models put a blank line between the action paragraph and the speech, which is
good prose and exactly the shape asked for above:

```
@irene|neutral|guard+0|fluster+0
*She is at the mirror, and does not turn around.*

"You're here."
```

That is **one** beat. Splitting on the blank line tore it in two and the orphan
half carried no emotion and no deltas, so roughly half of all beats moved
nothing - a live run found this, and no amount of prompt-side reasoning would
have. Prose never begins with `@`; a beat always does, so the separator is
`/
s*
(?=s*@)/` and nothing else.

### The opening beat is hers

A scene does **not** open with a synthesised player action. `*enters*` gives the
model nothing to react to, which is how a carefully chosen gift once got
answered with "You came."

Instead the first turn is an instruction (`openingDirective` in
`agent/sceneEngine.js`):

- no gift: *write her opening beat - what she does in the moment she notices the
  player has walked in.*
- with a gift: *write her opening beat. It is her reaction to what she has just
  been handed, and to the person holding it.*

The gift note itself is appended ahead of that instruction and **carries its
tier** (section 11), because an iced coffee and a hand warmer she never told
anyone she needed are otherwise the same sentence to the model.

### Parser rules (`agent/responseParser.js`)

Streaming state machine. Format failures are guaranteed at this model tier, so:

1. No metadata line found -> render the whole output as prose from the current focus character, no state change.
2. Unknown emotion -> fall back to `neutral`.
3. **Speaker id not in the current scene roster -> drop the beat entirely.** This is the hard guarantee against member bleed; prompting alone will not hold it.
4. Unknown but rostered speaker id -> fall back to the focus character.
5. Malformed meter -> treat as no movement. An unsigned number is a reading and replaces the meter; a signed one is a movement and is added to it; an out-of-range reading is clamped to 0-100 rather than trusted.
6. **Never** show a raw metadata line to the player.

### Member separation

Three layers, cheapest first:

1. Block 3 carries dossier entries only for present members - an absent member's facts are not in the prompt at all.
2. Block 4 lists the roster explicitly and names absent members as absent.
3. The parser enforces the roster (rule 3 above).

**The cap was a constraint on the single-call architecture, and the client-side
addressee has retired it.** It existed because one call writing three people is
unreliable at this model tier - not because three people in a room is wrong.

The client now picks who speaks and asks for **one member's beat per call**, so
the roster rule above holds at one speaker per call and member bleed stays
structurally prevented rather than prompted against. A group scene is therefore
as safe as a 1v1 by construction, at this model tier or any other.

What replaces the cap is a rule about calls rather than about people:

> **One call, one speaker.** Never ask the model to write two members in one
> response. The roster may be the whole room; the answer may not.

Two calls a player turn at most - the addressee, and at most one interjection.
Section 10c has the shape.

Summarizer and any JSON-returning call use the rv-simulator 4-level fallback: direct parse -> strip markdown -> regex field extraction -> safe defaults. Never crash.

---

## 10. Time, Calendar, Tasks

3-week cycle: `PREP -> COMEBACK -> REST`. Each day has 3 time blocks: morning / afternoon / evening.

### Two schedule layers, driven by the group cycle

X has real comebacks, and each member also has an individual career. The group layer and the solo layer trade dominance across the cycle, which is what gives each week a distinct feel:

| Week | Phase | Group layer | Solo layer | Co-presence | Outside exposure |
|---|---|---|---|---|---|
| 1 | **PREP** | rehearsal, recording, concept, MV shoot | continues - dramas shoot, solo tracks | medium | low |
| 2 | **COMEBACK** | music shows, fansigns, promo, variety | largely suspended | **high** | high |
| 3 | **REST** | none | resumes fully - everyone scatters | low | mixed |

The emotional rhythm this produces:

- **PREP** - everyone is in the building, exposure is low. Intimacy grows, admissibility cannot move. Safe building.
- **COMEBACK** - everyone is in the *same rooms* under maximum visibility. Admissibility can finally rise, and every gesture is witnessed by four other people. The pressure-cooker week.
- **REST** - the cast scatters to individual work and the dorm empties out. The repair week, where `piqued` jealousy gets converted before it hardens.

Build, risk, repair. Note that COMEBACK raises **both** risks at once - outside scandal and internal jealousy - which is exactly why the dorm matters (below).

**The calendar is deterministic.** Hand-authored slot templates per week-phase, filled by a seeded RNG. No LLM call. Reasons: replayable, testable, instant, and the player can be shown the whole week upfront - opportunity cost only bites when it is visible. The LLM may write a flavor label for a slot; it may never decide the slot.

### Two schedule layers

```js
weekPlan: {
  group:   [ { day, block, location, activity } ],          // all of X at once
  members: { irene: [ { day, block, location, activity } ] } // solo careers
}
```

### Weekends are protected

**No group activity, no solo activity, and no daily task on Saturday or Sunday.** Everyone is at the dorm, the cafe, or somewhere else that is not a workplace.

This is load-bearing, not a nicety:

- It is the only time the whole cast is simultaneously reachable and unscheduled, which makes the weekend the relationship engine's own playground.
- The weekend is where **dating** lives (below). A date consumes the whole day.
- It gives the week a shape - five days of opportunity cost, two days of choice.

**Event anchors go on weekdays, not weekends.** This reversed during the M5
design pass and the earlier reasoning was backwards. The argument for weekends
was that nothing was scheduled there, so a scripted beat could not collide with
a comeback - but an authored event should *replace* a scheduled day, not dodge
one. The Music Bank recording genuinely is that Thursday. Weekends belong to the
player, which is what this section wanted them for in the first place.

`isWeekend(day)`, `workDays()` and `eventWindows()` in `systems/calendar.js`. Day 0 is Monday.

### Anchor events: five in a campaign, not five per cycle

`data/events/` holds one authored event per event slot on the three phase maps
- concept meeting, Music Bank, fan meeting, company cruise, island day. Each
takes a weekday and the whole of it, and each **fires exactly once in the
campaign**: `flags.firedEvents` holds `phase:slot` keys, `generateWeek` filters
on it, and the site leaves the map at the same moment. A phase that has spent
both of its events goes back to ordinary working days.

An event is **not** a branching node. It is the ordinary scene engine given the
three things a date already gets - a frame, the literary register, and sixteen
turns instead of eight - so nothing about it is a second code path. What makes
it different from a date is who is in the room: **the whole cast is present and
one of them speaks.** Section 9's two-member cap is about who may SPEAK, and
`presentIds` already drives witnessed jealousy and `riskExposure`, so choosing
one member in front of the other four at an event is the loudest single act
available to the player and it needed no new mechanic.

**The way in is walking to the site**, listed on the map like any other room -
no banner, no separate screen. Same argument as the daily task: privileging a
thing visually turns a choice back into an errand. The day screen says what
today is and that it takes all of it, and stops there.

Two joins that were missing and are worth remembering, because they are the
`markRisk` shape again - both halves correct, nothing calling them:

- `eventDays()` had been placing event days since M1 and `overworldFor` had
  been hiding event sites since the phase maps landed, and **nothing passed the
  live slot between them.** So on an event day the entire cast stood at a
  location the player could not reach, and the day read as everybody having
  vanished.
- A crowded map row offered only per-member chips, with no way to open the
  room itself - so section 10b's "every action in every room" was silently
  false whenever two members were standing in it, and the task, the snoop and
  the work were all locked out by company. Worst on an event day, where all
  five are present and the row offered nothing but five faces.

Occupancy for any `(day, block, location)` is derived: company slot first, then member solo slots, then a default idle location per member. This is what makes the map a *search* rather than a menu - Wendy is at the radio station on Wednesday afternoon whether you go looking or not.

Solo slots are generated from each card's `activityProfile.types`, resolved through the shared table in `data/activities.js`, which maps an activity type to its location, its `exposureBase`, and the phases it can appear in. Cards therefore stay portable: a card from any group drops into any cast without touching the calendar code.

### The map is a template of roles, filled differently each phase

The map is **a fixed set of role slots**, not a list of rooms. The shape is
constant for the whole campaign - the player learns the grammar once - while the
contents turn over with the phase. A **role is carried by the slot**, and one
slot can carry several.

| Slot | # | Roles | PREP | COMEBACK | REST |
|---|---|---|---|---|---|
| `workroom_a` | 1 | chat, task, knowledge | practice room | filming location | photo studio |
| `workroom_b` | 1 | chat, task, knowledge | wardrobe | make-up room | recording studio |
| `social` | 1 | chat, **rumor** | drink room | green room | hair salon |
| `venue` | 1 | chat, **public date**, part-time | bistro | cafe | Han River park |
| `event_a` / `event_b` | 1-2 | authored, whole day, fires once | meeting room | Music Bank, fan meeting hall | cruise, island |
| dorm shared | 2 | chat, knowledge | living room, kitchen | same | same |
| her room | x5 | **private date**, gated | routine evenings | (away) | routine evenings |
| your room | 1 | rest | same | same | same |

Eight or nine reachable at a time. An earlier draft capped this as "eight to ten
locations per phase", which is a number somebody has to remember; slots make the
same constraint structural. REST keeps its workrooms because the solo layer
resumes fully that week - they become individual-career sites rather than
vanishing.

**Every phase must carry every role, and this is asserted.** Section 21: a rule
that is not asserted is one that gets quietly broken, and "COMEBACK has no rumor
room" is exactly the hole that survives a content edit.

`data/phaseMaps.js` holds `SLOTS` and `PHASE_MAP`. Nothing else may hardcode a
location id where a role is meant.

### Where everyone is: the day has two textures

Weekday assembly order, at week start:

1. place the special event day
2. place the daily task
3. place group activity - **the density is phase-scoped**, because the phase
   table above is a claim about co-presence and a flat density cannot deliver
   it: PREP 3-4 slots a week, COMEBACK 4-5, REST 0
4. fill what is left with solo activity, then the social room

Morning and afternoon are work-adjacent. **Evenings are not:** the cast leaves
the workrooms, and turns up at the dorm, at the venue, or in her own room. So
after hours a workroom is *reliably* empty, which is the point - the player can
still work overtime there, and a dependable fallback is what makes the
unreliable options feel like a search rather than a lottery.

The two halves of the day therefore have different textures - work-adjacent
contact before dinner, relaxed and private contact after it.

Weekend assembly runs **at the start of each weekend day**, not at week start,
because occupancy depends on whether a date happened and that is player input.
Still deterministic: the inputs are `(seed, week, day, dateChoice)`.

### Her room is a routine, not a die roll

Each member is in her own room **one or two fixed evenings a week**, set by the
seed and stable for the cycle. Evenings only, and never during COMEBACK - she is
not home that week.

Fixed rather than random because this section has promised it since M1 and never
delivered: *routines are learnable*. A random presence is a lucky knock; a
routine is something **snooping can reveal**, which finally gives the knowledge
economy something to buy besides objects and openers - **access**. A fact that
tells you where she will be is more interesting than one that tells you what to
purchase.

### Dating: the two axes already say what the gate is

A date is asked for at the start of a weekend day, is refusable, and consumes
the whole day.

- **A public date gates on `admissibility`.**
- **A private date gates on `intimacy`.**

This falls out of the existing model rather than being bolted on. A private date
asks *how close are we*; a public one asks *how nameable is this*. So the two are
not substitutes: a player deep in `confidante` gets the private date easily and
cannot get the public one at all, which is the plateau stating its terms as
plainly as the game can.

**A refusal is not a failure.** It is the first time a hidden number becomes a
visible yes or no, which is pillar 1 working. An early ask costs the block and
nothing else.

Two things keep a public date distinct from simply meeting her at the cafe on a
Tuesday evening, which would otherwise offer most of the same exposure for a
fraction of the cost:

1. **It is witnessed-tier for all four absent members** - no probability roll,
   the way section 5b treats a group scene. Everyone finds out. That makes it
   categorically the loudest act in the game.
2. **The player pays the bill in credits.** See section 11: this is the second
   sink the economy has been waiting for, and it *competes* - a gift for her
   today, or affording to take her out on Saturday.

The emergent property worth protecting: **a date is depth and a free weekend is
breadth.** One consumes a day for one member; the other is six blocks across up
to three. That is the multi-route tension of section 5b expressed as a decision
the player makes every week.

### Locations: exposure and presence are independent

`data/locations.js` gives every location two separate numbers:

- **`exposureBase`** - visibility to the *outside* world. Drives scandal risk and admissibility gain.
- **`presence`** - how many other cast members can witness what happens there. Drives jealousy.

Most locations move these together. The **dorm is the one place that splits them**, and that split is the player's main strategic instrument:

| Location | outside exposure | witnesses |
|---|---|---|
| `broadcast_studio` | 85 | whole cast in COMEBACK |
| `drama_set` | 65 | only the member shooting |
| `cafe` | 60 | 1-2 |
| `corridor` | 45 | random - you run into people here, you do not seek them |
| `practice_room` | 25 | whole cast in PREP / COMEBACK |
| `wardrobe` | 20 | 1-2 - the assistant's own turf |
| `dorm_living` | **15** | **all four others** |
| `dorm_kitchen` | 12 | 1-2 |
| `dorm_room` | **5** | 1 - **needs `intimacy >= 50`** |
| `dorm_player_room` | 5 | 0 - yours, and the only place that gives anything back |

So the dorm is safe from scandal and dangerous for jealousy, and every other location trades the two together. Going out raises admissibility and risks a leak; going home builds intimacy and gets you watched.

**The dorm is a second step in the map**, not a row: living room, kitchen, your
own room, and five closed doors. Her door opens at `intimacy >= 50` - the same
threshold as the `touch` stance, so "you may go into her room" and "you may
reach for her hand" unlock together, which is the correct reading. A locked door
shows her name and the number: that is a goal, not a spoiler. A dark door means
she is not home tonight.

**The dorm is a second step in the map**, not a row: living room, kitchen, your
own room, and five closed doors. Her door opens at `intimacy >= 50` - the same
threshold as the `touch` stance, so "you may go into her room" and "you may
reach for her hand" unlock together, which is the correct reading. A locked door
shows her name and the number: that is a goal, not a spoiler. A dark door means
she is not home tonight.

### Private scene, public approach

`dorm_room` carries `approachWitnessed: true`. Entering it generates a witnessed jealousy event for every cast member currently in `dorm_living`, even though nothing about the scene itself leaks outward.

The others saw you go in. That is a complete otome beat produced by two numbers and one flag, with no authored content behind it.

It also feeds the dossier: routines are learnable. `known_facts` may hold `"she practises alone on Wednesday nights"`, and knowing it is how a player engineers a low-`exposure` meeting - which is the safe-but-stagnant side of the section 5b tension.

### Daily tasks

One mandatory work objective per day, flexible execution window across the three blocks.

**Tasks do not auto-complete on room entry.** A task creates a *conflict*: one block left, the outfit is not ready, and she wants to talk. Choose. That tension is the point of the task system.

The objective is discharged **at its own location**, listed alongside the solo
actions for that room (section 10b). Never from a menu - a button that works
from anywhere ignores where the player is standing, which is the only thing
that made the task cost something.

**A task names a slot, not a room.** `prep_outfits` belongs to *workroom B*,
which resolves to the wardrobe in PREP, the make-up room in COMEBACK and the
recording studio in REST. Binding to a location id does not survive phase maps:
three of the five shipped tasks pointed at `corridor` or `broadcast_studio`,
neither of which exists as an ordinary room once the map rotates. Name the role,
resolve the instance - the same argument that keeps cards portable across casts.

Two rules for how it is offered, both about keeping it a choice:

1. **It is one option in the room's action list, never a banner or a screen of
   its own.** Privileging it visually turns the choice back into an errand.
2. **The list must show the clock** - *today's job, last block*. The conflict
   this section describes only bites if the player can see the window closing. A
   conflict discovered by having already failed is a gotcha, not a decision.

The sharpest case is the one the schedule produces on its own: the task's room
has her in it. Spending the block on the outfits while she is standing there is
the task system working exactly as designed.

- Success: `competence +`, positive ledger entry.
- Failure: `competence -`, `energy -`, and if the failure touched her, `strain += 8`.

### Energy is the pacing mechanism

| | |
|---|---|
| a block | `-6` |
| "Read her" | `-1` each |
| a night | `+24` |
| sleeping in your own room | `+30`, and it costs the block |

**Read her is the energy sink, not the block.** Three blocks cost 18, plus one
per scene at the door, against 24 overnight - so a maximally busy day that never
looks inside her head is energy-*positive* by 3 to 5, and a measured campaign
never took energy below 77 of 100. What actually runs the player down is
choosing to read her: two uses a scene across three scenes is another 6, which
tips the day negative and eventually forces a rest block that the player wanted
to spend on her.

That is a defensible mechanic - it makes the rationed action the thing you
budget for - but it is not what this section used to claim, and the claim was
wrong: blocks are not the pressure. If playtesting shows players simply ignore
Read her, the fix is `ENERGY_RESTORED_OVERNIGHT` 24 -> 18. Not both.

### Player stats

| Stat | Effect |
|---|---|
| `competence` | gates event nodes and identity promotion |
| `energy` | consumed by blocks and by "Read her"; low energy narrows chip options |
| `secrecy` | low secrecy amplifies scene `exposure`; feeds `exposure_end` |
| `credits` | earned from completed tasks, spent on gifts |

---

## 10b. Solo Work: the empty room

Most blocks are spent in a room with nobody in it. That has to be worth doing,
or two thirds of the map is dead space and the day is a menu of one option.

**Every action is offered in every room, occupied or not.** Being locked out of
snooping because somebody walked in is agency lost for no design gain; a room
offers what it offers, and the player chooses. What changes with company is the
price, and two things set it - one of which was already here:

1. **You never learn about someone in the room** - facts *and* rumors, the rule
   below. So the more members present, the smaller the pool. An occupied room is
   a weaker snoop automatically, with no new code.
2. **The secrecy cost scales with `presence`.** Being nosy in front of witnesses
   costs more than being nosy alone. `presence` is already on every location, so
   this is a multiplier rather than new data.

Empty stays cheap; occupied stays possible. Without rule 2 the occupied room
would be strictly better than the empty one - chat *and* a snoop for the same
block - which only inverts the dead-space problem this section exists to solve.

Authored, deterministic, **no LLM call** - the same argument as the calendar.
Spending a model call on "you restocked the wardrobe" is waste, and these need
to be instant because they are the filler between scenes. `data/soloActions.js`
holds the table; `systems/soloWork.js` resolves one.

### The point is not the credits

The credit earners are the boring half. The important actions are the **snoops**:
an empty room is how you learn something about a member who is not in it, which
is the second path into `known_facts` and therefore into the knowledge-gated
gifts. That is what makes an empty wardrobe worth entering.

**Almost every room can teach you something**, and what changes is the price.
Only three could at first, which quietly funnelled the whole knowledge economy
through the wardrobe and left the rest of the map as credit dispensers you
visited when the wardrobe was busy. Anywhere the player is alone, a block and
some energy can buy a fact.

### A room teaches what its SLOT says it teaches

Two kinds of find (below), and which one a room gives is **not** a die roll -
it is the role its slot carries on the phase map. `social` carries `rumor`;
`workroom_a`, `workroom_b` and `venue` carry `knowledge`.

`data/phaseMaps.js` has said exactly this since phase maps shipped and nothing
read it. Every snoop drew from one pool weighted 3:1, so the rumor room taught
facts, the wardrobe taught rumors, and the role table was decoration.

It reads better as well as cleaner. **A rumor is something people say about you,
so you hear it where people talk; a fact is about HER, so you find it where her
work is.** The player learns the grammar once and it holds in every phase.

| Slot | Room by phase | Work | Snoop | teaches | secrecy |
|---|---|---|---|---|---|
| `workroom_a` | practice room / broadcast studio / practice room | run the setlist, help the crew | watch the playback, read the run order | fact | -4 / -5 |
| `workroom_b` | wardrobe / make-up room / photo studio | prep the fittings, lay out the kit, hold the reflector | read the fitting notes, the face charts, the contact sheet | fact | -5 / -5 / -4 |
| `social` | drink room / green room / hair salon | the drinks run, stock the green room, sweep up | linger by the urn, stay by the monitors, wait your turn | **rumor** | -3 / **-6** / -4 |
| `venue` | bistro / cafe / Han River | work the tables, the table coffee, walk it off | clear their table, stay for another cup, sit on the steps | fact | -2 |
| dorm shared | kitchen, living room | cook, clean up, wait up | read the fridge, wait up | fact | -2 / -1 |
| your room | - | sleep / lie awake | - | - | - |

The spread is the point. Loitering by a drinks urn is nearly free; being nosy in
a comeback-week green room, where everybody is between takes with nothing to do
but watch the assistant loiter, is the most expensive thing on the map.

Two rooms are exceptions and only two. **Your own room** has nothing to find out
about anybody else in it. **Her room** is reachable only as a private date and
only when she is home, so there is no version of it the player stands in alone.

**This is asserted against the phase maps**, not against a copy of the room
list - `data/soloCoverage.test.js`. It has to be: the map rotated under this
table once already. Seven rooms arrived on the map with no actions at all and
four entries here pointed at rooms that had left it, so in PREP two of the four
working rooms offered nothing, empty or occupied. Found by playing, on day 2.

### The dorm needs one thing that is unambiguously restorative

The dorm is safe from scandal and dangerous for jealousy, and that was **all
cost**: nothing in it spent time with the whole cast at once, so every dorm
visit was a choice of one member in front of four, priced accordingly. The
place the cast actually lives was the place it was most expensive to be.

Two shared activities fix it, one per shared room:

| Room | Alone | Together |
|---|---|---|
| `dorm_kitchen` | cook for later - produces a dish | **cook together** |
| `dorm_living` | wait up | **watch something together** |

Three rules, all asserted:

1. **No 1v1 is offered in either room.** The rule, not a limitation. The dorm
   is where an unchosen 1v1 costs the most, and removing the option is what
   turns it from a trap into somewhere the pressure comes off. This is the one
   documented exception to 10b's "every action in every room" - the work and
   the snoop are still there.
2. **No jealousy at all.** Nobody is singled out, so `rumor.js` skips the
   witnessed branch entirely. Without this the release valve is its own tax:
   five people watching a film would generate four witnessed jealousy events at
   a group scene's exposure floor, for an evening in which nothing happened to
   anyone in particular.
3. **A small intimacy gain for everyone present** (`SHARED_ACTIVITY_INTIMACY`),
   except the focus, who is already paid by the scene itself.

They are **concrete**, which is what makes them read differently from a work
scene: "what is in the fridge" and "this film is terrible" are topics five
people can actually have, and neither is available anywhere else on the map -
every other location produces conversation about the job. Section 8's argument
for `ACTIVITY_DOING` is that a scene needs a reason to exist, and a shared meal
and a bad film are two the workplace cannot supply.

Mechanically it is a group scene (section 10c) with a frame (section 10's date
register) and one flag. No new machinery.

**The dish is a gift that is not a purchase.** Cooking alone produces an object
the player can hand over later: generic tier, because anybody can cook, so it
stays weaker than an opener bought on a fact - but it costs a *block* instead
of credits, which makes it slightly stronger than what is in the shop. It is
the one use for a dorm evening that is neither a snoop nor a scene. Openers
paid in something other than credits declare it as `gift.stock`, and one whose
counter is empty is not shown at all, the same rule locked knowledge gifts
follow.

Snooping trades **`secrecy`** for a fact. Low secrecy amplifies scene exposure
and feeds `exposure_end`, so the cost is real and it lands later - which is the
right shape for a cost that buys knowledge.

**Secrecy recovers one point a night**, toward the identity's starting value and
never past it. Without that it is a one-way ratchet: a measured campaign hit 0
in week 3 of 9 and stayed pinned, which switched the cost off entirely for the
remaining two thirds of the run and left every scene carrying a flat +21
exposure. A reputation for being nosy fades if you stop being nosy; discretion
is not something you accumulate by sleeping.

### Two kinds of find

A snoop turns up one of two things, and which one depends mostly on what is left:

| | what it is | what it buys |
|---|---|---|
| **a fact** | one of her `learnableFacts` | an opener, and the dossier entry that unlocks it |
| **a rumor** | something *another* member has already heard about the player | nothing to spend - it is the only way to see jealousy coming |

**Which one you get is decided by where you are**, not by a weighting (see the
slot table above). The two used to compete in one pool at 3:1, which meant the
rumor room taught facts and the wardrobe taught rumors.

The curve still draws itself, and now it draws itself geographically. At the
start of a run there are 25 facts and **no rumors at all**, because nothing has
happened yet for anyone to have heard about - so the social room is worth
nothing in week 1 and the workrooms are worth everything. As the player starts
being seen the social room fills up and the fact pool empties. The early game
teaches you about them and the late game teaches you about what they know, which
is the right order, and now the map tells the player which is which.

`FACT_WEIGHT` and `RUMOR_WEIGHT` still exist and still order the pool for a
caller that asks for both, which today is only the balance harness.

The rumor find is also the only window onto section 5b's `heard_about` channel.
That data has always existed and the player has never been able to look at it,
so jealousy was invisible until it had already turned into strain. Finding one
writes nothing to her dossier: it changes what the **player** knows, not what
she knows.

Before this, the 25-fact pool emptied around week 6 and 12-21 of a campaign's
~40 snoop blocks returned nothing - half the map quietly reverted to being a
credit dispenser. Measured after: zero.

Three rules that are not optional:

1. **No charge for a search that found nothing.** Once there is no fact and no
   undiscovered rumor left, snooping stops taking secrecy. The player should not
   be taxed for having already done the work.
2. **Never about someone in the room.** You do not learn a secret about a woman
   who is standing next to you - and you do not find out what she has heard,
   either. The rule covers both kinds of find.
3. **A member drops out once you know all of her facts**, which quietly pushes
   the player toward whoever they have been neglecting.

Every solo action writes a line to the ledger in English, composed in code
rather than by the model - it is bookkeeping, and the summarizer call it would
otherwise cost is better spent on a scene.

`learnableFacts` on the card (section 12) is the pool. Every knowledge gift in
`data/gifts.js` must have at least one owner among the cast, or it is
unreachable; there is a test that asserts this.

---

## 10c. Group Scenes: the client owns the turn order

**Built. The rota in the first draft was wrong and never shipped; proposal 12
replaced it with an addressee.**

Any room with members in it offers three things: talk to one of them, join the
group, or work the room (knowledge / rumor / part-time). The group option is the
one that needed new machinery.

The rota did not survive one question from Yuhan: A speaks, the player
responds, and then it is B's turn - **who was the player talking to?** A turn
order has no answer, because a conversation is not a queue. It also generated
four calls a round the scene never asked for.

### The primitive is an addressee

> The player always has a current **addressee**. Whoever the player addresses
> speaks next. It defaults to whoever last spoke, and one tap changes it.

That answers who is being talked to, who answers, and whether the player
chooses - and because the addressee is **sticky**, the common case costs no
extra taps. A gift is one way of addressing someone and a chip is another: one
verb, two surfaces.

In a group scene the player's turn carries it into block 5 as `(to Nana)`,
because that is what the player actually did rather than a hint for the model.
A one-member turn writes nothing extra, so ordinary scenes are byte-for-byte
unchanged and section 8's prefix argument needs no re-measuring.

### The interjection is the whole feature

The addressee alone collapses a group scene into a 1v1 with spectators. So the
un-addressed need a way in, and it must not be a rota:

```
1. the addressee speaks
2. the client MAY add ONE second voice from another member:
   a CHIME if her chime stake clears CHIME_THRESHOLD, or
   a CUT_IN if she is in a sharp/corrosive band AND clears INTERJECT_THRESHOLD
3. the player acts: chip / free text / opener / turn to someone / pass
```

#### Two bars, because a room has two reasons to speak

**The first build had one bar and it was priced for jealousy.** That made
ordinary conversation structurally impossible, and the arithmetic says so
plainly: a week-1 bystander at intimacy 10 who had said nothing for four turns
scored **0.66 against a bar of 1.0**, and the jealousy term was the only thing
in the formula large enough to clear it on its own. So a group scene could be
**silent** or it could be **jealous**, and there was no third setting anywhere
in the number. Both halves of that were reported after one day of play.

| | priced on | asks |
|---|---|---|
| **chime** | silence, being named, a little intimacy. **No jealousy term at all.** | does somebody have something to add? |
| **cut_in** | the jealousy band, gated on `sharp` or `corrosive` | is somebody unsettled enough to interrupt about the player? |

A cut-in wins where both fire: a beat cannot be both warm and pointed, and the
rarer one is the more interesting event. `piqued` is deliberately excluded from
cutting in even though it scores - section 5b calls piqued an *opportunity*, and
letting her interrupt about it spends the moment before the player can read it.

**Silence dominates the chime**, and that is what makes the room circulate with
no rota deciding it: whoever speaks has her counter reset, so the next chime
goes to somebody else. Two quiet turns clears the bar exactly, which scales with
room size for free - a five-member room nearly always has somebody at two, a
two-member one alternates, and neither needed a rule.

Neither directive says **why** she is speaking. Handing the model "you are
jealous" makes it narrate the jealousy - the same mistake section 8 forbids for
relationship stats. What the chime directive *does* say is that this is **easy
company**: block 3 carries everyone's dossier and block 4 her standing, so a
model handed a bare "another member speaks" at a scene with any jealousy in it
will reliably write the jealousy.

Measured live (three in a practice room, six turns, nobody jealous): all three
voices present, **six chimes, zero cut-ins, zero resentful lines**, and one
speaker per call throughout. Under the single bar the same scene produced no
second voice at all.

`pass` stops being a skip button: it is the player letting the room breathe, and
somebody fills the silence whether or not she clears either bar. Ranked by
**chime** stake, not the jealousy-weighted one - the player stepping back is the
most ordinary moment in a group scene, and handing the floor to whoever is
angriest turns "let the room carry it" into "let the room have a go at you".
The turn sent is still the player's own move, never a line put in their mouth.

### What it costs

One or two calls a player turn, not five. The interjection fires **after**
`pending` clears, so her beat streams while the player is already reading the
addressee's - it hides behind reading time the way the chip call does.

Her beat moves **her** meters and not the addressee's. `guard` and `fluster` are
per-member readings, and letting an interjection drop somebody else's guard
would hand the player a number they never earned.

### Measured once, at three members

`CHIME_THRESHOLD = 0.9` and `INTERJECT_THRESHOLD = 1.0` have had **one** live
pass, at three members in a practice room, and it is recorded above. That
settled the direction and not the magnitude: a chime fired on **every one of six
turns**, which read well in the transcript but is the top of the range rather
than the middle of it. Nothing yet says whether it stays enjoyable across a
full eight-turn scene, or at five members, where the same bar produces the same
rate. If it turns into wallpaper the fix is in PROPOSALS 16, not a bare number
change.

The failure mode remains prose quality and not a distribution, so this is a
live question permanently: too low and nobody finishes a sentence, too high and
the room is furniture.

Block 3 carries every present member's dossier in a group scene - about 300
tokens rather than 60. That sits inside the per-scene rebuild and costs nothing
in cache terms.

### The stage shows who spoke, not who is being spoken to

Section 14's treatment, with one correction that the second voice forced.

The speaker sits at full opacity and scale, the others dim to 0.55 and 0.95 -
and **the speaker is whoever the beat says it is**, which in a group scene is
often not the addressee. Drawing the addressee for the portrait, the name and
the stage light put somebody else's line under her face with her name on it. It
survived while a second voice was rare and would have mislabelled most of a
group scene the moment chimes started arriving most turns.

So two states are on screen at once, and they are different things:

- **who is speaking** - the big portrait, the name over the dialogue, the light.
- **who the player is turned to** - marked in the row, because a chip, an opener
  and free text all silently target her. The meters are hers too, and carry her
  name in a group scene for exactly that reason: per-member readings are
  deliberate (`turnTo` carries them; an interjection does not move the
  addressee's), so labelling them is the honest fix rather than making them
  follow the face.

The dimmed portraits are **buttons** - tapping one is how the player turns to
her - and so is the big one, whenever the speaker is not already the addressee.
Without that she would be the one member in the room who could not be answered,
which is backwards: replying to whoever just spoke to you is what a second voice
is for.

The row is therefore not decoration. It is the only place in the game where the
player's attention is a visible, continuously priced state. Everybody in the
room can see where it points, and moving it is witnessed.

---

## 11. Gift & Knowledge Economy

The loop that ties memory to mechanics:

```
dialogue --reveals--> dossier fact --unlocks--> a specific gift --> LLM sees the fact
    ^                                                                    |
    +---------------------- unique reaction -----------------------------+
```

- Generic gift (rose, iced coffee): `+1` effect, generic reaction.
- **Knowledge-gated gift**: purchasable only once the matching `known_facts` entry exists. `+5` effect and a unique reaction, because the fact is in-prompt.

### Two ways in, and the dialogue one has to be wired for

A fact reaches the dossier from **snooping** (section 10b) or from **the scene
itself**. Only the first worked for a long time, and the reason is worth
remembering: openers match `requires` against dossier text by substring, and the
summarizer wrote whatever phrasing it liked. A live scene where Irene talked
about practising alone produced *"values trust earned in private, not public"* -
a good memory that matches no opener that exists. Every opener in the game was
therefore reachable by snooping and by nothing else, and **talking to her taught
the player nothing they could spend.**

The scene-exit call now carries the card's own wording for the facts the player
does not already have, scoped to members in the room like everything else in
block 3. It is a **checklist, not an instruction to fish**: use this wording if
the thing genuinely came up, and otherwise add nothing. A fact awarded for
nothing is worse than a fact never awarded, because it hands over an opener
nobody earned.

**Locked gifts are not shown.** Naming a gift the player cannot buy spoils the
fact it is waiting on and clutters the list with things they cannot act on. When
nothing is unlocked the modal says only that such gifts open when she tells you
the right thing.

**The reaction is generated, never authored.** There is no thank-you table. The
opening beat of a gift scene is a normal model call (section 9), which is what
lets the same iced coffee read as polite at `colleague` and as something else
entirely at `unspoken`. A fixed line cannot vary with affection, and a fixed
line is instantly legible to the player as a fixed line.

Three things have to reach the model for that reaction to land, and each one was
missing at some point:

**1. The tier**, not just the object:

- generic - *"an ordinary, thoughtful gesture - kind, but nothing she could not
  have guessed at."*
- knowledge - *"She has never told anyone she needed one. Only somebody who had
  been paying very close attention would have known to bring it."*

Without it, an iced coffee and a hand warmer are the same sentence to the model.

**2. The fact it was bought on.** `requires` is matched by substring against her
dossier, so the code already knows *exactly which remembered line* unlocked this
gift. That line is quoted into the note verbatim:

> the player has just handed Hyewon a knee brace. She let this slip once: "an
> old knee injury that flares up in the cold". She has never told anyone she
> needed one - only somebody who had been paying very close attention would have
> known to bring it.

The fact is already in block 3, but block 3 is a list of everything known about
her, and the step from `knee_brace` to that one line is an inference. At this
model tier, an inference that can be stated should be stated. This is the whole
distance between *"You were paying attention"* and *"How did you know about my
knee?"*, and the second one is the product.

**3. How close she already is.** See block 4 (section 7): the same gift from a
colleague and from someone at `unspoken` is not the same event, and the model
cannot know that unless the header says so.

### Two ways to spend a fact

**A gift is not the only way to show you were listening**, and most of the time
it is not the natural one. Knowing about her ankle and buying tape is one move;
knowing about her ankle and *asking how it held up* is another, and the second is
what a person would actually do. An economy whose only verb is BUY reads as a
shop rather than as attention.

So every knowledge fact opens **two** ways into the scene, side by side in the
same modal:

| | cost | effect | limit |
|---|---|---|---|
| the object | credits | `+5` | repeatable |
| **the gesture** | free | `+3` | **once per fact, per run** |

Not every fact has an object behind it, and forcing one is what made the whole
thing read as a shop. An opener marked `object: false` opens the scene by being
**said** and nothing else - you cannot buy somebody the habit of naming
everyone. The modal is titled for what it actually is, *how you walk in*, rather
than for the half of it that costs money.

Both are gated by the same fact and both quote it into the scene note, because
the payoff is identical: she hears that you remembered.

The two limits are what keep it honest:

- **Free has to be weaker**, or credits stop meaning anything and the shop
  becomes decoration.
- **Once per fact.** Asking after her ankle the first time is attention; asking
  every scene is a script. Spent gestures leave the list rather than greying out
  - there is nothing left to reconsider.

The gesture note carries one instruction the gift note does not need: *there is
no object; do not invent one.* The beat is written from that note alone, and a
model handed "she remembered something you said" will happily produce a present
that is not in anyone's hands.

### An opener is a turn, not a door

**It used to be a screen between the map and the scene, and that was wrong three
times over.** Reported on the first day of play:

1. It fired at the door of **every** scene, so the player was asked what they
   were giving her before they had been given any reason to want to give her
   anything.
2. In a **group scene** it asked *who* before showing who was in the room. The
   player bet blind at the door - the exact problem PROPOSALS 11 raised.
3. Whatever it produced became **the first thing that happened**, so a scene
   could never be about anything before it was about the gift. Every knowledge
   opener landed on a cold open, which is the weakest possible moment for it.

So it is a move the player makes *during* the scene, which is also when a person
would actually make it: you talk to her, and at some point you bring up the
thing she once let slip. **The topic turns**, which is what a real gesture does,
instead of the scene starting there.

Mechanically:

- `runTurn` takes a `note`. It is appended as a system note at the tail -
  section 8's invariant 3, never edited into the frozen header - and she answers
  it as the next beat. No directive follows it: the note is self-describing, and
  writing the next beat is her job every turn anyway.
- **It costs a turn**, one of the eight. That is what makes it a decision.
- A note with no words after it is a complete turn. The player handed it over
  and said nothing, which is a real way to do it.
- It sets `singledOut` (section 5b), because a gift is nameable by anybody
  watching.
- **Handing something to somebody also turns to her.** A gift is a way of
  addressing someone (section 10c) - choosing her in the sheet and then still
  talking to the last person would be two answers to the same question.
- In a group scene the sheet asks **who**, defaulting to the current addressee,
  so most of the time there is nothing to choose and changing it is one tap.

There is consequently **one** opening beat shape. `openingDirective` no longer
takes an argument, and the offline writer had to learn to recognise an opener
mid-scene - it keyed on the opening directive, so without that change every
gift given without an API key produced a shrug, and section 3 makes offline a
supported mode rather than a degraded one.

The note itself is unchanged:
`System note: the player has just handed Irene a hand warmer. She let this slip once: "..."`

---

## 12. Character Card Schema

JSON, importable and exportable. Prebuilt cards ship in `src/data/characters/`; custom cards live in localStorage. One loader serves both.

```json
{
  "id": "irene",
  "schema": 1,
  "name": "Irene",
  "nameRoman": "Bae Ju-hyun",
  "emoji": "🐰",
  "origin": "Red Velvet",
  "mascot": "rabbit",
  "mascotNote": "cool on the surface, fiercely protective underneath",
  "palette": { "base": "#f0c8d8", "accent": "#c2185b" },
  "mbti": "ISFJ",
  "birthday": "1991-03-29",
  "birthplace": "Daegu",
  "ig": "renebaebae",
  "preferredRoles": ["leader", "lead_rapper"],
  "activityProfile": {
    "primary": "soloist",
    "types": ["solo_recording", "tour_rehearsal", "photoshoot", "brand_event"]
  },
  "publicImage": "...",
  "personality": "...",
  "speechStyle": "...",
  "queerTexture": "...",
  "hiddenConflict": null,
  "styleHints": { "zh": null, "ko": null },
  "likesSeed": ["quiet mornings"],
  "learnableFacts": ["cold_hands", "no_sleep_before_comeback"],
  "startIntimacy": 5,
  "portraitMode": "mascot",
  "portraits": { "neutral": "portraits/irene.svg" }
}
```

`origin` is **library metadata only and is never injected into a prompt** - in fiction every member is in X (section 1b). `preferredRoles` feeds `castBuilder.js`, which resolves a coherent X lineup from whichever five cards are chosen. `activityProfile.types` are keys into `data/activities.js` and drive her solo schedule. `hiddenConflict` is optional and names the specific way this character fails under neglect; it is injected only once jealousy reaches `piqued` or above.

Localized display names live in `i18n/`, not on the card, so a card stays a single portable file.

**Semantic fields stay English.** `personality`, `speechStyle`, and `queerTexture` are authored once in English and translated by the model at generation time. This keeps cards portable across locales and keeps them a single source of truth. `styleHints` is the escape hatch for locale-specific voicing that a generic translation flattens - Korean honorific level, Chinese sentence-final particles - and is `null` unless a locale actually needs it.

`learnableFacts` is the pool solo-work snooping draws from (section 10b).

### A fact is an id, and it has two texts

One string was doing three incompatible jobs: the line the model reads in block
3 (must be English, section 19 rule 2), the needle a gift `requires` matches
(must be stable and comparable), and the sentence a snoop puts on screen (must
be the player's language). It only looked correct because the third job is
invisible in an English run - a `zh` player learned that Irene "has extremely
cold hands", in English, on an otherwise Chinese screen.

So a card names **ids**, and `data/facts.js` resolves them:

| | where | why there |
|---|---|---|
| **canonical** English | `data/facts.js` | it is memory and it is what needles match. Not `i18n/en.js`, whose whole purpose is being reworded for how it reads on screen - a polish pass there would silently unhook an opener |
| **display** per locale | `i18n/<lang>.js`, `fact.<id>` | section 21 keeps non-ASCII source out of everywhere else |

English therefore has **no `fact.*` keys at all** and falls back to canonical,
while every other locale must translate every fact. Both halves are asserted:
one stops somebody duplicating the English to make the bundles symmetric, the
other stops a new fact shipping untranslated.

An id also fixes something this section already complains about below. Gift
matching now has two paths, because there are two ways a fact arrives:

- **snooped** - drawn from `learnableFacts`, so the id is known when it is
  awarded. Matched against `factIds`, exactly. Cannot be broken by a reword.
- **from dialogue** - written by the summarizer in its own words, so there is
  no id and never can be. Matched by `requires` substring, which is why those
  needles carry paraphrases.

A **custom card** cannot ship `i18n/` files, so its facts may carry their own
text inline instead: `{ "id": "hates_cold", "en": "...", "zh": "..." }`. The
resolver takes either shape and nothing outside it reads `learnableFacts`
directly. A card authored offline with no English simply stays single-locale -
the game must never require a model call to make a card (section 3).

**The dossier entry is an object**, `{ text, factId }`, and `text` stays the
English the prompt sees, so blocks 3 and 5 and the cache behaviour do not
change. `heard_about` carries the rumor's shape the same way, which is what
lets the snoop screen render the sentence instead of echoing the English one.
A bare string is still accepted everywhere and normalised on the way in,
because that is all the summarizer can produce.

**Five per card, twenty-five in all, and the opener is written to the habit
rather than the habit to the opener.** An earlier catalogue did the reverse -
eight neutral objects, one matching fact per member - and the result was a fixed
lookup: jisoo always meant the annotated script, hyewon always meant the knee
brace. The snoop was already picking a random member and a random fact; with two
facts each and one opener apiece there was nothing for the randomness to do.

Four rules, all asserted:

- **One opener per fact, never none and never two.** A fact matching two needles
  hands over a second opener free; a fact matching none is a snoop that teaches
  something worthless.
- **No two members share an opener.** Not strictly required, but an opener that
  answers two people says nothing about either.
- **No fact repeats across the cast.** Two members with cold hands is two members
  with the same character.
- **Every member reaches several openers**, so what you can do depends on which
  fact you happened to turn up first.

### Facts come from the real member, and stop at the persona

Facts are drawn from the member's publicly known habits, because an opener that
answers a real habit reads as attention paid and an invented one reads as a
fetch quest. Irene's laundry and her cold hands, Jisoo balancing things on her
head, Hyewon handing out takoyaki in other groups' waiting rooms, Yeri's
fearlessness in a haunted house.

They stay at **persona level: preferences, routines and running jokes.** Never a
claim about a real person's health, body, relationships or private life, even a
positively-worded or self-disclosed one (section 22). Two facts have been cut
under this rule after being written - an invented knee injury, and a real and
publicly discussed course of tattoo removal. Both would have played fine; both
are somebody's body rather than somebody's habit, and the line is easier to hold
at "not at all" than at "tastefully".

`requires` carries **paraphrases**, not just the card's wording. The summarizer
writes dossier entries in its own words, so a single tight needle means the
opener silently never unlocks for a player whose model phrased it differently.
This has regressed twice during content rewrites; the tests that catch it are
the ones that feed in a rephrased fact rather than the card's own string.

`portraitMode` is one of `mascot` | `single` | `multi` (see section 14). MVP writes only `mascot`; the field exists now so v2 is content, not a refactor.

MVP ships 5 cards, all present in the playthrough. The picker UI (choose from library / create custom) is stubbed but hardcoded to the 5.

---

## 13. Identity Schema

```json
{
  "id": "assistant",
  "displayName": { "en": "Artist Assistant" },
  "locations": ["wardrobe", "backstage", "van", "cafeteria", "practice_room"],
  "taskPool": ["prep_outfits", "run_schedule", "handle_press_kit"],
  "startStats": { "competence": 20, "energy": 80, "secrecy": 70, "credits": 0 },
  "exposureModifier": { "backstage": -10, "cafeteria": 10 }
}
```

MVP ships `assistant` only. The selection UI exists and is disabled for the rest.

---

## 14. Art Direction

**Animal-mascot abstraction, cute / cartoon.** No real-person likenesses. This solves expression cost and portrait rights at the same time, and it makes custom cards actually drawable by players.

**One portrait asset per character. Emotion is CSS.**

| Emotion | Treatment |
|---|---|
| `neutral` | base |
| `happy` | brightness 1.06 + subtle bounce keyframe |
| `blush` | warm overlay + cheek gradient + scale 1.02 |
| `shy` | +8px y-offset, edge blur, opacity 0.9 |
| `upset` | cool desaturate, -2deg tilt, hard shadow |
| `surprised` | scale 1.05, quick shake keyframe |

SVG preferred: small, and recolorable from the card `palette`. Scales to a 50+ card library with zero new art per emotion.

Multi-character focus: the speaker sits at full opacity and scale, others dim to 0.55 and scale 0.95.

### Portrait modes

| Mode | Source | How emotion is shown | Status |
|---|---|---|---|
| `mascot` | 1 shipped SVG | the 6 CSS treatments above, applied to the face | **MVP** |
| `single` | 1 player-uploaded image | **frame, not face**: rim-glow colour, tint wash, shake / bounce keyframe, corner emotion badge | v2 |
| `multi` | up to 6 player-uploaded images | direct swap, one per emotion | v2 |

`single` is the important one: it works with any image the player has, including a photo, without needing six of them. The renderer treats the portrait as an opaque rectangle and expresses everything in the surrounding chrome.

Storage for uploads: **IndexedDB, not localStorage** - localStorage caps near 5MB and base64 inflates by 33%. Downscale to 512px on the long edge at upload time.

Uploaded images stay on the device. They are never uploaded anywhere and never sent to the model - the model only ever sees text. The shipped card library remains mascot-only; what a player puts in their own local save is their own choice.

---

## 15. State Schema

```js
{
  meta:      { schemaVersion: 1, savedAt, lang, model },
  settings:  { theme: 'night', fontScale: 1, reduceMotion: false },
  run:       { identityId, day, week, phase, block, seed },
             // focusId is DERIVED (highest intimacy), never stored
  player:    { name, competence, energy, secrecy, credits },
  cast:      [ characterId ],
  relations: {
    irene: { intimacy, admissibility, strain, jealousy,
             peakIntimacy, peakAdmissibility, criticalScenes,
             stage, endingLocked: null }
  },
  dossier:   { irene: { known_facts, shared_moments, open_threads,
                        player_told_her, heard_about } },
  ledger:    [ { id, day, block, type: 'full' | 'summary', text, summary } ],
  calendar:  { weekPlan, todayTask, taskState },
  flags:     { firedEvents: [], repairUsed: {} },
  scene:     null   // volatile; never serialized
}
```

`scene` is deliberately excluded from saves: the memory design says a scene is ephemeral, so saving mid-scene means saving at the room door.

Save key: `yuriagent_saves_v1`. On load, unknown or missing fields fill from defaults rather than throwing.

**One slot, and the game saves itself at day rollover.** Not a button: there is
nothing for the player to decide, and a save screen would be the only piece of
bookkeeping in a game that has none. The day boundary is also the only moment
the schema permits - a scene is ephemeral, so a save taken mid-scene is a save
taken at the room door.

`toSave` is an explicit projection rather than a spread of app state, so that
adding a piece of UI state cannot silently start persisting it, and so reading
one function tells you what a save contains. `fromSave` merges per member
rather than replacing wholesale: a cast that gained a member since the save was
written must not come back with `undefined` where her relationship should be.

A failed write returns `false` and never throws. A player in a private window
should lose the save, not the run.

The **API key is not in here**. It lives in `yuriagent_key_v1` via `store/apiKey.js`,
in its own module with its own storage key, so it can never be accidentally
serialised into a save file that gets exported or shared (section 22).

---

## 16. Folder Structure

```
src/
  main.jsx
  App.jsx                    # routing, save/load, top-level state
  agent/
    sceneEngine.js           # turn loop, beat reveal, streaming orchestration
    promptBuilder.js         # 5-block assembly, cache invariants
    responseParser.js        # tolerant streaming state machine
    memory.js                # ledger append + compaction, dossier CRUD
    summarizer.js            # scene-exit call
    chipWriter.js            # written chip labels; ephemeral frame, never committed
    playthrough.test.js      # a whole campaign through the real engine, offline
    liveQuality.test.js      # what a real model writes; LIVE_QUALITY=1, opt-in
  systems/                   # PURE. no React, no network.
    rng.js                   # seeded mulberry32, injected everywhere
    relationship.js          # intimacy/admissibility/strain, stage, endings
    jealousy.js              # bands, gain/decay, exclusivity curve
    rumor.js                 # exposure -> awareness; presence -> witnessed events
    castBuilder.js           # any 5 cards -> a coherent X lineup
    calendar.js              # deterministic seeded group + member schedules
    clock.js                 # block/day/week/phase advance, energy
    tasks.js
    soloWork.js              # empty rooms: work, snooping, learned facts
    economy.js               # credits, knowledge-gated gifts
    exposure.js              # location x block x secrecy -> risk
    chips.js                 # stance legality + the fallback chip set
    balanceSim.js            # headless playthrough harness (dev only)
    *.test.js                # colocated; vitest
  tools/
    llmTool.js               # multi-model router, streaming, retries
    mockClient.js            # offline writer; the game runs with no API key
    client.js                # picks live vs mock, falls back per call
    liveEnv.js               # test-only: reads .env.local. Never imported by the app.
  data/
    characters/*.json        # cast: irene, nana, jisoo, hyewon, yeri
                             # library: seulgi, wendy, joy
    identities/*.json
    activities.js            # group / solo / idle activity tables
    locations.js             # exposureBase + presence + zone per location
    soloActions.js           # what the assistant does in an empty room
    gifts.js
    cast.js                  # card loader; PROMPT_EXCLUDED_FIELDS
    events/                  # anchor nodes
  ui/
    vn/                      # VNStage, Portrait, DialogueBox, ChipBar, MeterBar,
                             # ThoughtBubble, SceneHeader, beatQueue
    map/                     # LocationGrid, DormMap, WeekCalendar
    modals/                  # GiftModal, SettingsModal, SaveModal (M5)
    screens/                 # Day, SoloAction, Cover/Ending (M5)
  i18n/                      # zh/en (ko/pt stubs)
  config/
    constants.js
    modelConfigs.js
  store/
    save.js                  # M5
    settings.js
    apiKey.js                # its own key so it can never join a save file
public/
  portraits/*.svg
  manifest.webmanifest
```

---

## 17. Git & Session Workflow

| Branch | Role |
|---|---|
| `main` | stable, always runnable, what players get. Deploy only from here. |
| `dev` | integration branch. All features land here first. |
| `feat/<name>` | branched off `dev`, merged back with `--no-ff` |

### Session model

The engine systems are tightly coupled - jealousy depends on exposure, which drives rumor, which writes into the dossier, which is assembled by the prompt builder. Splitting them across parallel sessions means each session re-derives the same design and the work collides at merge. So:

**One primary session, sequential milestones, compacted at each milestone boundary.** `CLAUDE.md` plus `docs/PROGRESS.md` are the durable context that makes compaction safe - they are updated *before* a milestone closes, never after.

A second session is worthwhile only for work with zero coupling to the engine, on its own branch, on a cheaper model:

| Session | Model | Branch | Owns |
|---|---|---|---|
| primary | Opus | `feat/m*` | `systems/`, `agent/`, `ui/`, integration |
| assets | Sonnet | `feat/assets` | `public/portraits/`, PWA icons, `i18n/` string files |

**File ownership is exclusive.** The assets session never edits `systems/` or `agent/`; the primary session never edits portrait SVGs. That rule is what keeps merges trivial.

Never delegate `relationship.js`, `jealousy.js`, `rumor.js`, `promptBuilder.js`, `responseParser.js`, or `balanceSim.js` to a cheaper model - subtle errors there are expensive and hard to detect from the outside.

Rules:

- Never commit directly to `main`. Merge `dev -> main` only after `npm run build` passes and the affected loop has been played manually.
- Tag `main` merges: `v0.1.0`, `v0.2.0`, ...
- `npm test`, `npm run lint` and `npm run build` must pass before any merge.
- Never commit API keys or key files.

---

## 18. Roadmap

| Phase | Deliverable | Done when |
|---|---|---|
| **M0** | Repo hygiene: git init, `main` / `dev`, Tailwind wired with theme tokens, font-scale root, PWA manifest, i18n skeleton (zh/en) | `npm run build` clean, app boots, theme + font scale switchable |
| **M1** | Pure systems: `relationship`, `jealousy`, `exposure`, `rumor`, `calendar`, `chips`, `economy` + **headless balance simulator** | stage / strain / jealousy transitions verified with no UI and no LLM; simulator reports an ending distribution with the balance ending under 10% |
| **M2** | Prompt pipeline: `promptBuilder`, `llmTool`, `responseParser`, `memory` | a scene runs in a console harness; cache invariants and roster enforcement asserted |
| **M3** | VN layer: portrait + CSS emotions, dialogue box with beat reveal, chip bar, meters, Read her | one full scene playable end to end |
| **M4** | Shell: map, time blocks, calendar, tasks, gift modal, day rollover | one full in-game day playable |
| **M5** | Run layer: full 3x3 campaign, event anchors on weekend blocks, endings screen, save/load, PWA install | full playthrough reaches an ending |

**Status: M0-M5 complete.** A campaign now runs from the cover screen to the
endings screen, saves itself, and installs. Running state, what is done and what is
still open, lives in `docs/PROGRESS.md` - that file is updated *before* a
milestone closes, and it is what makes compacting this session safe.
Design changes that have been argued for but not made live in
`docs/PROPOSALS.md`; read it before touching a coefficient.

M1 before M2 is deliberate: the relationship model is the product, and it must be correct before a single token is spent on it.

---

## 19. Multilingual Design

UI strings are pre-written in `i18n/`. Generated prose is produced by the model. The two are kept strictly apart.

### Directive

Block 1 carries a language directive built from `meta.lang`:

```
Write all prose and dialogue in {Simplified Chinese}.
Metadata lines, speaker ids, emotion names, and all field names remain in ASCII English.
```

### The three hard rules

1. **Machine tokens never localize.** Speaker ids, emotion names, stance ids, JSON keys - ASCII English in every locale. See section 9.
2. **Memory is always English.** Ledger summaries and dossier entries are written in English regardless of `meta.lang`. Consequences: the player can switch language mid-run without corrupting history; block 1 stays byte-stable across the switch; and one card library serves every locale.
3. **Card semantics are English, with a per-locale escape hatch.** See `styleHints` in section 12.

### Locale support

| Locale | Status | Note |
|---|---|---|
| `zh` | MVP | primary |
| `en` | MVP | |
| `ko` | v2 | output quality on Flash-tier models is materially weaker |
| `pt` | v2 | same |

Language switching is allowed at any time from settings and does not reset the run.

---

## 20. Theming, Type Scale, Accessibility

**No literal colour or font-size values in components.** This is a review-blocking rule, not a preference.

### Tokens

All visual constants are CSS custom properties on `:root`, defined in `config/themes.js` and mapped into Tailwind 4 via `@theme`.

```
--bg, --surface, --surface-alt, --text, --text-dim, --border,
--accent, --accent-soft, --danger, --warn,
--meter-guard, --meter-fluster, --meter-exposure,
--font-scale, --radius, --shadow
```

### Themes

| id | Note |
|---|---|
| `day` | light |
| `night` | dark, default |
| `dusk` | warm low-contrast |
| `bloom` | tinted from the focus character's card `palette` |

`bloom` is worth building because the data already exists: every card carries `palette.base` / `palette.accent`, so the whole UI can take on the colour of whoever you are pursuing.

### Type scale

`html { font-size: calc(16px * var(--font-scale)); }` and **every size in the app is expressed in `rem`**. `settings.fontScale` offers 0.875 / 1.0 / 1.125 / 1.25. A larger scale must not break the 390x844 layout - verify the widest strings in `zh` and `pt` at 1.25 before merging any UI work.

### Permitted exceptions

Inline styles are allowed only for values that come from data at runtime: character `palette` application, and meter fill widths. Everything else uses tokens.

### Safe areas

`viewport-fit=cover` plus `apple-mobile-web-app-status-bar-style:
black-translucent` is what makes an installed iOS app fill the screen instead
of sitting in a letterboxed frame. The price is that the web view then draws
**underneath** the status bar and the home indicator, so without insets the day
header sits behind the clock and the chip bar behind the gesture bar - on every
iPhone, in the one mode the game is designed for. Android needs the same on any
device with a display cutout.

`--safe-top` / `--safe-bottom` / `--safe-left` / `--safe-right` are tokens
like everything else in this section, and exactly two rules read them: `body`
pads by them, and the full-height rules subtract them. A component must never
hardcode a notch height.

The two full-height rules are `.stage` (`min-height`) and `.stage-fill`
(`height`, for the scene, whose chip bar is pinned to the bottom). Both are
**unlayered**, so they beat the `min-h-dvh` utility - which would otherwise
make every screen one full viewport tall inside a body already inset, and push
the last row off the bottom by the height of the notch.

### Accessibility

`settings.reduceMotion` disables the emotion keyframes (bounce, shake) and beat-reveal transitions, falling back to instant state changes. Also honour `prefers-reduced-motion` as the initial value.

---

## 21. Coding Conventions

- **English only** in code, comments, identifiers, and filenames. All files UTF-8, no non-ASCII in source.
- Player-facing strings go through `i18n/`. Zero hardcoded display text in components.
- `systems/` stays pure and side-effect free - that is what makes the relationship model testable.
- **No literal colours or font sizes in components.** Use the tokens from section 20. Inline styles only for runtime data (character palette, meter widths).
- Mobile-first, 390x844 reference. Verify layouts at `fontScale` 1.25 with `zh` strings.
- Validate every change with `npm test`, `npm run lint` and `npm run build`. Do
  not commit a red build or a red suite.
- `systems/` and `agent/` changes need a test. A design rule that is not asserted
  somewhere is a rule that will be quietly broken later - every bug found in
  playtesting so far had no test covering it.
- No workaround flags, no commented-out errors. Fix the cause.

---

## 22. Content Guardrails

Carried over from `rv-simulator`, non-negotiable:

- Fan-made, non-profit, MIT. Not affiliated with any agency or artist.
- Characters are **fictional personas** with animal-mascot presentation. The shipped card library contains no real-person likeness art. Player-uploaded portraits (v2) stay on the player's device, are never transmitted, and are never sent to the model.
- No negative real-world claims about real artists; no real romantic or marital assertions.
- **Card content stays at persona level: preferences, routines and running
  jokes.** Never a real person's health, body, relationships or private life -
  not even positively worded, and not even something they have discussed
  publicly themselves. Two `learnableFacts` have been cut under this rule after
  being written (an invented knee injury, a real course of tattoo removal).
  Both would have played fine. The line is easier to hold at "not at all" than
  at "tastefully", and a game about five women deserves the strict version.
- No politics, graphic violence, occult, or sexual content involving minors.
- Adult-adult romance stays tasteful. The game is about tension, not explicitness.
- API keys live in localStorage on the player's device only. Never logged, never committed, never sent anywhere but the chosen model endpoint.
