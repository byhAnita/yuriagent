# YuriAgent

An LLM-driven visual-novel / life-sim PWA set in a fictional K-pop agency.
Mobile-first, offline-playable, zh / en.

**Play it: https://byhAnita.github.io/yuriagent/**

> That URL is the **hand-test build**, deployed from `dev`. It is a work in
> progress and will sometimes be mid-thought. See "Two deployments" in
> `CLAUDE.md` section 17.

---

## Not affiliated with anybody

Fan-made, non-profit, MIT-licensed. **Not affiliated with, endorsed by, or
connected to any agency, artist, or company.**

The characters are **fictional personas** presented as animal mascots. There is
no real-person likeness art anywhere in the shipped card library. Card content
stays at persona level - preferences, routines and running jokes - and never
touches a real person's health, body, relationships or private life, including
things they have discussed publicly themselves. Two `learnableFacts` were cut
under that rule after being written. Both would have played fine; the line is
easier to hold at "not at all" than at "tastefully".

Full guardrails: `CLAUDE.md` section 22.

---

## It runs with no API key

`tools/mockClient.js` writes in the real contract format, so the whole game -
scenes, chips, gifts, the calendar, endings - is playable offline. That is a
**supported mode, not a degraded one**: it keeps the loop free to play and lets
development continue without spending tokens.

With a key, it routes to an OpenAI-compatible provider. **The key lives in
`localStorage` on your own device**, is never logged, never committed, and goes
nowhere but the model endpoint you chose. It is not in this repo and it is not
in the deployed build - the provider variables in `.env.local` deliberately
carry no `VITE_` prefix, because Vite inlines every `VITE_*` variable into the
client bundle at build time.

---

## Running it

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # vitest, 1035 tests, all offline and free
npm run lint     # oxlint
npm run build
```

The live-provider suites are opt-in and need a key: `LIVE_PROVIDER=1`,
`LIVE_QUALITY=1`, `ZH_SMOKE=1`. The default suite spends nothing.

## Debugging on a phone

Every model call is recorded in a 40-call ring, unconditionally - a bug found
by hand is found once, so the evidence has to already be there.

- **Desktop:** `yuri.dump()` in the console.
- **iPhone / iPad:** iOS runs WebKit under every browser, so Chrome there has
  no devtools. Add **`?debug=1`** to the URL for an in-page console overlay,
  which has a one-tap `yuri.dump()` button. The flag sticks across reloads
  (an installed PWA drops query strings); `?debug=0` clears it.

The overlay is a dynamic import in its own chunk, so nobody who has not asked
for it ever downloads it.

---

## Where the design lives

- **`CLAUDE.md`** - the design. Read it before changing anything; it is the
  argument for why each mechanic is the shape it is, not a summary of the code.
- **`docs/PROGRESS.md`** - where the design currently stands in code, what has
  been played by hand, and what is still open in recommended order.
- **`docs/PROPOSALS.md`** - changes argued for but not made. Read it before
  touching a coefficient.

These are working documents written to be argued with, including the
post-mortems on bugs that shipped. That is deliberate: nearly every real defect
found in this project so far has been in code that had tests and passed them,
and the reasons why are more useful written down than tidied away.
