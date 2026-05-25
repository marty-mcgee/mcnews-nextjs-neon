# Project Context – mcnews-nextjs-neon

**Last Updated: May 25, 2026 @ 05:30pm PST**

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
| `/api/bay-area-511` | `?showAll=true` | 511.org events (Mendocino by default) |
| `/api/chp-cad` | - | Live CHP incidents (Ukiah/Humboldt only) |
| `/api/chp-historical/collisions` | `?showAll=true` | Historical collisions (local counties by default) |

### Polling Endpoints
| Endpoint | Schedule | Description |
|----------|----------|-------------|
| `/api/bay-area-511/cron` | Every 5 min | Polls 511.org API |
| `/api/caltrans/cron` | Every 5 min | Polls Caltrans CWWP2 API |
| `/api/chp-cad/cron` | Every 10 min | Scrapes CHP CAD page |
| `/api/chp-historical/cron` | Every 6 hours | Polls CKAN API |

### Utility Endpoints
- `/api/*/poll?action=poll` - Manual trigger polling
- `/api/*/poll?action=stats` - Get poll statistics
- `/api/*/debug` - Debug endpoints for testing

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