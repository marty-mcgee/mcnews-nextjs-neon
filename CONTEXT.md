# Project Context – mcnews-nextjs-neon

**Last Updated: May 25, 2026 @ 04:30pm PST**

---

## 🧱 Tech Stack

- **Framework:** Next.js (App Router), TypeScript, React
- **Database:** Neon Postgres + Drizzle ORM
- **UI:** shadcn/ui, Tailwind, Leaflet (OpenStreetMaps)
- **Deployment:** Vercel
- **Package Manager:** Bun

---

## 📡 Data Sources

| Source | Type | Method | Status |
|--------|------|--------|--------|
| CHP CAD (Live) | Live dispatcher feed | HTML scraping (Cheerio) | ✅ Working |
| CHP CKAN | Historical collisions | Official JSON API (CKAN) | ✅ Working |
| Caltrans CWWP2 | Real-time lane closures | Official JSON API | ✅ Working |
| Bay Area 511 | Real-time incidents | Official JSON API (511.org) | ✅ Working |
| Caltrans CCTV | Traffic cameras | Official JSON API | ✅ Working |

---

## 📁 Service Files (`src/lib/services/`)

| File | Purpose |
|------|---------|
| `CHPCADPoller.ts` | Live CHP CAD incidents (Ukiah & Humboldt centers) |
| `CHPPoller.ts` | Historical CHP collisions from CKAN API |
| `CaltransPoller.ts` | Real-time lane closures from CWWP2 (all 12 districts) |
| `BayArea511Poller.ts` | Real-time incidents from 511.org API |
| `CCTVPoller.ts` | Caltrans traffic cameras |

---

## 🗺️ Dashboard Pages

| Page | Route | Features |
|------|-------|----------|
| Master Map | `/dashboard` | All sources combined, layer toggles, date/source filters |
| 511.org | `/dashboard/511org` | Mendocino filter, expandable rows, map view |
| Caltrans | `/dashboard/caltrans` | District filter, closure details, map view |
| CHP Live | `/dashboard/chp-live` | Type filter, incident details, map view |
| CHP Historical | `/dashboard/chp-historical` | Severity/year filters, collision stats, map view |

---

## 🔧 Key Implementation Details

### CHP CAD Poller
- Fetches from Ukiah (UKCC) and Humboldt (HMCC) centers only
- Coordinates are city-level geocoded (fallback to city centers)
- Uses Cheerio to parse HTML table from `cad.chp.ca.gov/Traffic.aspx`

### CHP Historical Poller
- Uses native `fetch` (not axios) to avoid Next.js 502 errors
- Filters by date range client-side (CKAN limitation)
- County codes: Humboldt (12), Mendocino (23)

### Bay Area 511 Poller
- Requires `BAY_AREA_511_API_KEY` in environment
- Extracts coordinates from `geography.coordinates` array
- Marks events as `closed` when no longer in API response

### Caltrans Poller
- Fetches all 12 Caltrans districts
- Uses District 1 for local filtering (Mendocino/Humboldt)
- Marks stale closures as `completed` after 30 minutes

### API Routes Pattern
All main data endpoints accept `?showAll=true` to override local filtering:
- `/api/caltrans/closures/raw?showAll=true`
- `/api/bay-area-511?showAll=true`
- `/api/chp-historical/collisions?showAll=true`

---

## 🗄️ Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `chp_cad_incidents` | Live CHP incidents |
| `chp_cad_centers` | CHP communication centers |
| `chp_collisions` | Historical collisions |
| `lane_closures` | Caltrans lane closures |
| `bay_area_traffic_events` | 511.org events |
| `cctv_cameras` | Traffic cameras |
| `api_request_logs` | API monitoring |

---

## ⚠️ Known Issues & Solutions

| Issue | Solution |
|-------|----------|
| Next.js 502 errors on external APIs | Use native `fetch` instead of `axios` |
| CKAN date filtering not supported | Fetch all records, filter client-side |
| CHP CAD has no coordinates | City-level geocoding as fallback |
| 511.org coordinates nested | Extract from `geography.coordinates` |

---

## 🔧 Common Commands

```bash
# Development
bun dev

# Database
bun run db:generate
bun run db:migrate
bun run db:push

# Manual Polling
curl "http://localhost:3000/api/chp-cad/poll?action=poll"
curl "http://localhost:3000/api/chp-historical/poll?action=poll&limit=500&startDate=2026-01-01"
curl "http://localhost:3000/api/bay-area-511/poll?action=poll"
curl "http://localhost:3000/api/caltrans/poll"

# Check Stats
curl "http://localhost:3000/api/chp-cad/poll?action=stats"
curl "http://localhost:3000/api/chp-historical/collisions/stats"
curl "http://localhost:3000/api/bay-area-511/poll?action=stats"
curl "http://localhost:3000/api/caltrans/closures/stats"

