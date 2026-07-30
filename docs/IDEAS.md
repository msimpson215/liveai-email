# Running idea list

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

## Known open items

- **Render persistent disk.** Every deploy wipes `data/joe-memory/`, so all
  eight personal banks reset. Needs a paid disk added in Render settings.
- **Pin the realtime model version.** We request `gpt-realtime`, which follows
  OpenAI's latest GA release. Pinning avoids behavior shifting under us.
