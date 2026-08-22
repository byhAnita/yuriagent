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
- PWA: manifest + service worker, mobile-first 390x844
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

- Any gesture toward one member is **witnessed** by the other at `exposure = max(sceneExposure, 80)` - direct observation, no probability roll.
- Witnessed gestures give a larger admissibility gain and a larger jealousy hit than rumors. High-risk, high-reward is the mechanical identity of a group scene.
- Block 4 states cross-awareness explicitly when it applies: `Irene is aware of and unsettled by your closeness to Wendy.`
- The 2-member interactive cap and the parser roster rule (section 9) both still apply.

### Balance is a simulation problem

Five interacting tracks cannot be tuned on paper. `systems/balanceSim.js` runs N scripted playthroughs with no UI and no LLM and reports the distribution of reachable endings.

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
| `guard` | down = good | seeded from `100 - intimacy`, moved by the LLM per turn |
| `fluster` | up = you landed | starts at 0, moved by the LLM per turn |
| `exposure` | up = risky | **derived from location + time block + secrecy, not from the LLM**; also drives rumor propagation (section 5b) |

`exposure` being deterministic is what makes map choice matter romantically instead of only logistically: practice room at night is low, cafeteria at noon is high.

### Micro -> macro mapping (computed client-side at scene exit)

```
guard dropped >= 15 over the scene         -> intimacy      += 2..4
fluster peaked >= 60                       -> intimacy      += 1..3
risk action at exposure >= 60, survived    -> admissibility += 3..6
risk action at exposure >= 60, failed      -> strain        += 10..20
stage == 'reckless'                        -> strain        += 5 / scene
daily task failed and it affected her      -> strain        += 8
scene exit, per absent member              -> rumor roll    (section 5b)
gesture witnessed in a group scene         -> larger admissibility gain,
                                              larger jealousy hit, no roll
```

Deltas are computed by `systems/relationship.js` from accumulated per-turn metadata.
**The LLM never reports macro deltas** - only per-turn `guard` / `fluster` movement and emotion. Fewer things for a small model to get wrong.

### A scene occupies one block

`SCENE_TURN_LIMIT = 8`. Past that the block ends on its own. Without a cap a
player could grind a single block indefinitely and the opportunity cost that
makes three-blocks-a-day work would evaporate.

The opening beat does not count against it - nobody spent a turn walking through
a door. When the count reaches zero the chip bar is **replaced** by a notice and
a Leave button. Disabled chips with no explanation read as a frozen screen.

### Player input

Three **chips** per turn plus optional free text. A chip is a **stance**: the
player commits to a posture, and what she actually says back is the model's
answer. The player never writes her side and never picks a scripted line.

The baseline set is the stance names themselves, which is what ships when there
is no key, no budget, or no response:

```
[ Tease ]   [ Reassure ]   [ Change the subject ]        (pen) free text
```

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
(`src/tools/live.test.js`, which is opt-in and skipped without a key):

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

**Swap only while beats are still being revealed.** Once the player reveals the
last beat the chip bar is live, and relabelling a button under a finger is a
misclick. Late arrivals are discarded. The feature is therefore strictly
opportunistic: it can improve the bar, never degrade it.

Do not route chips to a different, faster model. That abandons the shared prefix
and turns a 20-token miss into 2200. Same model is what makes this cheap.

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
@irene|blush|guard-8|fluster+12
*I take the water bottle with a slight blush.* "Thanks... you really saved me back there."
```

Grammar: `@<speaker_id>|<emotion>|guard<signed_int>|fluster<signed_int>`
Emotions (MVP set): `neutral, happy, blush, shy, upset, surprised`.

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
5. Malformed delta -> treat as 0.
6. **Never** show a raw metadata line to the player.

### Member separation

Three layers, cheapest first:

1. Block 3 carries dossier entries only for present members - an absent member's facts are not in the prompt at all.
2. Block 4 lists the roster explicitly and names absent members as absent.
3. The parser enforces the roster (rule 3 above).

Interactive scenes cap at **2 present members**. Three or more only inside scripted event nodes, where the prompt is tight and one retry is acceptable.

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
- Weekend blocks are where **event anchors** are placed, so a scripted beat can never collide with a comeback.
- It gives the week a shape - five days of opportunity cost, two days of choice.

`isWeekend(day)`, `workDays()` and `eventWindows()` in `systems/calendar.js`. Day 0 is Monday.

Occupancy for any `(day, block, location)` is derived: company slot first, then member solo slots, then a default idle location per member. This is what makes the map a *search* rather than a menu - Wendy is at the radio station on Wednesday afternoon whether you go looking or not.

Solo slots are generated from each card's `activityProfile.types`, resolved through the shared table in `data/activities.js`, which maps an activity type to its location, its `exposureBase`, and the phases it can appear in. Cards therefore stay portable: a card from any group drops into any cast without touching the calendar code.

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

- Success: `competence +`, positive ledger entry.
- Failure: `competence -`, `energy -`, and if the failure touched her, `strain += 8`.

### Energy is the pacing mechanism

| | |
|---|---|
| a block | `-6` |
| "Read her" | `-1` each |
| a night | `+24` |
| sleeping in your own room | `+30`, and it costs the block |

Overnight deliberately does **not** cover a full day. Three blocks with a couple
of Read her uses runs slightly negative, so a heavy day forces a rest block -
and that block is one the player wanted to spend on her. If sleep ever becomes
free, the whole day structure stops mattering.

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

Authored, deterministic, **no LLM call** - the same argument as the calendar.
Spending a model call on "you restocked the wardrobe" is waste, and these need
to be instant because they are the filler between scenes. `data/soloActions.js`
holds the table; `systems/soloWork.js` resolves one.

### The point is not the credits

The credit earners are the boring half. The important actions are the **snoops**:
an empty room is how you learn something about a member who is not in it, which
is the second path into `known_facts` and therefore into the knowledge-gated
gifts. That is what makes an empty wardrobe worth entering.

| Room | Work | Snoop |
|---|---|---|
| `wardrobe` | prep the fittings | **read the fitting notes** |
| `corridor` | chase the schedule | **take your time getting through** |
| `practice_room` | run the setlist / tidy up | - |
| `cafe` | buy the table coffee | - |
| `dorm_kitchen` | cook for whoever comes in | - |
| `dorm_living` | - | **wait up** |
| `dorm_player_room` | sleep / lie awake | - |

Snooping trades **`secrecy`** for a fact. Low secrecy amplifies scene exposure
and feeds `exposure_end`, so the cost is real and it lands later - which is the
right shape for a cost that buys knowledge.

Three rules that are not optional:

1. **No charge for a search that found nothing.** Once you know everything
   learnable about the cast, snooping stops taking secrecy. The player should
   not be taxed for having already done the work.
2. **Never about someone in the room.** You do not learn a secret about a woman
   who is standing next to you.
3. **A member drops out once you know all of her facts**, which quietly pushes
   the player toward whoever they have been neglecting.

Every solo action writes a line to the ledger in English, composed in code
rather than by the model - it is bookkeeping, and the summarizer call it would
otherwise cost is better spent on a scene.

`learnableFacts` on the card (section 12) is the pool. Every knowledge gift in
`data/gifts.js` must have at least one owner among the cast, or it is
unreachable; there is a test that asserts this.

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

Gifts are chosen in a pre-scene modal before the first LLM call, then injected as the opening line of block 5:
`System note: the player opened the scene by giving Irene a hand warmer.`

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
  "learnableFacts": ["hates cold hands", "cannot sleep the week before a comeback"],
  "startIntimacy": 5,
  "portraitMode": "mascot",
  "portraits": { "neutral": "portraits/irene.svg" }
}
```

`origin` is **library metadata only and is never injected into a prompt** - in fiction every member is in X (section 1b). `preferredRoles` feeds `castBuilder.js`, which resolves a coherent X lineup from whichever five cards are chosen. `activityProfile.types` are keys into `data/activities.js` and drive her solo schedule. `hiddenConflict` is optional and names the specific way this character fails under neglect; it is injected only once jealousy reaches `piqued` or above.

Localized display names live in `i18n/`, not on the card, so a card stays a single portable file.

**Semantic fields stay English.** `personality`, `speechStyle`, and `queerTexture` are authored once in English and translated by the model at generation time. This keeps cards portable across locales and keeps them a single source of truth. `styleHints` is the escape hatch for locale-specific voicing that a generic translation flattens - Korean honorific level, Chinese sentence-final particles - and is `null` unless a locale actually needs it.

`learnableFacts` is the pool solo-work snooping draws from (section 10b). Each
entry should contain the substring a knowledge gift matches on, so that learning
it genuinely opens something.

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

**Status: M0-M4 complete. M5 is next.** Running state, what is done and what is
still open, lives in `docs/PROGRESS.md` - that file is updated *before* a
milestone closes, and it is what makes compacting this session safe.

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
- No politics, graphic violence, occult, or sexual content involving minors.
- Adult-adult romance stays tasteful. The game is about tension, not explicitness.
- API keys live in localStorage on the player's device only. Never logged, never committed, never sent anywhere but the chosen model endpoint.
