import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X, Plane, Train, Car, ExternalLink, Globe, MapPin,
  Phone, Clock, Navigation, Hotel, Utensils, Camera,
  ShoppingBag, Star, Flower2, Leaf,
} from "lucide-react";
import { ItineraryItem, CostDetail, OrderItem } from "../types";
import { Linkify } from "../lib/Linkify";
import { parseAmount, toTWD } from "../lib/useExchangeRate";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// Category maps (mirrored from App.tsx for standalone use in dialog)
// ---------------------------------------------------------------------------
const CAT_PILL: Record<string, string> = {
  交通: "bg-sky-50 text-sky-700",
  住宿: "bg-amber-50 text-amber-700",
  食:   "bg-rose-50 text-rose-600",
  飲食: "bg-rose-50 text-rose-600",
  餐廳: "bg-rose-50 text-rose-600",
  景點: "bg-violet-50 text-violet-700",
  買物: "bg-fuchsia-50 text-fuchsia-700",
  體驗: "bg-teal-50 text-teal-700",
  桜:   "bg-pink-50 text-pink-600",
  紅葉: "bg-orange-50 text-orange-700",
  機票: "bg-blue-50 text-blue-700",
};

// Hex accent colour for the top stripe (one per category)
const CAT_ACCENT: Record<string, string> = {
  交通: "#38bdf8",
  住宿: "#fb923c",
  食:   "#f43f5e",
  飲食: "#f43f5e",
  餐廳: "#f43f5e",
  景點: "#8b5cf6",
  買物: "#d946ef",
  體驗: "#14b8a6",
  桜:   "#f472b6",
  紅葉: "#f97316",
  機票: "#2563eb",
};

type LI = React.ComponentType<{ size?: number; className?: string }>;
const CAT_ICON: Record<string, LI> = {
  交通: Car,  住宿: Hotel,
  食: Utensils, 飲食: Utensils, 餐廳: Utensils,
  景點: Camera, 買物: ShoppingBag, 體驗: Star,
  桜: Flower2,  紅葉: Leaf, 機票: Plane,
};

function catPill(item: ItineraryItem) {
  return CAT_PILL[item.category] ?? "bg-gray-50 text-gray-600";
}
function catAccent(item: ItineraryItem) {
  if (item.flightNumber) return "#2563eb";
  return CAT_ACCENT[item.category] ?? "#9ca3af";
}
function catDialogIcon(item: ItineraryItem): LI {
  if (item.flightNumber) return Plane;
  return CAT_ICON[item.category] ?? MapPin;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  item: ItineraryItem | null;
  open: boolean;
  onClose: () => void;
  rates: Record<string, number>;
  currency: string;
}

// ---------------------------------------------------------------------------
// Cost tooltip chip
// ---------------------------------------------------------------------------
function CostChip({ amount, rates, currency, label }: {
  amount: string; rates: Record<string, number>; currency: string; label: string;
}) {
  const [show, setShow] = useState(false);
  const parsed = parseAmount(amount);
  const tip    = toTWD(parsed, rates, currency);

  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 whitespace-nowrap">
        {label}
      </span>
      <span
        className="relative text-sm font-bold text-gray-900 cursor-help"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {amount}
        {show && tip && (
          <span className="absolute bottom-full left-0 mb-1.5 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-xl whitespace-nowrap z-50 shadow-xl">
            {tip}
          </span>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cost section
// ---------------------------------------------------------------------------
function CostSection({ cost, rates, currency }: {
  cost: CostDetail; rates: Record<string, number>; currency: string;
}) {
  const hasStructured = cost.perPerson || cost.total || cost.cash || cost.card || cost.prepaid;
  if (!hasStructured && !cost.legacy) return null;

  return (
    <div className="pt-4 border-t border-gray-100 space-y-2">
      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">費用</h4>
      <div className="space-y-1.5">
        {cost.perPerson  && <CostChip amount={cost.perPerson}  label="每人" rates={rates} currency={currency} />}
        {cost.total      && <CostChip amount={cost.total}      label="總計" rates={rates} currency={currency} />}
        {cost.prepaid    && <CostChip amount={cost.prepaid}    label="預付" rates={rates} currency={currency} />}
        {cost.card       && <CostChip amount={cost.card}       label="刷卡" rates={rates} currency={currency} />}
        {cost.cash       && <CostChip amount={cost.cash}       label="現金" rates={rates} currency={currency} />}
        {!hasStructured && cost.legacy &&
          <CostChip amount={cost.legacy} label="費用" rates={rates} currency={currency} />}
        {cost.paymentNote && (
          <div className="flex items-center gap-2">
            <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">付款</span>
            <span className="text-sm text-gray-600">{cost.paymentNote}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Common fields (address / phone / website / maps / note)
// ---------------------------------------------------------------------------
function CommonFields({ item, rates, currency }: {
  item: ItineraryItem; rates: Record<string, number>; currency: string;
}) {
  return (
    <div className="space-y-3">
      {item.address && (
        <div className="flex items-start gap-2">
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
            <MapPin size={9} />地址
          </span>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(item.address)}`}
            target="_blank" rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline inline-flex items-center gap-1 leading-snug"
          >
            {item.address}<ExternalLink size={10} className="shrink-0 opacity-60" />
          </a>
        </div>
      )}
      {item.phone && (
        <div className="flex items-start gap-2">
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
            <Phone size={9} />電話
          </span>
          <span className="text-sm text-gray-700"><Linkify text={item.phone} /></span>
        </div>
      )}
      {item.website && (
        <div className="flex items-start gap-2">
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
            <Globe size={9} />官網
          </span>
          <a href={item.website} target="_blank" rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline break-all leading-snug">{item.website}</a>
        </div>
      )}
      {item.googleMaps && (
        <div className="flex items-start gap-2">
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
            <MapPin size={9} />地圖
          </span>
          <a href={item.googleMaps} target="_blank" rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline">Google Maps</a>
        </div>
      )}
      {item.reservationUrl && (
        <div className="flex items-start gap-2">
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">預約</span>
          <a href={item.reservationUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline break-all leading-snug">
            {item.reservationSite ?? item.reservationUrl}
          </a>
        </div>
      )}
      {item.note && (
        <div className="pt-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">備註</p>
          <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
            <Linkify text={item.note} />
          </p>
        </div>
      )}
      <CostSection cost={item.cost} rates={rates} currency={currency} />
      {item.address && (
        <div className="pt-1">
          <div className="h-44 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
            <iframe
              width="100%" height="100%" style={{ border: 0 }}
              loading="lazy" allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(item.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Airport parser  "TPE桃園T2" → { code:"TPE", city:"桃園", terminal:"T2" }
// ---------------------------------------------------------------------------
function parseAirport(str: string) {
  const codeM = str.match(/^([A-Z]{3})/);
  if (!codeM) return { code: str, city: "", terminal: undefined as string | undefined };
  const rest   = str.slice(3);
  const termM  = rest.match(/(T\d+)$/);
  const terminal = termM?.[1] as string | undefined;
  const city   = terminal ? rest.slice(0, rest.length - terminal.length).trim() : rest.trim();
  return { code: codeM[1], city, terminal };
}

// ---------------------------------------------------------------------------
// Price helpers for order subtotals
// ---------------------------------------------------------------------------
function parsePriceNum(price: string): { value: number; sym: string } | null {
  const m = price.match(/([₩¥$€￥]?)\s*([\d,]+)/);
  if (!m || !m[2]) return null;
  return { value: parseInt(m[2].replace(/,/g, ""), 10), sym: m[1] || "" };
}
function fmtMoney(value: number, sym: string) {
  return `${sym}${value.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// FLIGHT CARD — boarding pass
// ---------------------------------------------------------------------------
function FlightCard({ item, rates, currency }: { item: ItineraryItem; rates: Record<string, number>; currency: string }) {
  const from = parseAirport(item.departureAirport ?? "DEP");
  const to   = parseAirport(item.arrivalAirport   ?? "ARR");

  return (
    <div className="space-y-0">
      {/* Boarding pass */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-t-2xl p-5">
        <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-0.5">
          {item.airline ?? "航空"}
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold font-mono">{item.flightNumber}</span>
          <span className="text-xs opacity-55">{item.date}</span>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <div className="text-center">
            <div className="text-4xl font-bold font-mono leading-none">{from.code}</div>
            <div className="text-xs opacity-65 mt-1">{from.city}</div>
            {from.terminal && <div className="text-[10px] opacity-45 font-mono mt-0.5">{from.terminal}</div>}
            <div className="text-xl font-mono font-semibold mt-2 opacity-90">{item.time}</div>
          </div>

          <div className="flex-1 flex flex-col items-center gap-1.5">
            <Plane size={18} />
            <div className="w-full flex items-center gap-0.5">
              <div className="flex-1 h-px bg-white/25" />
              <div className="flex-1 h-px bg-white/25" />
            </div>
          </div>

          <div className="text-center">
            <div className="text-4xl font-bold font-mono leading-none">{to.code}</div>
            <div className="text-xs opacity-65 mt-1">{to.city}</div>
            {to.terminal && <div className="text-[10px] opacity-45 font-mono mt-0.5">{to.terminal}</div>}
            <div className="text-xl font-mono font-semibold mt-2 opacity-90">{item.endTime ?? "—"}</div>
          </div>
        </div>
      </div>

      {/* Tear line */}
      <div className="flex items-center">
        <div className="w-3.5 h-3.5 rounded-full bg-[#F5F4F2] -ml-1.5 shrink-0" />
        <div className="flex-1 border-t-2 border-dashed border-gray-200" />
        <div className="w-3.5 h-3.5 rounded-full bg-[#F5F4F2] -mr-1.5 shrink-0" />
      </div>

      {/* Stub */}
      <div className="bg-gray-50 rounded-b-2xl px-5 py-4 space-y-3">
        <CostSection cost={item.cost} rates={rates} currency={currency} />
        {item.note && (
          <p className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">
            <Linkify text={item.note} />
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TRANSIT CARD
// ---------------------------------------------------------------------------
const TRANSIT_RE = /KTX|ITX|電車|地鐵|公車|巴士|MRT|地下鉄|新幹線|지하철|버스|Subway|metro/i;
const TAXI_RE    = /計程車|KAKAO\s*T|UBER|택시/i;

function TransitCard({ item, rates, currency }: { item: ItineraryItem; rates: Record<string, number>; currency: string }) {
  const loc         = item.location;
  const isTrainLike = TRANSIT_RE.test(loc);
  const isTaxi      = TAXI_RE.test(loc);
  const fromTo      = (item.originalName ?? loc).split(/\n/);
  const from        = fromTo[0]?.trim() ?? "";
  const to          = fromTo[1]?.trim() ?? "";

  return (
    <div className="space-y-4">
      {isTrainLike ? (
        <div className="border-2 border-sky-100 rounded-2xl overflow-hidden">
          <div className="bg-sky-500 text-white px-4 py-2.5 flex items-center gap-2">
            <Train size={14} />
            <span className="text-sm font-bold">{loc.split("\n")[0]}</span>
          </div>
          <div className="px-4 py-4 flex items-center gap-3">
            <div>
              <div className="text-sm font-medium text-gray-700">{from || "出發"}</div>
              <div className="text-2xl font-mono font-bold text-sky-600">{item.time}</div>
            </div>
            <div className="flex-1 flex justify-center">
              <Navigation size={20} className="text-gray-200 rotate-90" />
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-700">{to || (item.endTime ?? "抵達")}</div>
              {item.endTime && <div className="text-2xl font-mono font-bold text-sky-600">{item.endTime}</div>}
            </div>
          </div>
        </div>
      ) : isTaxi ? (
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-yellow-700 font-bold text-sm">
            <Car size={15} />{loc.split("\n")[0]}
          </div>
          {(from || to) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{from}</span>
              {to && <><span className="text-gray-300">→</span><span>{to}</span></>}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-4">
          <div className="font-semibold text-gray-900">{loc}</div>
          {item.originalName && <div className="text-sm text-gray-500 mt-0.5">{item.originalName}</div>}
        </div>
      )}

      {item.reservationStatus && (
        <span className={cn(
          "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold",
          item.reservationStatus === "現場" ? "bg-gray-100 text-gray-500" : "bg-emerald-50 text-emerald-700"
        )}>
          {item.reservationStatus}
        </span>
      )}

      <CommonFields item={item} rates={rates} currency={currency} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// RESTAURANT CARD
// ---------------------------------------------------------------------------
function RestaurantCard({ item, rates, currency }: { item: ItineraryItem; rates: Record<string, number>; currency: string }) {
  const orders = item.orderItems ?? [];

  const rows = orders.map(o => {
    const p   = parsePriceNum(o.price);
    const q   = parseInt(o.qty, 10);
    const sub = (p && q > 0) ? fmtMoney(p.value * q, p.sym) : undefined;
    return { ...o, sub };
  });

  let totalStr: string | undefined;
  if (rows.length > 0) {
    let sum = 0, sym = "", ok = true;
    for (const o of rows) {
      const p = parsePriceNum(o.price);
      const q = parseInt(o.qty, 10);
      if (!p || !(q > 0)) { ok = false; break; }
      sum += p.value * q; sym = p.sym;
    }
    if (ok) totalStr = fmtMoney(sum, sym);
  }

  return (
    <div className="space-y-4">
      {item.reservationStatus && (
        <span className={cn(
          "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold",
          item.reservationStatus === "現場" ? "bg-gray-100 text-gray-500" : "bg-emerald-50 text-emerald-700"
        )}>
          {item.reservationStatus}
        </span>
      )}

      {rows.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] text-gray-400 uppercase">
              <tr>
                <th className="text-left px-3 py-2.5 font-bold">餐點</th>
                <th className="text-right px-3 py-2.5 font-bold">數量</th>
                <th className="text-right px-3 py-2.5 font-bold">單價</th>
                <th className="text-right px-3 py-2.5 font-bold">小計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((o, i) => (
                <tr key={i} className="hover:bg-gray-50/60">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-900 leading-snug">{o.name}</div>
                    {o.originalName && <div className="text-[10px] text-gray-400 mt-0.5">{o.originalName}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-500 tabular-nums">{o.qty}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 font-mono tabular-nums">{o.price}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 font-mono tabular-nums">{o.sub ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            {totalStr && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-bold text-gray-400">合計</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900 tabular-nums">{totalStr}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <CommonFields item={item} rates={rates} currency={currency} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HOTEL CARD
// ---------------------------------------------------------------------------
const parseRoomLines = (text: string) =>
  text.split("\n").map(line => {
    const m = line.match(/^(.*?)[：:](.*)/);
    return m
      ? { label: m[1].trim(), value: m[2].trim() }
      : { label: "", value: line.trim() };
  }).filter(r => r.label || r.value);

function HotelCard({ item, rates, currency }: { item: ItineraryItem; rates: Record<string, number>; currency: string }) {
  return (
    <div className="space-y-4">
      {/* Check-in / check-out */}
      {(item.checkin || item.checkout || item.time) && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-amber-50 rounded-2xl p-3.5 text-center">
            <div className="text-[9px] text-amber-400 font-bold uppercase tracking-wider mb-1">Check-in</div>
            <div className="text-lg font-bold text-amber-700 tabular-nums">{item.checkin ?? item.time}</div>
          </div>
          <div className="bg-gray-50 rounded-2xl p-3.5 text-center">
            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Check-out</div>
            <div className="text-lg font-bold text-gray-700 tabular-nums">{item.checkout ?? item.endTime ?? "—"}</div>
          </div>
        </div>
      )}

      {/* Room info */}
      {item.roomInfo && (
        <div className="space-y-2">
          {parseRoomLines(item.roomInfo).map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              {r.label ? (
                <>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 whitespace-nowrap">
                    {r.label}
                  </span>
                  <span className="text-sm text-gray-700 leading-snug"><Linkify text={r.value} /></span>
                </>
              ) : (
                <span className="text-sm text-gray-700 leading-snug"><Linkify text={r.value} /></span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Meals + facilities */}
      {(item.accommodationMeals || item.minibar || item.parking || item.shuttle) && (
        <div className="flex flex-wrap gap-1.5">
          {item.accommodationMeals && (
            <span className="bg-orange-50 text-orange-700 px-2.5 py-0.5 rounded-full text-xs font-bold">{item.accommodationMeals}</span>
          )}
          {item.minibar && (
            <span className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-xs font-bold">Mini Bar: {item.minibar}</span>
          )}
          {item.parking && (
            <span className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-xs font-bold">停車: {item.parking}</span>
          )}
          {item.shuttle && (
            <span className="bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-full text-xs font-bold">接駁: {item.shuttle}</span>
          )}
        </div>
      )}

      <CommonFields item={item} rates={rates} currency={currency} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SHOPPING CARD
// ---------------------------------------------------------------------------
function ShoppingCard({ item, rates, currency }: { item: ItineraryItem; rates: Record<string, number>; currency: string }) {
  const items = item.orderItems ?? [];

  return (
    <div className="space-y-4">
      {item.taxRefund && (
        <span className="inline-block bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">可退稅</span>
      )}

      {items.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] text-gray-400 uppercase">
              <tr>
                <th className="text-left px-3 py-2.5 font-bold">品名</th>
                <th className="text-right px-3 py-2.5 font-bold">數量</th>
                <th className="text-right px-3 py-2.5 font-bold">單價</th>
                <th className="text-right px-3 py-2.5 font-bold">小計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((o: OrderItem, i: number) => (
                <tr key={i} className="hover:bg-gray-50/60">
                  <td className="px-3 py-2.5 font-medium text-gray-900">{o.name}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500 tabular-nums">{o.qty}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700 tabular-nums">{o.price}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700 tabular-nums">{o.subtotal ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(item.preTaxTotal || item.tax || item.taxIncludedTotal) && (
            <div className="bg-gray-50 px-3 py-2.5 space-y-1 text-xs text-right border-t border-gray-100">
              {item.preTaxTotal      && <div className="text-gray-400">未稅: <span className="font-mono font-bold text-gray-700">{item.preTaxTotal}</span></div>}
              {item.tax              && <div className="text-gray-400">稅金: <span className="font-mono font-bold text-gray-700">{item.tax}</span></div>}
              {item.taxIncludedTotal && <div className="text-gray-900 font-bold">含稅合計: <span className="font-mono">{item.taxIncludedTotal}</span></div>}
            </div>
          )}
        </div>
      )}

      <CommonFields item={item} rates={rates} currency={currency} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BLOSSOM CARD
// ---------------------------------------------------------------------------
function BlossomCard({ item, rates, currency }: { item: ItineraryItem; rates: Record<string, number>; currency: string }) {
  const isSakura = item.category === "桜";
  return (
    <div className="space-y-4">
      {(item.bloomDate || item.fullBloomDate) && (
        <div className="flex gap-2.5">
          {item.bloomDate && (
            <div className={cn("flex-1 rounded-2xl p-3.5 text-center", isSakura ? "bg-pink-50" : "bg-amber-50")}>
              <div className={cn("text-[9px] font-bold uppercase tracking-wider", isSakura ? "text-pink-400" : "text-amber-500")}>預測開花</div>
              <div className={cn("text-sm font-bold mt-1.5", isSakura ? "text-pink-700" : "text-amber-700")}>{item.bloomDate}</div>
            </div>
          )}
          {item.fullBloomDate && (
            <div className={cn("flex-1 rounded-2xl p-3.5 text-center", isSakura ? "bg-pink-100" : "bg-amber-100")}>
              <div className={cn("text-[9px] font-bold uppercase tracking-wider", isSakura ? "text-pink-500" : "text-amber-600")}>預測滿開</div>
              <div className={cn("text-sm font-bold mt-1.5", isSakura ? "text-pink-800" : "text-amber-800")}>{item.fullBloomDate}</div>
            </div>
          )}
        </div>
      )}
      <CommonFields item={item} rates={rates} currency={currency} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// GENERIC CARD
// ---------------------------------------------------------------------------
function GenericCard({ item, rates, currency }: { item: ItineraryItem; rates: Record<string, number>; currency: string }) {
  return (
    <div className="space-y-4">
      {item.reservationStatus && (
        <span className={cn(
          "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold",
          item.reservationStatus === "現場" ? "bg-gray-100 text-gray-500" : "bg-emerald-50 text-emerald-700"
        )}>
          {item.reservationStatus}
        </span>
      )}
      <CommonFields item={item} rates={rates} currency={currency} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
function renderContent(item: ItineraryItem, rates: Record<string, number>, currency: string) {
  if (item.flightNumber)                      return <FlightCard    item={item} rates={rates} currency={currency} />;
  switch (item.category) {
    case "交通":                               return <TransitCard    item={item} rates={rates} currency={currency} />;
    case "食": case "餐廳": case "飲食":       return <RestaurantCard item={item} rates={rates} currency={currency} />;
    case "住宿":                               return <HotelCard      item={item} rates={rates} currency={currency} />;
    case "買物":                               return <ShoppingCard   item={item} rates={rates} currency={currency} />;
    case "桜": case "紅葉":                    return <BlossomCard    item={item} rates={rates} currency={currency} />;
    default:                                   return <GenericCard    item={item} rates={rates} currency={currency} />;
  }
}

// ---------------------------------------------------------------------------
// Dialog wrapper
// ---------------------------------------------------------------------------
export function DetailDialog({ item, open, onClose, rates, currency }: Props) {
  const CatIcon = item ? catDialogIcon(item) : MapPin;

  return (
    <Dialog.Root open={open} onOpenChange={o => !o && onClose()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className={cn(
          "fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        )} />

        {/* Content — bottom sheet on mobile, centered modal on sm+ */}
        <Dialog.Content className={cn(
          "fixed z-50 bg-white shadow-2xl overflow-hidden flex flex-col",
          "focus:outline-none",
          // Mobile: bottom sheet
          "max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-[28px] max-sm:max-h-[92dvh]",
          "max-sm:data-[state=open]:animate-in max-sm:data-[state=closed]:animate-out",
          "max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom",
          "max-sm:data-[state=closed]:fade-out-0 max-sm:data-[state=open]:fade-in-0",
          // Desktop: centered
          "sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:w-full sm:max-w-lg sm:rounded-3xl sm:max-h-[88vh]",
          "sm:data-[state=open]:animate-in sm:data-[state=closed]:animate-out",
          "sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0",
          "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
        )}>
          <Dialog.Title className="sr-only">{item?.location ?? "詳細資訊"}</Dialog.Title>
          <Dialog.Description className="sr-only">{item?.category}</Dialog.Description>

          {/* Category accent stripe */}
          {item && (
            <div className="h-[3px] shrink-0" style={{ backgroundColor: catAccent(item) }} />
          )}

          {/* Mobile handle */}
          <div className="sm:hidden flex justify-center pt-2.5 pb-0 shrink-0">
            <div className="w-8 h-[3px] rounded-full bg-gray-200" />
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-5 pt-4 pb-8 sm:px-6 sm:pt-5">

            {/* Dialog header */}
            {item && (
              <div className="mb-5 pb-4 border-b border-gray-100 pr-8">
                {/* Category pill */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-full",
                    catPill(item)
                  )}>
                    <CatIcon size={9.5} />
                    <span>{item.flightNumber ? "航班" : item.category}</span>
                  </span>
                  {item.reservationStatus && (
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-[3px] rounded-full",
                      item.reservationStatus === "現場" ? "bg-gray-100 text-gray-500" : "bg-emerald-50 text-emerald-700"
                    )}>
                      {item.reservationStatus}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h2 className="text-[1.15rem] font-bold text-gray-900 leading-snug">
                  {item.flightNumber
                    ? `${item.flightNumber}${item.airline ? `　${item.airline}` : ""}`
                    : item.location}
                </h2>

                {/* Original name */}
                {!item.flightNumber && item.originalName && (
                  <p className="text-sm text-gray-400 mt-0.5 leading-snug">{item.originalName}</p>
                )}

                {/* Date + time */}
                <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400 font-medium">
                  <Clock size={11} className="shrink-0" />
                  <span>{item.date}{item.dayOfWeek ? ` ${item.dayOfWeek}` : ""}</span>
                  {item.time && (
                    <span className="tabular-nums">
                      {item.time}{item.endTime ? ` → ${item.endTime}` : ""}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Card content */}
            {item && renderContent(item, rates, currency)}
          </div>

          {/* Close button */}
          <Dialog.Close className="absolute right-4 top-[calc(3px+0.75rem)] sm:top-4 rounded-full w-8 h-8 flex items-center justify-center bg-black/5 hover:bg-black/10 active:scale-95 transition-all">
            <X size={14} className="text-gray-500" />
            <span className="sr-only">關閉</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
