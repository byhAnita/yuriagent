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

**Status: AGREED 2026-08-22 with Yuhan. Not implemented.** One question is still
open (cycles, below). This entry replaces the earlier sketch; the parts of that
sketch that were wrong are recorded at the bottom rather than deleted, because
both were wrong in instructive ways.

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

**Status: AGREED 2026-08-22 with Yuhan, recommendation below. Not implemented.**
Raised because group scenes break the current placement.

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

**Status: AGREED 2026-08-22 with Yuhan. Not implemented.** Supersedes the
round-robin sketch in section 10c.

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

**Status: AGREED 2026-08-22 with Yuhan. Not implemented.** Raised by Yuhan while
planning dating: a whole-day scene played at ordinary-chat register will drift.

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
