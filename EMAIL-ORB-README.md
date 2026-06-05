# Live AI Dash Email — where this product lives

**Repo:** `msimpson215/liveai-email`  
**Render service:** `liveai-email` → https://liveai-email.onrender.com

Do **not** use `a1-fence` for the email orb / Gmail plate illusion. That was the wrong repo.

## Flow (table + plate)

| Layer | File | Role |
|-------|------|------|
| Email body | `public/mailer.html`, `email/a1-mailer.html` | Orb image + link in Gmail |
| HTTPS step | `public/launch.html` | Opens small popup (optional middle step) |
| AI plate | `public/email-plate.html` | Voice chat UI (`?src=email` → email greeting on server) |
| Link tool | `public/email-orb-launcher.html` | Copy JavaScript / HTTPS links |

## Deploy

Connect **this** repo on Render. Set `OPENAI_API_KEY` in Environment.

## Wrong-repo cleanup

If you opened a PR on `a1-fence`, close it and use a PR on `liveai-email` instead.
