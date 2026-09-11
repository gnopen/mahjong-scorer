# Mahjong Scorer

A mobile-first web app for scoring Mahjong at a physical table. Photograph the
winning hand, confirm the tiles, and the app scores it, explains every point,
works out who pays what, and writes the round to a ledger.

Rule set: **Chinese Official** (Mahjong Competition Rules, 1998), checked
against *A Guide to Mahjong (Chinese / Official International Rules)*. All 81
scoring hands with the guide's own hand numbers, its "cannot be combined with"
table, an 8-point minimum, the flat 8-point base on every payment, and the
30-point penalty for declaring short.

It also runs the table, not just the score: drawing for seats, the two dice
throws, where to break the wall, and how the seats rotate through all 16 hands.

---

## Running it

```bash
npm install
npm run dev
```

The app works immediately with no backend. Games are stored in the browser via
IndexedDB and scoring runs from the manual tile picker.

```bash
npm test        # engine tests
npm run build   # production build (PWA, installable to a phone home screen)
```

## Deploying to Vercel

The project is a static Vite site plus one serverless function, so Vercel needs
no configuration beyond what is already in `vercel.json`.

```bash
npx vercel          # first run links the project and asks you to sign in
npx vercel --prod   # publish
```

Vercel picks up the build from `vercel.json`: `npm run build` into `dist`, with
everything except `/api/*` rewritten to `index.html`.

**Turn on photo recognition** by adding one environment variable in the Vercel
project settings, then redeploying:

| Variable | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |

`api/recognize.ts` runs on the Edge runtime, holds the key server-side and
answers on `/api/recognize`. A deployed build looks there automatically, so no
`VITE_` variable is needed. Without the key the site still works; the recognition
card simply reports that this deployment has no key and the tile picker gives
the same score. `RECOGNIZE_BASE_URL` plus `RECOGNIZE_API_KEY` point the function
at any OpenAI-compatible endpoint instead.

**Turn on shared games** by adding the Supabase variables as well:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your project URL |
| `VITE_SUPABASE_ANON_KEY` | your anon key |

Those two are read at build time, so a redeploy is needed after changing them.

## Playing on more than one phone

Out of the box there is **no cross-device sync**. Games live in the browser's
own IndexedDB, so two phones each keep a separate game. Tabs in the same browser
do update each other live, over a BroadcastChannel.

Two separate things are needed to play across devices.

**1. Let the other devices reach the app.** `npm run dev` binds every
interface, so phones on the same wifi can open `http://<your-ip>:5180`. Find the
address with `ipconfig` on Windows or `ifconfig` on macOS and Linux. The
recognition server needs the same treatment, which `npm run dev:all` does for
you; the app calls it on whatever host the page came from, so no extra config.

**2. Make them share one game.** This needs Supabase:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor. It creates the tables, the
   balance view, the reconcile and void functions, row-level security, realtime
   publication and the photo bucket.
3. Copy `.env.example` to `.env` and fill in the project URL and anon key.
4. Restart `npm run dev`. Settings should then read "Synced through Supabase".

Every phone pointed at the same game then sees the scoreboard update the moment
a round is saved, because the store subscribes to Postgres changes on rounds,
transactions and the game row.

## Tile recognition

```bash
npm run dev:all     # the app and the recognition server together
```

`npm run recognize` starts a small Node server on port 8788 that reads hand
photos. It is the default recognition endpoint during `npm run dev`, so photo
scoring works on a laptop with nothing deployed. The app checks
`GET /health` on load, so the screens report what is actually running rather
than guessing.

The server picks a model provider automatically, in this order:

| Provider | Turned on by | Notes |
| --- | --- | --- |
| Anthropic API | `ANTHROPIC_API_KEY` | Fastest and most accurate. |
| OpenAI-compatible | `RECOGNIZE_BASE_URL` | Any chat-completions endpoint, including `hermes proxy start`. |
| Hermes CLI | Hermes installed | No key needed; uses whatever provider Hermes is logged into. Around 30 seconds per photo. |

Force one with `RECOGNIZE_PROVIDER=hermes|anthropic|openai`. Every provider gets
the same prompt from `server/prompt.mjs`, and the server drops any tile id it
does not recognise rather than guessing.

### The endpoint the app talks to

1. `VITE_RECOGNIZE_URL`, if set
2. the deployed Supabase Edge Function, if `VITE_SUPABASE_URL` is set
3. `http://localhost:8788/recognize` during `npm run dev`
4. `/api/recognize` on the site's own origin, which is the Vercel function

For a hosted deployment, use the Edge Function:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy recognize-tiles
```

It holds the key and proxies the photo to Claude, so the key never reaches the
browser. `VITE_DEV_ANTHROPIC_API_KEY` calls the API straight from the page for
local experiments only; never ship a build with it set, because anything in a
`VITE_` variable is public.

Recognition output is never scored directly. It always lands in the tile editor
first, with low-confidence tiles ringed in amber, and nothing is calculated
until the player confirms the reading.

---

## At the table

**Draw for seats.** New Game deals the four winds out at random. Whoever draws
East takes seat 0 and deals the first hand.

**Throw and break.** The wall screen walks the two throws in the guide's order.
East throws first and the total is counted counter-clockwise around the four
sides, East's own side counting as 1. That player throws in turn, and the total
is counted in from the right-hand end of their side to fix the gap. Dice can be
rolled in the app or typed in when the table uses real ones. The chosen side is
drawn stack by stack with the break marked and the 14-tile dead wall shaded.

Two parts of that are house rules, set per game and changeable mid-game:

- **One throw or two.** The guide throws twice. Many tables throw once and let
  the same total pick both the wall and the stack.
- **Count from the right or the left.** The guide counts from the right-hand
  end of the chosen side. Counting from the left is a common variation and puts
  the gap in the mirrored position. Either way the dead wall stays to the right
  of the gap, because that is fixed by the direction tiles are drawn, not by
  which end you counted from.

**Rotation.** After every hand each wind advances one step: East becomes South,
South becomes West, West becomes North, and North takes over as the new East.
Four hands to a round, four rounds to a game. The table screen shows the current
seating as a compass with arrows for the direction of play, and the rotation
screen shows the next hand plus the whole 16-hand schedule.

**Everyone enters their own hand.** Open the game on each player's phone and
each person claims their seat once. From then on they keep their own tiles up to
date during the hand, in the gaps between turns, and the table screen shows who
is ready. Whoever wins taps "I won this hand" and goes straight to the winning
tile, so a win does not begin with three people waiting for one to type out
fourteen tiles. Drafts clear themselves when the hand advances.

One phone still works: you can claim any seat, or ignore the feature entirely
and use the photo or manual entry as before. Sharing drafts across devices needs
Supabase, like the rest of the live sync.

**The guide screen** shows the tile set drawn the way the guide draws it, plus
building the wall, dealing, claiming a discard and rounds.

**Every scoring hand has a worked example.** The rule table draws a real
winning hand for each of the 81 patterns, with the winning tile marked and any
claimed set or concealed kong labelled. The explanation screen shows the same
picture next to your own tiles, so a pattern you have not met before can be
read at a glance rather than parsed from a sentence.

The examples are not decoration: `tests/examples.test.ts` builds each one as a
real hand, checks it is a legal win, and checks the pattern it illustrates
actually fires. A picture that stops matching its rule fails the build.

**The minimum is a house rule.** The guide plays 8 points for tournaments, but
home games usually let anything win, so a new game defaults to no minimum at
all. Pick 0, 1, 4, 8 or your own number when starting, and change it mid-game
from House rules on the table screen. With a minimum set, a hand declared under
it costs the declarer 30 points, 10 to each of the others; with no minimum,
nothing is ever scored as short.

## How it is put together

```
photo ─┐
       ├─> HandInput ─> validator ─> decomposer ─> rule engine ─> exclusions
manual ┘                                                              │
                                                                      v
                                              score ─> payment engine ─> ledger
```

There is exactly one scoring path. The camera flow and the tile picker both
produce the same `HandInput`, so a hand entered by hand and a hand read from a
photo cannot disagree.

### `src/engine`

| File | What it does |
| --- | --- |
| `tiles.ts` | Tile model, ids, names, suits, terminals, honors, tile predicates |
| `hand.ts` | `HandInput`, melds, win flags, game context |
| `decompose.ts` | Every legal reading of a set of tiles |
| `view.ts` | Precomputed per-reading facts the rules read |
| `validator.ts` | Whether a hand can win at all, with messages for players |
| `rules/mcr/` | The 81 patterns, the exclusion table and a worked example each |
| `setup.ts` | Seat draw, dice, wall break, and the 16-hand rotation |
| `scorer.ts` | Evaluates, suppresses overlaps, keeps the best reading |
| `payments.ts` | Turns a score into per-player transactions |
| `ruleset.ts` | The configuration object that ties the above together |

### Recognition back ends

All four speak the same request and response shape, so the app cannot tell them
apart. A `GET` on the endpoint reports whether it can answer; a `POST` reads a
photo.

| Where | What it is |
| --- | --- |
| `server/recognize-server.mjs` | Local Node server for development, wrapping Hermes, an Anthropic key or an OpenAI-compatible endpoint |
| `api/recognize.ts` | The Vercel Edge function, used by a deployed build |
| `supabase/functions/recognize-tiles/` | The Supabase Edge Function, used when Supabase is configured |
| `shared/recognizePrompt.js` | The one prompt all three send |

**Decomposition matters.** The same 14 tiles often read more than one way, and
the readings score differently. The engine builds all of them, scores each, and
keeps the highest, which is what the Chinese Official rules require.

**Overlapping patterns.** The table holds two different relationships.
*Containment* is evidence-scoped: when a pattern absorbs another, only the
occurrences whose tiles it already covers are dropped, so Big Three Winds
absorbs the three wind triplets under Pung of Terminals or Honors while an
unrelated triplet of 1 Bamboo keeps scoring. Containment is transitive, because
Seven Shifted Pairs contains Full Flush which contains One Voided Suit.
*Conflict* is the guide's flat "cannot be combined with", and it does not
propagate: Four Concealed Pungs blocks Fully Concealed Hand without also
blocking Self-Drawn. Every suppressed pattern is still shown on the explanation
screen, so the arithmetic can be checked at the table.

**Where the wait came from.** Edge, Closed and Single Wait only score when the
hand was waiting on exactly one tile, which is the guide's "invalid if there are
any other waits". The engine takes the winning tile back out and asks which
tiles would have completed what is left.

### Adding a rule set

A rule set is a list of `ScoringRule` objects, an exclusion table and a payment
function. Hong Kong Old Style or Japanese Riichi would each be a new folder
under `src/engine/rules/` plus one entry in `RULE_SETS`. No screen, no ledger
code and no database column would change.

### The ledger

Balances are never written directly. Each round appends one transaction per
player and a balance is the sum of those transactions, so a balance cannot drift
away from its history. Correcting a round writes reversing transactions rather
than deleting anything, and the round stays in history marked as voided.

## Where this guide differs from other MCR tables

The rule table follows the supplied guide rather than any other printing. Two
places are worth knowing about.

- **Two Concealed Kongs scores 6, not 8.** The guide's summary table and the
  accompanying points sheet both say 6, and only 6 makes the guide's own section
  counts balance at 7 hands worth 6 points and 9 worth 8. Its body text prints
  the hand under the 8-point heading, which appears to be the error.
- **Reversible Tiles lists the wrong suits.** The guide says Bamboos 1234589 and
  Dots 245689; those are the wrong way round, since 6 and 7 Dots are the
  asymmetric ones. The engine uses the physically correct set: Dots 1234589,
  Bamboos 245689, and the White Dragon.

Everything else the guide states in words is encoded with its wording quoted
beside it in `src/engine/rules/mcr/index.ts`, and `tests/guide.test.ts` checks
the hand numbering, the point distribution, the worked payment examples and the
30-point penalty against the document.

## Known limits

- Only the Chinese Official rule set ships. The others are architecture, not code.
- Where a pattern can repeat, non-overlapping occurrences are chosen greedily
  rather than by exhaustive search. A constructed hand could in principle score
  one point differently from an exhaustive solver.
- A self-drawn hand with no other pattern scores 1 point for Self-Drawn rather
  than 8 for Chicken Hand, since Chicken Hand is "a hand that should earn zero
  points". That reading is a rule-set flag if your table disagrees.
- There is no sign-in. The Supabase policies are open to the anon key, which is
  right for four people around one table and wrong for a public deployment.
- Cross-device play is untested end to end, because it needs a Supabase project
  that only you can create. The local path, the LAN binding and the realtime
  subscription wiring are all verified; the Supabase leg is not.
- The Hermes provider shells out to the Hermes CLI once per photo and takes
  around 30 seconds. It is the zero-setup option, not the fast one; set
  `ANTHROPIC_API_KEY` on the recognition server when speed matters.
- Recognition quality depends on the photo. Suit marks that differ by a stroke
  are the common misread, which is why every reading goes through the tile
  editor before it can change a balance.
