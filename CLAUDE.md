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

## 2. Scope

| Milestone | Contents |
|---|---|
| **MVP** | 1 identity (Artist Assistant), 5 prebuilt idols all present, 1 group, zh/en, one 3-week cycle, chips + free text, 2-axis relationship, dossier memory, deterministic calendar, knowledge-gated gifts, save/load, PWA |
| **v1** | Event anchor nodes, bad ends + endings screen, repair events, retry/copy, character-card picker UI, custom card editor |
| **v2** | More identities, 50+ card library, multi-member scenes (2 max interactive), ko/pt, multi-model expansion |

Everything in v2 must have its **interface stubbed in MVP** (identity config, card loader, language keys) so adding content later requires no refactor.

---

## 3. Tech Stack

- React 19 + Vite 8 (already scaffolded), Tailwind CSS 4
- Plain React hooks. No Redux/Zustand.
- LLM: OpenAI-compatible router - DeepSeek V4 Flash (default), Gemini 3.5 Flash-Lite, GPT-5.6 Luna, Qwen 3.8 Max
- PWA: manifest + service worker, mobile-first 390x844
- Persistence: localStorage
- Lint: oxlint (`npm run lint`). Validate with `npm run build`.

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

`peakIntimacy` also reframes the map: bottom-left with `peakIntimacy = 0` is **Stranger**; with `peakIntimacy = 75` it is **Aftermath** - same coordinates, different scene framing and a different chip set.

### Route focus

Every cast member carries a full track in `relations`, but only one is an active **route** at a time, named by `run.focusId`.

| | `focusId` member | other cast |
|---|---|---|
| `intimacy` | 0-100 | 0-50, hard cap at `good_friends` |
| `admissibility` | active | frozen at 0 |
| `strain` | active | frozen at 0 |
| endings | eligible | never |

Non-focus members are social texture, not routes. They appear in scenes, react, hold dossier entries, and gain friendship intimacy. They cannot reach `nameless` or beyond.

Rationale: "I cannot name what this is" is not a feeling you have about four people at once. Five parallel admissibility tracks dilute the exact tension the game exists for, and they require a jealousy system that is a separate design problem.

Switching focus is allowed before `nameless`. After that it costs `strain += 25` on the abandoned track. Multi-route is a v2 mode: a flag plus one system file, not a refactor, because the state shape already supports it.

---

## 6. Interaction Loop

### Scene meters (volatile, reset every scene)

| Meter | Direction | Source |
|---|---|---|
| `guard` | down = good | seeded from `100 - intimacy`, moved by the LLM per turn |
| `fluster` | up = you landed | starts at 0, moved by the LLM per turn |
| `exposure` | up = risky | **derived from location + time block + secrecy, not from the LLM** |

`exposure` being deterministic is what makes map choice matter romantically instead of only logistically: practice room at night is low, cafeteria at noon is high.

### Micro -> macro mapping (computed client-side at scene exit)

```
guard dropped >= 15 over the scene         -> intimacy      += 2..4
fluster peaked >= 60                       -> intimacy      += 1..3
risk action at exposure >= 60, survived    -> admissibility += 3..6
risk action at exposure >= 60, failed      -> strain        += 10..20
stage == 'reckless'                        -> strain        += 5 / scene
daily task failed and it affected her      -> strain        += 8
```

Deltas are computed by `systems/relationship.js` from accumulated per-turn metadata.
**The LLM never reports macro deltas** - only per-turn `guard` / `fluster` movement and emotion. Fewer things for a small model to get wrong.

### Player input

Three **chips** per turn plus optional free text. Chips are generated client-side from stance templates filtered by stage and strain band: zero LLM cost, instant render, and they cover the latency of the previous stream.

```
[ Tease ]   [ Reassure ]   [ Change the subject ]        (pen) free text
```

Stance vocabulary: `tease, reassure, deflect, press, confide, touch, retreat, joke, apologize, invite`.
Locking: `press` / `touch` / `confide` unavailable in `rift`; `touch` requires `intimacy >= 50`.

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
| 4 | **Scene header** - roster, time, location, exposure, stats, gift note | rebuilt at scene start | ~150 tok |
| 5 | **Scene buffer** - dialogue turns in the current room | **purged on exit** | grows |

### Dossier

The addition that makes memory visible instead of invisible plumbing.

```js
dossier: {
  irene: {
    known_facts:     [],  // max 8, LRU   - "hates cold hands"
    shared_moments:  [],  // max 5, LRU   - "you fixed her mic pack before showtime"
    open_threads:    [],  // max 3, FIFO  - "she asked if you are free Sunday"
    player_told_her: []   // max 5, LRU   - "you are from Busan"
  }
}
```

Unresolved `open_threads` at cycle end cost `strain += 5` each. The model is instructed to reference them.

Two rules that are not optional:

1. **Roster scoping.** Block 3 contains dossier entries only for members present in the current scene. An absent member's facts are simply not in the prompt, which is the cheapest possible defence against member bleed.
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
[ block 4  scene header ]  roster, time, location, exposure, stats, gift note
[ block 5  turns        ]  the ONLY thing that grows during a scene
```

### Why this order

The ledger gains an entry after *every* scene. So on the first turn of a new scene, everything after block 1 is a cache miss no matter how blocks 2-4 are arranged - moving the dossier earlier or later changes nothing.

Ordering is therefore chosen for **salience, not cache**: the most decision-relevant material sits closest to the dialogue. Dossier facts about the woman in the room matter more to the next line than a summary of week 1, so the dossier goes after the ledger.

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

Up to **3 beats** per response, separated by a blank line, each with its own metadata line. The client reveals beats one tap at a time. This halves call count and hides latency behind player pacing.

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

**The calendar is deterministic.** Hand-authored slot templates per week-phase, filled by a seeded RNG. No LLM call. Reasons: replayable, testable, instant, and the player can be shown the whole week upfront - opportunity cost only bites when it is visible. The LLM may write a flavor label for a slot; it may never decide the slot.

### Daily tasks

One mandatory work objective per day, flexible execution window across the three blocks.

**Tasks do not auto-complete on room entry.** A task creates a *conflict*: one block left, the outfit is not ready, and she wants to talk. Choose. That tension is the point of the task system.

- Success: `competence +`, positive ledger entry.
- Failure: `competence -`, `energy -`, and if the failure touched her, `strain += 8`.

### Player stats

| Stat | Effect |
|---|---|
| `competence` | gates event nodes and identity promotion |
| `energy` | consumed by blocks and by "Read her"; low energy narrows chip options |
| `secrecy` | low secrecy amplifies scene `exposure`; feeds `exposure_end` |
| `credits` | earned from completed tasks, spent on gifts |

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

Gifts are chosen in a pre-scene modal before the first LLM call, then injected as the opening line of block 5:
`System note: the player opened the scene by giving Irene a hand warmer.`

---

## 12. Character Card Schema

JSON, importable and exportable. Prebuilt cards ship in `src/data/characters/`; custom cards live in localStorage. One loader serves both.

```json
{
  "id": "irene",
  "schema": 1,
  "displayName": { "en": "Irene", "zh": "Irene" },
  "mascot": "rabbit",
  "palette": { "base": "#c9a0dc", "accent": "#f2e6f7" },
  "personality": "reserved, precise, dislikes being fussed over",
  "speechStyle": "short sentences, understated, rarely finishes a feeling",
  "queerTexture": "deflects with professionalism when it gets close",
  "styleHints": { "zh": null, "ko": null },
  "likesSeed": ["quiet mornings"],
  "startIntimacy": 5,
  "portraitMode": "mascot",
  "portraits": { "neutral": "portraits/irene.svg" }
}
```

**Semantic fields stay English.** `personality`, `speechStyle`, and `queerTexture` are authored once in English and translated by the model at generation time. This keeps cards portable across locales and keeps them a single source of truth. `styleHints` is the escape hatch for locale-specific voicing that a generic translation flattens - Korean honorific level, Chinese sentence-final particles - and is `null` unless a locale actually needs it.

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
  run:       { identityId, focusId, day, week, phase, block, seed },
  player:    { name, competence, energy, secrecy, credits },
  cast:      [ characterId ],
  relations: {
    irene: { intimacy, admissibility, strain,
             peakIntimacy, peakAdmissibility, stage, endingLocked: null }
  },
  dossier:   { irene: { known_facts, shared_moments, open_threads, player_told_her } },
  ledger:    [ { id, day, block, type: 'full' | 'summary', text, summary } ],
  calendar:  { weekPlan, todayTask, taskState },
  flags:     { firedEvents: [], repairUsed: {} },
  scene:     null   // volatile; never serialized
}
```

`scene` is deliberately excluded from saves: the memory design says a scene is ephemeral, so saving mid-scene means saving at the room door.

Save key: `yuriagent_saves_v1`. On load, unknown or missing fields fill from defaults rather than throwing.

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
  systems/                   # PURE. no React, no network.
    relationship.js          # intimacy/admissibility/strain, stage, endings
    calendar.js              # deterministic seeded schedule
    tasks.js
    economy.js               # credits, knowledge-gated gifts
    exposure.js              # location x block x secrecy -> risk
    chips.js                 # stance chip generation + locking
  tools/
    llmTool.js               # multi-model router, streaming, retries
  data/
    characters/*.json
    identities/*.json
    locations.js
    gifts.js
    events/                  # anchor nodes
  ui/
    vn/                      # VNStage, Portrait, DialogueBox, ChipBar, MeterBar, ThoughtBubble
    map/                     # LocationGrid, WeekCalendar
    modals/                  # GiftModal, SaveModal, SettingsModal
    screens/                 # Cover, Setup, Game, Ending
  i18n/                      # zh/en (ko/pt stubs)
  config/
    constants.js
    modelConfigs.js
  store/
    save.js
public/
  portraits/*.svg
  manifest.webmanifest
```

---

## 17. Git Workflow

| Branch | Role |
|---|---|
| `main` | stable, always runnable, what players get. Deploy only from here. |
| `dev` | integration branch. All features land here first. |
| `feat/<name>` | branched off `dev`, merged back with `--no-ff` |

Rules:

- Never commit directly to `main`. Merge `dev -> main` only after `npm run build` passes and the affected loop has been played manually.
- Tag `main` merges: `v0.1.0`, `v0.2.0`, ...
- `npm run build` and `npm run lint` must pass before any merge.
- Never commit API keys or key files.

---

## 18. Roadmap

| Phase | Deliverable | Done when |
|---|---|---|
| **M0** | Repo hygiene: git init, `main` / `dev`, Tailwind wired with theme tokens, font-scale root, PWA manifest, i18n skeleton (zh/en) | `npm run build` clean, app boots, theme + font scale switchable |
| **M1** | Pure systems: `relationship`, `exposure`, `calendar`, `chips`, `economy` | stage / ending / strain transitions and route-focus caps verified with no UI and no LLM |
| **M2** | Prompt pipeline: `promptBuilder`, `llmTool`, `responseParser`, `memory` | a scene runs in a console harness; cache invariants and roster enforcement asserted |
| **M3** | VN layer: portrait + CSS emotions, dialogue box with beat reveal, chip bar, meters, Read her | one full scene playable end to end |
| **M4** | Shell: map, time blocks, calendar, tasks, gift modal, day rollover | one full in-game day playable |
| **M5** | Run layer: 3-week cycle, event anchors, endings, save/load, PWA install | full playthrough reaches an ending |

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
- Validate every change with `npm run build` and `npm run lint`. Do not commit a red build.
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
