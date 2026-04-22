import React, { useState, useMemo, useEffect } from "react";
import {
  Plane, Hotel, MapPin, Utensils, Calendar, Users,
  ChevronRight, CloudRain, Sun, Cloud, CloudFog,
  CloudDrizzle, CloudSnow, CloudLightning, Loader2,
  RefreshCw, Globe, Map as MapIcon, Car,
  ShoppingBag, Star, Flower2, Leaf, Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { TripData, ItineraryItem } from "./types";
import { parseItineraryCSV, hashString } from "./lib/csvParser";
import { useExchangeRate } from "./lib/useExchangeRate";
import { DetailDialog } from "./components/DetailDialog";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SHEET_URL  = import.meta.env.VITE_SHEET_URL as string | undefined;
const CACHE_KEY  = "trip_v2";

// ---------------------------------------------------------------------------
// Category system
// ---------------------------------------------------------------------------
type IconComp = React.ComponentType<{ size?: number; className?: string }>;

const CAT_ICON: Record<string, IconComp> = {
  交通: Car, 住宿: Hotel,
  食: Utensils, 飲食: Utensils, 餐廳: Utensils,
  景點: Camera, 買物: ShoppingBag, 體驗: Star,
  桜: Flower2, 紅葉: Leaf, 機票: Plane,
};

const CAT_COLOR: Record<string, string> = {
  交通: "bg-blue-50 text-blue-600 border-blue-200",
  住宿: "bg-orange-50 text-orange-600 border-orange-200",
  食:   "bg-red-50 text-red-600 border-red-200",
  飲食: "bg-red-50 text-red-600 border-red-200",
  餐廳: "bg-red-50 text-red-600 border-red-200",
  景點: "bg-purple-50 text-purple-600 border-purple-200",
  買物: "bg-pink-50 text-pink-600 border-pink-200",
  體驗: "bg-teal-50 text-teal-600 border-teal-200",
  桜:   "bg-pink-50 text-pink-500 border-pink-200",
  紅葉: "bg-amber-50 text-amber-600 border-amber-200",
  機票: "bg-sky-50 text-sky-600 border-sky-200",
};

function catIcon(cat: string): IconComp {
  return CAT_ICON[cat] ?? MapPin;
}
function catColor(cat: string): string {
  return CAT_COLOR[cat] ?? "bg-gray-50 text-gray-600 border-gray-200";
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------
interface WeatherPoint { time: string; temp: string; icon: IconComp; color: string; }

function wIcon(code: number) {
  if (code === 0)            return { icon: Sun,          color: "text-orange-400" };
  if (code <= 3)             return { icon: Cloud,         color: "text-gray-400" };
  if (code === 45 || code === 48) return { icon: CloudFog, color: "text-gray-400" };
  if (code <= 57)            return { icon: CloudDrizzle,  color: "text-blue-400" };
  if (code <= 67)            return { icon: CloudRain,     color: "text-blue-500" };
  if (code <= 77)            return { icon: CloudSnow,     color: "text-blue-200" };
  if (code <= 82)            return { icon: CloudRain,     color: "text-blue-500" };
  if (code <= 86)            return { icon: CloudSnow,     color: "text-blue-200" };
  if (code <= 99)            return { icon: CloudLightning, color: "text-purple-500" };
  return { icon: Sun, color: "text-orange-400" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Returns { main, sub?, isPerPerson } from a cost item, splitting KRW／TWD pairs. */
function parseCostDisplay(item: ItineraryItem) {
  const c = item.cost;
  const raw = c.perPerson ?? c.total ?? c.legacy ?? "";
  if (!raw) return null;
  const [main, ...rest] = raw.split("／").map((s: string) => s.trim());
  return { main, sub: rest.join("／") || undefined, isPerPerson: !!c.perPerson };
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [tripData,       setTripData]       = useState<TripData | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [selectedDate,   setSelectedDate]   = useState<string | null>(null);
  const [weatherData,    setWeatherData]    = useState<WeatherPoint[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [selectedItem,   setSelectedItem]   = useState<ItineraryItem | null>(null);

  const { rates } = useExchangeRate(tripData?.currency ?? "KRW");

  useEffect(() => { loadItinerary(); }, []);

  async function loadItinerary(force = false) {
    setLoading(true); setError(null);
    try {
      if (!SHEET_URL) throw new Error("未設定 VITE_SHEET_URL 環境變數");
      const res = await fetch(SHEET_URL);
      if (!res.ok) throw new Error(`無法取得試算表 (${res.status})`);
      const csv  = await res.text();
      const hash = hashString(csv);

      if (!force) {
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            const { h, d } = JSON.parse(raw) as { h: string; d: TripData };
            if (h === hash && d?.items?.length) {
              setTripData(d); setSelectedDate(d.items[0].date);
              setLoading(false); return;
            }
          }
        } catch { /* ignore */ }
      }

      console.log("[trip-planner] CSV 前 300 字：\n", csv.slice(0, 300));
      const data = parseItineraryCSV(csv);
      console.log("[trip-planner] 解析結果：", { items: data.items.length, dayMeta: data.dayMeta });
      localStorage.setItem(CACHE_KEY, JSON.stringify({ h: hash, d: data }));
      setTripData(data);
      if (data.items.length) setSelectedDate(data.items[0].date);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "讀取失敗");
    } finally { setLoading(false); }
  }

  // dates
  const dates = useMemo(() => {
    if (!tripData) return [];
    return [...new Set(tripData.items.map(i => i.date))].filter(Boolean).sort();
  }, [tripData]);

  useEffect(() => {
    if (dates.length && !selectedDate) setSelectedDate(dates[0]);
  }, [dates, selectedDate]);

  // filtered items for selected day
  const filteredItems = useMemo(
    () => tripData && selectedDate ? tripData.items.filter(i => i.date === selectedDate) : [],
    [tripData, selectedDate]
  );

  // per-day metadata
  const todayMeta = useMemo(
    () => tripData?.dayMeta?.[selectedDate ?? ""] ?? {},
    [tripData, selectedDate]
  );

  // date display in header
  const dateInfo = useMemo(() => {
    const d = new Date((tripData?.dateRange ?? "").split(" to ")[0] + "T00:00:00");
    if (isNaN(d.getTime())) return { year: "—", month: "—" };
    return { year: d.getFullYear().toString(), month: `${d.getMonth() + 1}月` };
  }, [tripData]);

  // weather
  useEffect(() => {
    const lat = todayMeta.weatherLat ?? tripData?.weatherLat;
    const lon = todayMeta.weatherLon ?? tripData?.weatherLon;
    if (!lat || !lon || !selectedDate) { setWeatherData([]); return; }
    setWeatherLoading(true);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weather_code&timezone=auto`)
      .then(r => r.json())
      .then(data => {
        const pts: WeatherPoint[] = [];
        if (data.hourly?.time) {
          data.hourly.time.forEach((t: string, idx: number) => {
            if (!t.startsWith(selectedDate!)) return;
            const h = parseInt(t.substring(11, 13));
            if (h < 6 || h > 20 || h % 2 !== 0) return;
            const { icon, color } = wIcon(data.hourly.weather_code[idx]);
            pts.push({ time: t.substring(11, 16), temp: `${Math.round(data.hourly.temperature_2m[idx])}°`, icon, color });
          });
        }
        setWeatherData(pts);
      })
      .catch(() => setWeatherData([]))
      .finally(() => setWeatherLoading(false));
  }, [todayMeta.weatherLat, todayMeta.weatherLon, tripData?.weatherLat, tripData?.weatherLon, selectedDate]);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------
  if (loading && !tripData) {
    return (
      <div className="min-h-screen bg-[#FDFBF2] flex flex-col items-center justify-center p-6 space-y-4">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        <p className="text-gray-500 italic text-sm">正在讀取行程資料…</p>
      </div>
    );
  }

  if (error && !tripData) {
    return (
      <div className="min-h-screen bg-[#FDFBF2] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h2 className="text-2xl font-serif font-bold text-red-600">讀取失敗</h2>
        <p className="text-gray-500 max-w-sm text-sm">{error}</p>
        <button onClick={() => loadItinerary()}
          className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:scale-105 transition-transform text-sm">
          重試
        </button>
      </div>
    );
  }

  // actual hero source
  const heroImage =
    todayMeta.heroImage ||
    tripData?.heroImage ||
    `https://picsum.photos/seed/${encodeURIComponent(tripData?.title ?? "trip")}/800/400`;

  const weatherLink =
    todayMeta.weatherSite ??
    tripData?.weatherWebsite ??
    `https://weather.com/weather/today/l/${todayMeta.weatherLat ?? tripData?.weatherLat ?? 35},${todayMeta.weatherLon ?? tripData?.weatherLon ?? 139}`;

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FDFBF2] font-sans pb-24">
      {/* Header */}
      <header className="pt-12 pb-8 px-6 text-center space-y-4 max-w-2xl mx-auto">
        <div className="space-y-1">
          <p className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-bold">Family Trip</p>
          <h1 className="text-3xl font-serif font-black text-gray-900 tracking-tight">
            {tripData?.title ?? "旅遊行程"}
          </h1>
        </div>
        <div className="flex items-center justify-center space-x-4">
          <div className="flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-lg shadow-sm">
            <span className="text-xl font-bold font-serif">{dateInfo.year}</span>
            <span className="text-xs font-medium bg-white/20 px-1.5 py-0.5 rounded">{dateInfo.month}</span>
          </div>
          {(tripData?.travelers || tripData?.travelerCount) && (
            <div className="flex items-center space-x-1 text-gray-400 text-xs font-bold">
              <Users size={14} />
              <span>{tripData.travelers ?? `${tripData.travelerCount} 人`}</span>
            </div>
          )}
        </div>
      </header>

      {/* Date selector */}
      <div className="sticky top-0 z-10 bg-[#FDFBF2]/80 backdrop-blur-md border-b border-gray-100 mb-8">
        <div className="max-w-2xl mx-auto px-6 py-4 flex space-x-6 overflow-x-auto no-scrollbar">
          {dates.map(date => {
            const d = new Date(date + "T00:00:00");
            const selected = selectedDate === date;
            return (
              <button key={date} onClick={() => setSelectedDate(date)}
                className={cn("flex flex-col items-center min-w-[50px] space-y-1 transition-all",
                  selected ? "text-gray-900" : "text-gray-300 hover:text-gray-400")}>
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span className={cn("text-2xl font-serif font-bold relative",
                  selected && "after:content-[''] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-red-500 after:rounded-full")}>
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero image */}
      <div className="max-w-2xl mx-auto px-6 mb-10">
        <div className="relative h-48 rounded-3xl overflow-hidden shadow-xl group">
          <img src={heroImage} alt="hero"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-6 left-6 text-white space-y-1">
            <div className="flex items-center space-x-2 text-[10px] font-bold opacity-80">
              <Calendar size={12} /><span>{selectedDate}</span>
              {filteredItems[0]?.location && (
                <><span className="mx-1">•</span><MapPin size={12} /><span>{filteredItems[0].location}</span></>
              )}
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              {todayMeta.title ?? (filteredItems[0]?.location ? `抵達 ${filteredItems[0].location}` : "開始今日行程")}
            </h2>
          </div>
        </div>
      </div>

      {/* Day notes from info row */}
      {todayMeta.notes && Object.keys(todayMeta.notes).length > 0 && (
        <div className="max-w-2xl mx-auto px-6 mb-6">
          <div className="flex flex-wrap gap-2">
            {Object.entries(todayMeta.notes).map(([k, v]) => (
              <span key={k} className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
                {k}: {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weather strip */}
      <div className="max-w-2xl mx-auto px-6 mb-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-serif font-bold text-gray-900">
            {filteredItems[0]?.location ?? "目的地"} 天氣
          </h3>
          <a href={weatherLink} target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-bold text-blue-500 flex items-center space-x-1 hover:underline">
            <span>天氣預報</span><ChevronRight size={12} />
          </a>
        </div>
        <div className="flex justify-between items-center py-4 border-y border-gray-100 overflow-x-auto no-scrollbar min-h-[88px]">
          {weatherLoading ? (
            <div className="w-full flex justify-center"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
          ) : weatherData.length > 0 ? (
            weatherData.map((w, i) => (
              <div key={i} className="flex flex-col items-center space-y-2 min-w-[50px]">
                <span className="text-[10px] font-bold text-gray-300">{w.time}</span>
                <w.icon size={16} className={w.color} />
                <span className="text-sm font-medium text-gray-600">{w.temp}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-300 w-full text-center italic">尚無天氣資料（請在 CSV 加入天氣座標）</p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-2xl mx-auto px-6 space-y-6 relative">
        <div className="absolute left-[3.25rem] top-0 bottom-0 w-px bg-gray-100 hidden sm:block" />

        <AnimatePresence mode="popLayout">
          {filteredItems.map((item, idx) => {
            const Icon      = catIcon(item.category);
            const colorCls  = catColor(item.category);
            const cd        = parseCostDisplay(item);

            return (
              <motion.div
                key={`${item.date}-${item.time}-${idx}`}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }} transition={{ delay: idx * 0.04 }}
                className="flex items-start space-x-6 group"
              >
                {/* Time */}
                <div className="w-12 pt-1 text-right shrink-0">
                  <span className="text-xs font-bold text-gray-900 font-mono">{item.time}</span>
                  {item.endTime && (
                    <span className="block text-[9px] text-gray-300 font-mono">{item.endTime}</span>
                  )}
                </div>

                {/* Card */}
                <div className="flex-1 bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  {/* Tags row */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <div className={cn("flex items-center space-x-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider", colorCls)}>
                      <Icon size={11} /><span>{item.category}</span>
                    </div>
                    {/* Reservation tag for 食/餐廳/住宿 */}
                    {item.reservationStatus && (item.category === "食" || item.category === "餐廳" || item.category === "住宿" || item.category === "飲食") && (
                      <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold",
                        item.reservationStatus === "現場" ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700")}>
                        {item.reservationStatus}
                      </span>
                    )}
                    {/* Meals tag for 住宿 */}
                    {item.accommodationMeals && item.category === "住宿" && (
                      <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-md text-[10px] font-bold">
                        {item.accommodationMeals}
                      </span>
                    )}
                    {/* Bloom tag for 桜/紅葉 */}
                    {item.fullBloomDate && (
                      <span className="bg-pink-100 text-pink-600 px-2 py-0.5 rounded-md text-[10px] font-bold">
                        滿開 {item.fullBloomDate}
                      </span>
                    )}
                    {/* Flight tag */}
                    {item.flightNumber && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono">
                        {item.flightNumber}
                      </span>
                    )}
                  </div>

                  {/* Title + cost */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      {/* Flight: show origin → dest inline */}
                      {item.flightNumber && item.departureAirport && item.arrivalAirport ? (
                        <div className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                          <span>{item.departureAirport}</span>
                          <Plane size={12} className="text-blue-400 shrink-0" />
                          <span>{item.arrivalAirport}</span>
                        </div>
                      ) : (
                        <h4 className="text-base font-bold text-gray-900 leading-tight">{item.location}</h4>
                      )}
                      {item.category === "住宿" && item.roomInfo && (
                        <p className="text-xs text-orange-500 font-medium truncate">
                          {item.roomInfo.split("\n")[0].replace(/^[^：:]+[：:]\s*/, "").trim()
                            || item.roomInfo.split("\n")[0]}
                        </p>
                      )}
                      {item.originalName && !item.flightNumber && (
                        <p className="text-xs text-gray-400 truncate">{item.originalName}</p>
                      )}
                    </div>
                    {cd && (
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="text-sm font-bold text-gray-900 whitespace-nowrap">{cd.main}</div>
                        {cd.sub && <div className="text-[11px] text-gray-500 whitespace-nowrap">{cd.sub}</div>}
                        {cd.isPerPerson && <div className="text-[10px] text-gray-400">（每人）</div>}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {item.website && (
                        <a href={item.website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-[10px] font-bold text-gray-400 hover:text-blue-500 transition-colors">
                          <Globe size={11} /><span>官網</span>
                        </a>
                      )}
                      {item.googleMaps && (
                        <a href={item.googleMaps} target="_blank" rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors">
                          <MapIcon size={11} /><span>地圖</span>
                        </a>
                      )}
                    </div>
                    <button onClick={() => setSelectedItem(item)}
                      className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-all">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredItems.length === 0 && !loading && (
          <div className="text-center py-20 text-gray-300 italic text-sm">今日尚無安排行程</div>
        )}
      </div>

      {/* Detail dialog */}
      <DetailDialog
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        rates={rates}
        currency={tripData?.currency ?? "KRW"}
      />

      {/* FAB: refresh */}
      <button onClick={() => loadItinerary(true)} disabled={loading} title="重新載入行程"
        className={cn("fixed bottom-8 right-8 w-14 h-14 bg-gray-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-20",
          loading && "opacity-50 cursor-not-allowed")}>
        {loading ? <Loader2 className="animate-spin" size={22} /> : <RefreshCw size={22} />}
      </button>
    </div>
  );
}
