# Restore point — pause/resume build (saved before layout tweaks)

**Tag:** `working-save`  
**File backup:** `backups/talk-working.html`

## To restore this exact version

```bash
git checkout working-save -- public/talk.html
git push origin main
```

Or copy the backup file:

```bash
cp backups/talk-working.html public/talk.html
```

## What this version has

- Pause / Resume (no second greeting)
- Voice cannot be interrupted by saying "stop"
- Type-your-question fallback for loud rooms
- Powered by Axon AI link at bottom

## Live URL

https://liveai-email.onrender.com/talk.html?name=Mr.%20Grawe
