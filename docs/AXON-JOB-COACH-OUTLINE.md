# Axon Job Coach — build outline

**Status:** planning doc. **Do not build until Marty's interactive resume is finished.**

---

## Sequencing (Marty's call)

1. **Finish the interactive resume** in this repo (`liveai-email`, `/cv2/`, capture
   file, voice brain, pages). Keep dictating. Blab into `MARTY-CAREER-CAPTURE.md`.
2. **When the CV is done**, write a **complete outline** from the finished work —
   structure, guardrails, voice rules, difficult-topic patterns, what worked, what
   was a bad habit to leave behind.
3. **Start a whole new repo** for Axon Job Coach. Teach it from that outline. Clean
   sheet. No anger in the new repo. Some habits may carry over — that's OK — but
   the CV codebase is not the Job Coach codebase.

Nothing in this file is a reason to split focus before step 1 is done.

**Why Job Coach exists:** people need a vault for the furious true version and a
separate product that turns it into something an employer can hear without lying.
That product is built *after* the CV proof is done.

---

## Do not keep bolting everything onto `marty-cv.js`

| Brain | Job | Audience |
|-------|-----|----------|
| **Capture file** (`MARTY-CAREER-CAPTURE.md`) | Raw dictation. Anger OK. Never published. | Marty only |
| **Axon Job Coach** | Interview, rehearse hard questions, spin difficult topics | The client, privately |
| **Axon CV** (`marty-cv.js` + pages) | Published facts + tight "if asked" private answers | Strangers, recruiters, Tim |

Marty's CV brain is **client zero** — the proof that Axon CV works. Job Coach is
the bigger business. They share voice plumbing; they do not share one instruction
file.

---

## The anger filter — what it actually does

Not censorship. **Translation.**

```
RAW (vault)          COACH (rehearsal)           CV (public / orb)
─────────────────────────────────────────────────────────────────
"He's a fucking      "A partner I took in        "While I was at the
 prick, destroyed     out of sympathy. While      hospital with my
 everything"         I was at the hospital,      daughter, the
                     operations collapsed and    operating companies
                     I had to start over."       did not hold."
```

Three outputs from one painful story:

1. **Vault** — everything, including rage. Stays in capture. Never spoken to a stranger.
2. **Coach** — first person, out loud practice. "Here's how you say it in the room."
3. **CV** — third person, factual, no slurs, no volunteering. Answer only if asked.

---

## Difficult-topic patterns to train (starter list)

Each pattern needs: **raw prompts**, **coach rehearsal line**, **CV/orb line**,
**never say**.

| Pattern | Example raw | Public spin principle |
|---------|-------------|----------------------|
| **Bad partner / betrayal** | Jay Schober | Took someone in; while you were elsewhere, operations failed; started over. No name unless client approves. |
| **Fired** | "They screwed me" | Role ended; what you built anyway; what you learned. No trashing. |
| **Accused of something** | "They said I stole — I didn't" | Do not repeat the accusation as fact. "There was a dispute; it was resolved / not pursued / I left." Ask lawyer if needed. |
| **Business failed** | Fire sale, city turned | Market/timing/personal crisis; what you built before it ended. |
| **Gap in resume** | Hospital, family, burnout | One honest sentence. No overshare. |
| **Left on bad terms** | Boss was an idiot | "Fit wasn't right" / "priorities shifted." Move to what you did. |
| **Overqualified / job hop** | — | Coach reframes; CV shows thread. |
| **Weakness question** | Private tier only | Coach holds the real answer; CV never prints it. |

Job Coach's job: recognise which pattern the client is in, pull the facts out of
the anger, draft three tiers, read them back, **nothing goes live until approved**.

---

## Interview flow (Job Coach session)

1. **Warm open** — beside you, not across a desk (voice orb).
2. **Section by section** — same sections as CV (businesses, development, etc.).
3. **Detect heat** — raised language, names, accusations → flag as "difficult topic."
4. **Follow-ups** — the Belleville questions: what was your role, what number are
   you sure of, what would you do differently.
5. **Draft three tiers** — vault / coach / public. Show public only unless client
   asks to see vault.
6. **Rehearse the dread question** — "Tell me about leaving Maplewood." Practice
   until it is sayable without shaking.
7. **Approve** — client reads back. Then push approved slices to CV brain + pages.

---

## What we need before writing code

### Content (can start now — Marty dictating)

- [ ] Finish `MARTY-CAREER-CAPTURE.md` sections
- [ ] One "difficult topic" worked example end-to-end (Schober = template #1)
- [ ] 5–10 more spin examples Marty approves (fired, accused, gap, etc.)
- [ ] Business Journal text when available (citation only)

### Product rules (documented)

- [x] Two tiers: published vs private (`IDEAS.md`)
- [x] Guardrails as selling point (`IDEAS.md`)
- [ ] Anger filter three-tier output (this doc)
- [ ] Never invent numbers / never characterise third parties without approval
- [ ] Accusations: never state as fact on public tier

### Technical (later)

- [ ] `server/axon-job-coach.js` — separate instructions from `marty-cv.js`
- [ ] Vault storage per client (raw capture JSON or markdown)
- [ ] Approval gate: coach drafts → human OK → sync to CV brain
- [ ] Reuse existing voice stack (`/session`, orb) with `src=job-coach`
- [ ] Optional: LLM pass labelled "spin draft" with temperature low, facts-only

### Pilot

- [ ] Marty completes capture + approves public spin for Schober, Maplewood, STS
- [ ] Record one coach rehearsal session (hard question about Maplewood)
- [ ] If it holds live between two people, automate

---

## Should Marty keep adding to the current brain?

**While the CV is in progress: yes to the capture file only.** Blab. Ramble.
`MARTY-CAREER-CAPTURE.md` is the vault — anger OK there, nothing auto-goes live.
When a chunk is ready, distill into `marty-cv.js` and the pages.

**No Job Coach repo yet.** When the interactive resume is finished, we write the
full outline from it and start fresh. Do not train Job Coach inside this repo.

---

## One sentence pitch for Job Coach

*Practice the hard answer before somebody asks it — and make sure what goes on
the page is not what you said when you were furious.*
