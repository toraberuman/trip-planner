// ---------------------------------------------------------------------------
// Cost breakdown — amounts kept as strings to preserve formatting (e.g. "₩20,000")
// ---------------------------------------------------------------------------
export interface CostDetail {
  perPerson?:   string;   // col 18 — per-person cost in local currency
  total?:       string;   // col 19 — total cost in local currency
  cash?:        string;   // col 20 — on-site cash payment
  card?:        string;   // col 21 — card payment (TWD charged to credit card)
  prepaid?:     string;   // col 22 — prepaid amount
  paymentNote?: string;   // col 23 — which card / transit card / ApplePay etc.
  // Legacy: synthesised from old cols 12-14 when new cols are empty
  legacy?:      string;
}

export type ReservationStatus = "預約" | "預刷" | "現場";

// Parsed order / purchase line item
export interface OrderItem {
  name:          string;
  originalName?: string;   // 餐廳 only
  price:         string;
  qty:           string;
  subtotal?:     string;   // 買物 only
}

// ---------------------------------------------------------------------------
// Main itinerary item
// ---------------------------------------------------------------------------
export interface ItineraryItem {
  // Core
  date:      string;
  dayOfWeek: string;
  category:  string;
  time:      string;
  endTime?:  string;   // parsed from location text or col 17
  endDate?:  string;   // col 16

  // Location
  location:      string;
  originalName?: string;
  address?:      string;
  phone?:        string;
  website?:      string;
  googleMaps?:   string;

  // Payment
  cost: CostDetail;
  reservationStatus?: ReservationStatus;
  reservationUrl?:    string;

  // Accommodation
  accommodationMeals?: string;
  roomInfo?:           string;
  minibar?:            string;
  parking?:            string;
  shuttle?:            string;
  checkin?:            string;
  checkout?:           string;

  // Flight
  airline?:          string;
  flightNumber?:     string;
  departureAirport?: string;
  arrivalAirport?:   string;

  // Generic
  detail?: string;
  orderItems?: OrderItem[];
  note?:   string;

  // 桜 / 紅葉
  bloomDate?:     string;
  fullBloomDate?: string;

  // 買物 tax
  preTaxTotal?:      string;
  tax?:              string;
  taxIncludedTotal?: string;
  taxRefund?:        boolean;
}

// ---------------------------------------------------------------------------
// Per-day metadata  (from special pseudo-rows: 天氣 / 大圖 / info)
// ---------------------------------------------------------------------------
export interface DayMeta {
  weatherLat?:  number;
  weatherLon?:  number;
  weatherSite?: string;
  heroImage?:   string;
  title?:       string;
  notes?:       Record<string, string>;
}

// ---------------------------------------------------------------------------
// Trip
// ---------------------------------------------------------------------------
export interface TripData {
  title:           string;
  dateRange:       string;
  travelers?:      string;
  travelerCount?:  number;
  heroImage?:      string;
  weatherLat?:     number;
  weatherLon?:     number;
  weatherWebsite?: string;
  currency:        string;   // "KRW" | "JPY"
  dayMeta:         Record<string, DayMeta>;
  items:           ItineraryItem[];
}
