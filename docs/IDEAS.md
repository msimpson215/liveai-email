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

### Naming

`Amelia` was the working name, then set aside — it is his daughter's formal
name, and he would be aiming it at a machine forty times a day. `Axon` is the
company. The assistant should get its own short, easy word. Undecided.

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
