# Auto-push to liveai-email (one-time)

This folder is the **Live AI Dash Email** app. It syncs to `github.com/msimpson215/liveai-email` via GitHub Actions.

## One-time (2 minutes)

1. GitHub → **msimpson215/a1-fence** → **Settings** → **Secrets and variables** → **Actions**
2. New secret: **`LIVEAI_GITHUB_TOKEN`** = a Personal Access Token with **repo** access to your account
3. Merge or push the branch that contains `liveai-email/` and `.github/workflows/sync-liveai-email.yml`
4. Actions tab → run **Sync to liveai-email** (or push again)

Render service **liveai-email** should track repo **liveai-email** branch **main**.

## Environment on Render

| Key | Required |
|-----|----------|
| `OPENAI_API_KEY` | Yes — Axon AI voice (Realtime API) |
| `QUICKBOOKS_CLIENT_ID` | Optional — Axon AI Brain live books |
| `QUICKBOOKS_CLIENT_SECRET` | Optional — with client id |
| `QUICKBOOKS_REFRESH_TOKEN` | Optional — from Intuit OAuth |
| `QUICKBOOKS_REALM_ID` | Optional — Joe’s company id |
| `QUICKBOOKS_ENV` | Optional — `sandbox` or `production` |

Axon AI Brain (yellow orb + QuickBooks): `/axon-brain.html` — see `docs/AXON-QB-BRAIN.md`.

## Test locally

```bash
cd liveai-email
npm install
npm start
```

Open http://localhost:3000/mailer.html · http://localhost:3000/launch.html · http://localhost:3000/email-plate.html?src=email
