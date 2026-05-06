# Semi Portfolio Tracker

Interactive returns tracker for semiconductor portfolios. Two preset
portfolios out of the box (the 3-pick "inference thesis" basket and the
45-name watchlist), but everything is editable in the UI — add/remove
tickers, change weights, swap benchmark, change time window.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS for styling
- Recharts for the price chart
- Server-side `/api/prices` route that proxies Yahoo Finance with a
  cookie+crumb handshake, falling back to Twelve Data when an API key is
  configured

## Running locally

```
npm install
npm run dev
# open http://localhost:3000
```

## Price data — IMPORTANT

The app first tries Yahoo Finance's unofficial chart endpoint, which is
free but increasingly rate-limited from cloud provider IPs (including
Vercel). When that fails it falls back to **Twelve Data** if the
`TWELVEDATA_API_KEY` env var is set.

### Setting up Twelve Data (5 minutes, free)

1. Sign up at https://twelvedata.com/pricing — pick the free Basic tier
   (800 requests/day, no credit card).
2. Copy your API key from the dashboard.
3. Add it to Vercel:
   - **Web UI**: Project → Settings → Environment Variables → add
     `TWELVEDATA_API_KEY` with your key, scoped to Production.
   - **CLI**: `vercel env add TWELVEDATA_API_KEY production` then paste
     the key.
4. Redeploy: `vercel deploy --prod`.

For local dev, drop the key into `.env.local` at the project root:
```
TWELVEDATA_API_KEY=your_key_here
```

## What's next

The current build is the returns side of the thesis ("did this basket
make money over X period"). Coming next on the right column:
- Latest fundamentals (P/E, P/S, gross margin, FCF margin, R&D intensity)
  pulled from the SEC EDGAR pipeline in `../scripts/`.
- Per-position commentary (the moat-in-understanding rationale for the
  3-pick portfolio).
