# RESTORE POINTS

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
