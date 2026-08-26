# Running idea list

---

## QR → scan → talk: the reusable structure

The generalized version. Scan a code, a page opens, tap once, talk to Axon AI
about one subject. Works for any industry — only the subject changes.

| Piece | Path |
|-------|------|
| Topic registry | `server/ask-topics.js` |
| One page for every topic | `public/ask.html` |
| Live topic URL | `/ask/<slug>` |
| Index of all topics + codes | `/ask` |
| QR generator, all topics | `npm run qr` |
| Voice profile | `ask` in `server/server.js` |

**Adding an industry** is one entry in `ASK_TOPICS`:

```
'slug': {
  title, blurb, opening,        // what the person sees and hears first
  role,                         // who it is
  covers: [...],                // what it knows and may discuss
  refuse: [...],                // what it declines
  escalate: '...',              // the emergency line, if any
  sendTo: '...',                // where unanswered questions go
  asks: [...]                   // example prompts on the page
}
```

Then `npm run qr`. No new page, no new route, no client changes. It appears at
`/ask/<slug>` and on the `/ask` index automatically.

Three unrelated topics ship as proof the structure travels: a nuclear stress
test, a residential HVAC install, and an apartment move-in. Same plumbing,
same page, same voice pipeline.

Every topic inherits, from the template rather than per-topic wording: no
guessing or inventing details, stay on subject, never ask for personal
information, never claim to be a person, and re-explain patiently because
people scan these precisely because they forgot.

Public QR sources are covered by the spend guard (see below).

---

Durable notes that must survive a deploy. The memory bank in
`data/joe-memory/` is wiped whenever Render restarts, so anything worth
keeping goes here instead.

---

## Patient question line — nuclear stress test (BUILT, needs clinic review)

**Where it came from:** Marty was sitting for a nuclear stress test and
realized patients are nervous, get a lot explained to them quickly, and
remember very little of it. Alicia could hand out a QR code.

**What it is:** a QR code on a card or wall sheet. The patient points their
phone camera at it, taps a circle, and talks. It explains the test only.

| Piece | Path |
|-------|------|
| Patient page (generic) | `/stress-test.html` |
| Patient page (per clinic) | `/stress-test/<clinic>` e.g. `/stress-test/bjc` |
| QR code — generic | `/qr/stress-test.png` / `.svg` |
| QR code — BJC Shiloh | `/qr/stress-test-bjc.png` / `.svg` |
| Take-home cards, 8 per sheet | `/qr/stress-test-cards.html` |
| Printable wall sheet | `/qr/stress-test-poster.html` |
| Voice profile | `stresstest` in `server/server.js` |
| Clinic logistics map | `STRESS_CLINICS` in `server/server.js` |
| QR generator | `node scripts/make-qr.mjs <url> <name>` |

### The two-layer split (important — this is what keeps it approvable)

The medical explanation is ONE universal script. Per-clinic data is a separate
logistics-only block layered on top: address, floor, phone, arrival time, what
to bring, check-in, payment, mask policy.

Adding a hospital means adding an entry to `STRESS_CLINICS` and generating a QR
code. It never touches the clinical wording, so a clinician signs off on the
medical script once and that approval holds as clinics are added.

The universal script answers the four questions patients actually have:
what the test is accomplishing, what is physically being done to them, how long
it takes, and when/how results come back.

### Drug covered: Lexiscan (regadenoson)

The pharmacologic stress agent, for patients who can't do the treadmill. Facts
in the script are sourced from the manufacturer's patient guide and prescribing
information, not invented:

- Widens the coronary arteries to raise blood flow as exercise would. Not a
  stimulant, not adrenaline. Given as a fast IV push plus saline flush.
- Common effects: shortness of breath, headache, flushing/feeling hot, chest
  discomfort, dizziness, nausea, abdominal discomfort, metallic taste. Most
  pass in ~15 min; headache ~30 min.
- Staff can reverse it with aminophylline if it doesn't settle — included
  because it genuinely calms a nervous patient.
- Caffeine/methylxanthines block it, which can make images misleading and force
  a repeat test. Label says avoid ≥12 h; many clinics ask 24 h.
- The script explains the caffeine rule and the reason, then always defers to
  the clinic's own sheet. It will not compute a personal cutoff or judge whether
  what someone drank was a problem.
- It normalizes needing the drug version instead of the treadmill — patients
  are often quietly embarrassed by it, and it is not a verdict on them.

Still missing: the clinic's own fasting window and exact caffeine window. Those
are per-clinic and belong in `STRESS_CLINICS`, not the universal script.

**Hard guardrails built into the profile:**

- No medical advice, diagnosis, opinions, or recommendations
- Will not interpret results, numbers, scans, blood pressure, or rhythms
- Will not discuss whether to take, skip, or change any medication
- Will not assess personal risk or say the test is safe "for you"
- Symptoms happening now → tells them to get a nurse immediately, nothing else
- Off-topic → politely declines and points to staff
- Not covered → "I don't want to guess on that, ask the technologist"
- No live web search (unlike the open Axon brains) so it cannot wander

**Patient privacy posture:** the page asks for nothing, stores nothing, and
writes no memory. The voice profile is explicitly told never to ask for or
repeat a name, birthdate, or chart number. No PHI from anyone's chart belongs
in this repo — a MyChart PDF was reviewed for source material and only the
generic clinic logistics were used.

**Spend guard (important — a printed QR code is public forever):**

Voice minutes bill our OpenAI account, and anyone who photographs the card can
use it. `PUBLIC_QR_SOURCES` in `server/server.js` caps the `stresstest` source:

| Limit | Default | Env var |
|-------|---------|---------|
| Sessions per visitor per hour | 8 | `QR_SESSIONS_PER_VISITOR_HOUR` |
| Sessions per day, all visitors | 300 | `QR_SESSIONS_PER_DAY` |

Over the limit returns a friendly 429 telling them to call the office. Personal
Axon links are deliberately NOT capped. Counters are in memory and reset on
restart, which is acceptable.

**Before real patients use it:**

1. A clinician at the clinic reads the script and signs off on the wording
2. Confirm the clinic's actual visit length and whether they use treadmill,
   medication, or both — the script currently stays deliberately general
3. Decide whose OpenAI account pays, and whether this becomes a paid product
   the clinic buys rather than something running on Marty's key
4. Ask the clinic about HIPAA posture. Nothing identifiable is collected today
   and the page stores no memory, but the clinic's compliance people should
   confirm that before it is posted in an exam room

**Why it is a real product:** the same pattern fits any procedure where a
nervous patient forgets the explanation — colonoscopy prep, MRI, cardiac cath,
pre-op instructions. One scoped brain per procedure, one QR code per wall.

---

## Voice console — talk to the computer instead of reaching for it (IDEA)

**Where it came from:** Marty was deleting an old screensaver Chrome app and got
annoyed that using a browser extension he likes — Go Full Page — takes a trip up
to the toolbar with the mouse, then a second click down in a menu. The address
is already in the machine. The only reason his arm is involved is that nobody
built another way to ask for it. He laid out the chain himself: brain, shoulder,
forearm, finger, mouse, wire, click — all of it overhead on a lookup.

He is from Palo Alto, two miles from where the mouse was being worked on. His
point is not that the mouse is bad, it is that it should not be the *primary*
navigation layer for things he does the same way every single morning.

### The commit token — "22"

The design idea that makes this work, and it is his: the trigger goes at the
**end** of the phrase, not the beginning.

- "Gmail **22**" → opens Gmail
- "Yahoo News **22**" → opens Yahoo News
- "IAAI **22**" → salvage auction listings

Nothing fires until the number lands. So he can think out loud, trail off,
change his mind mid-sentence, and the machine stays still. This is strictly
better than a wake word: Alexa makes you say her name every time before you
have finished deciding what you want. A trailing token lets you decide first
and commit second.

Everything he says gets transcribed; anything not ending in his number is
discarded. The assistant does not need to be addressed at all during the day —
its name is only for waking it, silencing it, or setting a timeout.

### The switchboard

His picture: a 1940s switchboard operator sitting between him and the screen.
The board has jacks for the places he actually goes — X, Al Jazeera, Morrow
Newhall, Google News, Google Docs, Gmail, YouTube, IAAI. She plugs him in. She
also *remembers who she has connected*, which is the part that matters:

> "Take Marty's CV and put it in Gmail" — she still knows what he just pulled.

So the build needs a registry of destinations plus a short-term handoff buffer,
the operator's cord held in her hand between two jacks.

### Axon-marks — the real product insight

His name for it, and it is better than a pun. A bookmark is an address the
machine already knows, that you are forced to retrieve with your hand. Replace
the bookmarks bar with an index you can **address** instead of **reach for**.

The bar is roughly 95% of his day. Anything outside it goes through a general
search command instead of a saved jack.

### Why this is buildable — the three tiers

The tiers matter because the first one is nearly free and would already cut most
of his mousing.

| Tier | Example | What it needs |
|------|---------|---------------|
| Navigation | "YouTube 22", "morning 22" | URLs. No auth, no API keys, nothing. |
| Reading the page | "what does this article say" | Browser extension to pull page text |
| Acting across apps | "send the CV to Tim Donahue" | One-time OAuth per service, token kept |

**Start with the morning macro.** His routine is the same five destinations every
day in roughly the same order: X, Al Jazeera / Morrow Newhall, Google News,
IAAI, YouTube. That is not five commands, it is **one** — "morning 22" opens all
of them in tabs while he is still getting coffee. Zero credentials required.

### The proverbial newspaper — the sharper version of the morning macro

His own frame, and it is a real step past opening tabs. The 1950s picture: the
husband sits down at the counter in his suit, and the paper is already there
with the coffee. He does not navigate anything. Every article is already in it.

That is the distinction that matters:

| | |
|---|---|
| **Bookmark** | You still go get it |
| **Newspaper** | It was delivered, already assembled |

Five tabs opening is still work. Being told what happened is not. So the orb
greets him, says the four things that happened overnight, and only opens
something on screen when he says "show me that one." He is not driving.

Feasibility, honestly:

- **News is nearly free.** Google News, Yahoo News, and Al Jazeera all publish
  feeds. No keys, no permission, no scraping. Headlines can be assembled before
  he is awake.
- **X is the expensive one.** API access is paid now, and this is the one source
  that may not survive the first version.
- **IAAI needs a login**, so it is a session problem rather than a feed.

The core of his actual morning — what happened overnight, what is on the news —
is a feed pull plus a summary, with nothing clicked anywhere.

### The last inch nobody shipped

Gemini and ChatGPT already have the Gmail connector. They made him authorize it.
And they still hand him a draft and make him click the arrow. The connector is
done; the last inch is missing. Voice in → action executed → spoken confirmation
back *is* the product.

Everyone avoids it because an assistant sending the wrong email is a real risk.
The solution is boring: **read it back before it goes.** "To Tim Donahue,
subject Curriculum Vitae, CV attached — send it?" Two seconds instead of six
clicks, and it makes voice-driven action safe enough to actually use. Voice ID
or a camera can come later; the confirmation step is the practical guard.

### The orb

Not decoration — it is the confirmation loop. A small always-present presence
that shows it heard you and states what it is about to do, so you are never
wondering whether it worked. He pictures it eventually as a hologram between him
and the screen, Star Trek style, and wants to be able to chat with it while a
task runs ("what should I cook tonight?") — which already works, since that is
just conversation in the same session.

Video calling is explicitly **not** wanted. He tried a camera app and the point
of seeing a face escapes him. Voice and confirmation only.

### Naming — settling on Axon, and never "assistant"

`Amelia` was the working name, then set aside — it is his daughter's formal
name, and he would be aiming it at a machine forty times a day.

**Axon is the name, and it is earned rather than decorative.** Marty was a
biology major, pre-med at Washington University, and considered going into
neuroscience — drawn to how picking something up with your fingers is electrical
impulses traveling along a path. Same as the wire to the computer.

The word works in two directions at once, which is why it should stay:

- An axon *carries the signal*. Not the thinking, not the deciding — the
  conduction. This whole product is a complaint about the conduction path being
  made of shoulder, forearm, finger, and a wire from 1976.
- It is also how he describes building companies: you have this, you need that,
  and there is always a little connection between them. An axon.

"Is Axon hard to say?" is close to moot, because of his own design. The trailing
"22" does the work a wake word normally does, so he says the name to wake it in
the morning and to tell it to hush — a handful of times a day, not forty. Two
syllables, no sibilants, soft ending.

**Do not call it an assistant.** The better word came out of his own switchboard
picture: **operator**. Not someone who assists you — someone who *operates the
board*. It carries the 1940s image exactly, it reads as competence instead of
servitude, and the second meaning sits right there: the one who works the
machine. "My operator" sounds like something a serious person has. "My
assistant" sounds like an app.

Also floated at some point: `VoxShots`.

### The commercial — black and white, and the color arrives

Marty's, and it is good enough to keep verbatim in spirit.

1950s, black and white. A woman opens the front door and picks up off the step —
not a newspaper — **Axon**. It is the only object with color in the frame. She
carries it to the kitchen, sets it on the table with the coffee and the donut.
The husband comes out in the suit. She says, *"Here, honey, here's your Axon AI
for today."*

**They both touch it.** The room floods into color and modernity. An awakening
of information.

Why it works: the black and white *is* the argument, so nothing needs
explaining. The paper on the step is information as it used to be — flat, gray,
a day old, identical for everyone on the street. It is the Oz reveal.

The detail that saves it from being a 1950s costume piece is his, and it is
load-bearing: **both** of them touch it. If she hands it over and stands there,
it is a woman serving a man his newspaper and the ad is about him. Two hands on
it and the room comes alive for the pair of them — service becomes an awakening
they walk into together. Keep the set 1950s; the light is what changes.

Suggested ending: no tagline. She says her line, they touch it, color floods the
kitchen, and he just says her name. Cut.

**What she wears when the color arrives.** Marty wanted her out of the apron and
into a business suit, to land the equality note. The sharper version answers his
own question — *what do people carry these days?* **Nothing.** In 1950 the
husband carries a briefcase because information had to be physically carried. In
color, neither of them carries anything, because it is all in the object on the
table. The missing briefcase *is* the modernization, and it beats handing her a
laptop bag, which tips into the career-woman-montage cliché. The apron
disappearing says enough. Both dressed, both reaching for the same object, both
out the same door. Equal footing, no punchline.

### Second commercial — the cords become light

Possibly stronger than the first. The switchboard operator, board fully lit,
cords tangled in both hands, more calls arriving than she can plug. She is
genuinely losing.

Then **she has the idea** — Marty's beat, and it is the load-bearing one. She is
not rescued by the future, she *thinks* of it.

The money shot for a company named Axon: **the cords come loose and become
light.** They stop being rubber and copper and turn into signal, everything
reaching everything at once, no plugging required. Color floods the room. The
board goes dark because it is no longer needed.

Thirty seconds, and it never says the word AI.

### How to say it — article, pronoun, and what not to call it

- **Product name:** `Axon Operator`, no article. Articles kill names.
- **Referring to it:** "my operator."
- **Talking to it:** "Axon."
- **Never** "the Axon Operator." Nobody says "the Siri."

**Do not give it a gendered pronoun.** The operator in the commercial is a woman
because she is a *person* in 1948. The moment the product becomes "she," it
rebuilds the servitude the ad is working to escape, and it dates the thing on day
one. Use the name and the question never comes up: "Axon can do that," not "she
can."

### Model routing — the seatbelt, not the discount

Marty's read, and it is strategically right: stop depending on any single
provider. Take the best piece from each. AI ends up as a signal you plug into,
the way nobody owns the internet.

Two corrections worth keeping straight before this gets pitched to anyone:

**We would not be first.** Routing is a mature market — OpenRouter, LiteLLM,
Requesty, Portkey, NotDiamond, Martian. That is good news, not bad: the hard
part is done and adopting it is close to a base-URL change.

**Do not sell it as cost savings.** Vendors advertise 90%+ reductions.
Independent 2026 benchmarking (LLMRouterBench, 21 datasets, 33 models) found
several commercial routers performing *worse* than simply always using the best
single model — OpenRouter scored −24.7% against that baseline. Real gains where
they exist land nearer ~30% cost reduction while merely *matching* the best
single model.

**The actual argument is independence.** If a provider triples its price,
changes terms, or decides our category is now their category, we switch models
that afternoon instead of rebuilding the company. A seatbelt, not a discount.

**And the metaphor is already the architecture.** A switchboard operator *is* a
router — a call arrives, she decides which line takes it. The front of the
product and the back of the product are the same picture.

Practical: `LiteLLM` self-hosted for zero markup and full control, or
`OpenRouter` for instant access at ~5.5%. Decide by whether we want to own the
routing decision or rent it.

### Open questions

- Wake-on-always vs. push-to-talk, and what that costs running all day
- Where transcription runs. Local keeps it private and cheap; hosted is better
  at accuracy
- Whether the desktop side is a tray app or leans entirely on the existing
  `extension/` folder for browser reach
- Security posture once it can send mail on his behalf, beyond read-back

### Related note: dictation keeps losing his long messages

Not part of the product, but it is the reason this idea keeps getting retyped.
Long voice takes in the Cursor client spin and then come back blank, losing
several minutes of thinking at a time. The fix that works is OS-level dictation
(Windows key + H, or the Mac dictation key), which types into the field as you
speak — the words accumulate on screen and cannot evaporate on send. Worth
noting because it is the same problem the product solves: voice in, nothing
lost.

---

## Known open items

- **Render persistent disk.** Every deploy wipes `data/joe-memory/`, so all
  eight personal banks reset. Needs a paid disk added in Render settings.
- **Pin the realtime model version.** We request `gpt-realtime`, which follows
  OpenAI's latest GA release. Pinning avoids behavior shifting under us.
