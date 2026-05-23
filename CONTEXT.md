# Project Context – mcnews-nextjs-neon

**Last Updated: May 23, 2026 @ 03:00pm PST**

## 🧱 Tech Stack
- Next.js (App Router), TypeScript, React
- Neon Postgres + Drizzle ORM
- shadcn/ui, Tailwind, Leaflet (Maps using OpenStreetMaps)
- Vercel Production Deployment
- Bun Package Manager

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

## 🚦 Bay Area 511.org Poller
- **Endpoint:** `http://api.511.org/traffic/events`
- **Format:** JSON, requires .env key `BAY_AREA_511_API_KEY`
- **Polling:** Every 5 minutes, all locations
- **Upsert logic:** By `source_id`, marks stale after 15 min

## 📊 CHP CAD Live Poller
- **Endpoint:** `https://cad.chp.ca.gov/Traffic.aspx`
- **Format:** HTML, requires scraping using Cheerio logic (mostly working)
- **Communication Centers:** Saved in database, related to CHP CAD Events
- **Focus:** Ukiah, Humboldt, but support all other CHP CAD CenterCodes

## 📊 CHP Historical Poller
- **Endpoint:** `data.ca.gov/api/3/action/datastore_search`
- **Resource ID:** `b8ce0ca4-b4e9-490d-b4d1-1f4ec48cbefb`
- **Format:** JSON, no auth
- **CKAN limitation:** No date operators in filters → client-side filtering
- **Batch import:** Paginates 100 records at a time

## 🚦 Caltrans CWWP2 Poller
- **Endpoint:** `https://cwwp2.dot.ca.gov/data/d{1-12}/lcs/lcsStatusDXX.json`
- **Format:** JSON, no auth
- **Polling:** Every 5 minutes, all 12 districts
- **Upsert logic:** By `source_id`, marks stale after 15 min

## 🚦 Caltrans CCTV Poller
- **Endpoint:** `https://cwwp2.dot.ca.gov/data/d{1-12}/lcs/lcsStatusDXX.json`
- **Format:** JSON, no auth
- **Polling:** Every 5 minutes, all 12 districts
- **Upsert logic:** By `source_id`, marks stale after 15 min

## ⚠️ Key Decisions
1. HTML scraping (CHP CAD page is HTML only, so use Cheerio)
2. All DB operations via Drizzle ORM (no raw SQL)
3. File naming conventions are Next.js App Router (camelCase friendly)
<!-- 4. Vercel serverless functions: `maxDuration = 300` -->

## 🔧 Common Commands
```bash
bun db:generate && bun db:push && bun dev
curl "http://localhost:3000/api/bay-area-511/poll?action=poll&limit=100"
curl "http://localhost:3000/api/chp-cad/poll?action=poll&limit=100"
curl "http://localhost:3000/api/chp-historical/poll?action=poll&limit=500"
curl "http://localhost:3000/api/caltrans/poll?action=poll&limit=500"
