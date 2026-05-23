# Project Context – mcnews-nextjs-neon

**Last Updated: May 23, 2026 @ 02:27pm PST**

## 🧱 Tech Stack
- Next.js (App Router), TypeScript, React
- Neon Postgres + Drizzle ORM
- shadcn/ui, Tailwind, Leaflet

## 📡 Data Sources (Official JSON APIs)
| Source | Type | Status |
|--------|------|--------|
| Caltrans CWWP2 | Real-time lane closures | ✅ Implemented |
| CHP CKAN | Historical collisions | ✅ Working |
| Bay Area 511 | Real-time incidents | ✅ Working |
| CHP CAD HTML | Live dispatcher feed | ❌ Rejected (HTML only) |

## 📁 Key Services (`src/lib/services/`)
- `CHPPoller.ts` – Historical collisions from CKAN
- `CaltransPoller.ts` – Real-time lane closures from CWWP2
- `BayArea511Poller.ts` – 511.org incidents
- `CCTVPoller.ts` – Caltrans cameras

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
1. No HTML scraping (CHP CAD page is HTML only)
2. All DB operations via Drizzle ORM (no raw SQL)
3. Vercel serverless functions: `maxDuration = 300`

## 🔧 Common Commands
```bash
npm run db:generate && npm run db:migrate
curl "http://localhost:3000/api/chp-historical/poll?action=poll&limit=5000"
curl "http://localhost:3000/api/caltrans/poll"
