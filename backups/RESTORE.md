# Restore point — Joe's original artwork + working layout

**Commit:** `40310ee`  
**File backup:** `backups/talk-working.html`

## To restore this exact version

```bash
git checkout 40310ee -- public/talk.html
cp backups/talk-working.html public/talk.html
git push origin main
```

## What this version has

- **talk-bg.png** — Joe's original logo/arch, never painted over
- Single orb overlay, three buttons, footer dock
- Pause / Resume, voice cannot be interrupted
- Type-instead fallback, Powered by Axon AI

## Do NOT use talk-bg-clean.png

That file masks tabs by painting over the image and damages the logo.

## Live URL

https://liveai-email.onrender.com/talk.html?name=Mr.%20Grawe
