# Axon AI — App Design Brief

A written spec for the Axon app. Hand this to a designer, to Canva, or use it
as the build plan.

---

## 1. What we are building

Axon AI is a personal AI that a business owner talks to every day. It answers
questions, pulls numbers from their books, takes notes from meetings, and gives
advice — by voice or by typing.

The thing that makes it different is **memory**. Axon remembers conversations
for months and years. It gets to know the person: how they work, what they
worry about, what they decided last quarter, what they promised an employee in
March. Most AI forgets you the moment you close the window. Axon does not.

Everything about the app should make that one idea obvious.

---

## 2. The one differentiator: memory

Do not sell "AI." Everyone has AI, and a lot of people are sick of hearing
about it. Sell **an AI that knows you.**

Ways the app should prove memory instead of claiming it:

- Greet the person by name, every time
- Show what it remembered from the last conversation
- Show a running count: "Remembering 148 conversations since March"
- Bring things up unprompted: "You told me payroll runs about $15k a cycle"
- Let them scroll their own memory like a journal

A number and a name do more than a slogan. Someone opening the app on day 90
should immediately see that it has been paying attention the whole time.

---

## 3. Billboard vs. app (the thing to fix)

What exists now is a **splash screen** — a logo, a tagline, and one button. That
is a poster. It is fine as the very first thing a brand-new user sees, but it
is not what an app looks like day to day.

A real app home screen shows **your stuff**: your name, your recent activity,
things you can tap. It is a dashboard, not an advertisement. Nobody needs to be
sold on Axon after they have already installed it.

**Rule:** the splash screen is seen once. The home screen is seen a thousand
times. Design the home screen first.

---

## 4. The screens

### 4.1 Home — "the face"

The screen that opens every time. Top to bottom:

**Greeting.** Large, warm, personal. "Good morning, Joe." Below it in smaller
text, something Axon actually recalls — "Yesterday we went over the May P&L and
the Henderson bid."

**The orb.** The blue pulsating sphere, centered, big. It breathes slowly so the
app feels alive without being noisy. Tapping it starts talking. This is the
main action and should be the most obvious thing on screen.

**Memory strip.** Directly under the orb, a quiet line of proof:
"Remembering 148 conversations · since March 4." Tapping it opens the memory
screen.

**Recent cards.** Two or three small cards showing recent threads —
"Payroll planning", "Sealcoat pricing", "Staff meeting notes" — each with a
date. Tapping one picks that conversation back up.

That is the whole home screen. No feature list, no marketing copy, no
explanation of what AI is.

### 4.2 Talk

Full screen, mostly empty. The orb is large and centered, and it reacts —
brighter and larger while Axon speaks, gentler while listening. Live transcript
appears underneath in soft text so they can read along in a loud room. One
button to end. A text field at the bottom for when they cannot talk out loud.

### 4.3 Memory — the proof screen

This is the screen that closes deals, so it deserves real design attention.

A scrollable timeline of everything Axon remembers, newest first, grouped by
month. Each entry is one card: a date, a short summary in plain English, and
the topic. Months collapse into a single summary card once they are old —
"March: focused on payroll and two large bids."

At the top, a search box: "What do you remember about...". Typing "payroll"
should surface everything Axon has ever stored about payroll.

Also on this screen: a way to **add** memory. Upload documents, or import an
existing ChatGPT history so the assistant starts out already knowing them.

### 4.4 Settings

Short. Name, voice on/off, mode (how much thinking power to spend), connected
accounts like QuickBooks, and the option to delete a memory. That last one
matters — people trust a memory they can erase.

---

## 5. Visual direction

**Colors** (from the original VoxTalk page, keep these):

| Use | Hex |
|-----|-----|
| Background top | `#dbeafe` pale blue |
| Background mid | `#93c5fd` sky |
| Background bottom | `#1e3a8a` navy |
| Orb light | `#3b82f6` |
| Orb dark | `#1e40af` |
| Glow | `rgba(59,130,246,.7)` |
| Text on light | `#0d2a63` deep navy |
| Text on dark | white |

Blue reads calm, safe, and trustworthy. It is the opposite of the black-and-
white "edgy tech" look, which makes people who are already nervous about AI
feel worse. Avoid black backgrounds entirely.

**Cards** sit on the blue as soft white panels at about 85% opacity with
generous rounded corners, roughly 20px. Shadows should be soft and wide, never
hard.

**Type.** One family, three sizes. A rounded, friendly geometric sans —
Plus Jakarta Sans works well. Greeting large and bold, body normal weight,
labels small. Never more than two weights on a screen.

**Motion.** Slow and calm. The orb breathes on about a 3.5 second cycle.
Nothing flashes, nothing bounces. The app should feel like a person who is
relaxed, not a notification that wants attention.

**Wordmark.** "Axon" in title case with a normal A, plus a small blue "AI"
chip beside it. All-caps thin letterforms read like a cosmetics brand — avoid.

---

## 6. Words

**Say:** remembers, knows you, every day, your day, ask it anything.

**Avoid (Joe / consumer app):** assistant (worn out), second brain (nerdy),
revolutionary / cutting-edge / powered by advanced AI (nobody believes it).

On Martin’s public CV, keep his own wording: he created Axon AI as a new
artificial brain with longer-term memory, fluent in conversation, with a sense
of humor. He sometimes calls it an artificial person. Originally conceived for
a legacy website; new applications keep landing almost weekly. Do not use
anatomical brain imagery.

Sample home greeting: "Good morning, Joe. Yesterday we went over the May P&L."

Sample memory line: "Remembering 148 conversations since March."

Sample button: "Talk" — one word is enough.

---

## 7. What to ask Canva (or a designer) for

Request these four phone screens, portrait, 9:16:

1. **Home** — greeting by name, blue pulsating orb, memory count, two recent cards
2. **Talk** — big orb mid-conversation with live transcript below
3. **Memory** — scrollable timeline of dated summary cards with a search box
4. **Splash** — logo, one line, one button (seen once, on first open)

Give them the color table in section 5 and the words in section 6. Tell them
the app is for business owners aged 40–65, men and women, who are not
technical and are slightly suspicious of AI. Calm and trustworthy beats
futuristic.
