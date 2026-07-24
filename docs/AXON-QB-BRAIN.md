# Axon AI Brain ↔ QuickBooks

Yellow pulsating orb on **live AI email**. Joe asks the books in plain English — P&amp;L, payroll charts, etc.

**Page:** https://liveai-email.onrender.com/axon-brain.html  
**Local:** http://localhost:3000/axon-brain.html

## Tomorrow — Joe’s real QuickBooks (not a password / API key)

**What you have now:** a **mock**. We did **not** log into Intuit. The numbers are sample A1 demo books so the UX works today.

QuickBooks Online does **not** hand you a single “API key” from Joe’s normal login. Tomorrow you’ll need an **Intuit developer app** connected once to his company:

1. Create/open an app at [developer.intuit.com](https://developer.intuit.com/)
2. OAuth once into Joe’s QuickBooks company (sandbox first is fine)
3. Copy these four values into Render → `liveai-email` → Environment:

| Env var | What it is |
|---------|------------|
| `QUICKBOOKS_CLIENT_ID` | App client id |
| `QUICKBOOKS_CLIENT_SECRET` | App client secret |
| `QUICKBOOKS_REFRESH_TOKEN` | From that one OAuth connect |
| `QUICKBOOKS_REALM_ID` | His company id |
| `QUICKBOOKS_ENV` | `sandbox` or `production` |

4. Redeploy. The pill flips to **Live QuickBooks** and the same questions hit his real books.

Joe’s everyday QuickBooks **username/password alone is not enough** to paste in — Intuit requires the OAuth app + refresh token. If you want, when you have access we can walk the OAuth playground together and drop the four values in.

## Demo vs live

Until Intuit credentials are set, the brain uses **demo books** shaped like an asphalt contractor so you can try the UX immediately. The UI pill says **Demo books** or **Live QuickBooks**.

QuickBooks Online does **not** use a single API key for company data. You create an Intuit developer app, connect Joe’s company once (OAuth), then store the refresh token on the server.

## Connect Joe’s QuickBooks (Render)

1. Create an app at [Intuit Developer](https://developer.intuit.com/) (QuickBooks Online).
2. Add scopes: `com.intuit.quickbooks.accounting` (Payroll extras if your plan supports them).
3. Run OAuth once (Intuit OAuth Playground is fine) against Joe’s company → copy **Realm ID** + **Refresh Token**.
4. On Render → `liveai-email` → Environment:

| Key | Value |
|-----|--------|
| `QUICKBOOKS_CLIENT_ID` | Intuit app client id |
| `QUICKBOOKS_CLIENT_SECRET` | Intuit app client secret |
| `QUICKBOOKS_REFRESH_TOKEN` | Long-lived refresh token from OAuth |
| `QUICKBOOKS_REALM_ID` | Company id (realmId) |
| `QUICKBOOKS_ENV` | `sandbox` or `production` |
| `OPENAI_API_KEY` | Already required for voice |

5. Redeploy. `/api/brain/status` should show `"mode":"live"`.

## API

```bash
curl -s https://liveai-email.onrender.com/api/brain/status | jq
curl -s -X POST https://liveai-email.onrender.com/api/brain/ask \
  -H 'content-type: application/json' \
  -d '{"question":"Chart my payroll over the past five years"}' | jq
```

## Long-term memory (automatic)

After Joe talks (voice or text), the server **auto-saves a short summary**. The next session **auto-loads** those summaries into the assistant — no buttons, no “reload.” Feels continuous over months.

| Piece | Role |
|-------|------|
| `server/joe-memory.js` | Stores summaries under `data/joe-memory/` |
| `POST /api/brain/memory/remember` | Accepts conversation turns → summarizes → stores |
| `GET /api/brain/memory` | Lists saved summaries |
| Voice/text clients | Silently flush turns when a talk ends |

On Render’s ephemeral disk, memory lasts for the life of the instance unless you attach a persistent disk or move storage to a DB later — same pattern as teaching docs.

## Files

- `public/axon-brain.html` — orb UI + charts
- `server/quickbooks.js` — demo books + live QBO reports
- `server/joe-memory.js` — automatic session summaries
- `server/server.js` — `/api/brain/*` + voice playbook `qb`
