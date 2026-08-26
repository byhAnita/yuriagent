# YuriAgent - Project Blueprint

> **Status: v2 engine, phase 0 complete.** The spike is built and validated; the
> loop is not. Read Part 0 and Part I first - they are the current design. Part
> II is the v1 engine, most of which still stands, with the superseded sections
> marked.
>
> `docs/PROPOSALS.md` §27 is the decision record behind Part I: twenty-one
> decisions, why each was taken, and what was measured. Read it before arguing
> with anything here.

---

# Part 0 - Vocabulary

Settled first, because five words were about to collide and one of them already
meant two things.

| term | means | replaced |
|---|---|---|
| **Day** | one in-game day | - |
| **Block** | morning / afternoon / evening | - |
| **Scene** | one location visit, 4-6 rounds long | - |
| **Round** | one model call: ~80 words plus four options | `turn`, `beat` |
| **Tier** | a prompt layer - 1 static, 2 ledger, 3 tail | `block 1-5` |

`Tier` is lifted from `rv-simulator`'s own docs, which frees `block` for the
clock. **Retired outright: `stance`, `chip`, `beat`, `turn`.** If you find one in
the code, it is v1 and it is on the way out.

**And `intimacy` is now `affection`, everywhere.** Part II still says `intimacy`
because that is the record of how this was arrived at; the code says `affection`.

That rename is not cosmetic, and it is worth the paragraph. For a while both
names existed at once: `newRelation` wrote `intimacy` and `systems/values.js`
wrote `affection`, so a fresh run started with `intimacy: 5` and `affection:
undefined`. The value bar showed every member at 0 while the day screen showed 5,
and tier 3 told the model **`affection NaN`** - which is the number the pacing
bands are read off, and therefore the number the whole genre correction in I.7
runs on. Both halves were correct and 879 tests were green, because every test
built its `relations` by hand with the name it expected. Only `App` used
`newRelation`.

**One number, one name.** `agent/roundEngine.test.js` asserts the join by
building a relation the way App does and looking for `NaN` in the tail.

---

# Part I - The v2 engine

## I.1 The one sentence

**The model decides what the scene MEANS. The code decides what the world IS.**

Everything below is a consequence of that. v1 had it backwards - code picked a
stance, priced the outcome, and asked the model to write a label for it - and
the result was a stat machine with prose on top, which is the non-goal §1 rules
out explicitly.

| | who decides |
|---|---|
| where each member is, each block | code |
| which day an event falls on, what the phase is | code |
| `exposure` of a location x time | code |
| who is in the room when the player walks in | code, and **shown on the map** (I.11 - reversed on played evidence) |
| the ~80-word round: the room and her lines | model |
| the four options | model, written from the current moment |
| affection and player-stat deltas | model, bounded |
| `admissibility` delta | model proposes, code vetoes a rise at low exposure |
| who hears about it afterwards | code |
| jealousy | model |

## I.2 Pillar 1, rewritten

v1's first pillar was *the player reads hidden emotional state and bets on it*,
and `Read her` was rationed so that reading her cost something. **That pillar is
what produced the stance bar**: it hid the numbers and then handed the player a
labelled lever instead, which is the worst of both.

So: **the numbers are on screen.** Affection, admissibility, selfId, mood,
secrecy, the round counter, the location. `rv-simulator` does this and has been
played for months; the intensity comes from the writing, not from concealment.

`Read her` survives with a different job - one extra call, still rationed,
returning her **unspoken thought** rather than a number. With the values visible,
that is the only hidden state left, and it is where the tension moves.

## I.3 The round

```
[round: the room and her line, ~80 words, in the player's language]
        |
[four options - these ARE the player's line, shown verbatim as theirs]
        |
[next round: her reaction]
```

**The model never writes the player's dialogue.** `rv-simulator` does, because
it is a story generator; this is a game, and the chosen option *is* the player's
line. That keeps §1's third pillar for free.

A scene is **4-6 rounds**, then the block ends. A Leave control forfeits the
rest. The block stays the unit of opportunity cost, so rounds inside it are free.

**Length: ~80 words is the instruction, and the model writes about twice that in
`zh` (240-330 characters).** Measured, read, and kept - at that length a round is
~30 seconds of reading against a ~4 second wait, which is the right ratio.
`ROUND_WORDS` in `config/rules.js` is the one number to move.

### ...and that length is a layout constraint, not just a reading one

**Found on the phone, first hand test of the v2 loop.** The scene ran about 1.5
viewports tall at font scale 1, so every single round had to be scrolled past
before it could be answered - four options, sitting off the bottom of the screen,
every time.

Two causes, and the second is the general rule.

**Too many numbers.** The value strip drew *every* member in the room on two
lines each, plus four player stats - up to eleven rows of chrome above a
paragraph of Chinese. So it collapses to the woman whose portrait is up, one
line, with the rest behind a tap that carries the count of who else is in the
room. That is not a retreat from I.2: the rule there is that the numbers are
**available**, and four absent members' values are not what anybody is reading
while she is talking.

**Nothing said which row was allowed to give.** `.stage-fill` is a fixed height,
and a flex item defaults to `min-height: auto` - so every child was sized by its
own content, nothing could shrink, and the column simply overflowed the page.

> **Every row in the scene column states how it yields.** `shrink-0` means fixed
> and deliberately so; a `min-h-` floor means it gives way down to there. There
> is no third option, and it is asserted rather than described.

Header, value strip and options are fixed - **the options are what the player
acts with, so they never move.** The portrait takes the slack off a zero basis
and falls to a floor. The prose is the one element whose length the code does not
control, so it shrinks last and **scrolls inside its own box**, name plate
pinned. A long round costs a scroll in the text box; it never costs the options
their place under the thumb.

The root keeps `overflow-y-auto` as a belt: §20's sheet that grew off the top of
the screen took its close button with it and the run stopped there. Nothing on
this screen may become unreachable.

### One call per round

The options come out of the same call as the prose. That is the whole saving:

| per scene | v1 (8 turns) | v2 (5 rounds) |
|---|---|---|
| prose calls | 8 | **5** |
| chip calls | 8 | **0** |
| interjections | up to 6 | 0 |
| summarizer | 1 | 0 (folded in) |
| **total** | **~18-25** | **~5** |

**Never split the machine fields into a second call.** That architecture is
exactly what v1's `writeChips` was: ~500 extra calls a campaign, and §6's warning
against routing it elsewhere - *"that abandons the shared prefix and turns a
20-token miss into 2200"* - still applies. There is a quality argument too: the
model that just wrote her reaction is the one that should say how far she moved.

## I.4 The wire format

Prose first, a sentinel, then pipe-delimited machine lines. **Not JSON.**

```
<~80 words, in the player's language, the room and her line>
%%%
A|<option>
B|<option>
C|<option>
D|<option>
emo|blush
irene+2
sum|<one English sentence, last round of the scene only>
canon|title_track|<what the room settled>
```

Three reasons, and the first is v1's own measured note: *"Not JSON - more tokens,
and small models break it more often."*

1. **JSON scaffolding is proportionally far worse here.** `rv-simulator`'s story
   is 350-450 words, so braces and key names vanish into it. At 80 words it is a
   fifth of the output.
2. **Prose streams from the first token.** ~1.2s to first word against ~4s for a
   complete round, measured live. A JSON object cannot be shown until it closes.
3. **The failure mode is a line, not the round.** A missing `sum|` costs a
   summary; a malformed option costs one option and backfills. A broken JSON
   object costs everything.

Machine tokens - field names, member ids, emotion names - stay **ASCII English in
every locale**. That rule survives from v1 and is free.

### The parser is liberal inward and conservative outward

`agent/roundParser.js`. **Measured: about one `zh` round in ten came back with
its options unparseable, and the cause was punctuation rather than structure.** A
model writing Chinese reaches for the full-width pipe, or writes the list the way
one is *displayed* - `A.`, `A、` - because that is what an option list looks like
in Chinese prose. The line is otherwise perfect.

So the machine half accepts `| ｜ . ． 、 :` as separators, and the prose half
stays strict about what it *deletes*: `.` and `:` appear in narration constantly,
and eating a line of her dialogue to catch a leaked field is a far worse trade.

The streaming reader emits **raw** and cleans at the end, because a stream has
half a line rather than a line. Holding every line back until its newline arrives
would throw away most of the latency this format exists to buy.

## I.5 Three tiers

```
TIER 1  static   rules, profiles, identity      100% cache hit after round 1
TIER 2  ledger   append-only history            hit except on a collapse
TIER 3  tail     values, place, time, who       always a miss, kept small
```

**The rule that makes it work: nothing volatile may appear above tier 3.**
Affection, mood, who is in the room, what time it is - all of it lives in the
tail and nowhere else. Put one live number in tier 1 or 2 and every round after
it is a full miss.

Tier 3 also carries **where and when**: `Location: X Practice Room`, `Week 2,
Tuesday, evening`. v1 carried this and it is what let one practice room open
three different ways under three different activities, for about forty tokens in
a block being rebuilt anyway.

### The stepped window

From `rv-simulator/src/agent/memoryPool.js`. Three full entries in the player's
language; when a fourth arrives all three collapse **in place** to their
one-sentence English summaries. Never reordered, never deleted mid-ledger, so the
token prefix stays byte-identical between rounds.

**One summary per scene, not per round.** The client knows which round is last,
so only that round emits `sum|`.

## I.6 Language: instructed in English, immersed in the locale

This is the single thing v1 got backwards, and fixing it fixed the prose on the
first try.

| | language |
|---|---|
| rules, wire format, pacing, the axes | **English** - `config/rules.js`, never localized |
| member profiles, player identity | **locale** - `profileLocal[lang]`, `identity.prompt[lang]` |
| the round's prose and its options | **locale** |
| the one-sentence summary | **English** |
| recent full text in the ledger | **locale** |

**§19 rule 2 - "memory is always English" - is repealed.** The only thing it
bought was mid-run language switching, and that is now explicitly unsupported: a
`zh` player plays the whole campaign in `zh`.

Three `zh` rules a generic language directive cannot reach, all found live:
Simplified only; every character is a woman; and **never write 喉结**. The last is
the one place this codebase deliberately breaks §21's ASCII rule - the phrase is
stock romance description for a male lead in Chinese web fiction, so it arrives
as an idiom rather than as a claim about a body, and the English rule *"never use
male-coded physical description"* has now been measured failing to hold it twice.

## I.7 Register and pacing - the actual fix for the genre

v1 had no pacing brief at all, which is why `flirt` was reachable in week one, in
an office. The correction came from the person this game is for:

> Yuri relationship contains lots of 试探、心动、克制 texture, not direct flirting
> in a work place at a very early stage... Emotions develop in hidden care and
> small details during the work.

Two things carry it, both in `config/rules.js` and both cheap.

**The register**, adapted from `rv-simulator`: literary and emotional; sensory
detail across sight, sound, touch and smell; and a tone ratio of **60% sweet, 30%
the real pressure of the job, 10% youthful regret**. The ratio is the useful
half - "sweet" alone produces syrup, the 30% keeps a comeback schedule in the
room, and the 10% stops a scene resolving too cleanly.

**The pacing bands**, stated against affection rather than round number, because
this game runs ~650 rounds to `rv-simulator`'s ~60:

| affection | what may happen |
|---|---|
| 0-15 | strangers; professional politeness; **no romantic moves at all** |
| 16-30 | warmth shows only as noticing - how she takes her coffee |
| 31-50 | friends, and both would say so; proximity that stays deniable |
| 51-70 | **the heart of the game** - close, unnamed, and restrained |
| 71-85 | both know; neither says it |
| 86+ | named, at least to each other |

And three rules at every band: **probe, do not declare**; the flutter is
**physical and unstated**; **restraint is affection, not its absence.**

**The identity paragraph does more work than it looks.** `rv-simulator` gives its
identities a paragraph - the job, three typical days, and what it costs - and the
last clause of ours is load-bearing: *any ambiguity could be read as misconduct*
is the `admissibility` axis stated as a fact about the workplace rather than as a
number.

## I.8 The two numbers

Per romanceable member:

| | range | means |
|---|---|---|
| `affection` | 0-100 | how emotionally close she is |
| `admissibility` | 0-100 | how far either of them could let this **be seen** |

**`admissibility` is restraint as a number**, and it is the whole reason this is
not a generic romance. It rises only when something happened where others could
see it and it survived. Deeply close and completely unable to name it is a
stable, interesting place to be - not a failure.

**`strain` is gone.** It locked stances (retired), shortened scenes (retired),
gated repair events (never built), and decided bad ends. With the model deciding
affection, a bad scene simply moves affection down - *that is the damage* - and a
second damage axis only code can read is exactly the hidden machinery this
redesign removes. `mood` replaces it on the player's side, where it belongs.

**And `jealousy` goes with it, for the same reason and it is the same reason.**
This was not obvious when Part I was written - I.1's table still says jealousy is
the model's - so it is worth stating as a deletion rather than a reassignment.
§5b's engine was a number that ticked upward in the background of a woman the
player had not seen for two weeks, with a band table, a decay rate, an
exclusivity curve and a scale factor found by a harness that no longer exists.
Every one of those is code deciding what something was worth to her.

What replaces it is better and cost nothing to build, because half of it was
already there. `propagate` still runs at scene exit and still writes a
`heard_about` entry in her own words - and then **nothing happens.** The entry
sits in her dossier until she is in front of the player, at which point tier 3
carries it, the model reads it, and her reaction moves affection like everything
else does. **Jealousy stops being a number and becomes a scene.**

Three consequences, all deliberate:

- **The day screen is correctly stale** for anybody not recently seen. You do not
  know how she took it until you see her. That is the mechanic, not a gap in it.
- **A date refusal loses two of its reasons.** `rift` and `corrosive` used to
  refuse on their own; now two axes decide a date, which is what §10 always
  claimed. A member who has heard something she dislikes still refuses - in the
  scene, in her own words, which is a better refusal than a band lookup could
  ever write.
- **The aftermath screen has to say who found out**, and say that it has not cost
  anything *yet*. Every one of those lines used to be a hit landing as it
  printed. A player shown four names and no note will read four penalties.

The three propagation tiers survive intact. They were never really about the
number: they decide **what she found out** - watched it, heard about it, or was
merely standing there - and that is still three different things.

Player stats: `selfId`, `energy`, `secrecy`, `credits`, `mood`. `competence` is
dropped; `selfId` is lifted from `rv-simulator` and is the one stat that is
actually about being a queer woman in this industry.

### The delta bound does not port

`rv-simulator` allows ±1-10 a round over ~60 rounds. This game is ~650 rounds - a
favoured member appears in maybe 40 scenes, so ~200 rounds, and moving her 5 → 85
across those needs an average of **+0.4 a round**. ±5 would be ten times too hot.

**±2 a round, 0 is the normal answer, first round of a scene is always 0**, and
code clamps the scene total to ±6. Clamping a total is the same kind of rule as
clamping to 0-100: it bounds, it does not choose.

**Only present members move.** A rumor lands in an absent member's dossier and
does nothing until she is in front of the player. Jealousy stops being a number
ticking in the background and becomes a scene - and the day screen's reading for
anyone not recently seen is *correctly* stale. You do not know how she took it
until you see her.

## I.9 The one code-side value rule

`admissibility` may not **rise** when the scene's exposure was low. The model
still picks the number; the world gets to say *nobody saw that*.

**The spike says this is a safety net rather than the mechanism.** Five rounds in
an empty practice room at night, with no veto in play: affection 8 → 12,
admissibility 0 → 0, unprompted. The model holds the axes apart on its own. Keep
the veto anyway - it costs one comparison, and the axis it protects is the one
this project has already made unreachable three separate times.

## I.10 The knowledge economy, and what is left of it

- **Dossier: three categories**, one per real question - `facts` (what the player
  knows about her), `told_her` (what she knows about the player), `heard_about`
  (what she has heard and not yet reacted to). `shared_moments` duplicated the
  ledger; `open_threads` existed only to feed `strain`.
- **Knowledge reaches the player as an option.** The model has her `facts` in
  tier 3, so when it is apt one of the four options simply *is* the gesture -
  contextual, unspammable, impossible to turn into a checklist. The opener sheet
  is retired.
- **Objects keep a Give control**, because choosing among things you are carrying
  and paying for one needs a list. Giving is a round action; the next round is her
  reaction.
- **Gifts stop being knowledge-gated.** `requires` matched substrings against
  dossier text and broke twice; it existed only because code had to decide whether
  the player had earned a gift. The model reads her `facts` and reacts accordingly.
- **Free text survives** as a fifth control. The played evidence demands it: at
  the concept meeting the player had to type every agenda topic in by hand.

## I.11 ~~An empty room is what happens when you guess wrong~~

> **REVERSED, on played evidence, after one phone session.** The map shows
> occupancy again. The argument below is kept because half of it survives and
> because it is the record of how this was arrived at - but where it and the
> paragraph after it disagree, **the reversal wins.**

Occupancy is **hidden**. In v1 the player saw who was where and *chose* an empty
room to work in; now they guess, and solo work is the consolation rather than a
strategy.

That finally pays off something §10 has wanted since M1 and never delivered:
*"a fact that tells you where she will be is more interesting than one that tells
you what to purchase."* It never delivered because the map already told you.
**Snooping's best prize stops being an object and becomes access.**

### ...but a guess with no information is a lottery, not a bet

> Now the click to come in and find character doesn't give good play experience.
> Let's change UI back to show where they are.

**The argument above is good and it is about the wrong thing.** Hiding occupancy
does turn the map from a menu into a search. What the player actually *does* with
a hidden map is tap into rooms one at a time until they find her - and there is
no decision anywhere in that. The block costs the same however many doors it
took; the only variable is tedium.

It also contradicts §10, which this file has agreed with since M1: **the calendar
is deterministic specifically so it can be shown in full before the player
commits anything, because opportunity cost only bites when it is visible.** The
week grid has always been open. Hiding *this* block while showing the other
twenty was the inconsistency, not the fix.

The real cost was always the one §10 names, and it is untouched: three blocks, five
members, and one of them gets this one.

**Two things this does NOT give back**, and the distinction is what saves the
paragraph above from being wrong twice:

1. **A row is not a shortcut.** The faces come back; the per-member *button* on
   the row does not. Choosing one woman in front of the others happens **inside**
   the room, where it costs what it should. v1's crowded row offered *only*
   per-member buttons, so the daily task, the snoop and the solo work were all
   silently locked out by company - worst on an event day, when all five are
   standing there and the row offered no way in at all.
2. **Access is still worth snooping for.** The map says where she is **now**; a
   routine says where she will be on an evening nobody has reached yet, and the
   week grid shows *scheduled work slots*, never idle ones. So *"she practises
   alone on Wednesday nights"* is still something that has to be learned - which
   keeps §10's prize intact without the map having to lie about the present.

The row therefore carries the room, who is in it, and how visible it is. **The
abstract witness count is gone** - it was the room's *capacity* for witnesses,
which is a worse answer to the same question now that the faces are the real one.

## I.12 What is not measurable any more

Once the model sets deltas, `balanceSim` and the 189-block campaign harness
cannot report an ending distribution. **That is a decision, not an accident.**
`rv-simulator` has no such apparatus and does not miss it, and both v1 harnesses
missed the largest bug the chip system ever had - so balance becomes permanently
a play question.

What replaces them is a thin smoke harness: ~40 rounds against the offline
writer, proving the loop, the calendar and the memory pool do not crash or drift.

---

# Part II - The v1 engine

> **Read the banner on each section.** Much of what follows still stands - the
> setting, the calendar, the map, exposure, locations, dating, art direction,
> theming, git workflow and the content guardrails are unchanged and still
> authoritative.
>
> **Superseded by Part I:** §5 (relationship model - `strain`, the delta engine,
> and the plateau BRAKE, though the plateau survives as a reading), §5b (the
> jealousy engine **in its entirety** - bands, decay, exclusivity, scale; the
> three propagation tiers and the exposure-drives-awareness argument survive),
> §6 (interaction loop - stances and chips **in their entirety**), §7 (memory -
> five blocks become three tiers), §8 (prompt assembly), §9 (the beat contract),
> §11 (gift gating), §19 rule 2 (memory in English).
>
> They are kept rather than deleted because the *arguments* in them are the
> record of how this design was arrived at, and several are still load-bearing
> for the parts that survive. Where Part I and Part II disagree, **Part I wins.**


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

### Every model call is recorded, because the two useful facts never reach the screen

`tools/debugLog.js`. Which writer answered - the router, the offline writer, or
the offline writer *standing in for a failed router* - and what the raw text was
before the parser touched it. A player cannot see either, so a hand-played bug
report cannot contain them, and a live probe cannot reproduce a client-side path
at all: that is how eight of them missed a language bug that lived in
`client.js`.

`client.js` is the only layer that knows, so it is the only layer that records.
`source` is `live` / `mock` / `fallback`, and the third is invisible in play for
every preset except chips.

**Recording is unconditional; printing is opt-in.** That way round on purpose - a
bug found by hand is found once, and asking the player to switch logging on and
then hit it again is asking for the one thing they cannot promise. The ring
holds forty calls, about two scenes, which is the window a report is written
from. `yuri.dump()` renders it as text meant to be pasted; `yuri.debug()` also
prints each call as it happens.

**The key is never in a record** (section 22). It travels as its own argument to
`llmTool` and is not in `messages`, so this is mostly a matter of not being
clever; `redact()` is a belt on top of that, and it is tested harder than the
feature, because a log written to be pasted into a bug report is the likeliest
way a key ever leaves a device. Nothing here transmits anything - the ring is in
memory and `dump` returns a string the player chooses what to do with.

### ...and a console to type it into, because the target device has none

The record is only worth having if somebody can read it, and on the device this
game is built for they could not. **iOS runs WebKit under every browser**, so
Chrome on an iPhone has no devtools and no way to call `yuri.dump()` - which
made the whole apparatus desktop-only, on a mobile-first PWA.

`tools/eruda.js` loads an in-page console overlay. Three rules:

1. **Opt-in and not free.** ~490KB, so it is a **dynamic import** and lands in
   its own chunk. A static import would put devtools in the main bundle for
   every player forever.
2. **Asking is sticky.** `?debug=1` sets a flag that survives reload, because
   an installed PWA opens at `start_url` and drops the query string - the
   console would otherwise vanish the moment a tester added the game to their
   home screen, which is exactly when they are testing on a phone. `?debug=0`
   turns it off.
3. **It never breaks the game.** Every failure path is silent. A diagnostic
   that takes the game down with it is worse than no diagnostic, and section 3
   keeps every degraded mode playable.

The dump gets its own button in the overlay rather than being typed. Typing
`yuri.dump()` into a 390px console with autocorrect on is precisely the
friction that stops a report carrying its evidence.

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

> **SUPERSEDED IN PART by Part I.8 - `strain` is gone and the model sets the deltas. The two axes, the stage map, the plateau and the endings all still stand.**

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
| **piqued** | 25-49 | she probes about it; `care` or `confide` converts: `jealousy -20, intimacy +2` |
| sharp | 50-74 | scene `guard` starts +15; `flirt` and `touch` locked; `strain += 3` per unaddressed scene |
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

#### ...but nobody chose to be at the concept meeting

`WEIGHT_PRESENT` prices *she was in the room while the player spent the block on
somebody else*, and that is exactly right for a practice room with three of them
in it: the player picked one. An **anchor event is not that.** The company put
all five in the room, attendance is the day, and the engine picks an addressee
by construction - so every event ended with four "she watched you give your time
to Irene" lines and four jealousy hits, fourteen times a campaign, for turning
up to work. Reported five separate times in one session, once per event played.

So a `collective` scene takes the same exemption the dorm's `shared` evening
already has, on the same grounds: **collective attendance is not a choice.**

Only the presence tier, though. A **gesture** at an event still falls through to
the witnessed branch at full weight, because singling somebody out in front of
the other four is the loudest act available to the player and an event is where
it is loudest. The event stays the highest-stakes room in the game; it just
stops charging admission.

#### A gesture is a gesture, not "a system note went out"

The turn loop read `singledOut` off `Boolean(note)`, because at the time the
only thing that appended a note mid-scene *was* an opener. Then the closing
directive arrived - one more system note, appended to the last turn of every
scene - and quietly made **every group scene in the game end witnessed.** Four
absent members took `WEIGHT_WITNESSED` and a dossier entry each for a
conversation, which is precisely the defect the three tiers above were
introduced to fix, arriving by a different door eight weeks later.

Played, it is unmissable and it is unattributable: *"Nana saw you with Irene"*,
four times, at the end of a scene in which nothing happened. The number that
produced it was correct; the question it was asked was wrong.

**So the flag is passed, never inferred.** `runTurn` takes `gesture`, and the
one caller that means it - handing something over - sets it. A note is a
transport, and what a scene costs may not be read off which transport it
happened to use.

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

> **SUPERSEDED ENTIRELY by Part I.3 and I.7. Stances, chips and beats no longer exist. Kept for the arguments, which are the record of how the v2 design was arrived at.**

### Scene meters (volatile, reset every scene)

| Meter | Direction | Source |
|---|---|---|
| `guard` | down = good | opens at `100 - intimacy`, and the LLM reports where it is on every beat |
| `fluster` | up = you landed | opens at 0, and the LLM reports where it is on every beat |
| `exposure` | up = risky | **derived from location + time block + secrecy, not from the LLM**; also drives rumor propagation (section 5b) |

`exposure` being deterministic is what makes map choice matter romantically instead of only logistically: practice room at night is low, cafeteria at noon is high.

**Volatile has to be visibly volatile.** These three were the only relationship
numbers on the scene screen, so a player who watched `fluster` climb to 28
through an anchor event and open the next afternoon at 0 read it as her
affection being wiped - which is exactly how the first played event was
reported. Both numbers were right and nothing said they were a different kind
of thing from `intimacy`.

So the meter bar carries **standing**, in a word, next to the three that move:
the same sentence block 4 gives the model, for the same reason and under the
same rule - words, not numbers (section 8). The number itself stays on the day
screen for anyone who wants it. One fixed thing beside three moving ones is
what makes the moving ones legible as scene state.

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
within earshot are all nameable. `flirt` and `press` are loud and deniable, and
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

Stance vocabulary: `flirt, care, casual, deflect, joke, press, confide, touch, retreat, apologize, invite`.
Locking: `press` / `touch` / `confide` unavailable in `rift`; `touch` requires `intimacy >= 50`.

### Four of them are the everyday register, and the rest are events

**`care`, `casual`, `flirt` and `work` are the common tones.** They are what an
ordinary turn is made of - being warm, saying something light, being obvious
about liking her, and getting on with the job. Everything else is a move
somebody would notice making: pressing, confiding, reaching, leaving,
apologising, asking her somewhere, refusing a subject.

`generateChips` weights the four accordingly. A vocabulary where every stance
is equally likely reads as a random verb generator, because most turns in a
conversation are not events.

#### There was no way to do the job

**`work` is the twelfth stance and it took the fourth common slot from
`deflect`.** Reported at an anchor event about a comeback:

> the options are still daily small talk options - maybe this is the cause -
> the whole meeting continue talking about small talks like *Did you sleep well
> yesterday*

Every one of the other eleven stances is a move in a **relationship**. There
was nothing for **doing the work you are both there to do**, and the player is
an artist assistant standing in a meeting about a comeback. Their workaround
was typing every agenda topic in by hand, which is a complete diagnosis: with a
work stance on the bar, the day would have moved itself.

`casual` does not cover it and was never meant to. It was added for the
opposite problem - there was no *low-stakes* move - so it is deliberately
contentless: talk about nothing. *Let us settle the thing this room is for* is
a different axis, not a lighter version of that.

Three properties, all falling out of the existing model:

| | |
|---|---|
| **common** | at work, most turns are work |
| **safe** | never locked by strain, jealousy or low energy. There is no state of a working relationship in which the work stops - and section 6 already wanted a second move that survives `rift` |
| **worth little** | there is no stance-to-payout table anywhere: `guard` and `fluster` are readings the model reports, so a stance is worth what it is *written* worth. The offline tables give `work` the smallest numbers in the game, below `casual` |

**And the agenda is what it acts on.** At an anchor event a `work` chip written
by the model has the agenda sitting in block 4, so it becomes *"so - the title
track"* rather than a generic verb. That is the whole feature: the day's
business becomes a thing the player can pick instead of a thing they must type.

**Four common stances stays four.** `generateChips` fills two of three slots
from the set and reserves the third, so a fifth dilutes every other one by a
fifth - including `care`, which the `piqued` conversion runs through. `deflect`
gives up the slot and **only** the slot: still legal, still offered from the
general pool, no longer weighted up. Evasion is a tactic, and the argument for
`casual` was that most turns are not tactics.

#### What the harness could and could not say about it

Five seeds is a **reading, not a comparison**, and this is the change that
proved it. On the default list `spread` went 28 -> 40 and `balanced` 32 -> 16 -
in **opposite directions**, and only for the two policies that pick uniformly
from `available`. Run wide, at twenty seeds and with the stance withheld from
one arm, **every policy lands inside +/-2 points**. The whole of it was noise.

Two things worth keeping from that.

**Neither harness calls `generateChips`.** Both pick a stance uniformly out of
`availableStances`, so `COMMON_STANCES` changing cannot reach them at all - the
weighting, which is the entire player-facing half of this change, is invisible
to the only thing that plays a whole campaign. What they *did* see is a twelfth
entry in a list they draw from, which reshuffles which stance every rng draw
lands on.

**Which is why a before/after across a stance ADDITION compares two different
questions.** The honest experiment withholds the stance from one arm rather
than reverting the code (`HARNESS_EXCLUDE`), so the rng stream and every other
input stay identical and the arms differ by one thing. `HARNESS_SEEDS` widens
it. Neither existed before this change needed measuring, and both are the
reason its number is trustworthy.

#### What replaced what, and why

Reported after a `zh` session on a phone: *"tease, apologize, reassure don't
give the option we want in most cases."*

- **`tease` -> `flirt`.** `tease` is barbed by construction, and in a game
  whose entire subject is two women falling for each other there was **no way
  to simply be warm about it**: `touch` is physical and gated at `intimacy >=
  50`, and everything else is deflection or pressure. Flirting is the register
  the genre actually runs on, and it inherits `tease`'s mechanical role intact
  - loud, deniable, and therefore unable to move admissibility (below), and
  locked in the `sharp` jealousy band, where being playful about it is exactly
  as wrong as teasing was.
- **`reassure` -> `care`.** `reassure` only ever fit one situation - she is
  unsettled about where your attention has been - so it had nothing to say
  when she was simply tired or hurt. `care` covers both, keeps the `piqued`
  conversion (section 5b), and is **safe in `rift`**, which finally gives the
  strain bands a move that is not `apologize`. Apologising presumes fault;
  most of the time nobody is at fault and she just needs somebody to notice.
- **`casual` is new.** There was no low-stakes move at all. `joke` is
  specifically humour and `deflect` is specifically evasion, so a player with
  nothing in particular to say had to pick a tactic. Most turns are not
  tactics.

`deflect` is unchanged and already reads as *change the subject* in both
locales - that request was already built.

#### The chips were never actually shuffled

The vocabulary complaint had a mechanical cause underneath it, and it is worth
keeping written down because the code looked completely reasonable:

```js
available.filter(...).sort(() => rng() - 0.5)   // NOT a shuffle
```

`Array.prototype.sort` with a random comparator does not produce a uniform
permutation - on a short array it barely permutes at all - so **position in the
`STANCES` array decided how often a stance was offered.** Measured over 2400
sets on a calm mid-game relation: `tease` (element 0) appeared in **41%**,
`reassure` (element 1) in 33%, `apologize` (element 9) in **23%**.

So the player was not tired of the vocabulary. They had been shown the top of
an array, every turn, for an entire campaign, and reasonably concluded the game
only had three verbs. Fixed with a seeded Fisher-Yates.

**The lesson is the one this project keeps relearning**: the report named a
symptom (*"these tones are wrong"*) and the cause was two layers down. Fixing
only the vocabulary would have shipped a new set of three stances stuck at the
top of a new array.

`systems/chips.js` resolves which stances are legal from stage, strain band,
jealousy band and energy, and which the situation is actively asking for. That
resolution is pure, deterministic and free, and it is the source of truth for
what may be offered. Nothing below is allowed to widen it.

### Written chips

A bare `[ Tease ]` is legible but generic - it reads the same in week 1 and in
the middle of a fight. So the label may be **written by the model for this
moment**, while the stance underneath stays exactly what `chips.js` decided:

```
[ You're doing that thing with your hands again ]     -> flirt
[ I'm not going anywhere ]                            -> care
[ So. The schedule. ]                                 -> deflect
```

The stance is what the game acts on. The label is what the player reads. Keeping
those separate is what lets the writing improve without any mechanic changing.

#### The written set may not be a different set

**The stance is what the game acts on**, so which stances the model is offered
is a mechanic and not a detail of the call. It was written as
`available.slice(0, 6)` and that is the head of the `STANCES` array - `flirt,
care, casual, deflect, joke, press`, byte-identical in every scene of every
campaign ever played.

`touch`, `invite` and `confide` are at indices 7, 6 and 10. **The only three
stances that can move admissibility could never be written**, and because a
written set replaces the static one wholesale, the slot `generateChips` reserves
for exactly them was destroyed on every turn the model answered. Played:

> I saw the option with a small circle noted on it to be seen, but the option is
> changed to LLM options... we now need to click the need to be seen option very
> fast before LLM options come.

A public risk, reachable only by out-racing an API call. That is the third time
this project has made the second axis unreachable - after `markRisk`, and after
the bar that filled with warm verbs - and the third time the cause was **a
deterministic slice of an ordered array standing in for a choice**, which is the
same defect as `sort(() => rng() - 0.5)`.

Two rules, and the first is the fix:

1. **The field is built, not sliced.** Everything the static bar is showing,
   then a sampled remainder, capped at six. A written set is a relabelling of
   the move the game dealt, plus room for the model to pick a better one.
2. **A dealt risk keeps its slot.** If the bar was holding one and the model
   writes three warm verbs, the risk stays and loses only its label - degrading
   chip by chip, which is what this whole subsystem does everywhere else.

Neither widens what is legal. `chips.js` is still the source of truth.

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

#### Turning to somebody is a new moment, so it asks for new chips

Written labels belong to an addressee, not only to a turn. `chips.js` resolves
legality from **her** stage, strain band and jealousy band, and the label is
what the player says **to her** - so a set written for answering Nana is the
wrong set the instant the player turns to Yeri.

The bar knew half of that and not the other half. `turnTo` correctly dropped
the written set, and nothing asked for another, so **turning to somebody
downgraded the player to static labels until they had spent a turn** - and in a
group scene, where turning is the commonest move there is, that is most of the
scene. Reported in play as the options going dead on tapping a portrait, which
is exactly what it looked like from outside.

It costs one chip call, on the same prefix, at no turn - which is what the
call was already priced at. Two consequences carried over unchanged: the static
set is on screen the whole time, so nothing is ever awaited; and the token
still moves, so a set for the member the player just turned *away* from is
discarded when it lands.

The directive also names the addressee in a group scene, for the same ~6 tokens
it takes to say so. Without it the model writes the player's next line at
whoever last spoke, which after a turn is somebody else.

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
flirt|You're doing that thing with your hands again
care|I'm not going anywhere
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

That keeps the value - the model knowing `care` is the live move is the point
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
`Read her` is a limited action. It requests a thought-only response (~30 output tokens, full prefix cache hit).

> **Superseded on the ration and on the mechanism.** "2 uses per scene, or 1
> Energy" is now **energy alone** - see section 10, which has the argument and
> the six milestones in which nothing spent it. And it no longer appends a system
> note to the scene buffer: Part I.2 makes it an ephemeral branch off the prefix,
> because committing it would put a note between two rounds and cost the prefix
> on every round after.
---

## 7. Memory Architecture

> **SUPERSEDED by Part I.5 - five blocks become three tiers, and the dossier is cut to three categories. Canon (below) survives unchanged.**

Five prompt blocks; four of them frozen while a scene is open.

| Block | Structure | Lifetime | Size |
|---|---|---|---|
| 1 | **Static system** - rules, format contract, identity, all cast cards | whole run, byte-stable | ~2200 tok |
| 2 | **Ledger** - append-only one-sentence scene summaries + macro state | whole run | ~1200 tok |
| 3 | **Dossier** - learned facts, **only for members present in this scene** | rebuilt at scene start | ~60 tok / char |
| 4 | **Scene header** - roster, time, location, exposure, standing, canon, gift note | rebuilt at scene start | ~150 tok |
| 5 | **Scene buffer** - dialogue turns in the current room | **purged on exit** | grows |

There are **three** memory stores behind those blocks, and they answer three
different questions. Confusing them is how a design ends up trying to widen the
ledger:

| store | question | shape | compacts? |
|---|---|---|---|
| **ledger** | what happened, in order | one sentence per scene | **yes** - and eventually drops |
| **dossier** | what she knows about you | per member, five categories | LRU / FIFO per category |
| **canon** | what the group decided | per topic, run-level | **never** |

### Canon

> **Built 2026-08-24.** `systems/canon.js`, written by the event scene-exit
> call, chained through `reads`, injected into block 4, shown to the player in
> the handbook, persisted at `schemaVersion` 3. The one part not built is the
> per-cycle stakes clause - see section 10.

The two stores above cannot hold a decision, and an anchor event is a day that
makes decisions. `dossier` is per member and scoped to the room, so it is the
wrong shape - everybody in X knows what the group chose. `ledger` is chronology
that compacts and drops, and it spends its one sentence on whatever the scene
was emotionally about. **The played evidence is unambiguous**: fifteen turns of
a meeting that picks a comeback concept produced a ledger line about a plate of
food.

So `run.canon`, a list of what the campaign has settled:

```js
canon: [
  { topic: 'title_track',                      // an id from the event's `agenda`
    text: 'the title track is Surfin Summer',  // ENGLISH, for the prompt
    display: '主打歌定为 Surfin Summer',         // meta.lang, for the player
    cycle: 0, phase: 'prep', slot: 'event_a' },
]
```

**Two texts, for the reason section 12 already learned once.** Memory is English
so a language switch cannot corrupt it (section 19 rule 2) - which means the
player-facing handbook would otherwise show a `zh` player their own campaign in
English. `learnableFacts` made exactly this mistake and the fix was the same:
one id, a canonical English string, and a display string per locale.

**Storage and injection are separate, and that is what keeps it simple.**

| | rule |
|---|---|
| **storage** | complete, never compacts, never reordered. This is what the player reads. |
| **injection** | filtered and capped at ~6 lines of block 4 |

Only the ledger has to fit inside a prompt, so only the ledger needs a
compaction rule. Canon does not inherit that constraint, which is why "what
happens when it fills up" is not a question anyone has to answer.

What block 4 carries depends on the scene:

- **ordinary block** - two or three lines of the current cycle. This is the half
  that makes canon *visible*: Irene mentioning the title track in a wardrobe on
  a Tuesday is pillar 4 working, and it costs nothing block 4 was not already
  paying.
- **anchor event** - the topics its `reads` field names, plus the same-slot
  entries from previous cycles, which is what lets a second concept meeting
  escalate rather than repeat.

Capped, because block 4 is ordered by immediacy (section 8) and eighteen world
facts would drown the standing sentence - the one line in there that makes every
reaction proportionate.

**And the player can read it.** `ui/modals/HandbookModal.jsx`, opened from the
day screen and free - a room action would read as costing a block, and reading
your own notes must not. Section 10's "do not privilege it visually" argument is
about *choices*; a reference list is not one, and the opposite rule applies.

It shows `display`, grouped by cycle, newest first. Without this canon would
reach the model and never the player, which is the exact failure pillar 4 exists
to forbid: **memory that shows in mechanics, not only in prose.**

### The same lesson, the second time: the relationship row opens

`ui/modals/RelationsModal.jsx`, and it is the handbook's argument again in a
place nobody expected to need it. The day screen has printed every member's
stage and intimacy since M4 - and the player went looking for a menu that was
already a row:

> And no UI display the character's intimacy value in the game... should also
> find a place/menu in outside scene - the game main screen - to present
> character's intimacy & emotion stage

**A thing the player has to discover is a thing that does not exist.** So the
row is a button into a `Sheet`, free and costing no block, for the same reason
the handbook is.

**And it is the first place `admissibility` has ever appeared in the UI.** That
is half the relationship model - it decides the plateau, the public date and
four of the endings - and a one-line row had no room for a second number, so a
player could not see there *were* two, let alone that one of them was stuck.
The panel carries both axes, the standing sentence in the player's language, the
jealousy and strain bands when there is something to say, and what the plateau
wants.

**Nothing goes on the scene screen.** Pillar 1 is the player *reading* hidden
state, and section 6 already gives the scene bar standing in words beside the
three volatile meters. A readout there retires `Read her` in one stroke.

`standing.*` in `i18n/` is player-facing, second person, and deliberately not
the `STANDING` table in `promptBuilder.js` - that one is model-facing English
that never localizes. Same sentence, different reader, allowed to drift.

**Written by events only, and validated rather than trusted.** The scene-exit
call gains `decisions: [{ topic, text }]`, parsed through the same four-level
tolerant fallback as the rest of the summarizer. Then:

> **A decision whose topic is not in this event's `agenda` is dropped
> entirely.**

That is section 9's roster rule in a new place, and it is here for the same
reason: prompting alone will not hold it. A model asked what a room decided will
happily report a decision the room never reached, which is the `learnableFacts`
problem again - **a fact awarded for nothing is worse than a fact never
awarded.** A topic the day did not reach is simply absent; there is no filler
and no placeholder, and the only consequence is that the next event in the chain
reads one line fewer.

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

> **SUPERSEDED by Part I.5. The cache argument is unchanged and still correct; only the block count and the language split differ.**

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

> **SUPERSEDED by Part I.4. The tolerant-parser discipline survives; the beat contract does not.**

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

#### ...and it carries the language, because it is the one beat with nothing behind it

**This is where the language split lives.** Reproduced on a phone, in `zh`, at
the opening beat of an anchor event:

```
She is already at the table, a printout held at an angle, and it takes her a
second to look up. "坐吧。咖啡刚倒的，还热。"
```

English action, Chinese speech - the exact reported shape, and the player had
never switched language. One tap later, every following beat was Chinese and it
never recurred in that scene.

That last detail is the whole diagnosis. **Block 5 is empty on the opening
beat**, and it is the only turn in the game for which that is true. Every later
turn has Chinese sitting immediately above the generation - her last beat, the
player's chip - and the model simply continues in the language it can see. On
turn one there is nothing to continue: the model's entire recent context is
English, because everything above block 5 is English *by design* (section 19
keeps memory language-agnostic), and the last thing it reads is an English
instruction telling it to write an opening beat.

An anchor event is the worst case and that is why it surfaced there: block 4
gains `## The day` and `## How to write this one`, so there is even more
English immediately before the turn.

The `## Language` reminder in block 4 was aimed at this and does not reach it -
it sits above the frame, the register, and the English directive. So
**`openingDirective` takes the language and states it inline.** It is the last
thing the model reads before the only generation with no prose behind it, which
is exactly where the instruction has to be.

Note what this does *not* do: it does not add the reminder to every system
note. Mid-scene notes are followed by generations that have plenty of Chinese
above them, and section 8's cost argument still applies. One turn has the
problem; one turn gets the fix.

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

### Anchor events: six of them, two per phase

`data/events/` holds one authored event per event slot on the three phase maps
- concept meeting, MV shoot, Music Bank, fan meeting, company cruise, island
day. Each takes a weekday and the whole of it, and each **fires exactly once in
the campaign**: `flags.firedEvents` holds `phase:slot` keys, `generateWeek`
filters on it, and the site leaves the map at the same moment. A phase that has
spent both of its events goes back to ordinary working days.

**Two slots per phase, and PREP having only one was a hole rather than a
preference.** The concept meeting had nothing to hand off to, so a comeback
cycle decided its concept and then never showed it being made - while the group
activity `mv_shoot` had been on the calendar since M1 with no authored day
behind it. `mv_set` closes it, at `exposureBase` 70, which gives the four
working-cycle events a visibility ramp: **35 -> 70 -> 90 -> 88.** A gesture at
the concept meeting is safe and cheap; the same gesture at the fan meeting is
the loudest thing in the game. That ramp is the cycle's shape expressed as one
number per site.

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

### A day that decides nothing is a day nobody remembers

Reported after the first played concept meeting: **"not distinguishable from
ordinary group chat."** Fifteen turns that were supposed to choose a comeback
concept produced a joke about ear colour and a plate of food, and the ledger
line for the whole day went to the food.

Nothing about that is a model failure, which is what makes it worth writing
down. Read what the frame actually asked for: *the boards going up, and which
one she reacts to before she can stop herself*; *the part of the concept that
asks something of her specifically*; *an idea getting cut, and the room going
carefully polite.* Every movement is an emotional situation and **not one of
them says a title track gets chosen today.** The model was asked for feelings in
a meeting room and it delivered feelings in a meeting room.

Two things were missing, and they are different things.

**Nothing established the day.** Every scene in the game opens with
`openingDirective` - one member's beat, what she does in the moment she notices
the player has walked in. That is exactly right for a wardrobe on a Tuesday and
wrong for a room the whole cast is already sitting in for a stated purpose. So
an event gets an **establishing beat** first: one paragraph, about forty words,
what the room looks like and what the day is here to do, and then the ordinary
loop. Its own call, deliberately - nothing about the section 9 contract changes
and the parser's roster rule is not asked to grow a case for prose with no
speaker. `speaker: null` is the whole of what makes it narration on screen, and
the name plate is simply not drawn, because nobody said it.

**Events only.** Pillar 1 is 30-50 word bursts and the *contrast* is the point -
a game that establishes every room has stopped establishing anything. A date
already opens on atmosphere in her own beat, and the `event` register no longer
asks for it a second time.

It carries the language, and that is a trap rather than a nicety: **this call
now owns the empty block 5**, which is the exact condition that produced the
language split (section 9), and an anchor event was already that bug's worst
case. The opening beat that follows is no longer the scene's first generation
and has this paragraph's prose above it, which is where the model reliably
continues in the right language.

**And the frame was all mood and no business.** So a frame may carry an
**`agenda`** beside its movements: two to four things the day must decide - the
concept, the title track, the styling, the centre position. A separate field
rather than four more movements, precisely so the rule above survives: a
movement sets the situation and never the outcome, and an agenda item names
**what** gets settled and never **which way**. Which way is still the scene's
job, like everything else here.

Block 4 says it as an obligation where the movements are offered (*the day is
here to settle these, and it does not end until it has*), and the closing
directive says it once more on the turn the client knows is last. The rendered
block also states outright that not everything has to go anyone's way - a room
told to decide four things will otherwise agree pleasantly about all four, which
is small talk wearing a suit.

**This is two of the three deficits, and doing only these two produces a
livelier meeting that still forgets itself by Tuesday.** There is nowhere to
record what the room decided: the dossier is per member, and the ledger is
chronology that compacts and drops - and the played transcript is the evidence
for what a single sentence spends itself on, because it chose the plate of food.
That is `run.canon`, and section 7 has it.

### Four of them recur, and two are punctuation

**Built 2026-08-24.** Five events per campaign meant cycles 2 and 3 had no
authored beat at all, and week 9 was the quietest stretch of the game. So
`flags.firedEvents` keys on `phase:slot:cycle` and four events come back every
cycle, in a chain where each reads what the one before it settled:

```
prep_a concept meeting -> prep_b MV shoot -> comeback_a music bank
   ^                                                 |
   +------- comeback_b fan meeting <-----------------+
```

**A chain has a direction, so `event_a` always falls on the earlier weekday.**
`eventDays` deals the days at random and then hands them to the slots in order.
Dealt at random *and* assigned at random, half of every two-event week ran
backwards - reported on the first played PREP week as the MV shoot happening
before the concept meeting, which is a shoot filming a concept nobody has
chosen. Nothing about the scene was wrong; `reads` was pointing at a day still
in the future. Which days are used stays random, so the week still varies;
only which slot gets which is fixed.

`company_cruise` and `island_trip` stay **once per campaign** and stay out of
the chain, for two reasons that both come from elsewhere in this document.
**REST is the repair week** - two mandatory whole-cast days out of its five
weekdays works against the one week whose job is converting jealousy before it
hardens. And **an event day generates no daily task**, so event days are a
supply line as well as a schedule: six recurring events would take 40% of the
working weekdays and cut credits by roughly the same, against a campaign that
already ends with 0-2 of them and 36 unspent facts. Four recurring plus two
punctuation is ~31%, and the harness measures it before any of it merges.

### The second comeback must not be the first one again

**Built. Two mechanisms, and they are not alternatives.**

The chain worked exactly as designed and that is what caused the failure.
`concept_meeting` reads its own previous `concept` and `title_track` precisely
so a second meeting can escalate rather than start from nothing - and handed its
own last answer, the model reproduced it. Played, week 4:

> Oh no she's talking same concept of 1st concept.
> Oh no, the song name is same as 1st comeback, and the concept is similar.

**Reading the previous cycle and being different from it are two instructions,
and only one of them was being given.**

| | what it does | where it lives |
|---|---|---|
| **stakes clause** | continuity - the second meeting knows it is the second, that the last one is recent enough for a repeat to be noticed, and that the third is the one the year gets remembered by | authored, one line per cycle per recurring event, `data/events/` |
| **style pools** | difference - a **sound**, an **occasion** and a **place**, drawn per cycle | `data/comebackStyle.js` |

**Drawn without replacement across the campaign**, which is the whole point and
the one thing an independent per-cycle draw cannot promise: three cycles drawing
from an eight-entry pool collide about a third of the time, and a collision is
precisely the defect. Each pool is shuffled once from the run seed and indexed
by cycle, so different runs get different comebacks and no run ever repeats
itself.

This is the calendar's own argument applied to content. The schedule is
deterministic and seeded because it is replayable, testable, instant and free,
and *the LLM may write a flavour label; it may never decide the slot.* A comeback
concept is a slot. **Three dice make cycle 2 structurally unable to be cycle 1,
where a clause only asks it not to be.**

**It reaches the model as pressure, never as three nouns.** A prompt that says
`{jazz, christmas, forest}` produces a room reciting three nouns at each other.
It arrives as what people outside the room want - what the label has been
pushing for, what A&R keep bringing up, what is in the director's reference
folder - so the room can argue with it. Same rule the `agenda` follows: name
what is at stake, never which way it goes.

**The concept meeting alone gets the pools**, because it is the only event in
the chain that invents rather than inherits. Everything downstream is already
constrained by what that room settled.

`eventFrame(event, { cycle, seed })` is the join, and it is **derived, never
stored**: `(seed, cycle)` reproduces a comeback exactly, the same reason
`focusId` and the calendar stay out of the save file.

### The shoot has to actually shoot

**Built.** One complaint, stated three times in one played session:

> Still No description of MV shooting scene.
> Same issue - no description for comeback stage performance.
> Still no fan-meeting description.

An anchor event produces a room full of women *talking about* the day. The
concept meeting survives that, because a meeting **is** people talking. The
other three do not: a shoot is a shoot, Music Bank is a stage, and a fan meeting
is nine hundred albums and the people who bought them. What the player got at
all three was a green room.

**Not a model failure.** Every mechanism an event has - `movements`, the
`agenda`, the addressee, the interjection - produces dialogue *between cast
members*, because that is what the whole engine is built to produce. Nothing in
it can represent a thing happening **to** the room.

**Narration, not an NPC.** A director with a speaker id is the right instinct
and the expensive answer, and it bends three load-bearing rules: the parser
roster rule would grow a case for somebody who is not a cast member, `presentIds`
would need a hand exclusion, and portraits, meters and the addressee row are all
per cast member. The establishing beat already does the job and bends none of
them - and it was singled out as good in four separate places in the same
report.

So an event carrying `physical: true` gets **one more establishing-shaped beat
at the two-thirds mark**: `speaker: null`, no name plate, no roster entry, no
jealousy, no new rules. It asks for the **work** rather than the mood - a take,
a reset, the light going, the queue moving - because the room was established
forty words ago and the work is the one thing dialogue between five friends
cannot show.

`establish` and `interlude` are one `narrate` with a different sentence in it.
The properties that matter - unparsed, metadata stripped, silent on failure -
belong to the shape rather than to either use. The client decides *when*, for
the same reason it owns the closing directive: only the client can see the turn
budget.

If a played event still reads as people in a room after this, the NPC is the
next step and PROPOSALS 23 has the argument for what it costs.

### An event day is the event, and nothing else

"It takes the whole day" was on the day screen from the start and **nothing in
the game enforced it.** Played, the concept meeting was one row on a map that
still offered four other rooms, a daily task in the wardrobe, and five
individual chips at the meeting-room door. The whole cast was standing in a
room the player could walk past.

Three rules, and each is the same sentence said to a different part of the
code:

1. **No daily task.** Section 10's own assembly order places the event day
   *before* the task, and `generateDayTask` never knew about it - so the
   agency asked for the outfits on the day it had put everyone in a meeting.
2. **The map is the site.** On an event day the overworld is one row, and the
   dorm is not on it. Not a banner and not a modal - the way in is still
   walking there, there is simply nowhere else to walk.
3. **Walking in is joining them.** The site offers no 1v1 and no snoop. An
   anchor event is the whole cast in one room by definition, and offering
   *"talk to Jisoo, the others are nearby"* at the door of one turns the
   loudest day in the game back into an ordinary block that happens to be
   crowded.

Rule 3 is the one with a design argument behind it rather than only a bug.
Section 10c's addressee already lets the player spend an event on one member -
**inside** the scene, in front of the other four, where it costs what it should.
Picking her at the door skips the room entirely.

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

**And it names the axis it was short on.** For a long time both gates returned
one reason - "not yet" - which tells the player nothing about *which* of two
completely different questions they failed. Reported as *"Oh no we have no
dating access to anyone."*

So there are two: **not close enough** and **not nameable enough**, derived from
the kind's own axis rather than hardcoded, and worded without a number - *she
would spend the day with you; somewhere people could watch her do it is another
question.*

The ask underneath that report was for `intimacy` on the scene screen, and the
answer to that is no: pillar 1 is the player reading hidden state and betting on
it, and `Read her` is rationed so that reading her costs something. Naming the
axis is the opposite of a readout - **the hidden state becomes legible through a
decision the player made.**

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

**A lit door means she is behind it**, and nothing weaker. The light was drawn
from "is she anywhere in the dorm", so a member standing in the kitchen lit her
own door as well - and the map showed Nana in two rooms at once on the second
evening anybody played. The routine layer already answers the exact question:
she is in `dorm_room` on the evenings that are hers, and in the kitchen on the
ones that are not. Anywhere-in-the-dorm is still the right test for the dorm
*row* on the overworld, which is why one constant served two questions for as
long as it did.

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

#### ...and for six milestones it was not the sink, because nothing spent it

**`ENERGY_PER_READ` existed, was documented, and had no reader.** The paragraph
above has been in this file since M1 and the constant has sat in
`config/constants.js` under the comment *"Read her costs one on top"* - while the
scene screen rationed the action with a **per-scene allowance of two** and
charged no energy at all. Every number in the arithmetic above was right and
none of it was happening.

The `markRisk` shape again, in its quietest form: **a number being ignored looks
exactly like a number being small.** No test could see it, because every test
supplied its own count.

Two counters for one action was also one too many, and the per-scene one was the
wrong half. **An allowance that resets at every door can never be a decision** -
nothing about it survives the block, so it cannot trade against anything. Energy
is the only resource in the scene that carries a choice into the next one, which
is the whole of why section 10 named it. `READ_HER_USES_PER_SCENE` is deleted.

Three rules, all asserted:

1. **The engine charges it, not the screen.** `session.player` is the scene's
   only copy of energy and `endScene` hands it back, so a screen that spent it
   would be writing state it does not own. One number, one owner - the rule the
   `affection` rename cost a day to learn.
2. **Charged on the answer, never on the ask.** A failed call is not a look
   inside her head, and a provider having a bad minute must not also drain the
   day. Same rule the date bill follows: she turned you down, you did not buy
   her dinner.
3. **It refuses rather than going negative**, so the one rationed action in the
   game can never strand the player at zero.

The control shows the **price** now, not a remaining count - the same number
every time, going dead when it can no longer be afforded, which is exactly the
state a price is there to make visible.

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

**Walking in is not spending the block, and the room has to say so.** The block
is paid by the action, and until the player picks one nothing at all has
happened - but the room screen had no way back, so opening a door to see who
was in it was a commitment. That reads as the opposite of what this section is
built on: a map is only a *search* if looking is free. The way out is a plain
`back` in the header, the same shape the dorm already uses, and it costs
nothing because nothing has been spent.

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

> **SUPERSEDED IN PART by Part I.10 - gifts are no longer knowledge-gated and the opener sheet is retired. The economy itself survives.**

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

**Except how her name is SPELLED, which is on the card.** A `zh` run called
Irene *Yilin* and Hyewon *Huiyuan* - transliterations the model invented on the
spot, differently in different scenes, because nothing ever told it how these
names are written in Chinese. `nameLocal: { "zh": "..." }` sits beside
`nameRoman` as the same kind of thing: how this person is written somewhere
other than English.

It is on the card rather than in `i18n/` for two reasons that point the same
way. **`agent/` never imports `i18n/`** - that module's own header says the two
paths never mix, because one is UI strings and the other is a prompt - and a
**custom card cannot ship an i18n file at all**, which is the argument section 12
already made for facts. Absent, the Latin stage name stands, which is normal in
Chinese K-pop writing and in every case better than an invented spelling. The
speaker id stays ASCII in every locale (section 9); only the prose changes.

**Semantic fields stay English.** `personality`, `speechStyle`, and `queerTexture` are authored once in English and translated by the model at generation time. This keeps cards portable across locales and keeps them a single source of truth. `styleHints` is the escape hatch for locale-specific voicing that a generic translation flattens - Korean honorific level, Chinese sentence-final particles - and is `null` unless a locale actually needs it.

**It is read in block 4, beside `speechStyle`, and for six milestones it was
not read anywhere.** The field has been on the schema since M0, this paragraph
described what it was for, every card had `null` in it, and nothing in
`agent/` ever looked at it - a designed slot with no consumer, which is the
`markRisk` shape in its mildest form. Mild only because every hint was null, so
the absence was invisible.

It matters because `speechStyle` is authored in English and describes an
*English* voice. "Measured and short. Understates everything" rendered word for
word is a woman speaking translated English, which is exactly what a native
reader reported (section 19). Her reticence in Chinese is made of different
material. All five of the MVP cast now carry a `zh` line; the library cards
deliberately do not, and the English card stands - the same rule `nameLocal`
follows. English never gets one and never should: it is the language the card
is written in, so a hint would be the card said twice.

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
  canon:     [ { topic, text, display, cycle, phase, slot } ],  // section 7
  calendar:  { weekPlan, todayTask, taskState },
  flags:     { firedEvents: [], repairUsed: {} },
  scene:     null   // volatile; never serialized
}
```

`canon` is **designed and not yet built** (section 7). When it lands it is a
`schemaVersion` bump plus a `fromSave` default, so a save written before it
loads with an empty canon rather than `undefined` - the same merge rule
`relations` already follows.

`flags.firedEvents` changes shape in the same step, from `phase:slot` to
`phase:slot:cycle`, which is what lets an event recur. That one **needs an
actual migration** rather than a default: a two-part key matches nothing under
the new scheme, so an untouched old save would replay every anchor event the
player has already had. `fromSave` appends `:0` to any key with two parts.
Worth writing down because it is the quiet kind of break - the save loads, the
run continues, and the concept meeting simply happens twice.

`scene` is deliberately excluded from saves: the memory design says a scene is ephemeral, so saving mid-scene means saving at the room door.

Save key: `yuriagent_saves_v1`. On load, unknown or missing fields fill from defaults rather than throwing.

**Six slots: one that writes itself, five the player writes.** The day boundary
is the only moment the schema permits either of them - a scene is ephemeral, so
a save taken mid-scene is a save taken at the room door.

An earlier draft of this section argued for a single automatic slot, on the
grounds that there was nothing for the player to decide and a save screen would
be the only bookkeeping in a game with none. The first half of that is still
true and the second half was wrong about what a slot is *for*. A campaign is
nine weeks and every route is a decision that cannot be taken back; one slot
means the player can never look at a fork twice, and the game is *about* forks.
Branching is the content.

So the autosave stays exactly as it was - `auto`, written at every day rollover,
never a decision - and five numbered slots sit beside it that the player writes
deliberately. Nobody has to think about saving, and anybody who wants to can.

Three rules:

1. **Manual slots survive a restart.** `restart` clears `auto`, because the
   autosave belongs to the run it was taken from. The five are the player's and
   outlive any particular campaign.
2. **A slot is legible before it is loaded.** Week, day, player name and whoever
   currently holds the highest intimacy - derived at read time, never stored,
   the same rule `focusId` follows everywhere. Two saves of one campaign are
   otherwise indistinguishable, which defeats the point of having several.
3. **Overwrite and delete both confirm.** They are the only destructive actions
   in the game and a mis-tap costs a campaign.

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
    debugLog.js              # the call record; window.yuri.dump()
    eruda.js                 # ?debug=1 -> an in-page console, for iOS
    liveEnv.js               # test-only: reads .env.local. Never imported by the app.
  data/
    characters/*.json        # cast: irene, nana, jisoo, hyewon, yeri
                             # library: seulgi, wendy, joy
    identities/*.json
    activities.js            # group / solo / idle activity tables
    locations.js             # exposureBase + presence + zone per location
    comebackStyle.js         # seeded sound/occasion/place pools, drawn per cycle
    soloActions.js           # what the assistant does in an empty room
    gifts.js
    cast.js                  # card loader; PROMPT_EXCLUDED_FIELDS
    events/                  # anchor nodes
  ui/
    vn/                      # VNStage, Portrait, DialogueBox, ChipBar, MeterBar,
                             # ThoughtBubble, SceneHeader, beatQueue
    map/                     # LocationGrid, DormMap, WeekCalendar
    modals/                  # Sheet + GiftModal, SettingsModal, SaveModal,
                             # HandbookModal, DateModal, RelationsModal
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

### Two deployments, and only one of them is a release

`bash deploy.sh` publishes the current branch to GitHub Pages. That is not a
contradiction of "deploy only from `main`" - it is a second thing with a
different job.

The game is designed for a 390x844 phone and was, for six milestones, only ever
played on a desktop. A build nobody can open on a phone cannot be tested on the
device it is for, and the fixes that matter here have all come from playing.
So: **the Pages site is the hand-test build; a tag from `main` is what players
get.** The distinction is worth keeping sharp, because a URL that is sometimes
a release and sometimes a work in progress is neither.

`deploy.sh` runs `lint` and `test` before it builds. A red build must never
become a URL somebody is testing against - a bug report from a broken deploy
costs more than the deploy saves.

**It publishes a branch rather than going through Actions**, and that was
learned the hard way. The Actions route needs three server-side things to line
up: Pages enabled, a `pages: write` token, and a `github-pages` environment
whose deployment branch policy permits the branch. GitHub creates that policy
**hardcoded to `main`**, so deploying `dev` failed at environment resolution in
two seconds - before step one, with no log line saying why, while
`configure-pages` in the job above it reported success. A branch push needs
none of that. `.github/workflows/ci.yml` still runs the suite on a clean
checkout, which is worth having on its own terms.

**Publish the whole `dist/`, never a list of file types.** The obvious script
copies `assets/*.js` and `*.css` and it is quietly wrong here: the PWA needs
its `manifest.webmanifest`, its `sw.js`, its icons and its portraits, and a
copy rule that names extensions drops all of them - a site that loads and
cannot install, with no faces. `deploy.sh` asserts the build is complete before
it pushes, for the same reason section 21 asserts everything else.

**The key is not in the deployment and cannot be.** It is entered by the player
into `localStorage` on their own device (section 22), and the provider names in
`.env.local` deliberately carry no `VITE_` prefix, because Vite inlines every
`VITE_*` variable into the client bundle at build time. `tools/liveEnv.js`
imports `node:fs`, so it could not enter a browser build even by accident -
that is a structural guarantee rather than a convention, which is the right
shape for this particular rule.

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

**Status: M0-M5 complete, and deployed.** A campaign runs from the cover screen
to the endings screen, saves itself, and installs. It is live at
`https://byhAnita.github.io/yuriagent/` - published from `dev` by
`bash deploy.sh`, which is the hand-test build and not the release (section
17). Five sessions have been played by hand, the last two on the phone the game
is designed for.

**PROPOSALS 20 is complete**, and so are 22-26 - the five questions the
day-three playtest left open, all built on 2026-08-24 after Yuhan went through
them and took the recommended option in each:

| # | What shipped | Where |
|---|---|---|
| **24** | seeded style pools + the per-cycle stakes clause, so cycle 2 cannot be cycle 1 | section 10 |
| **22** | the `work` stance; `deflect` gives up the common slot | section 6 |
| **23** | a mid-event interlude for the three events that DO something | section 10 |
| **26** | `zh` prose rules, and `styleHints` finally read | sections 12, 19 |
| **25** | a refusal names its axis; the relationship row opens into a panel | sections 7, 10 |

**The day-three playtest also found the largest bug the chip system has had.**
Written chips offered the model `available.slice(0, 6)` - the head of the
`STANCES` array - so `touch`, `invite` and `confide` could never be written and
the slot `generateChips` reserves for them was destroyed on every turn the
model answered. Section 6 has it. Two things worth carrying: it is the third
occurrence of a deterministic slice standing in for a choice, and **neither
harness could see it, because neither calls `writeChips`** - so every
admissibility figure measured before 2026-08-24 is an upper bound.

**Nothing in 22-26 has been played by hand yet.** The offline suite, both live
suites and a twenty-seed sweep are green; what none of them can judge is
whether a comeback now feels like a different comeback, whether the interlude
reads as the day happening or as furniture, and whether the Chinese still reads
translated. That last one has no test and cannot have one - the measure is a
native reader (section 19).

Running state, what is done and what is still open, lives in
`docs/PROGRESS.md` - that file is updated *before* a milestone closes, and it
is what makes compacting this session safe. Design changes that have been
argued for but not made live in `docs/PROPOSALS.md`; read it before touching a
coefficient.

M1 before M2 is deliberate: the relationship model is the product, and it must be correct before a single token is spent on it.

---

## 19. Multilingual Design

> **SUPERSEDED IN PART by Part I.6 - rule 2 (memory always English) is REPEALED. Rules 1 and 3 stand.**

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

### ...but a name is not prose

Rule 2 is a rule about **prose**, and a name is not prose. Found live: a `zh`
concept meeting settled a title track and wrote the memory line as *the
road-trip demo titled 《...》 was chosen as the title track* - English sentence,
Chinese title - with the same title in `display`.

That is correct, and demanding an English title would be the `learnableFacts`
mistake again: **it invents a second name for one song.** The model would then
say the English one in Chinese prose, and the player would read a different
title in the handbook from the one Irene says out loud. One id, one name, two
*sentences* around it - the same shape `nameLocal` gives the members
themselves.

So the assertion strips quoted and bracketed spans and asks whether what is
**left** is English. A bare Chinese word in an English sentence still fails.

### Writing Chinese is not translating English

Reported by the only person who can report it - a native reader:

> the Chinese expression are very awkward and strange, not native. "cables
> crawling along the ground like black snakes", "settle the skeleton of the
> whole video" - feels like using a machine translation from English to Chinese.

**The cause is upstream of the prose.** Everything the model reads before
writing is English - the cards, the ledger, the dossier, the frame, the
register, the agenda - because rule 2 keeps memory language-agnostic *on
purpose*. It is being asked to write Chinese from an English brief, which is
the definition of translationese. Note what both reported examples are: **stage
directions**, which come most directly off the English frame and are exactly
where a simile survives being carried across word for word.

The proposed fix was to write memory in `zh`, and that is the one thing that
must not be done: it trades a prose problem for a data-integrity one, and a
player switching language mid-run would corrupt their own history. Two cheaper
things reach the same place:

1. **The `zh` block says how to write, not only which language.** Write as a
   Chinese novelist writes rather than as a translator does; the notes above are
   a brief and not a text to render; prefer the concrete verb to the imported
   metaphor; never carry an English simile across word for word.
2. **`styleHints[lang]`, which is now read** (section 12). Her voice in Chinese
   is not her voice in English rendered word by word.

**The measure is a native reader, not a test.** That is what produced the
finding, and no assertion can stand in for it - the tests here only prove the
join.

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

### Every sheet is bounded, and one component enforces it

**`ui/modals/Sheet.jsx` is the only bottom sheet.** Height cap, its own scroll,
a header pinned above that scroll, and the safe-area inset - once, in one
place, rather than four copies that drift.

They did drift, and the drift was a hard stop. `DateModal` was the one of four
that carried no `max-h` and no `overflow-y-auto`, and the date sheet is the
longest list in the game: **five members x two kinds of date**. It is also
bottom-anchored, so it did not overflow downward where a scroll would have
saved it - it grew *upward*, off the top of the screen, **taking the close
button with it**. On a 390x844 phone that is a modal with no visible way out
and no reachable option: the run stopped there.

Three rules, all in `Sheet`:

1. **A cap and a scroll always.** `max-h` plus `overflow-y-auto`. Content is
   player-sized - five members, eleven stances, six save slots - so no sheet
   may assume its list is short.
2. **The header does not scroll.** The other three modals were bounded and
   still put their close button in the scrolling area, so a long list pushed
   the way out off-screen until the player thought to scroll up. The way out of
   a modal is not something to go looking for.
3. **The inset is the sheet's own job.** A `position: fixed` overlay is laid
   out against the viewport, not against the padded `body` below - so the
   `--safe-bottom` rule in section 20 does not reach it, and a sheet that stops
   at the viewport edge sits under the home indicator.

The rule is asserted rather than reviewed: a test walks every file in
`ui/modals/` and fails on one that builds its own `fixed inset-0` shell.
**Verify long sheets at `fontScale` 1.25 in `zh`** - section 20 has always said
so, and this is what it looks like when nobody does.

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
