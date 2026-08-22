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

**DONE 2026-08-22 - option 1.** `turnDeltas` averages within a reply.
Re-measured live: beat count no longer predicts payout - a 7-beat scene dropped
guard 19 and a 19-beat scene dropped 6. The thresholds moved with the unit,
because a mean is smaller than a sum by construction and the old fluster bar of
60 had become unreachable: `GUARD_DROP_TO_PAY = 12`, `FLUSTER_PEAK_TO_PAY = 30`.

It also surfaced a measurement problem worth keeping in view: **the offline
writer is 2-3x more generous per turn than DeepSeek**, so every payout figure
the campaign harness reports is an upper bound. Aligning the mock's magnitudes
with the live model would make the harness numbers trustworthy, and would mean
re-baselining a lot of existing test expectations.

### Measured

Six identical seven-turn scenes against DeepSeek, same setup, same stances:

| beats | guard drop | fluster peak | paid? |
|---|---|---|---|
| 7 | 9 | 23 | no |
| 7 | 0 | 23 | no |
| 21 | -1 | 67 | yes |
| 13 | 25 | 63 | yes |
| 21 | 25 | 80 | yes |
| 21 | -4 | 85 | yes |

Every seven-beat scene paid nothing. Every twenty-one-beat scene paid. The
model writes one to three beats per turn as a stylistic choice, deltas are
per-beat and the client sums them, so **a scene is worth roughly three times
more when the model is feeling verbose.** The player did the same things in all
six.

### Why it matters

Section 6's whole claim is that the player reads hidden state and bets on it. If
the payout is driven by the model's paragraph count, the bet is partly a
coin-flip on prose length, and the feedback the player gets is noise on top of
signal. It also makes every threshold in section 6 untunable: whatever value is
chosen is right for one beat count and wrong for the other.

### Options

1. **Average within a turn.** A turn's movement is the mean of its beats rather
   than the sum. Three beats in one reply are one exchange described in three
   moments, so a mean is arguably the truer reading of "where her guard is now".
   One line in `applyBeatToMeters`.
2. **Cap per-turn movement** at, say, ±10 guard. Cheap, but measured per-turn
   movement was already near 10 in the verbose runs, so it compresses the spread
   without removing it.
3. **Ask for exactly one metadata line per turn** and let the prose carry the
   beats. Cleanest signal, but it throws away the per-beat emotion track that
   drives the portrait, which is a real loss.

**Recommendation: option 1**, and re-run the six-scene sample to confirm the
spread narrows before touching any threshold.

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

## 10. The map should change with the phase, and some scenes should be authored

**Priority: high. This is the next big content decision, and it is M5-shaped.**
Proposed by Yuhan, 2026-08-22. Not implemented - written down for confirmation
before any code moves.

### The idea

The map is currently one fixed set of ten locations for all nine weeks. It
should instead change with the company phase, so that a cycle *looks* like a
cycle:

| Week | Phase | Map |
|---|---|---|
| 1 | PREP | **X Entertainment** as a two-step menu like the dorm: practice room (dance), recording studio (vocals), wardrobe (fitting), **meeting room** (comeback planning), **tea room** (replacing the corridor - where you overhear things). Plus X Dorm, cafe, filming location. |
| 2 | COMEBACK | **Music Bank** (performing), **fan meeting hall**, **variety taping stage**. Plus the dorm and a bistro. |
| 3 | REST | Dating and holiday places: **Han River bridge**, **Jeju**, a **cruise**. |

And alongside it: **authored event scenes** injected once at specific moments -
a comeback planning meeting, a fansign - mixed in with the ordinary generated
ones.

### Why it is right

Three arguments, and the third is the strongest:

1. **It makes the phase legible in the place the player spends most of their
   time.** Section 10 already claims each week has a distinct feel - build,
   risk, repair - and right now the only evidence for that is a word in the
   header and a different activity label. A player who never reads the calendar
   would not notice the cycle turning.
2. **It answers "why is this scene different from the last one" at the level
   above the one just fixed.** Block 4 now says what she is doing; this says the
   world has moved on. A REST week that opens onto Jeju is a different game from
   a PREP week in a rehearsal room, and that is free variety for the model.
3. **It fixes an asymmetry the harness measured.** Only three locations
   (`cafe` 60, `drama_set` 65, `broadcast_studio` 85) sit above the risk
   threshold, and members are rarely at them - measured, only 35-40 of ~107
   scenes in a campaign were public at all. The whole second axis runs through
   that narrow gate. Week 2 and week 3 as proposed are *full* of public places,
   which would let COMEBACK be the week admissibility actually moves and REST
   be the week you can be seen together off duty. That turns the phase cycle
   into the game's pacing rather than set dressing.

### What it costs

Honest accounting, because this is the largest change on this list:

- **`data/locations.js` roughly triples.** Every new location needs
  `exposureBase`, `presence`, `zone`, an English label and a note, plus en/zh
  strings, plus `soloActions` entries or it is dead space for the block the
  player spends alone.
- **`data/activities.js` needs new activity types** and their `doingLine`.
- **`calendar.js` needs a phase-scoped location pool** for the idle layer -
  `WEEKDAY_IDLE` / `WEEKEND_IDLE` are currently flat arrays.
- **The map UI needs a second two-step zone.** The dorm already does this, so it
  is a pattern to copy rather than invent.
- **`exposure.js` needs nothing.** The numbers already do the work.

I would do it in that order and ship it behind the existing `zone` field, which
already exists precisely for this.

### Two things I would push back on

**Jeju and a cruise are not day trips.** The clock is three blocks a day and a
member's schedule is generated per block; an island is a *day*, not a morning.
Either they become whole-day events that consume all three blocks (which the
clock does not model), or they are quietly just "a location with high exposure
and no witnesses", which wastes the idea. My suggestion: keep Han River and a
few local outings on the block clock, and make Jeju/cruise the **authored
event** kind below, where consuming a whole day is the point.

**Do not let the location list outgrow the cast.** Five members across three
blocks means at most five occupied locations at any moment. A map of twenty
rooms in week 2 is mostly empty rooms, and empty rooms are solo work - which is
good, but it dilutes the chance of finding anyone. Roughly eight to ten
reachable locations per phase is the ceiling before the map becomes a search
problem rather than a choice.

### Authored events: what they are, and the one rule

An event scene is a prompt fragment injected **once**, at a specific
(week, day, block), that replaces the generated opening with an authored
situation - the comeback planning meeting, the fansign, the last night of the
cruise.

`eventWindows()` already returns the six weekend blocks per week and
`data/events/` is empty; this is the M5 line item that was always coming.

The one rule that matters: **an event may set the situation, never the
outcome.** It says "the five of you are in a meeting room and the label has
just moved the comeback forward two weeks"; it does not say how she reacts to
you. Everything the engine already does - standing, dossier, her voice, the
meters - still writes the scene. An event that scripts her reply is a branching
text adventure, which section 1's non-goals rule out explicitly.

Two consequences worth stating now:

- Events are the natural home for **group scenes** (2+ members), which section 9
  restricts to "scripted event nodes, where the prompt is tight". That is still
  blocked on the two-portrait stage.
- Events are the only place a **whole-day** cost makes sense (Jeju, the cruise),
  so the clock would need an "event consumes the day" concept. That is small,
  but it is new.

### Recommendation

Do it, in two separable pieces, and not at the same time:

1. **Phase maps first** (data + calendar + one UI zone). Pure content and
   deterministic systems, no LLM, testable, and it delivers most of the variety.
2. **Authored events second**, as the M5 event-anchor line item, starting with
   one per phase - a comeback meeting in PREP, a fansign in COMEBACK, one
   outing in REST - to prove the shape before writing nine.

Piece 1 is a good session on its own. Piece 2 wants the two-portrait stage
first, or its best material (a group scene) is unavailable.
