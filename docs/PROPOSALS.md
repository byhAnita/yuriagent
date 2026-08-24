# Proposals

Design changes that came out of the post-M4 testing pass, each of which changes
a rule rather than repairing one. `CLAUDE.md` is the design; this file is the
queue of arguments for amending it, and the record of which argument won.

Each entry says what was measured, why it is a problem, what the options are,
and which one I would pick. **Entries marked DONE have been accepted and built**
- the reasoning is kept because the measurement is the evidence for whether the
number should move again. Everything else is still only an argument.

> Evidence throughout is from `src/agent/playthrough.test.js` (189-block
> campaigns through the real engine, offline writer) and
> `src/agent/liveQuality.test.js` (DeepSeek V4 Flash, `LIVE_QUALITY=1`).
> Both are in the repo and re-runnable.

---

## 1. A scene's payout depends on how many beats the model felt like writing

**DONE 2026-08-22 - by changing the contract, not the arithmetic.** The metadata
line now reports **where she is** (`guard58`) instead of how far she moved
(`guard-8`), so the last beat of a reply is the state and beat count stops
mattering. Section 9 carries the contract; section 6 carries the argument.

Four settings were measured at twelve live scenes each:

| prompt asks for | client does | result |
|---|---|---|
| a scale per BEAT | sum | verbose paid: every 21-beat scene, no 7-beat one |
| a scale per BEAT | mean | the bias **flipped**: 5/6 terse paid, 1/5 verbose |
| a budget per REPLY | sum | verbose paid again: 6/7 verbose, 0/5 terse |
| **a reading, 0-100** | **take the last** | guard fell in **12 of 12** scenes |

The first three all failed the same way and it took all three to see why: the
client was reassembling a quantity from an unknown number of pieces, and the
model was choosing that number for prose reasons. Averaging looks like the
obvious fix and is not - handed a per-beat range, the model uses the small end
when it writes three beats and a big number when it writes one, so a verbose
reply moves her *less* in its own numbers however you add them up.

What the change bought, same script:

```
before   guard drops  10, 8, -7, 11, 0, -3, -10, -23, 9, 9, 9, -20
after    guard drops  17, 4,  8, 10, 13, 10,   7,  11, 10, 11, 9, 17
```

Before, half the drops were negative and not one cleared the threshold - the
guard branch was dead and every paying scene paid on fluster. After, **every
scene moves her the right way** and the spread is tight. Guard now behaves like
something that trends across a scene rather than jitters inside one.

Pay rate is 4 of 12 on a deliberately clumsy script (the test player `press`es
twice at intimacy 45), against 6 of 12 before. Thresholds were NOT touched again
to chase that number: the distributions are healthy and one twelve-scene sample
on a fixed script is not enough to move a coefficient the whole first axis runs
through.

Two consequences worth knowing:

- **Block 4 states her opening reading** (`Irene starts this scene at guard55,
  fluster0`), because an absolute needs a scale. It does not violate section 8's
  invariant 2 - that forbids re-injecting a *refreshed* stat block mid-scene,
  and this is stated once in the frozen header and never updated.
- **The offline writer emits readings too**, converting its own delta tables
  against a running state that resets on each opening beat. Offline play is a
  supported mode, so the mock must not speak a dialect the live model has
  stopped speaking. Its magnitudes are still about twice DeepSeek's, so
  **harness payout figures remain an upper bound**, and aligning them would mean
  re-baselining a good many test expectations.

---

## 2. Secrecy is a one-way ratchet that bottoms out by week three

**DONE 2026-08-22 - option 1.** `SECRECY_RECOVERED_OVERNIGHT = 1`, drifting toward
the identity baseline and never past it. Measured after: secrecy floor over a
full campaign went 0 -> 16, so it spends the whole run somewhere that a snoop
decision still costs something.

### Measured

Every 189-block campaign ends with `secrecy` at **0**, reached around week 3 of
9. Snooping costs 1-7 secrecy and nothing anywhere restores it.

### Why it matters

Two things break at the floor, in opposite directions:

- **Snooping becomes free.** Section 10b's first rule is that the cost of
  knowledge is real and lands later. Once secrecy is 0 it cannot go lower, so
  every subsequent snoop is free, and the player learns the remaining facts at
  no price at all. Two thirds of the campaign is played with the cost switched
  off.
- **Exposure is permanently +21.** `(70 - secrecy) * 0.3` becomes a flat bonus
  on every scene for the rest of the run. That is not purely bad - it pushes
  more scenes over the risk threshold, which now helps admissibility - but it is
  not a *decision* any more, and the practice room stops being private.

### Options

1. **Slow recovery.** `secrecy += 1` at day rollover, capped at the identity's
   starting value. A reputation for being nosy fades if you stop being nosy.
   Keeps the value moving inside its interesting band all campaign.
2. **Scale the snoop cost** so it is a percentage of remaining secrecy and
   always bites. Never reaches zero, but the late-game cost becomes negligible
   in absolute terms, which is the same problem wearing a hat.
3. **Leave it, and let the floor be a state.** "Everyone knows you're the one
   who reads things" is a legitimate late-game identity. But then it wants to be
   *visible* - a named condition on the day screen, not a silently pinned stat.

**Recommendation: option 1**, at +1/day. It is one line in the day rollover and
it makes the whole campaign's worth of snoop decisions matter.

---

## 3. Energy only does something if the player uses Read her

**DONE 2026-08-22 - option 2, documentation.** Read her is the energy sink and
section 10 now says so instead of claiming blocks are the pressure. No
coefficient moved. If playtesting shows players ignore Read her, option 1
(overnight 24 -> 18) is the fallback - but not both at once.

### Measured

Energy floor across a full campaign: **77 of 100**. It never came close to
constraining anything.

The arithmetic: three blocks cost 18, plus 1 per scene aftermath, so a full day
is 19-21 against `ENERGY_RESTORED_OVERNIGHT = 24`. **A maximally busy day is
energy-positive.** Section 10 claims "three blocks with a couple of Read her
uses runs slightly negative, so a heavy day forces a rest block" - and that is
true *only* if the player spends 6 energy a day on Read her. Every day they
don't, they gain 3-5.

### Why it matters

Sleeping in your own room is meant to be a block the player wanted to spend on
her. If energy never runs down, that trade never happens and the rest block is
dead content. It also means low-energy chip narrowing (`LOW_ENERGY = 25`) is
effectively unreachable in normal play.

### Options

1. **Overnight 24 -> 18.** A three-block day then costs 1-3 net, which
   accumulates to a forced rest every couple of weeks. Smallest change.
2. **Leave it and call Read her the energy sink.** Defensible - it makes Read
   her the thing you budget for, which is a fine mechanic - but then section 10
   should say so, because it currently claims blocks are the pressure.
3. **Charge more for a scene than for solo work.** A scene is emotionally
   expensive; restocking a wardrobe is not. Makes energy a reason to take a
   quiet block, which is thematically nice and mechanically fiddly.

**Recommendation: option 2 plus a documentation fix**, unless playtesting shows
players ignore Read her - in which case option 1. Do not do both at once.

---

## 4. The fact pool runs out, and 40% of late snoops teach nothing

**DONE 2026-08-22 - option 3.** A snoop now turns up either a member fact or a
rumor: something another member has already heard about the player. Facts are
weighted 3:1 over rumors, and early in a run there are no rumors to find at all,
so the early game teaches facts and the late game teaches jealousy. Measured
after: snoops that taught nothing went **12-21 per campaign to 0**.

### Measured

25 facts, all of them learned by roughly week 6. After that, **12-21 of ~40
snoop blocks in a campaign return nothing.** The no-charge rule (section 10b,
rule 1) means the player is not billed, so the failure is quiet - but the block
and the energy are still gone.

### Why it matters

An empty room is supposed to be worth entering. Once the pool is dry, half the
map reverts to being a credit dispenser, which is exactly the state section 10b
was written to fix.

### Options

1. **More facts per card.** Simple, and it scales badly: 3 cycles x 5 members
   wants something like 8-10 each, and the persona-level rule in section 22
   correctly makes those hard to write.
2. **Second-tier finds.** Once her facts are exhausted, a snoop turns up a
   `shared_moments` or `open_threads` entry instead - something about the two of
   you rather than about her. Reuses the dossier categories that currently only
   the summarizer writes.
3. **Rumors as a find.** A late snoop turns up what *another member* has heard,
   which is intelligence about the jealousy layer rather than about a person.
   Fits section 5b and makes the fourth-wall-adjacent `heard_about` channel
   legible to the player for the first time.

**Recommendation: option 3**, then option 2 if it is still thin. Both give the
late game something the early game does not have, which is better than more of
the same.

---

## 5. The plateau needs to say so

**DONE 2026-08-22.** The member row on the day screen marks a stalled route in
the exposure colour and says what it needs: "stalled; needs to be seen". With
the risk marker already on the chips, the plateau now states both the problem
and the answer.

`confidante` now genuinely stops intimacy (see the fix in `relationship.js`),
which is what makes the good endings reachable. But the UI does not tell the
player it has happened: the stage name changes to a word they may not have seen
before, and the meter simply stops moving.

The plateau is the single most important state in the game to be legible,
because it is the one that demands a specific response - go somewhere visible
and make an overt move. Right now the player has to infer that from a stalled
number.

**Recommendation:** a one-line explanation wherever the stage is shown, plus the
existing risk marker on the chips (already shipped) being enough to point at the
way out. This is UI work, not a rule change, but it is a rule that is invisible
without it.

---

## 6. Credits have exactly one sink

**Priority: low.**

With openers working, a campaign ends at 0-2 credits with 26-41 scenes where the
player wanted an opener and could not afford one. So credits *are* binding now,
and the economy works - but every credit goes on the same thing.

Nothing else in the game costs money: not the task, not travel, not repair.
Section 11's line that "money is not the constraint, attention is" is true of
each individual opener and false of the aggregate.

**Recommendation:** leave it until there is a second thing worth buying. Noted
here so it is not rediscovered as a bug.

---

## 7. `severance_end` is the catch-all for collapses it does not describe

**Priority: low.**

`resolveBadEnd` falls through to `severance_end` for any collapse that is not
reckless, not exposed and not deeply-close-and-unnameable - so a mid-intimacy
strain collapse reports "she cuts contact". The table in section 5 defines
`severance_end` specifically as the reckless collapse.

It is not wrong in fiction, and it is one line, but a run that quietly fell
apart under accumulated strain is a different story from one that burned down in
public. A fourth ending id (`attrition_end`?) would say the true thing.

---

## 8. Two members in a scene is still not reachable

**Priority: v1, already tracked.** Repeated here only because the jealousy
system's most legible surface - the witnessed gesture in section 5b - is the
part of the design with no path to being seen. `VNStage` renders one portrait,
so `App` passes a roster of one, so `WITNESS_EXPOSURE_FLOOR` has never fired in
play. Everything behind it is built and tested.

---

## 9. The plateau gets harder to escape the closer you get

**DONE 2026-08-22 - option 2.** A survived public risk now pays
`(3..6) x (1 + intimacy/100 x 1.2)`; the failure branch stays flat, because a
failed risk already costs 10-20 strain. Measured across 5 policies x 5 seeds,
good endings went **spread 40 -> 24%, balanced 52 -> 52%, bold 28 -> 84%,
expert 28 -> 88%, devoted 12 -> 20%** - and `devoted` now reaches `out_end`, the
hardest true ending, for the route it actually commits to. The ordering finally
says the right thing: reading the map beats spreading yourself thin, and
spreading thin beats nothing.

### Measured

`STAGE_A_MIN` steps the admissibility requirement up as intimacy crosses each
tier boundary: `nameless` wants 20, `unspoken` 40, `ours` 60, and the plateau
triggers ten below each. So the bar to escape `confidante` is **10 at intimacy
60, 30 at intimacy 75, and 50 at intimacy 90** - while a successful public risk
pays 3-6 and there is at most one per scene.

Two campaigns on the same seed, differing only in whether secrecy recovers:

| | intimacy | admissibility | endings |
|---|---|---|---|
| recovery on | 71-77 | 12-23 | 5x `confidante_end` |
| recovery off | 54-69 | 0-12 | 2x `unnamed_end`, 3x `confidante_end` |

The run with **lower** intimacy got the better endings, because at intimacy
54-69 an admissibility of 10-12 clears the `nameless` bar, and at 71-77 the same
admissibility is 18 short of the `unspoken` one.

### Why it matters

It inverts the incentive at exactly the wrong moment. Getting closer to her
raises the price of ever being able to name it, so a player who has been
building intimacy efficiently - which is what the openers reward - walks into a
wall they cannot see and cannot easily climb. It also means intimacy inflation
(the repeatable +5 opener) is not just a pacing problem: it actively buys the
player a worse ending.

Note this is *not* what I first assumed. The secrecy fix looked like it had
suppressed public scenes by removing the free +21 exposure from a floored
secrecy; measured, public scenes were 40 vs 38 and risks 27 vs 21. The bar
moving, not the opportunities disappearing, is what did it.

### Options

1. **Flatten the step.** Make `STAGE_A_MIN` rise proportionally rather than in
   20-point jumps, so the plateau bar tracks intimacy smoothly instead of
   lurching at 70 and 85.
2. **Pay admissibility proportionally too.** A successful risk at high intimacy
   is worth more than one at `colleague` - which is also true in fiction: being
   seen with someone you are obviously close to says more.
3. **Cap the opener's contribution to intimacy**, so intimacy stops outrunning
   admissibility in the first place. Overlaps with #1 and with section 11's
   deliberate choice to make the object repeatable.

**Recommendation: option 2.** It fixes the incentive without touching the map,
and "the more there is between you, the more a public gesture costs and means"
is the game's own thesis rather than a balance patch.

---

## 10. Phase maps, dating, and five authored events

**Status: IMPLEMENTED 2026-08-23**, except the escalation question below, which
was resolved AGAINST this entry's own recommendation. CLAUDE.md sections 10 and
10b carry what shipped. The parts of the earlier sketch that were wrong are
still recorded at the bottom rather than deleted, because both were wrong in
instructive ways.

**The one place the build differs from what is written here: events are five
per CAMPAIGN, not five per cycle.** See "OPEN: five per campaign, or five per
cycle" below, which now records why.

### The map is a template of roles, not a list of rooms

The earlier version of this proposal said "eight to ten locations per phase" and
left it as a number somebody has to remember. Yuhan's version is better and is
what we are building: **a fixed set of role slots, filled with different content
each phase.** The map keeps one shape for the whole campaign - the player learns
the grammar once - while the contents turn over.

A **role is a tag on a location**, and one location can carry several.

| Slot | # | Roles | PREP | COMEBACK | REST |
|---|---|---|---|---|---|
| workroom A | 1 | chat, task, knowledge | practice room | filming location | photo studio |
| workroom B | 1 | chat, task, knowledge | wardrobe | make-up room | recording studio |
| social room | 1 | chat, **rumor** | canteen & drink room | green room | hair salon |
| public venue | 1 | **public date**, part-time | bistro | cafe | Han River park |
| event site | 1-2 | authored, whole day, fires once | meeting room | Music Bank, fan meeting hall | cruise, island |
| dorm shared | 1 | chat, knowledge | kitchen & living room | same | same |
| her room | x5 | **private date**, gated | routine evenings | (away) | routine evenings |
| your room | 1 | rest | same | same | same |

Eight or nine reachable at once, constant across the campaign. REST keeps its
workrooms because the solo layer resumes fully that week (section 10) - they
become individual-career sites rather than disappearing.

**Every phase map must carry every role, and this is asserted.** Section 21: a
design rule that is not asserted is one that gets quietly broken. "COMEBACK has
no rumor room" is exactly the kind of hole that survives a content edit.

### Dating: the two axes already say what the gate is

- **Public date gates on admissibility.**
- **Private date gates on intimacy.**

This falls out of the existing model instead of being bolted onto it. A private
date asks *how close are we*; a public one asks *how nameable is this* - being
seen at a bistro on a Saturday with no work excuse is the most legible statement
the game can make. The two are therefore not substitutes: a player deep in
`confidante` gets the private date easily and cannot get the public one at all,
which is the plateau telling them what it wants in the plainest terms available.

**A refusal is not a failure.** It is the first time a hidden number becomes a
visible yes or no, which is pillar 1 working. An early ask costs the block and
nothing else; asking far below the bar is the only place a little strain
belongs.

A public weekend date is the **loudest rumor generator in the game** - whole
day, maximum exposure, four members elsewhere. That is the price and it is the
right one.

**The player pays the bill in credits.** See the economy note below; this is the
first sink that is not a shop.

### Her room is a routine, not a die roll

Her door stays visible and locked with its `entryIntimacy` number, because
section 10 is right that a threshold you can see is a goal rather than a
spoiler. What changes is what is behind it.

Each member is in her room **one or two fixed evenings a week**, set by the
seed, the same evenings all cycle. Evening blocks only, and not during COMEBACK,
because she is not home that week.

Fixed rather than random because section 10 already promises this and has never
delivered it: *"routines are learnable - known_facts may hold 'she practises
alone on Wednesday nights', and knowing it is how a player engineers a
low-exposure meeting."* A random presence is a lucky knock. A routine is
something **snooping can reveal**, which gives the knowledge economy a second
thing to buy besides gifts and openers: *access*. A fact that tells you where
she will be is more interesting than one that tells you what to purchase.

The private weekend date opens the same door for a whole day, and
`approachWitnessed` makes that the loudest version of the beat rather than
retiring it.

### Five authored events

One weekday each. PREP 1, COMEBACK 2, REST 2.

| Phase | Site | Event |
|---|---|---|
| PREP | meeting room | comeback planning meeting |
| COMEBACK | Music Bank | the comeback performance |
| COMEBACK | fan meeting hall | the fansign |
| REST | cruise | the company outing |
| REST | island | the trip |

All five members and the player attend. The site is removed from that week's map
once the event fires. It consumes the whole day and runs longer than an ordinary
scene, from an authored prompt.

**The one rule: an event may set the situation, never the outcome.** It says the
five of you are in a meeting room and the label has moved the comeback forward
two weeks; it does not say how she reacts to you. Standing, dossier, her voice
and the meters still write the scene. An event that scripts her reply is a
branching text adventure, which section 1 rules out.

**Division of labour: the map carries the weekly rhythm, the events carry the
campaign arc.** The same practice room in week 1 and week 7 is fine - it is the
same company. The events are the thing that must differ.

#### OPEN: five per campaign, or five per cycle

`CYCLES_PER_CAMPAIGN = 3`, so PREP week is weeks 1, 4 and 7. "Removed after
firing" needs a scope, and the three readings are not equal:

| reading | consequence |
|---|---|
| 5 total, cycle 1 only | cycles 2-3 have no events; week 9, the end of the game, is the emptiest week in it |
| 5, repeating verbatim | the same fansign three times; the player notices on the second |
| **5 situations x 3 cycles** | the site recurs, the stakes escalate |

**Recommended: the third.** It is also the fictionally correct one - each cycle
is a different comeback, so of course there is another Music Bank recording.
What changes is what is riding on it. Most of the variation arrives free from
the engine (ledger, standing, dossier), so the writing is five situations plus a
short per-cycle stakes clause, not fifteen scenes.

Under this reading "fires once" means **once per cycle**.

#### RESOLVED 2026-08-23: the first, on Yuhan's instruction

> "Each special event occurs only once and removed event and place, each cost 1
> weekday... So we have 5 special events in total."

That is reading one, and it is what shipped: `flags.firedEvents` persists for
the whole campaign, so a fired event never returns. It overrides the
recommendation above, which was mine.

**The consequence this entry warned about is real and has not been addressed:**
cycles 2 and 3 have no anchor events, so week 9 - the end of the game - is the
emptiest week in it. Two things to know if that turns out to matter in play:

- The engine already supports the escalating reading. `eventDays` filters on
  `fired`, so keying it `phase:slot:cycle` instead of `phase:slot` would make
  events recur, and `data/events/` would gain a per-cycle stakes clause. It is
  a small change, not a redesign.
- Weeks 2-3 of every cycle already have a shape without events - COMEBACK is
  the co-presence week and REST is the repair week. It is specifically the
  authored beat that is missing, not the structure.

Worth watching for in the first hand-played campaign rather than pre-empting.

### Schedule assembly

Weekday assignment order, run at week start:

1. place the special event day
2. place the daily task
3. place group activity
4. place solo activity in what is left

Weekend: **no task, ever** (section 10 already protects this). Saturday and
Sunday are each assembled at the start of that day rather than at week start,
because weekend occupancy depends on whether a date happened and that is player
input:

1. ask whether the player wants to invite someone, and where
2. if yes: the affection check runs, and on acceptance the day jumps to the date
   scene and is consumed
3. if no, or refused: place members in the shared dorm, the social room, or
   invisible in their own gated rooms

Still deterministic - the inputs are (seed, week, day, dateChoice). The seed
derivation has to include the day so Saturday and Sunday differ.

`generateWeek` already does seeded deterministic assignment, so the weekday
ordering is a priority pass inside a function that exists. The weekend re-runs
are new but small.

### Group scenes: rotation is client-side

Yuhan's shape: pick a member, she says a line, the player answers or skips,
rotate. **Feasible, and architecturally the right call** for a reason worth
stating - the model is never asked to write five people at once. Each call
produces one member's beat, so section 9's roster rule holds at one speaker per
call and **member bleed is prevented structurally rather than by prompting.**
Asking a Flash-tier model for a five-way scene in a single response is the
hardest thing we could ask it; this sidesteps it entirely.

Three things to settle before it is built:

- **Latency is additive.** Each member must see what the last one said, so the
  calls cannot be parallelised. A five-member round is roughly 8-14s of model
  time. Beat-by-beat reveal hides some of it. Measure, do not assume.
- **Do not prompt the player every line.** Five "say something or skip?" prompts
  a round is a lot of decisions for little content. The rotation should run and
  let the player interject.
- **Do not pick the speaker at random** - it reads as arbitrary. Weight by who
  has a stake: jealousy, intimacy, whether the last line was about them. Pure
  function, `systems/`, deterministic, testable, no model call.

Block 3 carries all five dossiers in a group scene, about 300 tokens instead of
60. That is inside the per-scene rebuild and costs nothing in cache terms.

### Multi-portrait UI

Sequenced **after** the rotation works. It is presentation for a thing that does
not exist yet. Section 14 has the modes.

### Credits and energy: settled

**Credits are binding, not in surplus.** I claimed a 3x surplus in discussion
from an income-versus-catalogue estimate, and proposal 6 - which measured a real
campaign rather than counting the price list - says the opposite: **a campaign
ends at 0-2 credits, with 26-41 scenes where the player wanted an opener and
could not afford one.** The estimate went wrong by treating knowledge gifts as
25 one-off purchases; the object is *repeatable*, and the player wants one
nearly every scene, so demand is several hundred and not a hundred.

Recorded because the correction changes what to build, not just a number.

Consequences:

- **The public date costs credits, and it is proposal 6's "second thing worth
  buying".** That entry recommended leaving the economy alone until one existed.
  It now does, and it competes for a budget that is already tight: a gift for
  her today, or affording to take her out on Saturday. A sink that competes is
  worth far more than a sink that absorbs a surplus.
- **Part-time is therefore real income, not padding.** With credits binding, a
  block traded for money is a genuine choice against a block spent with her -
  which is the shape this game wants every choice to have.
- **Information stays priced in secrecy, never credits.** That cost is the whole
  point of section 10b - it is deferred, and it feeds `exposure_end`. A job that
  buys past it switches the mechanic off. A small credit charge *on top of* a
  secrecy price (a round of drinks in the canteen) is fine.
- Mechanically **part-time is one `SOLO_ACTIONS` entry**: higher credits, higher
  energy, no `learns`. No new system. Its energy cost is what gives energy teeth -
  section 10 records that a busy day is currently energy-*positive* by 3-5 and a
  full campaign never dropped below 77 of 100, so energy today is the Read-her
  budget and nothing else. Do this **or** drop `ENERGY_RESTORED_OVERNIGHT` to
  18, never both.

### What the earlier sketch got wrong

Kept because both errors are the same kind - reasoning about content volume
without checking the structure it sits in:

1. **"Two events per week"** was mine, and it multiplied out to 18 forced days
   of 63, about 29% of the campaign authored. One event per site, five sites, is
   Yuhan's correction and it is far lighter.
2. **Events on weekend blocks** was mine, on the grounds that weekends were
   free. Backwards: a forced event should *replace* a scheduled day, and the
   Music Bank recording genuinely is that Thursday. Weekends belong to the
   player, which is what section 10 wanted them for in the first place.
   **Section 10 needs updating** - it currently says event anchors go on weekend
   blocks.

### Sequencing

1. **Phase maps + roles + dating** - data, `calendar.js`, one UI zone. No LLM,
   fully deterministic, testable. Delivers most of the variety.
2. **Authored events** - needs the whole-day clock concept, which is new but
   small. Write the first as a 2-member scene to prove the injection shape.
3. **Group rotation** - `systems/` speaker weighting first, then the turn loop.
4. **Multi-portrait** - last.

---

## 11. The opener moves into the scene, and taking someone a gift takes the floor

**Status: IMPLEMENTED 2026-08-23**, after Yuhan hit all three of its predicted
failures in the first day of play and reported them as one bug. CLAUDE.md
section 11 carries what shipped.

What was built, against what this entry proposed:

- **The opener is a turn.** `runTurn` takes a `note`; it costs one of the eight
  turns, appends at the tail as a system note, and sets `singledOut`. As
  proposed.
- **A gift takes the floor.** Handing something to somebody moves the addressee
  to her, so choosing in the sheet and talking are one act rather than two.
  As proposed - and the "missing verb" turned out to already exist, because the
  portrait row shipped with group scenes.
- **The sheet asks who**, defaulting to the current addressee. Not in the
  original entry; it fell out of the group-scene case, and it is the direct
  answer to reason 2 below.

One thing the entry did not anticipate and the build had to handle: the offline
writer recognised a gift only from the opening directive, so moving the opener
mid-scene made every gift given without an API key produce a shrug. Section 3
treats offline as a supported mode, so that was a blocker rather than a
footnote.

### The problem

Section 11 puts the opener in a **pre-scene modal**: the player picks a gift or a
gesture before the first call, and it is injected as the opening line of block 5
so that her opening beat is the reaction. That works for one member in a room and
does not survive section 10c. In a rotating group scene there is no single
"before the scene starts" moment that belongs to any one member.

### The change

**One interactions control, next to the portrait, live for the whole scene.** It
replaces the pre-scene modal rather than sitting alongside it - two mechanisms
for one act is complexity with nothing bought. Opening with a gift becomes
"tap it before saying anything", and section 9's existing gift opening directive
still fires for that case.

Three reasons it is right, and the second is the one that was not obvious:

1. **Uniform across 1v1 and group.** The reason it came up.
2. **The gesture half improves.** Section 11's free option - asking how her ankle
   held up - is a conversational act, and a pre-scene modal makes the player bet
   it blind at the door. Mid-scene it can land immediately after she mentions the
   thing, which is the best possible moment for *"How did you know about my
   knee?"* The responsive version should read better, not worse.
3. **The cache already allows it.** Section 8 invariant 3 names a mid-scene gift
   explicitly: appended at the tail, never edited into the header. No cost.

### Ordering in a group scene: interaction takes the floor

The question Yuhan raised: A speaks, the player gifts A, and B was next.

**Rule: interacting with someone makes her the next speaker.**

A gift is an *address*. Handing someone something in a room full of people is
turning to them, and cutting from that to a third party talking about the
schedule is not how a room works. Two alternatives were considered and both are
worse: attaching the control to the current speaker restricts the player to
whoever happened to talk last, and attaching it to the *next* speaker uses the
client's pick where the player's intent belongs.

Two things follow for free:

- **It gives the group scene its missing verb.** In section 10c the rotation is
  client-driven and the player only answers or passes. "Turn to her" is the lever
  the player needs, and it is a forced value into the speaker-weight function -
  no new machinery.
- **It fires the witnessed rule.** Turning to one member in a full room and
  handing her something is the loudest witnessed act in the game. Section 5b
  already prices it.

### One opener per scene, and that is the interesting part

The pre-scene modal rationed this by construction; an always-live button does
not. Credits are binding (proposal 6), but an economic brake alone means a rich
player can degrade the fiction into a gift every turn until "she hears that you
remembered" is noise.

**One per scene, not one per member.** In a group scene that becomes the best
version of the mechanic: the single opener is a choice of *who gets it in front
of everyone else*, and scarcity is what makes "whom" mean anything. That is the
jealousy tension inside one tap.

The control dims after use **with the reason shown** - section 6 already learned
that a disabled control with no explanation reads as a frozen screen.

### Smaller consequences

- **Only someone in the room.** You cannot hand a gift to an absent member. This
  mirrors the parser roster rule and the chip-label rule.
- **The i18n title changes.** "How you walk in" stops being accurate once the
  control is live all scene.
- **Turn 0 versus later.** Given on turn 0 it uses the existing gift opening
  directive; given later it is an ordinary tail injection under invariant 3.
  Both paths already exist.

### Cost

Small. UI work plus a target step in group scenes, a one-per-scene flag in the
turn loop, and a forced next-speaker value. No prompt-block changes at all.

---

## 12. A group scene is a room, not a queue

**Status: IMPLEMENTED 2026-08-23.** Supersedes the round-robin sketch that was
in section 10c; that section now describes what was built. `INTERJECT_THRESHOLD`
is still unmeasured and still wants a live pass - it is the only part of this
proposal that shipped on reasoning alone.

### The problem with rotation

The first design was: pick a member, she speaks, the player answers, rotate.
Yuhan pushed on it and it does not survive the question - **A speaks, the player
responds, and then it is B's turn. Who was the player talking to? Who answers?**

A rota has no answer, because a conversation is not a turn order. Rotation also
generates four calls a round that the scene did not ask for.

### The primitive: an addressee

> **The player always has a current addressee. Whoever the player addresses
> speaks next. It defaults to whoever last spoke, and one tap changes it.**

That answers all three questions at once. Who is the player talking to - the
addressee. Who answers - the addressee. Does the player choose - yes, but only
when they want to, because the addressee is **sticky**, so the common case costs
zero extra taps.

A gift is one way of addressing someone (proposal 11), a chip is another. One
verb, two surfaces, which is a good sign it is the right primitive.

### The addressee alone collapses the scene

If the addressee always answers, B and C never speak and a group scene is a 1v1
with spectators. So the un-addressed need a way in - and it must not be a rota:

```
1. the addressee speaks
2. the client MAY add ONE interjection from another member,
   if her stake clears a threshold
3. the player acts: chip / free text / gift / turn to someone / pass
```

**The interjection is the whole feature.** It is not randomness - it is section
10c's stake function doing real work. Nana cuts in *because* she is at `sharp`
jealousy and the player just turned to Irene; Hyewon cuts in because they were
talking about her. The room writes itself out of state the game already tracks,
which is what a group scene should be and what a rota structurally cannot be.

`pass` also stops being a skip button: it is the player letting the room breathe,
with the client picking who fills the silence by stake.

### This retires the latency worry

Section 10c estimated 8-14s a round from five sequential calls. Addressee plus
optional interjection is **one or two calls per player turn** - a 1v1, sometimes
plus one. The rota was generating calls the scene did not need.

### Two things that come free

- **The UI already exists in the design.** Section 14: *"the speaker sits at full
  opacity and scale, others dim to 0.55 and scale 0.95."* That is exactly how to
  show who the player is turned to.
- **Attention becomes a visible, priced state.** Who the player is turned to is
  on screen at all times, the others can see it, and turning away is witnessed.
  The group scene's tension is literally where the player's attention points -
  the jealousy system made continuous rather than settled at scene exit.

### Implementation plan

1. `systems/speaker.js` - **pure**. `stakeOf(member, sceneState)` and
   `pickSpeaker(rng, candidates)`. Weighted by jealousy band, intimacy, whether
   the last beat named her, and how long since she last spoke. Deterministic,
   testable, no model call.
2. `systems/speaker.js` - `shouldInterject(stakes, threshold)`. Threshold is a
   **named constant** set by the harness, like `RISK_PAYOFF_SCALE`. An
   interjection every turn is a scene where nobody finishes a sentence.
3. `agent/sceneEngine.js` - scene session gains `addresseeId`; `runTurn` targets
   it; a second optional call for the interjection.
4. `agent/promptBuilder.js` - an **interjection directive**: *you are Nana; Irene
   and the player were talking; you cut in.* This is a new prompt shape beside
   `openingDirective`, and the one most likely to read badly if the threshold is
   wrong.
5. `ui/vn/` - portrait row with the section 14 focus treatment; a "turn to her"
   control; `pass`.
6. Raise section 9's 2-member cap only after this is measured live.

### Risk

The interjection threshold is the one number here that cannot be reasoned to. It
needs a live pass, not a harness pass, because the failure mode is prose quality
rather than a distribution.

---

## 13. Dates and events need a different register, and the player needs a name

**Status: IMPLEMENTED 2026-08-23.** Raised by Yuhan while planning dating: a
whole-day scene played at ordinary-chat register will drift. All three registers
ship (`data/sceneFrames.js`), dates and anchor events both use the literary one
at sixteen turns, the pronoun rule is in block 1, and the name field is on the
cover screen.

Two things the build added beyond this entry: the shared dorm evenings borrow
the same register (PROPOSALS 15), and every frame has a smell test asserting a
movement never writes her reaction - which caught a scripted movement in an
event frame on its first run.

### Three registers, and the contrast is the point

An ordinary slot chat is one block, `SCENE_TURN_LIMIT = 8`, 30-50 word beats. A
date or an authored event is a **whole day**. Played at the same register it
either ends too soon or wanders, because nothing in the prompt says where the
scene is going.

| Register | Turns | Style | Frame |
|---|---|---|---|
| ordinary | 8 | terse, legible, quick | location + activity + standing |
| **date** | ~16 | literary, sensory | + an authored spine for the venue |
| **event** | ~16 | literary, sensory | + an authored spine for the occasion |

**Keeping ordinary scenes terse is deliberate.** Section 1's first pillar is
"legible tension over long prose - 30-50 word bursts, not 300-word narration",
and applying a literary register everywhere would quietly repeal it. Making the
register a *contrast* is what lets a date feel like a date: the game changes how
it writes when the day is hers.

### The spine: shape without script

Drift is a length problem, and the fix is not a longer instruction - it is
giving the scene somewhere to go. A date frame carries **movements**: two to
four situations the scene may pass through, in order, none of them required.

```
bistro:
  setting  - a corner table, the window fogged, the waiter who does not
             recognise her
  movements - arriving and deciding where to sit
            - the meal, and what she does not say about work
            - the walk back, and how long it takes
```

**The rule from section 11 holds unchanged: a movement may set the situation,
never the outcome.** "The walk back, and how long it takes" is a place. "She
takes your hand on the walk back" is a script, and section 1 rules out branching
text adventures explicitly. Everything the engine already does - standing,
dossier, her voice, the meters - still writes what happens.

This is adapted from `rv-simulator`'s `specialEvents.js`, which frames an event
as setup -> emotional beat -> constraint in one or two sentences. The one thing
deliberately dropped: its prompts name the payoff (*"player thinks: I want to
hold onto this moment forever"*). At whole-day length with a real relationship
model underneath, the payoff has to be earned by the scene rather than stated by
the frame.

### Style directive

Applied to date and event registers only:

```
Literary and sensory. Sight, sound, touch, smell.
Open with one or two sentences that establish the atmosphere before anyone
speaks.
```

### The pronoun rule is global

This one applies to every register and is missing today:

```
In NARRATION, refer to the player as "you" and "your".
In DIALOGUE, inside quotation marks, she may use the player's name.
```

Without it every line addresses a person with no name, which is the flattest
possible second person. With it, the first time she uses the player's name is a
moment - and it is her choice of register, which is exactly the kind of signal
this game asks the player to read.

### The player needs a name

`player.name` is **already in the section 15 state schema** and has never been
collected or used. It needs:

- a name field at run start, alongside the (later) cast picker
- injection into block 1, which is byte-stable for the run, so it is set once
- **sanitising**: cap the length, strip newlines and control characters. It is
  player text going into a prompt, and a name containing a newline can forge a
  metadata line and move her meters.
- no localisation - it is the player's own text, in whatever script they typed.

### Implementation plan

1. `config/constants.js` - `SCENE_TURN_LIMIT` becomes per-register.
2. `data/sceneFrames.js` - setting and movements per date venue and per event.
   Model-facing English, never localized, like `ACTIVITY_DOING`.
3. `agent/promptBuilder.js` - block 1 gains the pronoun rule and the player name;
   block 4 gains the style directive and the spine when the register is not
   ordinary. Both are inside blocks that are already rebuilt or already stable,
   so **neither costs anything in cache terms**.
4. `store/player.js` + a name field on the start screen; sanitiser with a test.
5. `systems/dating.js` picks the frame for the venue.

Order: the name and the pronoun rule first, because they are global and cheap;
the registers with dating; the event frames with the events.

---

## 14. A fact is one string doing three jobs

**Status: IMPLEMENTED 2026-08-23.** Found by Yuhan in a `zh` session: a learned
fact shows in English. The other three bugs from that session were fixed
directly; this one was a schema question and was decided first. CLAUDE.md
section 12 now carries the rule; what follows is the argument that got there,
kept because the reasoning is the part worth re-reading.

**Two things the implementation changed from what is written below.**

1. The canonical English lives in `data/facts.js`, **not** in `i18n/en.js` as
   proposed. The proposal had it in the bundle for symmetry, and symmetry is
   the wrong thing to optimise here: canonical text is what gift needles match
   by substring, and `i18n/en.js` is a file whose purpose is being reworded for
   how it reads on screen. Putting them together would invite the exact
   regression this proposal exists to end. English has no `fact.*` keys; every
   other locale must have all of them; both are asserted.
2. The English-a-custom-card-has-no-way-to-produce question resolved to **3
   (single-locale card) as the default and 1 (translate at import) as v2
   polish**, rather than the reverse. The custom-card live probe settled it:
   memory came back 0% Han from a fully Chinese card, because the summarizer
   keeps memory English on instruction regardless of what the card says. So
   translate-at-import buys portability, not correctness, and the card editor
   it belongs to is v2 anyway.

### The diagnosis

`learnableFacts` entries are used for three different things:

| job | who reads it | what it needs to be |
|---|---|---|
| a line in prompt block 3 | the model | **English** - section 19 rule 2, so memory survives a language switch |
| the needle a gift `requires` | `economy.js`, by substring | **stable and machine-comparable** |
| the sentence after a snoop | the player | **the player's language** |

One string cannot be all three, and today it is. It only looks correct because
the third job is invisible in an English run.

**This is the only card field with that problem**, which is worth stating
because it bounds the whole thing. `personality`, `speechStyle` and
`queerTexture` are prompt-only and never shown. `name`, `emoji` and `palette`
are display-only and never semantic. Gift and gesture labels are already keyed
by gift id and localized. `learnableFacts` is the single field that is *both*
prompt-facing and player-facing, so it is the single field that needs splitting.

### The rule

> Every stored string has a **canonical English form** for memory and matching,
> and a **display form** in the player's language. Authored content takes its
> display form from `i18n/`. Generated content gets it from the model, in the
> same call that generated it.

The second half already exists as of the section 19 fix: the summarizer now
returns `display` beside `summary` for exactly this reason. This proposal is the
same move applied to facts.

### Authored facts: give them ids

```json
"learnableFacts": ["cold_hands", "no_sleep_before_comeback"]
```

with `fact.cold_hands` in `i18n/en.js` and `i18n/zh.js`.

This is worth doing even setting the language bug aside, because it fixes
something section 12 already complains about. Gift `requires` matches dossier
text **by substring**, and section 12 records that this "has regressed twice
during content rewrites" - a fact reworded on a card silently unlocks nothing.
An id cannot be reworded by accident.

It does not replace substring matching, because there are two ways a fact
reaches the dossier and only one of them has an id:

- **snooped** - drawn from `learnableFacts`, so the id is known at the moment it
  is awarded. Match by id. Display from `i18n/`.
- **from dialogue** - written by the summarizer in its own words, so there is no
  id and never can be. Match by substring, as now. Display from the
  summarizer's own `display` field.

### The dossier entry becomes an object

```js
known_facts: [{ text: 'hates cold hands', factId: 'cold_hands', display: '怕手冷' }]
```

`text` stays English and stays what the prompt sees, so blocks 3 and 5 do not
change at all and neither does the cache behaviour.

**Do this now rather than later.** Section 15's schema has these as bare
strings, and `store/save.js` is still an empty stub - so there are no saves in
the world to migrate. This is the last moment the change is free, and after
save/load ships it needs a `schemaVersion` bump and a migration.

### Custom cards: the same resolver, from the other direction

A player writing a card types everything in their own language, which inverts
section 12's rule that semantic fields are authored English. A custom card
cannot ship `i18n/` files either, so its facts have to carry their text inline:

```json
"learnableFacts": [{ "id": "hates_cold", "zh": "怕手冷", "en": "hates cold hands" }]
```

So the resolver takes **either shape** - a bare id resolved through `i18n/`, or
an object carrying its own text - and everything else in the game calls the
resolver rather than reading the field. Shipped cards stay tidy (translations
live with translations); custom cards stay self-contained and portable as a
single file, which section 12 cares about.

Two functions, and nothing outside them ever touches `learnableFacts` directly:

```js
factCanonical(fact)      // English, for prompt + matching. Always defined.
factDisplay(fact, lang)  // the player's language, falling back to canonical.
```

### The English a custom card has no way to produce

A card authored in Chinese has no canonical English, and memory needs one.
Three options:

1. **Translate once at import.** One model call when the card is saved,
   producing the English canonical fields; the original stays as the `zh`
   display. Costs one call per card, once, and the card is fully portable
   afterwards.
2. **Let memory drift into the authoring language.** Cheapest, and it breaks
   section 19's guarantee that the player can switch language mid-run.
3. **Declare the card single-locale.** It carries `lang: "zh"` and the picker
   says so. No call, no drift, no portability.

**Recommended: 1, with 3 as the automatic fallback.** A card records the
language it was written in; if the translation has not run - no key, offline,
the player declined - it stays single-locale and the picker is honest about it.
What must not happen is option 2 by default, because a save that silently mixes
languages in its ledger cannot be repaired later.

This also means **the game must not require a model call to make a card.**
Offline play is a supported mode (section 3), so creating a card offline has to
work and simply produce a single-locale one.

### Scope

Small, and mostly mechanical:

- `data/facts.js` - the resolver, plus the id table for shipped cards
- five card files - facts become ids
- `i18n/en.js`, `i18n/zh.js` - 25 `fact.*` keys each
- `data/gifts.js` - `requires` gains `factIds`, keeps the paraphrase list for
  summarizer-written entries
- `systems/soloWork.js` - awards `{ text, factId, display }`
- `agent/memory.js` - dossier entries are objects; `renderDossier` reads `.text`
- one test that a `zh` run puts no ASCII sentence on the snoop screen

The card-editor half is v2 and only needs the resolver to exist now.

---

## 15. The dorm needs something to do together

**Status: IMPLEMENTED 2026-08-23.** CLAUDE.md section 10b now carries the rule.
The open question at the bottom was decided as recommended: **no jealousy, and a
small intimacy gain for everyone present.**

### The gap

The shared dorm rooms used to walk the player straight into a 1v1 with whoever
was listed first. That is fixed - both open the room screen now - but it exposed
something the design had not noticed.

Section 10 makes the dorm safe from scandal and dangerous for jealousy: nearly
invisible outside, watched by everyone who lives there. That is a good tension
and it is **currently all cost.** There is nothing in the dorm that spends time
with the whole cast at once, so every dorm visit is a choice of one member in
front of four, priced accordingly. The place the cast actually lives is the
place it is most expensive to be.

### The fix

Two authored group activities, one per shared room:

| Room | Solo | Together |
|---|---|---|
| `dorm_kitchen` | cook for yourself - produces a dish that can be given later as an ordinary gift | **cook together** - a group scene about food, with whoever is in |
| `dorm_living` | wait up | **watch a film together** - a group scene about a randomly chosen film |

**No 1v1 option is offered in either room.** That is the rule, not a limitation:
the dorm is where an unchosen 1v1 costs the most, and removing the option is
what turns the dorm from a trap into the place the pressure comes off.

### Why these two specifically

They are concrete, and concrete is what makes them read differently from a work
scene. "What is in the fridge" and "this film is terrible" are topics a group of
five can actually have, and neither is available anywhere else on the map -
every other location produces conversation about the job. Section 8's whole
argument for `ACTIVITY_DOING` is that a scene needs a reason to exist; a shared
meal and a bad film are two reasons the workplace cannot supply.

They also give the evening its own texture. Section 10 already made evenings
work-free and put the cast at the dorm; this is what they do when they get
there.

### The dish is a small, good loop

Cooking alone produces an object the player can hand to someone later. It is a
generic-tier gift (section 11), not a knowledge one - anybody can cook - so it
costs a block instead of credits and stays weaker than an opener bought on a
fact. What it adds is a use for a dorm evening that is neither a snoop nor a
scene, and a gift that is not a purchase.

### What it needs first

The group scene machinery in PROPOSALS 12: the addressee, the interjection, and
the speaker weighting. All three exist as pure functions already; what is
missing is the interjection call and its directive.

Until then both rooms behave as ordinary room screens, which is correct and not
broken - just quieter than they should be.

### One thing to decide when it is built

Whether a shared activity generates **witnessed** jealousy at all. The argument
for no: nobody is being singled out, which is the whole point, and charging for
it would put the cost straight back. The argument for yes at a reduced rate: the
player is still choosing to spend an evening with the group rather than with
her, and section 5b's `jealousy` is pressure about where attention goes.

Recommended: **no jealousy, and a small intimacy gain for everyone present.**
The dorm needs one thing that is unambiguously restorative, or the tension it
carries has no release valve.

---

## 16. The chime has no brake, and one day it will need one

**Status: NOT a proposal yet - a measurement and a plan for if it goes wrong.
Raised 2026-08-23 while fixing the silent room.**

`CHIME_THRESHOLD = 0.9` against `perSilentTurn = 0.45` means **two quiet turns
clears the bar exactly**, and in a room with more than two bystanders somebody
is essentially always at two.

### Measured, twice

| | three members, six turns | five members, eight turns |
|---|---|---|
| chimes | 6 of 6 | 8 of 8 |
| cut-ins | 0 | 0 |
| resentful lines | 0 | 0 |
| members who spoke | 3 of 3 | 5 of 5 |
| beats total | 21 | 34 |

`LIVE_BIG_ROOM=1` runs the second one. It earned its keep immediately: the
first pass had **Yeri say nothing at all** across the whole block, because the
chime's silence term had copied `stakeOf`'s four-turn clamp and three bystanders
sat at the ceiling permanently, dropping the sort through to the id tie-break.
Fixed by uncapping; the second column above is after.

Both read well, and the prose is the best this project has produced. But the
rate is the **top** of the range rather than the middle: a second voice on
literally every turn, in both room sizes, because the bar scales with room size
and the counters do too.

### Solved on the spot: 34 beats became 17

The five-member block ran to **34 beats**, because the model wrote two beats per
chime despite the directive asking for one - so an interjection was as long as
the reply it cut into, and a block cost about 34 taps.

"write one beat" did not take. **Naming the form did:** *"write ONE beat - a
single metadata line and what follows it, no second metadata line."* Same scene,
re-measured: **17 beats**, exactly one per chime, eight chimes of eight, all five
members still speaking, and a visibly better transcript - tighter, with more
narrative momentum, because the room moves on rather than each voice settling in.

It is the cheapest lever on how much reading a group scene costs, and it is one
careless reword away from regressing invisibly, so `groupScene.test.js` asserts
the wording. The same form was applied to the cut-in, which had the same
problem.

**A claim written here and then withdrawn**, because it is the kind of mistake
worth leaving visible: the same run showed the addressee's replies drop from ~2
beats to 1, and this file briefly explained it as prompt contamination - the
chime directive accumulating in block 5 and being generalised. Three runs say
otherwise. The addressee came back at **9, 17 and 25 beats** across three
identical eight-turn blocks, which is section 9's 1-to-3 range doing exactly
what it is allowed to do. One sample looked like a mechanism.

What that does establish is where the reading actually comes from: the chime is
**8 beats of a 17-to-35 beat scene**. Scene length is dominated by the
addressee, and no threshold in this entry touches that.

### What is still open

1. **Call count.** Two calls a player turn, near-always. Roughly doubles a
   campaign's request count. Money is not the constraint; free-tier rate limits
   might be.
2. **Whether always-on is right at all.** Nobody has played nine weeks of it.
   Six of six and eight of eight are pleasant in isolation; the question is
   whether the room ever feeling quiet is something the game wants.

### If it does need a brake, three options, and only one of them is right

**(a) Raise `CHIME_THRESHOLD`.** Cheapest, and it does not work. With four
bystanders cycling, somebody is always at three or four, so raising the bar
quietly turns the chime off in *two*-member rooms while barely touching
five-member ones. It makes the feature worse where it is already weakest.

**(b) A hard cooldown - no chime the turn after a chime.** Caps it at every
other turn, and produces a visible alternating rhythm that is exactly the rota
proposal 12 was written to avoid. A reader would notice the pattern within a
scene.

**(c) Recommended: a decaying bar.** The chime threshold rises by a fixed amount
when somebody chimed last turn and relaxes back over the next two, so a member
with something real to say - just named, or four turns silent - still cuts
through, while three people talking over each other in a row costs more each
time. It needs one field on the session (`turnsSinceChime`) and no new concept:
it is the same "something has to have HAPPENED" argument the interjection bar
already runs on, applied to the room's own recent noise rather than to one
member's state.

The fourth lever - making the chime reliably one beat - was tried and worked,
and is described above. It is the reason none of (a) to (c) is urgent: the
complaint a brake would answer was mostly about volume of reading, and that
halved without making the room any quieter.

Do not do any of the remaining three on reasoning. **This is a prose question and it needs a
played campaign**, the same status `INTERJECT_THRESHOLD` had before 2026-08-23.

---

## 17. Everyone in the room reacts to a gift, and only one of them can

**Status: NOT implemented. Raised 2026-08-23, out of scope for the fix that
found it.**

Handing Nana a hand warmer in front of Irene and Jisoo now does three things:
Nana answers, everybody present takes a `WEIGHT_WITNESSED` jealousy hit, and the
scene moves on. What the other two do not do is **say anything about it**, in the
moment when a person obviously would.

The machinery is nearly all there. `singledOut` is already set on the turn, and
a chime already fires most turns - so the beat that follows a gift is very
likely to be somebody else speaking anyway. What is missing is that she is not
told what just happened: the chime directive says "she joins in on what they are
talking about", and what they are talking about is a present she watched change
hands.

Three ways to do it, in ascending order of cost:

**(a) Nothing.** The chime already fires and the note is in block 5 three
messages back, so a good model may well pick it up unprompted. Cheapest, and
probably produces the right thing perhaps half the time.

**(b) A third directive.** `witnessDirective` - she saw the player give
something to somebody. Same shape as the other two, no new state, and it fires
only on a turn where `note` was set. The risk is the section 8 mistake in
miniature: told she watched a gift change hands, a model at this tier may
narrate the jealousy rather than react like a person, which is the exact failure
the cut-in directive is written to avoid. It would need the same discipline -
say what happened, never say how she feels about it.

**(c) Make the gift turn a two-beat exchange by construction** - recipient, then
guaranteed witness. Rejected: it makes the loudest act in the game also the
slowest, and it removes the possibility of nobody reacting, which is sometimes
the more cutting outcome.

**Recommended: (b), after a played campaign says (a) is not enough.** The
question is empirical and the measurement is free - play a group scene, hand
somebody something, read what the others say.

---

## 18. `shared` beats `singledOut`, so the dorm evening is the cheap place to spend openers

**Status: KNOWN and deliberate. Raised 2026-08-23. Watch, do not fix yet.**

Section 5b's three tiers are gated on `singledOut`, except in a shared dorm
activity, where `rumor.js` skips the whole branch first and **nothing** costs
anything. So handing Irene a knowledge gift during the film, in front of the
other four, is free - where the same act in the practice room is the most
expensive thing on the map.

That is the weaker half of PROPOSALS 15's rule and it was chosen knowingly: the
dorm needs one thing that is unambiguously restorative, and a release valve with
an asterisk on it is not one. A player who notices will bank their openers for
Friday night.

Two reasons not to close it yet:

- **The exploit is small.** An opener is worth +5 intimacy and the jealousy it
  dodges is a one-off tick on four members, which attention decays anyway. It
  buys a modest saving for a rigid routine.
- **Closing it costs the valve.** The moment `singledOut` overrides `shared`,
  the player has to think about who they are being seen favouring during the one
  evening designed for nobody to be favoured.

If it does need closing, the fix is one line in `rumor.js` - check `singledOut`
before `shared` - and the honest version pairs it with saying so on the dorm
screen, because a cost the player cannot see is a gotcha.

**What would make it urgent:** a played campaign in which openers cluster on
weekend dorm evenings. That is visible in the ledger, so it is worth looking for
rather than guessing at.

---

## 19. What the player may do while somebody is still speaking

**Status: PARTLY BUILT 2026-08-23, and one half of it is a real open question.**
Raised by Yuhan after a played day: *"the interrupt button is the only button
the player can choose... shall we allow the player other choices?"*

### The half that was a bug, and is fixed

The bar rendered all six controls dimmed and dead with a continue button under
them. Two separate reports, one cause: *"they all present on the screen"* but
nothing works, and *"Irene interrupted herself"* in a one-to-one scene where an
interjection cannot happen. The bar is one control now, the same treatment a
spent block gets, and the label is neutral because in a group scene the next
beat is often somebody else. CLAUDE.md section 6.

### The half that is already true and was invisible

**Turning to somebody is live while reading.** It costs no turn and makes no
call - it is pure client state - so the portrait row stays enabled the whole
time the beats are being tapped through. Somebody cuts in, and the player can
turn to her *before* answering, which is the natural response to being
interrupted and the reason the second voice exists at all.

Nobody could tell, because the row is dimmed portraits and gives no sign it is
tappable while everything below it has gone. Worth making visible - a label on
the row, or letting the addressee marker brighten - rather than worth building
again.

### The half that is open: should a TURN-SPENDING move be allowed mid-reply?

No, and the reason is pillar 1 rather than implementation.

The player reads hidden state and bets on it. Beats are revealed one at a time
precisely so that reading is paced - the meters move across a reply, and acting
on beat one of three means betting before the information the model just wrote
has arrived. Section 6 states it directly: *"choosing a stance mid-reply would
skip her line."*

There is a real argument the other way, and it is worth writing down because it
will come back: **a genuine interruption is exactly the moment a person cuts in
back.** Nana cuts across Irene, and the natural move is to round on Nana
immediately rather than politely finish reading. That is a live feeling the
current design gives up.

Three ways it could be honoured, if it turns out to matter:

**(a) Nothing. Turning to her covers it.** The player CAN redirect mid-reply -
they just cannot speak yet. Cheapest, and probably enough: the intent gets
expressed, the words wait one tap.

**(b) A "cut back in" move on the second beat only.** Available only while an
interjection is unread, spends the turn, and tells the model the player talked
over somebody. Expensive: a new stance, a new directive, a new failure mode
where the player skips a beat they paid tokens for.

**(c) Reveal a cut-in whole rather than beat by beat.** An interjection is one
beat now (the one-beat directive), so in practice it already arrives whole. This
is mostly already true.

**Recommended: (a), plus making the portrait row visibly live during a read.**
The feeling Yuhan is pointing at is *"I want to react to that now"*, and turning
to her IS reacting - it changes who answers next, which is the only thing the
player's response would have decided anyway. Build (b) only if a played campaign
says the one-tap delay is what is missing, because it costs a stance and a
directive to buy something (a) mostly already delivers.

## 20. An anchor event has to decide something

**Status: BUILT 2026-08-24, except the per-cycle stakes clause.** (a), (b),
(c) and (d) all shipped, together with open item 7 - which the design pass found
was a prerequisite rather than a follow-up. The design that was actually built
is "The settled design for (c)" at the end of this entry; it supersedes the
sketch in the middle. **Nothing here has been played by a human yet**, and
`docs/PROGRESS.md` "Still open" item 1 says what to look at first.** Yuhan raised it after
playing the first anchor event, marked it not urgent twice, then raised it a
third time and asked for it ahead of further hand testing. The build order is
in `docs/PROGRESS.md` "Still open" item 1; the argument for why it is three
problems rather than one is here.

**What shipped, and what it did not fix.** An event now opens with a paragraph
of room (`establish`), and every event frame carries an `agenda` of two to four
things the day must decide, restated once by the closing directive. That is the
meeting being *about* something. It is still true that nothing records what the
room decided, which is (c) - and the prediction written here before the build,
that (a) and (b) would produce a livelier meeting that still forgets itself by
Tuesday, is now an observation rather than a forecast.

It was marked *not urgent* by the person who raised it, and it is nevertheless the
largest quality lever left in the game.

The report, on the concept meeting: *"talks too general and random - not
distinguishable from ordinary group chat"*, and the broader version, *"different
playthroughs don't give quite distinguishable experience because dialogues are
always 无营养、水话"*.

The transcript bears it out. Fifteen turns of a meeting that decides the
comeback produced: a joke about ear colour, a joke about who writes the minutes,
a colour preference nobody wrote down, and a plate of food. The ledger line for
the whole day was *"In a comeback planning meeting, Irene accepted the player's
homemade food with guarded warmth."* The event was scenery for a gift.

### It is three separate deficits, and lumping them makes it unfixable

**(a) Nothing establishes the day.** The scene opens the way every scene opens -
one member's beat, *"what she does in the moment she notices the player has
walked in"*. That is right for a wardrobe on a Tuesday and wrong for a room the
whole cast is sitting in for a stated purpose. rv-simulator opens every round
with 350-450 words of literary scene-setting, and Yuhan's comparison names that
as the difference.

Note this is not a case for importing that format. Pillar 1 rules it out
directly: 30-50 word bursts, not 300-word narration, and a story generator is
the thing this project stopped being. But an **event** is exactly where the
exception earns its keep - a whole day, sixteen turns, the whole cast, the
`event` register already written for it. One establishing beat, from nobody, is
maybe forty words and it is the cheapest part of this entry.

**(b) The agenda is atmosphere, not business.** Look at what
`data/events/index.js` actually gives the model for `concept_meeting`:

```
'the boards going up, and which one she reacts to before she can stop herself'
'the part of the concept that asks something of her specifically'
'an idea getting cut, and the room going carefully polite'
```

Every movement is an emotional situation. Not one of them says *a title track
gets chosen today*. The model was asked for feelings in a meeting room and it
delivered feelings in a meeting room, which is a content bug wearing the costume
of a model failure. The frame rule - **a movement sets the SITUATION and never
the OUTCOME** - is correct and is not what is missing; what is missing is a
second field beside it saying what the day has to produce.

**(c) Nothing is recorded, so nothing accumulates.** Even had the room settled
on a concept, there is nowhere to put it. `dossier` is per member. `ledger` is
chronology, one sentence, and the summarizer spends it on whatever the scene was
emotionally about. So the comeback the group spent a day designing does not
exist in week 2, and cannot be referred to in week 5, and the second and third
cycles have nothing to escalate from.

This is the one that explains Yuhan's *"different playthroughs don't feel
distinguishable"*, and it is the one with real cost.

### What to build

**(a) and (b) are cheap and go together.**

- An `establishing` directive for `kind: 'event'`: one beat, no speaker, what
  the room looks like and what is about to happen in it. Then the ordinary loop.
- An `agenda` field on the event frame, listing two to four things the day must
  decide. For the concept meeting: the concept, the title track, the styling,
  the MV idea. Model-facing English like everything else in that file.
- The closing directive for an event says so: *before this ends, the room
  settles what it came to settle.*

Concreteness is the whole point, and it is what makes a run its own. A model
that has been told to name a title track will name one; Yuhan's example is
exactly right - *"1st comeback, all agreed on Irene's advice: classic R&B. Yeri
and Jisoo liked the player's idea of shooting the MV at a beach."* That is a
sentence a player remembers, and nothing in the current design asks for it.

**(c) is a schema change and should follow.**

> Superseded by "The settled design for (c)" below, which keeps the three
> reasons and replaces everything else. The sketch here got the shape right and
> two things wrong: it assumed canon could be injected wholesale, and it did not
> notice that the chain it implies cannot run on the current calendar.

A run-level **canon**: `run.canon`, a short list of decided facts with the cycle
they were decided in. Written by an extra field on the event's scene-exit call
(`decisions[]`), injected into block 4 as one or two lines, and English like all
memory (section 19 rule 2).

Three reasons it belongs at run level rather than in the ledger:

1. It is **not chronology**. "The title track is 'Static'" is true from the
   moment it is decided until the campaign ends. The ledger compacts and drops;
   canon must not.
2. It is **not per member**, so the dossier's roster scoping is wrong for it -
   every member knows what the group decided.
3. It is the missing input for **cycles 2 and 3** (open item 6). An event that
   can read what the last cycle decided is an event that can escalate, which is
   the reading of PROPOSALS 10 that was passed over.

Cost: a `schemaVersion` bump and a `fromSave` default, one summarizer branch,
~30 tokens in block 4.

### The second event PREP does not have

Yuhan also asks for a **comeback MV shoot** as an anchor. PREP carries only
`event_a` today (`meeting_room`); `comeback` and `rest` carry two each. So this
is a genuine hole rather than a preference, and the group activity `mv_shoot`
already exists in `data/activities.js` - the calendar has been sending the cast
to shoot an MV since M1 with no authored day behind it.

It also happens to be the best possible test of canon: an MV shoot that reads
back the concept the meeting chose is the shortest demonstration that a
campaign remembers itself.

Needs `event_b: 'mv_set'` on the prep map, a location with a high `exposureBase`
and full `presence`, an entry in `data/events/index.js`, `event.*` i18n keys in
both locales, and a check against `soloCoverage` - the map assertions are the
thing most likely to catch this, which is what they are for.

### Recommended

**(a) and (b) now, (c) and the MV shoot as one follow-up.** The first pair is a
directive and a data field and it will move most of the felt quality; the second
pair is where a campaign starts remembering what it decided, and it wants the
save-schema change done deliberately rather than mid-playtest.

Do not do (c) by widening the ledger. A summary that must carry both a feeling
and a fact will carry the feeling, every time - the played transcript is the
evidence, and it chose the plate of food.

### Two things learned since this was written, both of which change the build

**The establishing beat is an OPENING beat, so it carries the language.** The
language split was reproduced after this entry was drafted, and it lives on
exactly this turn: block 5 is empty, everything above it is English, and the
model has nothing in the target language to continue from. An anchor event is
the worst case because block 4 also carries the frame and the register.
`openingDirective(lang)` now states the language inline, and anything that
replaces or precedes it at an event must do the same. Getting this wrong would
reintroduce a bug that took four sessions to reproduce.

**The complaint is not confined to events.** The third report widened it: *"all
dialogues (1v1, group, special group, 1v1 dating) are random and shallow small
talks with nearly no advancing."* Events are the sharpest case and the right
place to start - they are authored, they already have a frame, and they are
where a decision has somewhere to go - but (b) should be looked at again for
ordinary blocks once it is working. `ACTIVITY_DOING` already tells the model
what she is doing there; what it does not say is what the scene is FOR.

### The settled design for (c), and for (d) with it

Designed with Yuhan 2026-08-24 and accepted whole. This supersedes the sketch
above. Nothing here is built yet.

#### It is not (c) then (d). (d) and open item 7 are PREREQUISITES.

The sketch assumed canon was a self-contained schema change. Reading the code
rather than the design says otherwise, and this is the finding that reorders the
whole thing:

| | what the code does | what it costs the design |
|---|---|---|
| **PREP has one event slot** | `PHASE_MAP.prep` carries `event_a: 'meeting_room'` and no `event_b` | the concept meeting has nothing to hand off to, so the chain has a hole at its first link |
| **Events fire once per CAMPAIGN** | `eventKey(phase, slot)` is `"prep:event_a"`, and `flags.firedEvents` filters `generateWeek` | cycles 2 and 3 have **no events at all**, so there is never a second concept meeting to escalate |

So an event that reads what the last cycle decided is impossible today for a
reason that has nothing to do with canon: there is no last cycle. `docs/PROGRESS.md`
open item 7 already says as much from the other direction - *"Item 1's canon is
the missing input"* - and the two entries were each waiting for the other.

The MV shoot therefore stops being content to do last. It is the second link in
the chain and it is built first.

#### The chain, and why it is four events rather than six

```
prep_a  concept meeting  --+
prep_b  MV shoot          |
comeback_a  music bank    |   each reads what the one before it settled
comeback_b  fan meeting  -+
     |
     +--> next cycle's prep_a
```

Four recurring events per cycle, not six. `company_cruise` and `island_trip`
stay **once-per-campaign punctuation** and stay out of the chain.

Two reasons, and the second one is a number nobody had priced.

**REST is the repair week.** Its job is converting `piqued` jealousy before it
hardens (section 10), and two mandatory whole-cast days out of its five weekdays
works directly against that.

**Event days do not generate a daily task**, and that is a supply line. Task ->
credits -> gifts. Six recurring events would be 6 of 15 weekdays a cycle - 40%
of the working game, against 11% today - and cutting weekdays by 40% cuts the
credit supply by roughly the same. Open item 4 already reports **36 facts with
nothing to spend them on and credits ending a campaign at 0-2**, so this would
make a known problem measurably worse for a reason that looks unrelated to it.
Four recurring plus two punctuation events is ~14 event days a campaign, ~31%,
and the harness measures the credit effect before any of it merges.

The loop also closes better at four: **what the fandom latched onto at the fan
meeting feeding the next concept meeting** is sharper than an island trip
feeding it.

#### Storage and injection are different things

The single most useful thing to come out of the design pass, because it dissolves
the question the sketch could not answer - *what happens when canon fills up?*

- **Storage is complete and never compacts.** Every decision, every cycle. This
  is what the player reads.
- **Injection is small and filtered.** Never more than about six lines in block
  4.

Nothing has to fit in a prompt, so nothing has to be thrown away. The ledger's
compaction rule (section 7) exists because the ledger IS the prompt; canon is
not, so it does not inherit the constraint.

#### An agenda item is an id and two texts

`agenda` currently holds bare strings. It becomes:

```js
agenda: [
  { id: 'concept',     text: 'which of the mood boards becomes the concept for this comeback' },
  { id: 'title_track', text: 'which of the demos is the title track' },
  { id: 'styling',     text: 'the styling the concept commits them to, and which member it asks the most of' },
  { id: 'centre',      text: 'who gets the centre position for the promotion' },
],
reads: ['fan_reaction', 'promotion_lead'],
```

Three separate things only work with an id, which is why it is not optional:

1. **Superseding.** Cycle 2's `title_track` replaces cycle 1's for injection
   purposes while both stay in storage.
2. **The chain.** `reads` names which earlier topics this day is handed.
3. **Validation** - below, and it is the important one.

A canon entry is then:

```js
{ topic, text, display, cycle, phase, slot }
```

**`text` is English and `display` is in `meta.lang`**, and this is not
symmetry-for-its-own-sake. Section 19 rule 2 keeps all memory English so a
language switch cannot corrupt history - which means a `zh` player's handbook
would show their own campaign's decisions in English on an otherwise Chinese
screen. That is precisely the bug section 12 already fixed once for
`learnableFacts` (*"a fact is an id, and it has two texts"*), and the summarizer
already returns `display` beside `summary` for exactly this reason. Getting it
wrong here would be making the same mistake a third time.

#### What stops a decision being invented

Yuhan's answer was *"strong prompt must decide XX, YY, other topics: ZZ, and
always only store XX and YY"*, and with ids the second half stops being a hope:

> **A `decisions[]` entry whose topic is not in this event's agenda is dropped
> entirely.**

That is the parser's roster rule (section 9, rule 3) in a new place, and it is
here for the same reason: it is the only kind of defence that does not depend on
the model cooperating. The summarizer's existing four-level tolerant fallback
handles the rest - a failure returns no decisions and never throws.

The "other topics: ZZ" half needs no new field. `movements` is already exactly
that list, and it stays unstored, which is what keeps the section 11 rule intact.

**A topic the day never reached is simply absent.** No filler, no placeholder. A
decision recorded for nothing is worse than one never recorded - the same
judgement `learnableFacts` makes about a fact awarded for nothing - and the
consequence is only that the next event in the chain reads one line fewer.

#### Where it goes in the prompt

Block 4, which is rebuilt at every scene start and therefore free in cache terms
(section 8).

| scene | what it carries |
|---|---|
| **ordinary** | two or three lines of the current cycle's canon |
| **event** | its `reads` topics, plus the same-slot entries from previous cycles |

Ordinary scenes getting it is a deliberate widening of the sketch and most of
the felt value: **Irene mentioning the title track in a wardrobe conversation on
a Tuesday** is pillar 4 working - memory that shows in the scene rather than in
plumbing. It costs nothing that block 4 was not already paying.

Capped at about six lines wherever it appears. Block 4 orders by immediacy
(section 8), and eighteen world facts would drown the standing sentence, which
is the one line in there that makes every reaction proportionate.

#### The event knows which time it is

Each recurring event carries a per-cycle stakes clause, so cycle 2's concept
meeting is not cycle 1's with different numbers: *the last comeback's title
track was X, and it did or did not land.* This is the difference between
escalating and repeating, and it is the reason the chain is worth building at
all.

It is also the largest authoring cost in the whole entry - four events times
three cycles of stakes - so it is the last thing built and the first thing to
cut if it does not read well.

#### Where the player sees it

A handbook: the assistant's own notes, listing what each cycle decided, in
`display` text.

**On the day screen, not as a room action.** A room action reads as costing a
block, and reading your own notes must not. Section 10's rule that privileging
something visually turns a choice back into an errand is about *choices*; a
reference list is not one, and the opposite rule applies to it.

Without this, canon reaches the model and never the player, which is the exact
failure pillar 4 exists to forbid.

#### Build order

Each step is playable on its own, which is the property that makes it safe to
stop between any two of them.

| | | why here |
|---|---|---|
| 1 | **(d)** the MV shoot - PREP `event_b` | the chain has a hole without it, and it is pure content |
| 2 | **item 7** - `firedEvents` keyed `phase:slot:cycle`, four recurring | cross-cycle escalation is impossible without it. **Measure the credit and task effect here**, before anything depends on it |
| 3 | **(c1)** agenda ids, `run.canon`, summarizer `decisions[]`, the drop rule | the schema change: `schemaVersion` bump and a `fromSave` default |
| 4 | **(c2)** injection into block 4, `reads` chains | the first step where a campaign visibly remembers itself |
| 5 | **(c3)** the handbook | |
| 6 | per-cycle stakes clauses | authoring, and cuttable |

#### One thing checked and found already built

Yuhan also asked that the prompt name the player by identity rather than
assuming assistant. Block 1 has done this since the pronoun fix:

```
The player is {name}, {identity.promptRole}.
She is a young woman, and the women in this story are who she is drawn to.
```

The role comes from the chosen identity with the default identity's own line as
the fallback, so nothing is hardcoded - MVP simply ships one identity. No change.

---

## 21. Dating is unreachable in week 1, and the fix is not a lower gate

**Status: OPEN, raised by Yuhan 2026-08-23.** *"Stepped threshold for week 1 and
week 8's public & private dating. Otherwise player hardly have in-depth
development chance with 1 character. But the dating texture should be different
for week 1 and week 8."* Marked not urgent, and it blocked a hand test, which
is why it is written up now.

### The observation is right and the diagnosis needs care

A private date gates on `intimacy >= 50`, a public one on `admissibility >= 30`.
After two played days across five members the highest intimacy in the run was
15, so the weekend arrived with nothing to spend it on and the whole dating
system - the largest admissibility lever in the game - stayed untested.

But the gate is doing exactly what section 5b asks of it. **Breadth is cheap
while everything is shallow**, and a player who spread five ways in week 1 is
supposed to find that no single route is deep enough for a day alone. A devoted
player reaches 50 by the first weekend on the current numbers; the run that
produced the report was not one.

So the honest reading is that **the gate is correct and the CURVE is empty**. In
week 1 the player has three blocks a day, no credits, no facts, no openers, and
nothing that costs a weekend. There is no early-game move that means anything.
That is a content hole, not a threshold that is too high.

### Why scaling the constant by week is the wrong shape

`intimacy >= 50` is not one number. It is the same number as the `touch` stance
and as her bedroom door, and CLAUDE.md says why in two places: *"you may go into
her room" and "you may reach for her hand" unlock together, which is the correct
reading.* Scaling it by week unhooks all three, or worse, unhooks one of them
and leaves a game where the player can be taken on a private date by somebody
they may not touch.

The same objection applies twice over to the public gate. `admissibility >= 30`
is what makes a public date the plateau's own answer to itself: a player deep in
`confidante` gets the private date easily and cannot get the public one at all,
which is the single clearest statement the mechanics make of the game's thesis.
A week-scaled floor deletes that.

### What to build instead: a smaller thing to spend a weekend on

The want is *an early, lower-stakes version of a date*, not the same date
earlier. That is a different object and it can be added without touching a
threshold:

- **Costs one block, not the day.** So it competes with a scene rather than with
  three.
- **Gates low** - somewhere near `colleague`, i.e. the point at which two
  colleagues would plausibly get coffee after work.
- **Moves intimacy only**, and modestly. It is not a lever on the second axis;
  the whole point of the real public date is that it is the loud one.
- **Refusable on the same shape**, because a refusal is where a hidden number
  becomes a visible yes or no (section 10), and that is worth meeting in week 1
  rather than week 4.

This also gives the weekend something to be about before the routes are deep,
which is the actual hole, and it leaves the two axes' thresholds alone.

### The texture half is already answerable, and for free

*"Dating in the beginning, you and the character are not sure and nervous."*
Correct, and nothing new is needed: `standing` already reaches block 4 as a
sentence, and the date frame in `data/sceneFrames.js` is per kind. Vary the
frame by stage rather than by week - **week 8 is not the variable, closeness
is** - and a first date at `good_friends` writes itself differently from one at
`unspoken` with no new system, no new numbers, and no risk of a week-4 date
reading as nervous because the player took it slowly on purpose.

### Recommended

**Neither now.** The threshold change is the one thing here that should not be
done, and the coffee block is a new mechanic proposed off two played days.

The immediate answer to the blocked hand test is that a **devoted week reaches
the private date on the current numbers** - three blocks a day on one member for
five days, which is also the run the harness has never played (open item 5). Do
that test first. If a focused week still cannot reach 50, the gate is wrong and
this entry is wrong about why; if it can, then what week 1 is missing is
something to do, and the coffee block is the cheapest version of it.

The stage-varied date frame is worth doing whenever dates are next touched. It
costs a table and no numbers at all.
