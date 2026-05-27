# Project Context – mcnews-nextjs-neon

**Last Updated: May 26, 2026 @ 07:30am PST**

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
| **CalFire** | **Wildfire incidents** | **Official JSON API** | **✅ Working** |

---

## 🗺️ Main Dashboard (`/dashboard`)

### Layer Toggle Cards
The main dashboard features **color-coded layer toggle cards** that control map marker visibility:

| Layer | Color | Icon | Function |
|-------|-------|------|----------|
| Caltrans | Blue | 🚧 Car | Show/hide lane closures |
| 511.org | Emerald | 📻 Radio | Show/hide traffic events |
| CHP Live | Red | 🚨 AlertTriangle | Show/hide live incidents |
| CHP Historical | Purple | 📅 Calendar | Show/hide historical collisions |

### Card Features
- **Click toggles** layer visibility on the map (no page navigation)
- **Eye/EyeOff icons** indicate current visibility status
- **Record counts** display number of items per source
- **Active state styling** (colored backgrounds, borders) when visible
- **Show All / Hide All** button for bulk layer control

### Map Features
- **Dynamic legend** - only shows currently enabled layers
- **Marker clicks** navigate to service-specific detail pages
- **Filter panel** for source and date range filtering
- **Local Only / All Regions** toggle for geographic filtering
- **Historical data toggle** (off by default for performance)
- **Auto-refresh** (60 seconds, toggle on/off)

---

## 📁 Service Dashboard Pages

| Page | Route | Features |
|------|-------|----------|
| 511.org | `/dashboard/511org` | Mendocino filter, expandable rows, map view |
| Caltrans | `/dashboard/caltrans` | District filter, closure details, map view |
| CHP Live | `/dashboard/chp-live` | Type filter, incident details, map view |
| CHP Historical | `/dashboard/chp-historical` | Severity/year filters, collision stats, map view |
| **CalFire** | **`/dashboard/calfire`** | **County/status filters, fire stats, map view, pagination, show inactive toggle** |

### Common Dashboard Patterns
- **Expandable table rows** - click row to see full details
- **Toast notifications** for poll results and errors
- **Theme-aware styling** (light/dark mode support)
- **Responsive design** with Tailwind CSS
- **Consistent card layouts** using shadcn/ui components

---

## 🔧 API Routes

### Main Data Endpoints
| Endpoint | Parameters | Description |
|----------|------------|-------------|
| `/api/caltrans/closures/raw` | `?showAll=true` | Lane closures (District 1 by default) |
| `/api/bay-area-511` | `?showAll=true` | 511.org events (all Bay Area) |
| `/api/chp-cad` | - | Live CHP incidents (Ukiah/Humboldt only) |
| `/api/chp-historical/collisions` | `?showAll=true` | Historical collisions (local counties by default) |
| `/api/dashboard` | `?showAll=true&historical=true` | Unified endpoint for main dashboard |
| **`/api/calfire`** | **`?showAll=true`** | **Wildfire incidents (active only by default)** |

### Polling Endpoints
| Endpoint | Schedule | Description |
|----------|----------|-------------|
| `/api/bay-area-511/cron` | Once daily | Polls 511.org API |
| `/api/caltrans/cron` | Once daily | Polls Caltrans CWWP2 API |
| `/api/chp-cad/cron` | Once daily | Scrapes CHP CAD page |
| `/api/chp-historical/cron` | Once daily | Polls CKAN API |
| **`/api/calfire/cron`** | **Every 30 min** | **Polls CalFire API (active only)** |

### Utility Endpoints
- `/api/*/poll?action=poll` - Manual trigger polling
- `/api/*/poll?action=stats` - Get poll statistics
- `/api/*/debug` - Debug endpoints for testing
- `/api/*/cron` - CRON endpoints for CRON jobs and Vercel
- `/api/*/seed` - Seed endpoints for populating db initially

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
| **`calfire_incidents`** | **Wildfire incidents from CalFire API** |

---

## 🎨 UI Components (shadcn/ui)

| Component | Usage |
|-----------|-------|
| `Card`, `CardContent` | Stats cards, filter panels |
| `Button` | Actions (variant: default, outline, secondary, ghost) |
| `Badge` | Status indicators, counts |
| `Toast` | Notification system |
| `Dialog` | Modal dialogs (where used) |
| `Table` | Data display in service dashboards |

---

## ⚠️ Known Issues & Solutions

| Issue | Solution |
|-------|----------|
| Next.js 502 errors on external APIs | Use native `fetch` instead of `axios` |
| CKAN date filtering not supported | Fetch all records, filter client-side |
| CHP CAD has no coordinates | City-level geocoding as fallback |
| 511.org coordinates nested | Extract from `geography.coordinates` |

---

## 📋 Summary of UI Changes Documented

| New Feature | Documentation Section |
|-------------|----------------------|
| Layer Toggle Cards | Main Dashboard → Layer Toggle Cards |
| Eye/EyeOff indicators | Main Dashboard → Card Features |
| Show All/Hide All button | Main Dashboard → Card Features |
| Dynamic legend | Main Dashboard → Map Features |
| Theme-aware styling | Common Dashboard Patterns |
| Toast notifications | Common Dashboard Patterns |

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

# Test Cron Jobs Locally
curl "http://localhost:3000/api/bay-area-511/cron"
curl "http://localhost:3000/api/caltrans/cron"
curl "http://localhost:3000/api/chp-cad/cron"
curl "http://localhost:3000/api/chp-historical/cron"

---

## 🎨 UI Design Improvements (May 25, 2026)

### Main Dashboard Layer Controls (`/dashboard`)

The main dashboard now features **color-coded layer toggle cards** that control map marker visibility:

| Layer | Color | Icon | Toggle Function |
|-------|-------|------|-----------------|
| Caltrans | Blue | 🚧 Car | Show/hide lane closures |
| 511.org | Emerald | 📻 Radio | Show/hide traffic events |
| CHP Live | Red | 🚨 AlertTriangle | Show/hide live incidents |
| CHP Historical | Purple | 📅 Calendar | Show/hide historical collisions |

### Card Features
- **Click toggles** layer visibility on the map (no page navigation away)
- **Eye / EyeOff icons** indicate current visibility status
- **Record counts** display number of items per source
- **Active state styling** (colored backgrounds, borders) when layer is visible
- **Show All / Hide All** button for bulk layer control

### Map Features
- **Dynamic legend** - only shows currently enabled layers
- **Marker clicks** navigate to service-specific detail pages
- **Filter panel** for source and date range filtering
- **Local Only / All Regions** toggle for geographic filtering
- **Historical data toggle** (off by default for performance)
- **Auto-refresh** (60 seconds, toggle on/off)

### Toast Notifications
- Non-intrusive toast notifications replace browser alerts
- Styled to match theme (light/dark mode)
- Auto-dismiss after 3 seconds
- Success/error variants with color-coded icons

### Known Dev-Only Issue
- React-Leaflet + Next.js Fast Refresh may show `getPane is undefined` error during local development HMR
- **Does not affect production builds on Vercel** — map works perfectly in production
- Fix: Add a `key` prop to `MapContainer` that changes on hot reload (if needed)

---

## 📁 Updated File Structure (UI Components)

./src
├── app
│   ├── admin
│   │   └── coordinates
│   │       └── page.tsx
│   ├── api
│   │   ├── auth
│   │   │   └── [...all]
│   │   │       └── route.ts
│   │   ├── bay-area-511
│   │   │   ├── cron
│   │   │   │   └── route.ts
│   │   │   ├── debug
│   │   │   │   └── route.ts
│   │   │   ├── poll
│   │   │   │   └── route.ts
│   │   │   ├── route.ts
│   │   │   └── seed
│   │   │       └── route.ts
│   │   ├── calfire
│   │   │   ├── cron
│   │   │   │   └── route.ts
│   │   │   ├── debug
│   │   │   ├── poll
│   │   │   │   └── route.ts
│   │   │   ├── route.ts
│   │   │   └── seed
│   │   ├── caltrans
│   │   │   ├── closures
│   │   │   │   ├── [id]
│   │   │   │   │   └── route.ts
│   │   │   │   ├── add-test-coordinates
│   │   │   │   │   └── route.ts
│   │   │   │   ├── export
│   │   │   │   │   └── route.ts
│   │   │   │   ├── raw
│   │   │   │   │   └── route.ts
│   │   │   │   ├── route.ts
│   │   │   │   ├── search
│   │   │   │   │   └── route.ts
│   │   │   │   ├── simple
│   │   │   │   │   └── route.ts
│   │   │   │   ├── stats
│   │   │   │   │   └── route.ts
│   │   │   │   ├── summary
│   │   │   │   │   ├── debug
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── route.ts
│   │   │   │   └── update-coordinates
│   │   │   │       └── route.ts
│   │   │   ├── cron
│   │   │   │   └── route.ts
│   │   │   ├── poll
│   │   │   │   └── route.ts
│   │   │   └── seed
│   │   │       └── route.ts
│   │   ├── cctv
│   │   │   ├── cron
│   │   │   ├── debug
│   │   │   ├── poll
│   │   │   ├── route.ts
│   │   │   └── seed
│   │   ├── chp-cad
│   │   │   ├── chp-cad-centers
│   │   │   │   └── route.ts
│   │   │   ├── cron
│   │   │   │   └── route.ts
│   │   │   ├── poll
│   │   │   │   └── route.ts
│   │   │   ├── route.ts
│   │   │   └── seed
│   │   │       └── chp-cad-centers
│   │   │           ├── data
│   │   │           │   └── chpCadCenters.ts
│   │   │           └── route.ts
│   │   ├── chp-historical
│   │   │   ├── collisions
│   │   │   │   ├── route.ts
│   │   │   │   └── stats
│   │   │   │       └── route.ts
│   │   │   ├── cron
│   │   │   │   └── route.ts
│   │   │   ├── debug
│   │   │   │   └── route.ts
│   │   │   ├── poll
│   │   │   │   └── route.ts
│   │   │   ├── route.ts
│   │   │   └── seed
│   │   │       └── route.ts
│   │   ├── dashboard
│   │   │   ├── route.ts
│   │   │   └── stats
│   │   │       └── route.ts
│   │   ├── debug
│   │   │   ├── api-structures
│   │   │   │   └── route.ts
│   │   │   ├── compare
│   │   │   │   └── route.ts
│   │   │   ├── database
│   │   │   │   └── route.ts
│   │   │   ├── full
│   │   │   │   └── route.ts
│   │   │   ├── ids
│   │   │   │   └── route.ts
│   │   │   ├── route.ts
│   │   │   ├── schema-check
│   │   │   │   └── route.ts
│   │   │   └── test
│   │   │       ├── add-more
│   │   │       │   └── route.ts
│   │   │       ├── caltrans
│   │   │       │   └── route.ts
│   │   │       ├── cwwp2-status
│   │   │       │   └── route.ts
│   │   │       ├── populate
│   │   │       │   └── route.ts
│   │   │       ├── route.ts
│   │   │       └── verify
│   │   │           └── route.ts
│   │   └── master-data
│   │       └── route.ts
│   ├── dashboard
│   │   ├── 511org
│   │   │   ├── 511orgContent.tsx
│   │   │   └── page.tsx
│   │   ├── calfire
│   │   │   ├── calfireContent.tsx
│   │   │   └── page.tsx
│   │   ├── caltrans
│   │   │   ├── caltransContent.tsx
│   │   │   ├── closure
│   │   │   │   └── [id]
│   │   │   │       └── page.tsx
│   │   │   └── page.tsx
│   │   ├── chp-historical
│   │   │   ├── chpHistoricalContent.tsx
│   │   │   └── page.tsx
│   │   ├── chp-live
│   │   │   ├── chpLiveContent.tsx
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   ├── page-working.tsx
│   │   └── page.tsx
│   ├── debug
│   │   ├── all-polls
│   │   │   └── route.ts
│   │   ├── closure-test
│   │   │   └── page.tsx
│   │   └── page.tsx
│   ├── favicon.ico
│   ├── fonts.js
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── sign-in
│   │   └── page.tsx
│   ├── sign-up
│   │   └── page.tsx
│   └── test
│       └── page.tsx
├── components
│   ├── ClosureMap.tsx
│   ├── DataFreshness.tsx
│   ├── LoadingSpinner.tsx
│   ├── dashboard
│   │   ├── BayArea511.tsx
│   │   ├── CHPHistorical.tsx
│   │   ├── CHPLiveIncidents.tsx
│   │   └── CaltransClosures.tsx
│   ├── map
│   │   ├── leafletMap.tsx
│   │   ├── masterMap.tsx
│   │   └── simpleMap.tsx
│   ├── navbar.tsx
│   ├── themes
│   │   ├── provider.tsx
│   │   └── selector.tsx
│   └── ui
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── scroll-area.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── skeleton.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       └── toast.tsx
└── lib
    ├── auth
    │   ├── client.ts
    │   ├── schema.ts
    │   └── server.ts
    ├── db
    │   ├── client.ts
    │   └── seed.ts
    ├── scripts
    │   ├── audit-511.ts
    │   ├── audit-caltrans.ts
    │   ├── audit-chp-cad-live.ts
    │   ├── audit-chp-cad.ts
    │   ├── backfill-511-coords.ts
    │   ├── backfill-chp-cad-city-coords.ts
    │   ├── backfill-chp-cad-geocode.ts
    │   ├── backfill-chp-historical.ts
    │   ├── check-511-coords.ts
    │   ├── check-511-data.ts
    │   ├── check-chp-cad-coords.ts
    │   ├── check-chp-hist-db.ts
    │   ├── check-data-consistency.ts
    │   ├── compare-ui-vs-db.ts
    │   ├── database-health.ts
    │   ├── debug-calfire-full.ts
    │   ├── debug-calfire-raw.ts
    │   ├── diagnose-chp-cad.ts
    │   ├── diagnose-chp-hist-dates.ts
    │   ├── test-chp-api.ts
    │   ├── test-ckan-direct.ts
    │   └── verify-data.ts
    ├── services
    │   ├── BayArea511Poller.ts
    │   ├── CCTVPoller.ts
    │   ├── CHPCADPoller.ts
    │   ├── CHPPoller.ts
    │   ├── CalFirePoller.ts
    │   ├── CaltransPoller-info.ts
    │   ├── CaltransPoller.ts
    │   ├── MasterDataService.ts
    │   ├── TravelTimesPoller.ts
    │   └── index.ts
    └── utils
        ├── cityGeocoder.ts
        ├── index.ts
        └── locationCoords.ts

92 directories, 146 files

---

## 🔧 Common Commands (Updated)

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

# Test Cron Jobs Locally
curl "http://localhost:3000/api/bay-area-511/cron"
curl "http://localhost:3000/api/caltrans/cron"
curl "http://localhost:3000/api/chp-cad/cron"
curl "http://localhost:3000/api/chp-historical/cron"

---

# Export dashboard data to CSV+JSON
# (Click "Export" button on main dashboard)

---

✅ Review Summary
Section	Status	Notes
Tech Stack	✅ Complete	Bun, Next.js, Neon, Drizzle, shadcn/ui
Data Sources	✅ Accurate	5 sources with correct methods
Main Dashboard	✅ Excellent	Layer toggle cards, eye icons, show/hide all
Service Dashboards	✅ Complete	4 dashboards with expandable rows
API Routes	✅ Accurate	Cron jobs, polling endpoints, showAll parameter
Database Schema	✅ Clear	7 key tables listed
UI Components	✅ Good	shadcn/ui components documented
Known Issues	✅ Honest	502 errors, CKAN limitation, geocoding
File Structure	✅ Very thorough	Full tree showing 82 directories, 134 files
Commands	✅ Useful	Dev, DB, polling, cron tests
🔍 Minor Observations (Optional Improvements)
Issue	Suggestion
Duplicate content	The "UI Design Improvements" section repeats some content from "Main Dashboard" section
Duplicate commands	"Common Commands" appears twice (once before file tree, once after)
Old working files	page-new-working-0.tsx and page-new.tsx in dashboard folder — can be archived
Missing Leaflet dev issue	The known dev-only getPane is undefined error is documented ✅
📝 Suggested Cleanup (Optional)

## 🎯 Overall Assessment

| Category | Rating |
|----------|--------|
| **Completeness** | ⭐⭐⭐⭐⭐ (5/5) |
| **Accuracy** | ⭐⭐⭐⭐⭐ (5/5) |
| **Organization** | ⭐⭐⭐⭐⭐ (5/5) |
| **Usefulness for AI** | ⭐⭐⭐⭐⭐ (5/5) |

Your `CONTEXT.md` is **production-grade documentation**. Any future AI session (or new developer) can pick this up and immediately understand your entire application architecture, data flows, and UI patterns.

**Great work!** 🎉

## [MM] CONTEXT.md

---

## ⚙️ Polling Control & Optimization (May 25, 2026)

### Dashboard Data Fetching
- **Unified endpoint:** `/api/dashboard` combines all 4 data sources
- **Single API call** per refresh instead of 4 separate calls
- **Auto-refresh interval:** 60 seconds (user-toggleable)
- **Caching:** 30-second cache to prevent duplicate requests

### Cron Job Management
- **Production:** Controlled schedules in `vercel.json`
- **Development:** Disabled via dummy schedule (`0 0 31 2 *`)
- **Manual triggers:** Available via `/api/*/poll` endpoints

### Duplicate Prevention
- **Concurrent fetch blocking:** `isFetching` ref prevents overlapping requests
- **React Strict Mode:** Handles double-mounting gracefully
- **Unique keys:** Fallback IDs when primary ID is undefined

---

## 🔄 CHP Historical Poller - Backfill + Incremental

### Architecture
- **One-time backfill script** (`scripts/backfill-chp-historical.ts`) imports all historical data
- **Simple incremental poller** only fetches records since the latest date in database
- **Local counties only:** Humboldt (12) and Mendocino (23)

### Usage
```bash
# Backfill (run once)
bun run src/lib/scripts/backfill-chp-historical.ts

# Incremental polling
curl "http://localhost:3000/api/chp-historical/poll?action=poll"

## 🚀 Next Steps

Your CHP Historical Poller is now:
- ✅ Backfilled with all historical data
- ✅ Configured for incremental updates
- ✅ Ready for production cron jobs (once per day is sufficient)

The 775 local records from 2026 are now available for your dashboard and maps!

---

---

## 🗺️ CHP Historical Dashboard - Pagination & Map Synchronization (May 26, 2026)

### Feature Overview
The CHP Historical dashboard now features **dual pagination controls** (top and bottom of table) with **map synchronization** — the map only shows markers for the currently visible page of records.

### Key UX Improvements

| Feature | Implementation |
|---------|----------------|
| **Dual Pagination** | Previous/Next buttons at both top and bottom of the table |
| **Map Stays Visible** | Page changes do NOT auto-scroll — map remains in view |
| **Map Synchronization** | Map markers update to show only current page collisions |
| **Performance** | Map renders ≤50 markers per page instead of all 775 |
| **Reusable Component** | `PaginationControls` used at both top and bottom |

### User Benefits
- **No scrolling** — Users can change pages without scrolling past the map
- **Visual correlation** — Table rows match exactly what is on the map
- **Fast navigation** — Map updates instantly on page change
- **Better performance** — Map loads faster with fewer markers

### Technical Implementation

```tsx
// Pagination state
const [currentPage, setCurrentPage] = useState(0);
const pageSize = 50;
const totalPages = Math.ceil(totalRecords / pageSize);

// Map shows only current page markers
const currentPageData = getCurrentPageData();
const mapEvents = currentPageWithCoords.map(c => ({...}));

// No auto-scroll on page change
const handlePageChange = (newPage: number) => {
  setCurrentPage(newPage);
  // Map stays visible - no automatic scrolling
};

---

## 🔥 CalFire Incident Monitor

### Overview
The CalFire service monitors wildfire incidents across California using the official CAL FIRE incident API.

### Features
- **Real-time wildfire tracking** - Active and inactive incidents
- **Statewide coverage** - All California counties
- **Detailed incident data** - Acreage, containment, location, admin unit
- **Historical records** - Complete incident history
- **Map integration** - Visualize fire locations
- **Filter by county and status** - Active, contained, extinguished

### Polling Options
| Endpoint | Action | Description |
|----------|--------|-------------|
| `/api/calfire/poll?action=poll` | Active only | Fast poll for cron jobs (active incidents only) |
| `/api/calfire/poll?action=poll-norcal` | NorCal | All incidents (active+inactive) in Northern CA |
| `/api/calfire/poll?action=poll-all` | Full | **All incidents statewide (no filter)** |

### API Routes
| Endpoint | Purpose |
|----------|---------|
| `/api/calfire` | Main data endpoint (supports `?showAll=true`) |
| `/api/calfire/poll` | Manual polling with actions |
| `/api/calfire/cron` | Cron job endpoint (every 30 min) |

### Database Schema
```typescript
calfire_incidents {
  id, uniqueId, name, type, status, county, location,
  latitude, longitude, acresBurned, percentContained,
  startedAt, updatedAt, extinguishedAt, adminUnit,
  url, isActive, isCalFireIncident, rawData
}

---

## [MM] CONTEXT.md

---
