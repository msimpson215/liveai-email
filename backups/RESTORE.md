# RESTORE POINT — approved eclipse + gap-free layout (June 30, 2026)

This is the version the client approved ("Wow, well done. Save, save, save.").

**Tag:** `working-good`
**Commit:** `0b3ae56`
**Backups:**
- `backups/talk-GOOD-eclipse-gapfree.html` (exact copy of public/talk.html)
- `backups/talk-working.html` (same)
- `backups/talk-bg-nogap.png` (the gap-free background)

## To restore this exact version

```bash
git checkout working-good -- public/talk.html public/email/talk-bg-nogap.png
git push origin main
```

Or from the file backup:

```bash
cp backups/talk-GOOD-eclipse-gapfree.html public/talk.html
cp backups/talk-bg-nogap.png public/email/talk-bg-nogap.png
git add public/talk.html public/email/talk-bg-nogap.png
git commit -m "Restore approved eclipse + gap-free layout"
git push origin main
```

## What this version has (verified by rendering at 5 screen sizes)

- **Background:** `talk-bg-nogap.png` — Joe's artwork with ONLY the blank white
  band (original rows 63–107) removed. Logo/arch/eclipse untouched. The original
  `talk-bg.png` is still in the repo, unedited.
- **No white gap** at the top on phone, laptop, or 31" monitor.
- **Full logo width** on phone (plain CSS `cover`, no zoom — zoom was what cut it).
- **Eclipse orb:** big dark shadow + dimmer outer ring + brighter middle ring that
  pulsates. Layers: `#orbShade` (0.38) + `#orbRingDim` (0.215) + `#orbRing` (0.135),
  centered at frac (0.512, 0.499) on the 1536×979 gap-free image.
- **Three buttons always visible:** Type instead / Human team / Pause, in the dock.
- Voice / pause / greeting logic unchanged.

## How it was verified

Rendered with headless Chrome at 2560×1440, 3840×2160, 1920×1080, 1440×900,
and 390×844 (phone). Do this again before changing layout — do not guess.

## Live URL

https://liveai-email.onrender.com/talk.html?name=Mr.%20Grawe
