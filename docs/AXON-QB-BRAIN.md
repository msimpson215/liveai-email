# Axon AI Brain ↔ QuickBooks

Yellow pulsating orb on **live AI email**. Joe asks the books in plain English — P&amp;L, payroll charts, etc.

**Page:** https://liveai-email.onrender.com/axon-brain.html  
**Local:** http://localhost:3000/axon-brain.html

## What it does

| Ask | Result |
|-----|--------|
| “A year ago in the month of May, give me a profit and loss” | Narrated P&amp;L + waterfall / bar chart |
| “On an XY chart, look at my payroll over the past five years” | Line chart + % change |
| Tap the yellow orb | Voice session (`/session?src=qb`) with the same books context |

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

## Files

- `public/axon-brain.html` — orb UI + charts
- `server/quickbooks.js` — demo books + live QBO reports
- `server/server.js` — `/api/brain/*` + voice playbook `qb`
