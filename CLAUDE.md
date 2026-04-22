# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment

Node.js is **not installed locally**. All build and dev commands must be run via Docker.

```powershell
# Dev server (hot-reload at http://localhost:5175)
cd D:\onsen.dansi
docker compose up trip-planner

# Production build (verify compilation)
cd D:\onsen.dansi\trip-planner
docker run --rm -v "${PWD}:/app" -w /app node:lts-slim sh -c "npm install && npm run build"

# Type-check only
docker run --rm -v "${PWD}:/app" -w /app node:lts-slim sh -c "npx tsc --noEmit"
```

The docker-compose.yml is at `D:\onsen.dansi\docker-compose.yml` (parent of this repo). The dev server maps container port 5173 → host port 5175.

## Environment Variable

The app requires `VITE_SHEET_URL` — the Google Sheets CSV export URL. Set it in `D:\onsen.dansi\trip-planner\.env` (gitignored):

```
VITE_SHEET_URL=https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv
```

For GitHub Actions deployment, this is stored as the `VITE_SHEET_URL` repository secret.

## Architecture

Single-page React app (React 19 + Vite 6 + TailwindCSS v4). No router — one view, date-picker navigation.

**Data flow:**
1. `App.tsx` fetches CSV from `VITE_SHEET_URL` on load
2. `csvParser.ts` parses it into `TripData` (cached in `localStorage` keyed by content hash)
3. `App.tsx` renders a day-selector + timeline of `ItineraryItem` cards
4. Clicking a card opens `DetailDialog.tsx` with category-specific card UI

**Key files:**
- `src/types.ts` — all TypeScript interfaces (`TripData`, `ItineraryItem`, `CostDetail`, `DayMeta`)
- `src/lib/csvParser.ts` — RFC-4180 tokeniser + header-aware column mapping + category-specific `parseDetail()`
- `src/components/DetailDialog.tsx` — Radix UI Dialog with 7 card variants (FlightCard, TransitCard, RestaurantCard, HotelCard, ShoppingCard, BlossomCard, GenericCard)
- `src/lib/useExchangeRate.ts` — fetches live rates from open.er-api.com (1 hr localStorage cache); exports `parseAmount()` and `toTWD()` helpers used in cost tooltips

## CSV Format

The Google Sheet has a **header row** (first non-date, non-`#` row). The parser auto-detects it via `HEADER_ALIASES` in `csvParser.ts` — matching both Chinese and English column names. Column order can change freely as long as headers are present.

**Current sheet columns (Chinese headers):**
`開始日期 | 曜日 | 結束日期 | 類別 | 是否預約 | 是否退稅 | 開始時間 | 結束時間 | 地點 | 原文名稱 | 房型資訊 | 住宿餐食 | 地址 | 電話 | 網站 | Google Maps | 刷卡 | 台幣 | 現金 | Note | detail | checkin | checkout | mini bar | parking | shuttle`

**Special pseudo-rows** (category values that bypass normal item parsing):
- `天氣` — sets per-day weather lat/lon (location column = `lat,lon`, website column = weather URL)
- `大圖` — sets per-day hero image (website column = image URL)
- `info` — sets day title (location column) and key:value notes (detail column, pipe-separated `key:value|...`)

**`#` metadata rows** (before the header, e.g. `#title,2026 韓國賞櫻`) set trip-level fields: `title`, `travelers`, `heroImage`, `weatherLat`, `weatherLon`, `weatherWebsite`, `dateRange`.

## Category System

Categories drive icon, colour, and which `DetailDialog` card variant renders:

| Category | Card | Notes |
|----------|------|-------|
| `交通` | TransitCard | Auto-detects train (KTX/MRT/電車…) vs taxi vs generic |
| `住宿` | HotelCard | `房型資訊` col → `roomInfo` (rendered as key:value label rows) |
| `食` / `餐廳` / `飲食` | RestaurantCard | `detail` col pipe-separated → order items table |
| `買物` | ShoppingCard | `detail` col pipe-separated → purchase items + tax summary |
| `桜` / `紅葉` | BlossomCard | `detail` col `bloom:date\|fullbloom:date` |
| Any item with flight regex `[A-Z]{2}\d{3,4}` in location | FlightCard | Boarding-pass UI |
| Everything else | GenericCard | |

Flight detection happens in `parseLocation()` — a location string matching the flight regex (e.g. `KE2086`) triggers FlightCard regardless of category.

## Deployment

Push to `main` → GitHub Actions builds and deploys to GitHub Pages automatically (`.github/workflows/deploy.yml`). Alternatively, connect the repo to Cloudflare Pages using the **React (Vite)** framework preset.
