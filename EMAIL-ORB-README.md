# Live AI Dash Email — where this product lives

**Repo:** `msimpson215/liveai-email`  
**Render service:** `liveai-email` → https://liveai-email.onrender.com

Do **not** use `a1-fence` for the email orb. That was the wrong repo.

## Flow (upper-right talk window)

No Gmail masquerade. The customer stays on their mail; a small A1 window opens in the **upper-right**.

| Layer | File | Role |
|-------|------|------|
| Email body | `public/mailer.html`, `email/a1-mailer.html` | Orb image + link in Gmail |
| HTTPS launch | `public/launch.html` | Opens 420×560 upper-right popup, then closes |
| Talk UI | `public/talk.html?src=email&popup=1` | Clean A1 page, orb upper-right (`src=email`) |
| Link tool | `public/email-orb-launcher.html` | Copy HTTPS / JavaScript links |

Click orb → Axon AI voice (OpenAI Realtime). Popup sits in the corner; clicking back to Gmail dismisses it.

## Deploy

Connect **this** repo on Render. Set `OPENAI_API_KEY` in Environment.

## Wrong-repo cleanup

If you opened a PR on `a1-fence`, close it and use a PR on `liveai-email` instead.
