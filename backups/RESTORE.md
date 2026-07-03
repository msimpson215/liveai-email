# RESTORE POINTS

## SAVED — greeting + interrupt + noise offer (July 3, 2026)

The "so close, basically done" A1 voice build, saved BEFORE the adaptive
loud/quiet auto-switch was added. Short 2-sentence greeting that can't be
interrupted, then the rest of the conversation IS interruptible, and a one-time
verbal offer to switch to text when it's noisy.

**Tag:** `approved-greeting-interrupt-noise` (commit `3e4cdf2`)
**Backup file:** `backups/talk-GOOD-greeting-interrupt-noise.html`
**Note:** `server/server.js` is identical between this point and the adaptive
version, so restoring `talk.html` + `a1.html` is enough to get this behavior back.

### Restore this version
```bash
git checkout approved-greeting-interrupt-noise -- public/talk.html public/a1.html
git push origin main
```

---

## CURRENT APPROVED — visual refresh (June 30, 2026)

Client-approved: tabs removed, soft "sun" eclipse, logo above the circle,
readable text, bigger dock buttons, loud-environment hint.

**Tag:** `working-good` and `approved-visual-refresh`
**Background image:** `public/email/talk-bg-v2.png` (tabs painted out)
**Backups:** `backups/talk-GOOD-visual-refresh.html`, `backups/talk-working.html`,
`backups/talk-bg-v2.png`

### Restore this version
```bash
git checkout approved-visual-refresh -- public/talk.html public/email/talk-bg-v2.png
git push origin main
```

### What it has (verified by rendering 2560x1440, 1440x900, 390x844)
- `talk-bg-v2.png`: Joe's artwork, blank top band removed AND Primary/Promotions/
  Updates tabs painted out (above the arch; arch/logo untouched).
- Soft sun eclipse: blurred radial glows that fade out (no hard ring lines),
  gentle breathing pulse. Logo sits clearly ABOVE the circle.
- Small dark center keeps the eclipse look without darkening the text.
- "Now You Can Have a / CONVERSATION / WITH OUR EMAIL" is readable.
- Taller dock; big buttons: Type instead / Human team / Pause.
- Loud-environment hint above the buttons.
- Loud-room auto hand-off: AI says it's switching to text (uninterruptible),
  voice pauses, "Resume voice" when quieter.

---

## EARLIER SAFE POINTS
- `approved-eclipse-gapfree` (commit 445419e): the gap-free layout with the
  layered hard-ring eclipse, BEFORE the soft-sun visual refresh. Uses
  `talk-bg-nogap.png`.
- `working-save`: original pause/resume build.

## How to verify before changing layout
Render with headless Chrome at 2560x1440, 3840x2160, 1920x1080, 1440x900, 390x844
and LOOK at each. Do not guess.

## Live URL
https://liveai-email.onrender.com/talk.html?name=Mr.%20Grawe
