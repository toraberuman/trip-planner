import { TripData, ItineraryItem } from "../types";

// ---------------------------------------------------------------------------
// RFC-4180 CSV tokeniser — handles quoted fields with embedded commas/newlines
// ---------------------------------------------------------------------------
function tokeniseCSV(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuote = false;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];
    if (inQuote) {
      if (ch === '"' && raw[i + 1] === '"') { field += '"'; i += 2; }
      else if (ch === '"')                   { inQuote = false; i++; }
      else                                   { field += ch; i++; }
    } else {
      if      (ch === '"')  { inQuote = true; i++; }
      else if (ch === ',')  { row.push(field); field = ""; i++; }
      else if (ch === '\r' && raw[i + 1] === '\n') {
        row.push(field); rows.push(row); row = []; field = ""; i += 2;
      } else if (ch === '\n') {
        row.push(field); rows.push(row); row = []; field = ""; i++;
      } else { field += ch; i++; }
    }
  }
  row.push(field);
  if (row.some(f => f !== "")) rows.push(row);
  return rows;
}

// ---------------------------------------------------------------------------
// Day-of-week helper
// ---------------------------------------------------------------------------
const DOW_ZH = ["日", "一", "二", "三", "四", "五", "六"];
function computeDow(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return isNaN(d.getTime()) ? "" : `週${DOW_ZH[d.getDay()]}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Column indices for the user's actual Sheet layout (no header row):
//
//  0  date       YYYY-MM-DD
//  1  dayOfWeek  English weekday (ignored — we compute from date)
//  2  category   交通/住宿/食/景點/買物/桜/體驗 …
//  3  time       HH:MM
//  4  location   place / flight / activity name
//  5  originalName  Korean / Japanese original name
//  6  detail     roomType for 住宿, description for others
//  7  meals      素泊 / 朝食付 / 夕朝食付 …
//  8  address
//  9  phone
// 10  website
// 11  googleMaps
// 12  costKRW    ₩ price  (hotels, tickets)
// 13  costTWD    $ TWD equivalent
// 14  costAlt    ₩ price  (transport, food — when col 12 is blank)
// 15  (unused)
// ---------------------------------------------------------------------------
function rowToItem(cells: string[]): ItineraryItem {
  const c = (n: number) => cells[n]?.trim() ?? "";

  const date     = c(0);
  const category = c(2);
  const detail   = c(6);

  // Pick the most meaningful cost to display
  const krw = c(12);
  const twd = c(13);
  const alt = c(14);
  let cost: string | undefined;
  if (krw && twd)       cost = `${krw}／${twd}`;
  else if (krw)         cost = krw;
  else if (alt)         cost = alt;
  else if (twd)         cost = twd;

  // col 6 is roomType for 住宿, otherwise description
  const isStay = category === "住宿";

  return {
    date,
    dayOfWeek:         computeDow(date),
    category,
    time:              c(3),
    location:          c(4),
    originalName:      c(5)  || undefined,
    roomType:          isStay && detail ? detail : undefined,
    description:       !isStay && detail ? detail : undefined,
    accommodationMeals: c(7) || undefined,
    address:           c(8)  || undefined,
    phone:             c(9)  || undefined,
    website:           c(10) || undefined,
    googleMaps:        c(11) || undefined,
    cost,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function parseItineraryCSV(csvText: string): TripData {
  const rows = tokeniseCSV(csvText);

  const meta: Record<string, string> = {};
  const items: ItineraryItem[] = [];

  // Whether we've found and skipped a designed header row ("date" in col 0)
  let pastDesignedHeader = false;

  for (const row of rows) {
    const first = (row[0] ?? "").trim();

    // skip blank rows
    if (row.every(c => c.trim() === "")) continue;

    // optional metadata rows  (#title, #travelers, …)
    if (first.startsWith("#")) {
      meta[first.slice(1).toLowerCase()] = (row[1] ?? "").trim();
      continue;
    }

    // designed-format header row  (first cell == "date")
    if (!pastDesignedHeader && first.toLowerCase() === "date") {
      pastDesignedHeader = true;
      continue;
    }

    // actual data row — first cell must look like a date
    if (DATE_RE.test(first)) {
      items.push(rowToItem(row));
    }
    // (silently skip any other non-matching rows)
  }

  // propagate hotel details to consecutive nights at the same place
  let lastStay: ItineraryItem | null = null;
  for (const item of items) {
    if (item.category === "住宿") {
      if (lastStay && lastStay.location === item.location) {
        item.originalName      ??= lastStay.originalName;
        item.address           ??= lastStay.address;
        item.phone             ??= lastStay.phone;
        item.website           ??= lastStay.website;
        item.googleMaps        ??= lastStay.googleMaps;
        item.roomType          ??= lastStay.roomType;
        item.accommodationMeals??= lastStay.accommodationMeals;
        item.description       ??= lastStay.description;
      }
      lastStay = item;
    }
  }

  const dates = items.map(i => i.date).filter(Boolean).sort();
  const dateRange =
    meta["daterange"] ??
    (dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : "");

  return {
    title:          meta["title"]          ?? "旅遊行程",
    dateRange,
    travelers:      meta["travelers"]      || undefined,
    heroImage:      meta["heroimage"]      || undefined,
    weatherWebsite: meta["weatherwebsite"] || undefined,
    weatherLat:     meta["weatherlat"]  ? Number(meta["weatherlat"])  : undefined,
    weatherLon:     meta["weatherlon"]  ? Number(meta["weatherlon"])  : undefined,
    items,
  };
}

export function hashString(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h.toString(16);
}
