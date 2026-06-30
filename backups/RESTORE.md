# Restore point — before layout was destroyed (June 29)

**Commit:** `51aab37`  
**File backup:** `backups/talk-working.html`

## To restore

```bash
git checkout 51aab37 -- public/talk.html
git push origin main
```

## What this version has

- **talk-bg.png** — Joe's original artwork (never talk-bg-clean.png)
- Background zoom/position crops Gmail white bar and tabs (`scale 1.20`, `object-position 42%`)
- Smaller orb overlay (`ORB_D 0.165`) aligned to painted ring
- Three buttons in footer dock: Type instead, Human team, Pause
- Pause/Resume, no second greeting, voice cannot be interrupted
- Powered by Axon AI

## What went wrong after this

Commits after `51aab37` started changing orb size, switching to talk-bg-clean.png,
and repositioning — that destroyed the logo and circles.

## Live URL

https://liveai-email.onrender.com/talk.html?name=Mr.%20Grawe
