import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X, Plane, Train, Car, ExternalLink, Globe, MapPin,
  Phone, Clock, Navigation,
} from "lucide-react";
import { ItineraryItem, CostDetail, OrderItem } from "../types";
import { Linkify } from "../lib/Linkify";
import { parseAmount, toTWD } from "../lib/useExchangeRate";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// Category display titles
// ---------------------------------------------------------------------------
const CATEGORY_TITLE: Record<string, string> = {
  住宿: "住宿詳細資訊", 食: "餐廳資訊", 餐廳: "餐廳資訊", 飲食: "餐廳資訊",
  買物: "購物資訊", 交通: "交通資訊", 景點: "景點資訊", 體驗: "體驗資訊",
  桜: "賞花資訊", 紅葉: "紅葉資訊", 機票: "航班資訊",
};

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
// Cost tooltip
// ---------------------------------------------------------------------------
function CostChip({ amount, rates, currency, label }: {
  amount: string; rates: Record<string, number>; currency: string; label: string;
}) {
  const [show, setShow] = useState(false);
  const parsed = parseAmount(amount);
  const tip = toTWD(parsed, rates, currency);

  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 whitespace-nowrap">
        {label}
      </span>
      <span
        className="relative text-sm font-bold text-gray-900 cursor-help"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {amount}
        {show && tip && (
          <span className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50 shadow-lg">
            {tip}
          </span>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cost section (shared)
// ---------------------------------------------------------------------------
function CostSection({ cost, rates, currency }: { cost: CostDetail; rates: Record<string, number>; currency: string }) {
  const hasStructured = cost.perPerson || cost.total || cost.cash || cost.card || cost.prepaid;

  if (!hasStructured && !cost.legacy) return null;

  return (
    <div className="pt-4 border-t border-gray-100 space-y-2">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">費用</h4>
      <div className="space-y-1.5">
        {cost.perPerson   && <CostChip amount={cost.perPerson}  label="每人" rates={rates} currency={currency} />}
        {cost.total       && <CostChip amount={cost.total}      label="總計" rates={rates} currency={currency} />}
        {cost.prepaid     && <CostChip amount={cost.prepaid}    label="預付" rates={rates} currency={currency} />}
        {cost.card        && <CostChip amount={cost.card}       label="刷卡" rates={rates} currency={currency} />}
        {cost.cash        && <CostChip amount={cost.cash}       label="現金" rates={rates} currency={currency} />}
        {!hasStructured && cost.legacy && <CostChip amount={cost.legacy} label="費用" rates={rates} currency={currency} />}
        {cost.paymentNote && (
          <div className="flex items-start gap-2">
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">付款</span>
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
function CommonFields({ item, rates, currency }: { item: ItineraryItem; rates: Record<string, number>; currency: string }) {
  return (
    <div className="space-y-3">
      {item.address && (
        <div className="flex items-start gap-2">
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
            <MapPin size={10} />地址
          </span>
          <span className="text-sm text-gray-700">
            <a href={`https://maps.google.com/?q=${encodeURIComponent(item.address)}`}
              target="_blank" rel="noopener noreferrer"
              className="text-blue-500 hover:underline inline-flex items-center gap-1">
              {item.address}<ExternalLink size={10} className="shrink-0" />
            </a>
          </span>
        </div>
      )}
      {item.phone && (
        <div className="flex items-start gap-2">
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
            <Phone size={10} />電話
          </span>
          <span className="text-sm text-gray-700"><Linkify text={item.phone} /></span>
        </div>
      )}
      {item.website && (
        <div className="flex items-start gap-2">
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
            <Globe size={10} />官網
          </span>
          <a href={item.website} target="_blank" rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline break-all">{item.website}</a>
        </div>
      )}
      {item.googleMaps && (
        <div className="flex items-start gap-2">
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
            <MapPin size={10} />地圖
          </span>
          <a href={item.googleMaps} target="_blank" rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline">Google Maps</a>
        </div>
      )}
      {item.reservationUrl && (
        <div className="flex items-start gap-2">
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">預約</span>
          <a href={item.reservationUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline break-all">{item.reservationUrl}</a>
        </div>
      )}
      {item.note && (
        <div className="pt-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">備註</p>
          <p className="text-sm text-gray-600 whitespace-pre-line"><Linkify text={item.note} /></p>
        </div>
      )}
      <CostSection cost={item.cost} rates={rates} currency={currency} />
      {item.address && (
        <div className="pt-2">
          <div className="h-44 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
            <iframe width="100%" height="100%" style={{ border: 0 }} loading="lazy" allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(item.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Airport code parser  "TPE桃園" → { code: "TPE", city: "桃園" }
// ---------------------------------------------------------------------------
function parseAirport(str: string) {
  const m = str.match(/^([A-Z]{3})(.*)$/);
  return m ? { code: m[1], city: m[2].trim() } : { code: str, city: "" };
}

// ---------------------------------------------------------------------------
// FLIGHT CARD — boarding pass style
// ---------------------------------------------------------------------------
function FlightCard({ item, rates, currency }: { item: ItineraryItem; rates: Record<string, number>; currency: string }) {
  const from = parseAirport(item.departureAirport ?? "DEP");
  const to   = parseAirport(item.arrivalAirport   ?? "ARR");

  return (
    <div className="space-y-0">
      {/* Boarding pass top */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-t-2xl p-6">
        <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-0.5">
          {item.airline ?? "航空"}
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold font-mono">{item.flightNumber}</span>
          <span className="text-xs opacity-60">{item.date}</span>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <div className="text-center">
            <div className="text-4xl font-bold font-mono leading-none">{from.code}</div>
            <div className="text-xs opacity-70 mt-1">{from.city}</div>
            <div className="text-xl font-mono mt-2">{item.time}</div>
          </div>

          <div className="flex-1 flex flex-col items-center gap-1">
            <Plane size={20} className="rotate-0" />
            <div className="w-full flex items-center gap-1">
              <div className="flex-1 h-px bg-white/30" />
              <div className="flex-1 h-px bg-white/30" />
            </div>
          </div>

          <div className="text-center">
            <div className="text-4xl font-bold font-mono leading-none">{to.code}</div>
            <div className="text-xs opacity-70 mt-1">{to.city}</div>
            <div className="text-xl font-mono mt-2">{item.endTime ?? "—"}</div>
          </div>
        </div>
      </div>

      {/* Perforated tear line */}
      <div className="flex items-center mx-0">
        <div className="w-4 h-4 rounded-full bg-gray-100 -ml-2 shrink-0" />
        <div className="flex-1 border-t-2 border-dashed border-gray-200" />
        <div className="w-4 h-4 rounded-full bg-gray-100 -mr-2 shrink-0" />
      </div>

      {/* Stub */}
      <div className="bg-gray-50 rounded-b-2xl px-6 py-4 space-y-3">
        <CostSection cost={item.cost} rates={rates} currency={currency} />
        {item.note && <p className="text-xs text-gray-500 whitespace-pre-line"><Linkify text={item.note} /></p>}
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
  const loc = item.location;
  const isTrainLike = TRANSIT_RE.test(loc);
  const isTaxi      = TAXI_RE.test(loc);

  // Try to split "from - to" from originalName or location
  const fromTo = (item.originalName ?? loc).split(/\n/);
  const from   = fromTo[0]?.trim() ?? "";
  const to     = fromTo[1]?.trim() ?? "";

  return (
    <div className="space-y-4">
      {isTrainLike ? (
        /* Train ticket */
        <div className="border-2 border-blue-100 rounded-xl overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-2 flex items-center gap-2">
            <Train size={14} />
            <span className="text-sm font-bold">{loc.split("\n")[0]}</span>
          </div>
          <div className="px-4 py-4 flex items-center gap-3">
            <div>
              <div className="text-base font-bold text-gray-900">{from || item.time}</div>
              <div className="text-2xl font-mono font-bold text-blue-600">{item.time}</div>
            </div>
            <div className="flex-1 flex justify-center">
              <Navigation size={20} className="text-gray-300 rotate-90" />
            </div>
            <div className="text-right">
              <div className="text-base font-bold text-gray-900">{to || (item.endTime ?? "")}</div>
              {item.endTime && <div className="text-2xl font-mono font-bold text-blue-600">{item.endTime}</div>}
            </div>
          </div>
        </div>
      ) : isTaxi ? (
        /* Taxi */
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-yellow-700 font-bold text-sm">
            <Car size={16} />{loc.split("\n")[0]}
          </div>
          {(from || to) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{from}</span>
              {to && <><span className="text-gray-300">→</span><span>{to}</span></>}
            </div>
          )}
        </div>
      ) : (
        /* Generic transport */
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="font-bold text-gray-900">{loc}</div>
          {item.originalName && <div className="text-sm text-gray-500 mt-0.5">{item.originalName}</div>}
        </div>
      )}

      {item.reservationStatus && (
        <span className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-bold",
          item.reservationStatus === "現場" ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700")}>
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

  return (
    <div className="space-y-4">
      {item.reservationStatus && (
        <span className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-bold",
          item.reservationStatus === "現場" ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700")}>
          {item.reservationStatus}
        </span>
      )}

      {orders.length > 0 && (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] text-gray-400 uppercase">
              <tr>
                <th className="text-left px-3 py-2 font-bold">餐點</th>
                <th className="text-right px-3 py-2 font-bold">單價</th>
                <th className="text-right px-3 py-2 font-bold">數量</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((o: OrderItem, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{o.name}</div>
                    {o.originalName && <div className="text-[10px] text-gray-400">{o.originalName}</div>}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 font-mono">{o.price}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{o.qty}</td>
                </tr>
              ))}
            </tbody>
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
    return m ? { label: m[1].trim(), value: m[2].trim() } : { label: "", value: line.trim() };
  }).filter(r => r.label || r.value);

function HotelCard({ item, rates, currency }: { item: ItineraryItem; rates: Record<string, number>; currency: string }) {
  return (
    <div className="space-y-4">
      {/* Check-in / check-out */}
      {(item.checkin || item.checkout || item.time) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-orange-50 rounded-xl p-3 text-center">
            <div className="text-[10px] text-orange-400 font-bold uppercase">Check-in</div>
            <div className="text-lg font-bold text-orange-700">{item.checkin ?? item.time}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-400 font-bold uppercase">Check-out</div>
            <div className="text-lg font-bold text-gray-700">{item.checkout ?? item.endTime ?? "—"}</div>
          </div>
        </div>
      )}

      {/* Room info */}
      {item.roomInfo && (
        <div className="space-y-1.5">
          {parseRoomLines(item.roomInfo).map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              {r.label ? (
                <>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap">{r.label}</span>
                  <span className="text-sm text-gray-700"><Linkify text={r.value} /></span>
                </>
              ) : (
                <span className="text-sm text-gray-700"><Linkify text={r.value} /></span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Meals + facilities */}
      <div className="flex flex-wrap gap-2">
        {item.accommodationMeals && (
          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-lg text-xs font-bold">{item.accommodationMeals}</span>
        )}
        {item.minibar && (
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg text-xs font-bold">Mini Bar: {item.minibar}</span>
        )}
        {item.parking && (
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg text-xs font-bold">停車: {item.parking}</span>
        )}
        {item.shuttle && (
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg text-xs font-bold">接駁: {item.shuttle}</span>
        )}
      </div>

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
        <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">可退稅</span>
      )}

      {items.length > 0 && (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] text-gray-400 uppercase">
              <tr>
                <th className="text-left px-3 py-2 font-bold">品名</th>
                <th className="text-right px-3 py-2 font-bold">數量</th>
                <th className="text-right px-3 py-2 font-bold">單價</th>
                <th className="text-right px-3 py-2 font-bold">小計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((o: OrderItem, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{o.name}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{o.qty}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700">{o.price}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700">{o.subtotal ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(item.preTaxTotal || item.tax || item.taxIncludedTotal) && (
            <div className="bg-gray-50 px-3 py-2 space-y-1 text-xs text-right">
              {item.preTaxTotal      && <div className="text-gray-500">未稅: <span className="font-mono font-bold text-gray-700">{item.preTaxTotal}</span></div>}
              {item.tax              && <div className="text-gray-500">稅金: <span className="font-mono font-bold text-gray-700">{item.tax}</span></div>}
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
// BLOSSOM CARD (桜 / 紅葉)
// ---------------------------------------------------------------------------
function BlossomCard({ item, rates, currency }: { item: ItineraryItem; rates: Record<string, number>; currency: string }) {
  const isSakura = item.category === "桜";
  return (
    <div className="space-y-4">
      {(item.bloomDate || item.fullBloomDate) && (
        <div className="flex gap-3">
          {item.bloomDate && (
            <div className={cn("flex-1 rounded-xl p-3 text-center", isSakura ? "bg-pink-50" : "bg-amber-50")}>
              <div className={cn("text-[10px] font-bold uppercase", isSakura ? "text-pink-400" : "text-amber-500")}>預測開花</div>
              <div className={cn("text-sm font-bold mt-1", isSakura ? "text-pink-700" : "text-amber-700")}>{item.bloomDate}</div>
            </div>
          )}
          {item.fullBloomDate && (
            <div className={cn("flex-1 rounded-xl p-3 text-center", isSakura ? "bg-pink-100" : "bg-amber-100")}>
              <div className={cn("text-[10px] font-bold uppercase", isSakura ? "text-pink-500" : "text-amber-600")}>預測滿開</div>
              <div className={cn("text-sm font-bold mt-1", isSakura ? "text-pink-800" : "text-amber-800")}>{item.fullBloomDate}</div>
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
        <span className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-bold",
          item.reservationStatus === "現場" ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700")}>
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
  if (item.flightNumber) return <FlightCard item={item} rates={rates} currency={currency} />;
  switch (item.category) {
    case "交通":  return <TransitCard    item={item} rates={rates} currency={currency} />;
    case "食": case "餐廳": case "飲食":
                  return <RestaurantCard item={item} rates={rates} currency={currency} />;
    case "住宿":  return <HotelCard      item={item} rates={rates} currency={currency} />;
    case "買物":  return <ShoppingCard   item={item} rates={rates} currency={currency} />;
    case "桜": case "紅葉":
                  return <BlossomCard    item={item} rates={rates} currency={currency} />;
    default:      return <GenericCard    item={item} rates={rates} currency={currency} />;
  }
}

// ---------------------------------------------------------------------------
// Dialog wrapper
// ---------------------------------------------------------------------------
export function DetailDialog({ item, open, onClose, rates, currency }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={o => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 bg-white p-6 shadow-2xl sm:rounded-3xl max-h-[88vh] overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <Dialog.Title className="sr-only">{item?.location ?? "詳細資訊"}</Dialog.Title>
          <Dialog.Description className="sr-only">{item?.category}</Dialog.Description>

          {/* Visible header — category label + location + original name */}
          {item && (
            <div className="mb-5 pb-4 border-b border-gray-100 pr-8">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                {item.flightNumber
                  ? "航班資訊"
                  : (CATEGORY_TITLE[item.category] ?? "行程資訊")}
              </p>
              <h2 className="text-lg font-bold text-gray-900 mt-0.5 leading-snug">
                {item.flightNumber
                  ? `${item.flightNumber}${item.airline ? `　${item.airline}` : ""}`
                  : item.location}
              </h2>
              {!item.flightNumber && item.originalName && (
                <p className="text-sm text-gray-400 mt-0.5">{item.originalName}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                <Clock size={11} />
                <span>{item.date} {item.dayOfWeek}</span>
                {item.time && (
                  <span>{item.time}{item.endTime ? ` → ${item.endTime}` : ""}</span>
                )}
              </div>
            </div>
          )}

          {item && renderContent(item, rates, currency)}

          <Dialog.Close className="absolute right-4 top-4 rounded-full w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors">
            <X size={14} />
            <span className="sr-only">關閉</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
