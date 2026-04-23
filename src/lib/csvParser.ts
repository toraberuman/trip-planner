import { TripData, ItineraryItem, CostDetail, OrderItem, DayMeta, ReservationStatus } from "../types";

// ---------------------------------------------------------------------------
// RFC-4180 CSV tokeniser
// ---------------------------------------------------------------------------
function tokeniseCSV(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQuote = false, i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (inQuote) {
      if (ch === '"' && raw[i + 1] === '"') { field += '"'; i += 2; }
      else if (ch === '"') { inQuote = false; i++; }
      else { field += ch; i++; }
    } else {
      if      (ch === '"')  { inQuote = true; i++; }
      else if (ch === ',')  { row.push(field); field = ""; i++; }
      else if (ch === '\r' && raw[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ""; i += 2; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ""; i++; }
      else { field += ch; i++; }
    }
  }
  row.push(field);
  if (row.some(f => f !== "")) rows.push(row);
  return rows;
}

// ---------------------------------------------------------------------------
// Header aliases — maps each possible column header (Chinese / English) to an
// internal field name used throughout this file.
// ---------------------------------------------------------------------------
const HEADER_ALIASES: Record<string, string> = {
  // Chinese headers (user's Google Sheet columns)
  "開始日期": "date",
  "曜日": "dayOfWeek",
  "結束日期": "endDate",
  "類別": "category",
  "是否預約": "reservationStatus",
  "是否退稅": "taxRefund",
  "開始時間": "time",
  "結束時間": "endTime",
  "地點": "location",
  "原文名稱": "originalName",
  "房型資訊": "detail",      // main category-specific detail column
  "住宿餐食": "meals",
  "地址": "address",
  "電話": "phone",
  "網站": "website",
  "google maps": "googleMaps",
  "刷卡": "cardPayment",
  "台幣": "costTWD",
  "現金": "cashPayment",
  "note": "note",
  "備註": "note",
  "detail": "detail2",       // secondary free-text detail column
  "checkin": "checkin",
  "checkout": "checkout",
  "mini bar": "minibar",
  "parking": "parking",
  "shuttle": "shuttle",
  // English / legacy headers (backward compatibility)
  "date": "date",
  "category": "category",
  "time": "time",
  "enddate": "endDate",
  "endtime": "endTime",
  "location": "location",
  "originalname": "originalName",
  "meals": "meals",
  "address": "address",
  "phone": "phone",
  "website": "website",
  "googlemaps": "googleMaps",
  "costkrw": "cardPayment",
  "costtwd": "costTWD",
  "reservationstatus": "reservationStatus",
  "reservationurl": "reservationUrl",
  "reservationsite": "reservationSite",
};

// Default column positions — matches the user's actual Google Sheet layout.
// These serve as fallback when the sheet has no recognisable header row.
const DEFAULT_COL: Record<string, number> = {
  date: 0, dayOfWeek: 1, endDate: 2, category: 3,
  reservationStatus: 4, taxRefund: 5, time: 6, endTime: 7,
  location: 8, originalName: 9, detail: 10, meals: 11,
  address: 12, phone: 13, website: 14, googleMaps: 15,
  cardPayment: 16, costTWD: 17, cashPayment: 18,
  note: 19, checkin: 21, checkout: 22,
  minibar: 23, parking: 24, shuttle: 25,
};

type CI = Record<string, number | undefined>;

/** Try to build a CI from a header row.  Returns null if < 3 cells match. */
function buildColIdx(row: string[]): CI | null {
  const ci: CI = {};
  let hits = 0;
  for (let i = 0; i < row.length; i++) {
    const cell = row[i].trim();
    // Try exact match (important for Chinese), then lower-case (for English)
    const key = HEADER_ALIASES[cell] ?? HEADER_ALIASES[cell.toLowerCase()];
    if (key) { ci[key] = i; hits++; }
  }
  return hits >= 3 ? ci : null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RESERVED_PREFIX = /^\(已預約\)\s*/;
const FLIGHT_NO_RE = /\b([A-Z]{2}\d{3,4})\b/;
const FLIGHT_ROUTE_RE = /([A-Z]{3}\S*)\s+(\d{1,2}:\d{2})\s*[-–]\s*([A-Z]{3}\S*)\s+(\d{1,2}:\d{2})/;
const END_TIME_RE = /\b\d{1,2}:\d{2}\s*[-–]\s*(\d{1,2}:\d{2})/;

const DOW_ZH = ["日", "一", "二", "三", "四", "五", "六"];
function computeDow(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return isNaN(d.getTime()) ? "" : `週${DOW_ZH[d.getDay()]}`;
}

/** Get cell value by column index (safe: returns "" for missing/negative index) */
const g = (cells: string[], n: number | undefined): string =>
  (n !== undefined && n >= 0) ? (cells[n]?.trim() ?? "") : "";

// ---------------------------------------------------------------------------
// parseCost
// ---------------------------------------------------------------------------
function parseCost(cells: string[], ci: CI): CostDetail {
  const card        = g(cells, ci.cardPayment)    || undefined;
  const twd         = g(cells, ci.costTWD)        || undefined;
  const cash        = g(cells, ci.cashPayment)    || undefined;
  const prepaid     = g(cells, ci.prepaid)        || undefined;
  const paymentNote = g(cells, ci.paymentNote)    || undefined;
  const perPerson   = g(cells, ci.costPerPerson)  || undefined;
  const total       = g(cells, ci.totalCost)      || undefined;

  let legacy: string | undefined;
  if (!perPerson && !total) {
    // Primary amount: card payment > legacy KRW column > cash
    const primary = card || g(cells, ci.costKRW) || cash;
    const secondary = twd || "";
    const alt = g(cells, ci.costAlt) || "";
    if (primary && secondary) legacy = `${primary}／${secondary}`;
    else if (primary)         legacy = primary;
    else if (alt)             legacy = alt;
    else if (secondary)       legacy = secondary;
  }
  return { perPerson, total, cash, card, prepaid, paymentNote, legacy };
}

// ---------------------------------------------------------------------------
// parseLocation
// ---------------------------------------------------------------------------
function parseLocation(raw: string): {
  location: string;
  reservationStatus?: ReservationStatus;
  flightNumber?: string;
  airline?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  endTime?: string;
} {
  let location = raw.replace(/\n/g, " ").trim();
  let reservationStatus: ReservationStatus | undefined;

  if (RESERVED_PREFIX.test(location)) {
    reservationStatus = "預約";
    location = location.replace(RESERVED_PREFIX, "").trim();
  }

  const flightMatch = location.match(FLIGHT_NO_RE);
  if (flightMatch) {
    const flightNumber = flightMatch[1];
    const airline = location.slice(0, flightMatch.index ?? 0).trim() || undefined;
    const routeMatch = location.match(FLIGHT_ROUTE_RE);
    return {
      location,
      flightNumber,
      airline,
      departureAirport: routeMatch?.[1],
      arrivalAirport:   routeMatch?.[3],
      endTime:          routeMatch?.[4],
      reservationStatus,
    };
  }

  const etMatch = location.match(END_TIME_RE);
  return { location, endTime: etMatch?.[1], reservationStatus };
}

// ---------------------------------------------------------------------------
// parseDetail — category-aware complex detail column
// ---------------------------------------------------------------------------
function parseDetail(category: string, raw: string): Partial<ItineraryItem> {
  if (!raw) return {};

  if (category === "食" || category === "餐廳" || category === "飲食") {
    if (raw.includes("|")) {
      // Format: 名稱,原文名稱,數量,單價
      const orderItems: OrderItem[] = raw.split("|").filter(Boolean).map(seg => {
        const p = seg.split(",").map(s => s.trim());
        return { name: p[0] ?? "", originalName: p[1] || undefined, qty: p[2] ?? "", price: p[3] ?? "" };
      });
      return { detail: raw, orderItems };
    }
    return { detail: raw };
  }

  if (category === "買物") {
    const segs = raw.split("|");
    const items: OrderItem[] = [];
    const meta: Record<string, string> = {};
    for (const seg of segs) {
      if (seg.includes(":") && !/^\d/.test(seg.trim())) {
        const idx = seg.indexOf(":");
        meta[seg.slice(0, idx).trim().toLowerCase()] = seg.slice(idx + 1).trim();
      } else if (seg.trim()) {
        const p = seg.split(",").map(s => s.trim());
        items.push({ name: p[0] ?? "", qty: p[1] ?? "", price: p[2] ?? "", subtotal: p[3] || undefined });
      }
    }
    return {
      detail: raw, orderItems: items.length ? items : undefined,
      preTaxTotal: meta["pretax"] || undefined, tax: meta["tax"] || undefined,
      taxIncludedTotal: meta["total"] || undefined, taxRefund: meta["refund"] === "1",
    };
  }

  if (category === "桜" || category === "紅葉") {
    const kvMap = Object.fromEntries(
      raw.split("|").filter(s => s.includes(":")).map(s => {
        const idx = s.indexOf(":");
        return [s.slice(0, idx).trim().toLowerCase(), s.slice(idx + 1).trim()] as [string, string];
      })
    );
    return { detail: raw, bloomDate: kvMap["bloom"] || undefined, fullBloomDate: kvMap["fullbloom"] || undefined };
  }

  if (category === "住宿") {
    // checkin / checkout / minibar / parking / shuttle now have dedicated columns;
    // the detail column (房型資訊) is treated entirely as roomInfo (rendered as
    // labelled key:value rows in the detail dialog).
    return { detail: raw, roomInfo: raw.trim() || undefined };
  }

  return { detail: raw, note: raw };
}

// ---------------------------------------------------------------------------
// rowToItem
// ---------------------------------------------------------------------------
function rowToItem(cells: string[], ci: CI): ItineraryItem {
  const date     = g(cells, ci.date);
  const category = g(cells, ci.category);
  const locP     = parseLocation(g(cells, ci.location));
  // 住宿 → col 10 (房型資訊); 餐廳/買物 → col 20 (detail), fallback col 10
  const rawDetail = (category === "住宿")
    ? g(cells, ci.detail)
    : (g(cells, ci.detail2) || g(cells, ci.detail));
  const detP     = parseDetail(category, rawDetail);
  const cost     = parseCost(cells, ci);

  // Reservation status: dedicated column takes priority over location-prefix parsing
  const resRaw = g(cells, ci.reservationStatus);
  const reservationStatus: ReservationStatus | undefined =
    resRaw && resRaw !== "否"
      ? (resRaw === "是" ? "預約" : resRaw as ReservationStatus)
      : locP.reservationStatus;

  // Tax refund: from dedicated column OR detail-parsing (買物 category)
  const taxRefundRaw = g(cells, ci.taxRefund);
  const taxRefundFromCol = taxRefundRaw === "是" || taxRefundRaw === "true" || taxRefundRaw === "1";

  // Hotel fields from dedicated columns (override any detail-parsed values)
  const checkinFromCol  = g(cells, ci.checkin)  || undefined;
  const checkoutFromCol = g(cells, ci.checkout) || undefined;
  const minibarFromCol  = g(cells, ci.minibar)  || undefined;
  const parkingFromCol  = g(cells, ci.parking)  || undefined;
  const shuttleFromCol  = g(cells, ci.shuttle)  || undefined;
  const noteFromCol     = g(cells, ci.note)     || undefined;

  const item: ItineraryItem = {
    date, dayOfWeek: computeDow(date), category,
    time:    g(cells, ci.time),
    endDate: g(cells, ci.endDate)  || undefined,
    endTime: g(cells, ci.endTime)  || locP.endTime,
    location:     locP.location,
    originalName: g(cells, ci.originalName) || undefined,
    address:      g(cells, ci.address)      || undefined,
    phone:        g(cells, ci.phone)        || undefined,
    website:      g(cells, ci.website)      || undefined,
    googleMaps:   g(cells, ci.googleMaps)   || undefined,
    accommodationMeals: g(cells, ci.meals)  || undefined,
    cost, reservationStatus,
    reservationUrl: g(cells, ci.reservationUrl) || undefined,
    reservationSite: g(cells, ci.reservationSite) || undefined,
    airline:          locP.airline,
    flightNumber:     locP.flightNumber,
    departureAirport: locP.departureAirport,
    arrivalAirport:   locP.arrivalAirport,
    ...detP,
  };

  // Dedicated columns override detail-parsed values
  if (taxRefundFromCol)  item.taxRefund = true;
  if (noteFromCol)       item.note     = noteFromCol;
  if (checkinFromCol)    item.checkin  = checkinFromCol;
  if (checkoutFromCol)   item.checkout = checkoutFromCol;
  if (minibarFromCol)    item.minibar  = minibarFromCol;
  if (parkingFromCol)    item.parking  = parkingFromCol;
  if (shuttleFromCol)    item.shuttle  = shuttleFromCol;

  return item;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function parseItineraryCSV(csvText: string): TripData {
  const rows = tokeniseCSV(csvText);
  const meta: Record<string, string> = {};
  const dayMeta: Record<string, DayMeta> = {};
  const items: ItineraryItem[] = [];
  let ci: CI = { ...DEFAULT_COL };           // start with defaults
  let headerDetected = false;
  let pendingTravelerCount: number | undefined;

  for (const row of rows) {
    const first = (row[0] ?? "").trim();
    if (row.every(r => r.trim() === "")) continue;

    // Metadata rows (#key value)
    if (first.startsWith("#")) {
      meta[first.slice(1).toLowerCase()] = (row[1] ?? "").trim();
      continue;
    }

    // Header row detection (Chinese or English)
    if (!headerDetected && !DATE_RE.test(first)) {
      const detected = buildColIdx(row);
      if (detected) {
        ci = { ...DEFAULT_COL, ...detected };   // detected overrides defaults
        headerDetected = true;
      }
      // Whether detected or not, skip non-date rows before first data row
      continue;
    }

    if (!DATE_RE.test(first)) continue;        // skip non-date rows

    const date = first;
    const cat  = (row[ci.category ?? 3] ?? "").trim();

    // ── Special pseudo-rows ──────────────────────────────────────────────────
    if (cat === "天氣") {
      const [latS, lonS] = (row[ci.location ?? 8] ?? "").split(",");
      const lat = parseFloat(latS), lon = parseFloat(lonS);
      const site = (row[ci.website ?? 14] ?? "").trim() || undefined;
      const dm = dayMeta[date] ?? (dayMeta[date] = {});
      if (!isNaN(lat)) dm.weatherLat = lat;
      if (!isNaN(lon)) dm.weatherLon = lon;
      if (site) dm.weatherSite = site;
      continue;
    }

    if (cat === "大圖") {
      const img = (row[ci.website ?? 14] ?? "").trim();
      if (img) { (dayMeta[date] ?? (dayMeta[date] = {})).heroImage = img; }
      continue;
    }

    if (cat === "info") {
      const dm = dayMeta[date] ?? (dayMeta[date] = {});
      dm.title = (row[ci.location ?? 8] ?? "").trim() || undefined;
      const noteRaw = (row[ci.detail ?? 10] ?? "").trim();
      if (noteRaw) {
        dm.notes = Object.fromEntries(
          noteRaw.split("|").filter(s => s.includes(":")).map(s => {
            const idx = s.indexOf(":");
            return [s.slice(0, idx).trim(), s.slice(idx + 1).trim()] as [string, string];
          })
        );
        const tc = dm.notes["同行人數"]?.match(/(\d+)/);
        if (tc) pendingTravelerCount = parseInt(tc[1]);
        if (dm.title && !meta["title"]) meta["title"] = dm.title;
      }
      continue;
    }
    // ─────────────────────────────────────────────────────────────────────────

    items.push(rowToItem(row, ci));
  }

  // Propagate hotel details to consecutive nights at the same property
  let lastStay: ItineraryItem | null = null;
  for (const item of items) {
    if (item.category === "住宿") {
      if (lastStay && lastStay.location === item.location) {
        item.originalName       ??= lastStay.originalName;
        item.address            ??= lastStay.address;
        item.phone              ??= lastStay.phone;
        item.website            ??= lastStay.website;
        item.googleMaps         ??= lastStay.googleMaps;
        item.roomInfo           ??= lastStay.roomInfo;
        item.accommodationMeals ??= lastStay.accommodationMeals;
        item.minibar            ??= lastStay.minibar;
        item.parking            ??= lastStay.parking;
        item.shuttle            ??= lastStay.shuttle;
      }
      lastStay = item;
    }
  }

  const dates = items.map(i => i.date).filter(Boolean).sort();
  const allCosts = items.map(i => i.cost.legacy ?? "").join("");
  const currency = allCosts.includes("¥") ? "JPY"
    : allCosts.includes("₩") ? "KRW"
    : "KRW";

  return {
    title:          meta["title"]           ?? "旅遊行程",
    dateRange:      meta["daterange"]       ?? (dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : ""),
    travelers:      meta["travelers"]       || undefined,
    travelerCount:  pendingTravelerCount,
    heroImage:      meta["heroimage"]       || undefined,
    weatherLat:     meta["weatherlat"]    ? Number(meta["weatherlat"])  : undefined,
    weatherLon:     meta["weatherlon"]    ? Number(meta["weatherlon"])  : undefined,
    weatherWebsite: meta["weatherwebsite"] || undefined,
    currency, dayMeta, items,
  };
}

export function hashString(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return h.toString(16);
}
