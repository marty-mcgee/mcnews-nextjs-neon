# Project Context – mcnews-nextjs-neon

**Last Updated: May 23, 2026 @ 02:40pm PST**

## 🧱 Tech Stack
- Next.js (App Router), TypeScript, React
- Neon Postgres + Drizzle ORM
- shadcn/ui, Tailwind, Leaflet (Maps using OpenStreetMaps)
- Vercel Production Deployment

## 📡 Data Sources (Official JSON APIs)
| Source | Type | Status |
|--------|------|--------|
| Bay Area 511 (511.org) | Real-time incidents | ✅ Working |
| CHP CAD (Live) | Live dispatcher feed (HTML scraping via Cheerio) | ✅ Working |
| CHP CKAN | Historical collisions | ✅ Implemented |
| Caltrans CWWP2 | Real-time lane closures | ✅ Implemented |

## 📁 Key Services (`src/lib/services/`)
- `BayArea511Poller.ts` – 511.org incidents and maps
- `CHPCADPoller.ts` – Live dispatcher feed (HTML scraping via Cheerio)
- `CHPPoller.ts` – Historical collisions from CKAN
- `CaltransPoller.ts` – Real-time lane closures from CWWP2
- `CCTVPoller.ts` – Caltrans cameras from CWWP2

## 🚦 Caltrans CWWP2 Poller
- **Endpoint:** `https://cwwp2.dot.ca.gov/data/d{1-12}/lcs/lcsStatusDXX.json`
- **Format:** JSON, no auth
- **Polling:** Every 5 minutes, all 12 districts
- **Upsert logic:** By `source_id`, marks stale after 15 min

## 📊 CHP Historical Poller
- **Source:** `data.ca.gov/api/3/action/datastore_search`
- **Resource ID:** `b8ce0ca4-b4e9-490d-b4d1-1f4ec48cbefb`
- **CKAN limitation:** No date operators in filters → client-side filtering
- **Batch import:** Paginates 100 records at a time

## ⚠️ Key Decisions
1. HTML scraping (CHP CAD page is HTML only, so use Cheerio)
2. All DB operations via Drizzle ORM (no raw SQL)
3. File name conventions are Next.js App Router + camelCase friendly
<!-- 4. Vercel serverless functions: `maxDuration = 300` -->

## 🔧 Common Commands
```bash
npm run db:generate && npm run db:push
curl "http://localhost:3000/api/chp-historical/poll?action=poll&limit=5000"
curl "http://localhost:3000/api/caltrans/poll"
