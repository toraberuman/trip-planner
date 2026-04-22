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
// Column indices (cols 16-25 are optional new columns)
// ---------------------------------------------------------------------------
const COL = {
  date: 0, dayOfWeek: 1, category: 2, time: 3,
  location: 4, originalName: 5, detail: 6, meals: 7,
  address: 8, phone: 9, website: 10, googleMaps: 11,
  costKRW: 12, costTWD: 13, costAlt: 14,
  endDate: 16, endTime: 17,
  costPerPerson: 18, totalCost: 19, cashPayment: 20,
  cardPayment: 21, prepaid: 22, paymentNote: 23,
  reservationStatus: 24, reservationUrl: 25,
} as const;

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

const g = (cells: string[], n: number) => cells[n]?.trim() ?? "";

// ---------------------------------------------------------------------------
// parseCost
// ---------------------------------------------------------------------------
function parseCost(cells: string[]): CostDetail {
  const perPerson   = g(cells, COL.costPerPerson)  || undefined;
  const total       = g(cells, COL.totalCost)       || undefined;
  const cash        = g(cells, COL.cashPayment)     || undefined;
  const card        = g(cells, COL.cardPayment)     || undefined;
  const prepaid     = g(cells, COL.prepaid)         || undefined;
  const paymentNote = g(cells, COL.paymentNote)     || undefined;

  let legacy: string | undefined;
  if (!perPerson && !total) {
    const krw = g(cells, COL.costKRW);
    const twd = g(cells, COL.costTWD);
    const alt = g(cells, COL.costAlt);
    if (krw && twd) legacy = `${krw}／${twd}`;
    else if (krw)   legacy = krw;
    else if (alt)   legacy = alt;
    else if (twd)   legacy = twd;
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
// parseDetail — category-aware col 6 parsing
// ---------------------------------------------------------------------------
function parseDetail(category: string, raw: string): Partial<ItineraryItem> {
  if (!raw) return {};

  if (category === "食" || category === "餐廳" || category === "飲食") {
    if (raw.includes("|")) {
      const orderItems: OrderItem[] = raw.split("|").filter(Boolean).map(seg => {
        const p = seg.split(",").map(s => s.trim());
        return { name: p[0] ?? "", originalName: p[1] || undefined, price: p[2] ?? "", qty: p[3] ?? "" };
      });
      return { detail: raw, orderItems };
    }
    return { detail: raw, note: raw };
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
    return { detail: raw, orderItems: items.length ? items : undefined,
      preTaxTotal: meta["pretax"] || undefined, tax: meta["tax"] || undefined,
      taxIncludedTotal: meta["total"] || undefined, taxRefund: meta["refund"] === "1" };
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
    const lines = raw.split("\n");
    const struct: Record<string, string> = {};
    const prose: string[] = [];
    for (const line of lines) {
      const m = line.match(/^(minibar|parking|shuttle|checkin|checkout)[：:](.*)/i);
      if (m) struct[m[1].toLowerCase()] = m[2].trim();
      else prose.push(line);
    }
    return { detail: raw,
      minibar:  struct["minibar"]  || undefined,
      parking:  struct["parking"]  || undefined,
      shuttle:  struct["shuttle"]  || undefined,
      checkin:  struct["checkin"]  || undefined,
      checkout: struct["checkout"] || undefined,
      roomInfo: prose.filter(Boolean).join("\n").trim() || undefined };
  }

  return { detail: raw, note: raw };
}

// ---------------------------------------------------------------------------
// rowToItem
// ---------------------------------------------------------------------------
function rowToItem(cells: string[]): ItineraryItem {
  const date     = g(cells, COL.date);
  const category = g(cells, COL.category);
  const locP     = parseLocation(g(cells, COL.location));
  const detP     = parseDetail(category, g(cells, COL.detail));
  const cost     = parseCost(cells);

  const explicit = g(cells, COL.reservationStatus) as ReservationStatus | "";
  const reservationStatus = (explicit as ReservationStatus) || locP.reservationStatus;

  return {
    date, dayOfWeek: computeDow(date), category,
    time:    g(cells, COL.time),
    endDate: g(cells, COL.endDate)   || undefined,
    endTime: g(cells, COL.endTime)   || locP.endTime,
    location:     locP.location,
    originalName: g(cells, COL.originalName) || undefined,
    address:      g(cells, COL.address)      || undefined,
    phone:        g(cells, COL.phone)        || undefined,
    website:      g(cells, COL.website)      || undefined,
    googleMaps:   g(cells, COL.googleMaps)   || undefined,
    accommodationMeals: g(cells, COL.meals)  || undefined,
    cost, reservationStatus,
    reservationUrl:   g(cells, COL.reservationUrl) || undefined,
    airline:          locP.airline,
    flightNumber:     locP.flightNumber,
    departureAirport: locP.departureAirport,
    arrivalAirport:   locP.arrivalAirport,
    ...detP,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function parseItineraryCSV(csvText: string): TripData {
  const rows = tokeniseCSV(csvText);
  const meta: Record<string, string> = {};
  const dayMeta: Record<string, DayMeta> = {};
  const items: ItineraryItem[] = [];
  let pastHeader = false;
  let pendingTravelerCount: number | undefined;

  for (const row of rows) {
    const first = (row[0] ?? "").trim();
    if (row.every(r => r.trim() === "")) continue;

    if (first.startsWith("#")) {
      meta[first.slice(1).toLowerCase()] = (row[1] ?? "").trim();
      continue;
    }
    if (!pastHeader && first.toLowerCase() === "date") { pastHeader = true; continue; }
    if (!DATE_RE.test(first)) continue;

    const date = first;
    const cat  = (row[COL.category] ?? "").trim();

    if (cat === "天氣") {
      const [latS, lonS] = (row[COL.location] ?? "").split(",");
      const lat = parseFloat(latS), lon = parseFloat(lonS);
      const site = (row[COL.website] ?? "").trim() || undefined;
      const dm = dayMeta[date] ?? (dayMeta[date] = {});
      if (!isNaN(lat)) dm.weatherLat = lat;
      if (!isNaN(lon)) dm.weatherLon = lon;
      if (site) dm.weatherSite = site;
      continue;
    }

    if (cat === "大圖") {
      const img = (row[COL.website] ?? "").trim();
      if (img) { (dayMeta[date] ?? (dayMeta[date] = {})).heroImage = img; }
      continue;
    }

    if (cat === "info") {
      const dm = dayMeta[date] ?? (dayMeta[date] = {});
      dm.title = (row[COL.location] ?? "").trim() || undefined;
      const noteRaw = (row[COL.detail] ?? "").trim();
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

    items.push(rowToItem(row));
  }

  // Propagate hotel details to consecutive nights at same property
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
  const currency = allCosts.includes("₩") ? "KRW" : allCosts.includes("¥") ? "JPY" : "KRW";

  return {
    title:          meta["title"]         ?? "旅遊行程",
    dateRange:      meta["daterange"]     ?? (dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : ""),
    travelers:      meta["travelers"]     || undefined,
    travelerCount:  pendingTravelerCount,
    heroImage:      meta["heroimage"]     || undefined,
    weatherLat:     meta["weatherlat"]   ? Number(meta["weatherlat"])  : undefined,
    weatherLon:     meta["weatherlon"]   ? Number(meta["weatherlon"])  : undefined,
    weatherWebsite: meta["weatherwebsite"] || undefined,
    currency, dayMeta, items,
  };
}

export function hashString(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return h.toString(16);
}
