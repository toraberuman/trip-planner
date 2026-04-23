import React, { useState, useMemo, useEffect } from "react";
import {
  Plane, Hotel, MapPin, Utensils, Users,
  ChevronRight, CloudRain, Sun, Cloud, CloudFog,
  CloudDrizzle, CloudSnow, CloudLightning, Loader2,
  RefreshCw, Globe, Map as MapIcon, Car,
  ShoppingBag, Star, Flower2, Leaf, Camera, X,
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
const SHEET_URL = import.meta.env.VITE_SHEET_URL as string | undefined;
const CACHE_KEY = "trip_v2";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
type IconComp = React.ComponentType<{ size?: number; className?: string }>;

type CatMeta = {
  dot:  string;   // bg color class for timeline dot
  pill: string;   // bg+text classes for pill badge
};

const CAT_META: Record<string, CatMeta> = {
  交通: { dot: "bg-sky-400",      pill: "bg-sky-50 text-sky-700"        },
  住宿: { dot: "bg-amber-400",    pill: "bg-amber-50 text-amber-700"    },
  食:   { dot: "bg-rose-500",     pill: "bg-rose-50 text-rose-600"      },
  飲食: { dot: "bg-rose-500",     pill: "bg-rose-50 text-rose-600"      },
  餐廳: { dot: "bg-rose-500",     pill: "bg-rose-50 text-rose-600"      },
  景點: { dot: "bg-violet-500",   pill: "bg-violet-50 text-violet-700"  },
  買物: { dot: "bg-fuchsia-500",  pill: "bg-fuchsia-50 text-fuchsia-700"},
  體驗: { dot: "bg-teal-500",     pill: "bg-teal-50 text-teal-700"      },
  桜:   { dot: "bg-pink-400",     pill: "bg-pink-50 text-pink-600"      },
  紅葉: { dot: "bg-orange-500",   pill: "bg-orange-50 text-orange-700"  },
  機票: { dot: "bg-blue-600",     pill: "bg-blue-50 text-blue-700"      },
};
const DEFAULT_META: CatMeta = { dot: "bg-gray-400", pill: "bg-gray-50 text-gray-600" };

function getCatMeta(cat: string): CatMeta {
  return CAT_META[cat] ?? DEFAULT_META;
}

const CAT_ICON: Record<string, IconComp> = {
  交通: Car,  住宿: Hotel,
  食: Utensils, 飲食: Utensils, 餐廳: Utensils,
  景點: Camera, 買物: ShoppingBag, 體驗: Star,
  桜: Flower2,  紅葉: Leaf, 機票: Plane,
};

function catIcon(cat: string): IconComp {
  return CAT_ICON[cat] ?? MapPin;
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------
interface WeatherPoint { time: string; temp: string; icon: IconComp; color: string; }

function wIcon(code: number) {
  if (code === 0)                  return { icon: Sun,           color: "text-orange-400" };
  if (code <= 3)                   return { icon: Cloud,          color: "text-gray-400"   };
  if (code === 45 || code === 48)  return { icon: CloudFog,       color: "text-gray-400"   };
  if (code <= 57)                  return { icon: CloudDrizzle,   color: "text-blue-400"   };
  if (code <= 67)                  return { icon: CloudRain,      color: "text-blue-500"   };
  if (code <= 77)                  return { icon: CloudSnow,      color: "text-blue-200"   };
  if (code <= 82)                  return { icon: CloudRain,      color: "text-blue-500"   };
  if (code <= 86)                  return { icon: CloudSnow,      color: "text-blue-200"   };
  if (code <= 99)                  return { icon: CloudLightning, color: "text-purple-500" };
  return { icon: Sun, color: "text-orange-400" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseCostDisplay(item: ItineraryItem) {
  const c   = item.cost;
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
      const res  = await fetch(SHEET_URL);
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

  const dates = useMemo(() => {
    if (!tripData) return [];
    return [...new Set(tripData.items.map(i => i.date))].filter(Boolean).sort();
  }, [tripData]);

  useEffect(() => {
    if (dates.length && !selectedDate) setSelectedDate(dates[0]);
  }, [dates, selectedDate]);

  const filteredItems = useMemo(
    () => tripData && selectedDate ? tripData.items.filter(i => i.date === selectedDate) : [],
    [tripData, selectedDate]
  );

  const todayMeta = useMemo(
    () => tripData?.dayMeta?.[selectedDate ?? ""] ?? {},
    [tripData, selectedDate]
  );

  const dateRangeDisplay = useMemo(() => {
    if (!tripData?.dateRange) return "";
    const parts = tripData.dateRange.split(" to ");
    if (parts.length < 2) return tripData.dateRange;
    const fmt = (s: string) => {
      const d = new Date(s + "T00:00:00");
      return isNaN(d.getTime()) ? s : `${d.getMonth() + 1}/${d.getDate()}`;
    };
    return `${fmt(parts[0])} – ${fmt(parts[1])}`;
  }, [tripData]);

  // Weather fetch
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
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading && !tripData) {
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center mx-auto shadow-xl">
            <Plane className="text-white" size={22} />
          </div>
          <div className="space-y-1.5">
            <Loader2 className="w-5 h-5 text-gray-300 animate-spin mx-auto" />
            <p className="text-[13px] text-gray-400 font-medium">正在載入行程…</p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error && !tripData) {
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center px-6">
        <div className="text-center space-y-5 max-w-xs w-full">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
            <X className="text-red-400" size={22} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-gray-900">無法載入行程</h2>
            <p className="text-sm text-gray-400 leading-relaxed">{error}</p>
          </div>
          <button
            onClick={() => loadItinerary()}
            className="w-full py-3 bg-gray-900 text-white rounded-2xl font-semibold text-sm hover:bg-gray-800 active:scale-[0.98] transition-all"
          >
            重試
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------
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
    <div className="min-h-screen bg-[#F5F4F2]">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ height: "clamp(200px, 55vw, 280px)" }}>
        <img
          src={heroImage}
          alt="hero"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/5 to-black/75" />

        {/* Top row: trip title + refresh */}
        <div className="absolute top-0 inset-x-0 px-5 pt-10 flex justify-between items-start">
          <div className="max-w-[75%]">
            {(tripData?.travelers || tripData?.travelerCount) && (
              <div className="flex items-center gap-1.5 mb-1">
                <Users size={11} className="text-white/60" />
                <span className="text-[11px] text-white/60 font-semibold tracking-wide">
                  {tripData.travelers ?? `${tripData.travelerCount} 人`}
                </span>
              </div>
            )}
            <h1 className="text-white font-bold text-[1.3rem] leading-snug tracking-tight drop-shadow">
              {tripData?.title ?? "旅遊行程"}
            </h1>
            {dateRangeDisplay && (
              <p className="text-white/55 text-[11px] font-medium mt-0.5">{dateRangeDisplay}</p>
            )}
          </div>
          <button
            onClick={() => loadItinerary(true)}
            disabled={loading}
            className="mt-0.5 w-9 h-9 rounded-full bg-black/25 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/40 active:scale-95 transition-all disabled:opacity-40"
            title="重新載入"
          >
            {loading
              ? <Loader2 size={14} className="animate-spin" />
              : <RefreshCw size={14} />
            }
          </button>
        </div>

        {/* Bottom: day headline */}
        <div className="absolute bottom-0 inset-x-0 px-5 pb-5">
          {(todayMeta.title || filteredItems.length > 0) && (
            <h2 className="text-white text-[1.15rem] font-bold leading-snug drop-shadow">
              {todayMeta.title ?? filteredItems[0]?.location ?? "今日行程"}
            </h2>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-white/50 text-[11px] font-medium">
            {selectedDate && <span>{selectedDate}</span>}
            {filteredItems.length > 0 && (
              <><span>·</span><span>{filteredItems.length} 個行程</span></>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky date nav ── */}
      <div className="sticky top-0 z-20">
        <div className="bg-[#F5F4F2]/90 backdrop-blur-md border-b border-black/[0.06]">
          <div className="max-w-2xl mx-auto px-3 py-2 flex gap-0.5 overflow-x-auto no-scrollbar">
            {dates.map(date => {
              const d        = new Date(date + "T00:00:00");
              const selected = date === selectedDate;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "flex flex-col items-center shrink-0 min-w-[3rem] py-1.5 px-2 rounded-xl transition-all duration-200",
                    selected
                      ? "bg-gray-900 text-white shadow-sm scale-[1.02]"
                      : "text-gray-400 hover:text-gray-700 hover:bg-black/5 active:bg-black/10"
                  )}
                >
                  <span className="text-[8.5px] font-bold uppercase tracking-wider leading-none mb-[3px]">
                    {d.toLocaleDateString("zh-TW", { weekday: "narrow" })}
                  </span>
                  <span className="text-[1.05rem] font-bold tabular-nums leading-none">
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-3">

        {/* Day notes */}
        {todayMeta.notes && Object.keys(todayMeta.notes).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(todayMeta.notes).map(([k, v]) => (
              <span key={k}
                className="bg-amber-50 text-amber-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-amber-100">
                {k}: {v}
              </span>
            ))}
          </div>
        )}

        {/* Weather card */}
        {(weatherData.length > 0 || weatherLoading) && (
          <motion.div
            key="weather"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_4px_rgba(0,0,0,0.04)] px-4 py-3"
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">今日天氣</span>
              <a href={weatherLink} target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-semibold text-blue-500 hover:underline">
                詳細預報
              </a>
            </div>
            {weatherLoading
              ? <div className="flex justify-center py-2"><Loader2 size={16} className="text-gray-200 animate-spin" /></div>
              : (
                <div className="flex gap-0.5 overflow-x-auto no-scrollbar">
                  {weatherData.map((w, i) => (
                    <div key={i} className="flex flex-col items-center min-w-[40px] gap-0.5 py-0.5">
                      <span className="text-[9px] text-gray-300 tabular-nums font-medium">{w.time}</span>
                      <w.icon size={15} className={w.color} />
                      <span className="text-xs font-bold text-gray-700">{w.temp}</span>
                    </div>
                  ))}
                </div>
              )
            }
          </motion.div>
        )}

        {/* ── Timeline ── */}
        <div className="relative pt-1">
          {/* Vertical connector line */}
          {filteredItems.length > 1 && (
            <div className="absolute left-[3.1rem] top-6 bottom-6 w-px bg-gray-200/70 pointer-events-none" />
          )}

          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {filteredItems.map((item, idx) => {
                const meta = getCatMeta(item.category);
                const Icon = catIcon(item.category);
                const cd   = parseCostDisplay(item);

                return (
                  <motion.div
                    key={`${item.date}-${item.time}-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ delay: idx * 0.035, duration: 0.22 }}
                    className="flex items-start gap-3"
                  >
                    {/* Time column */}
                    <div className="w-11 shrink-0 text-right pt-[15px]">
                      <span className="text-[11px] font-semibold text-gray-400 tabular-nums leading-none">
                        {item.time || "—"}
                      </span>
                      {item.endTime && (
                        <span className="block text-[9px] text-gray-300 tabular-nums mt-[3px] leading-none">
                          {item.endTime}
                        </span>
                      )}
                    </div>

                    {/* Category dot */}
                    <div className="shrink-0 flex justify-center w-5 pt-[18px]">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full ring-[2.5px] ring-[#F5F4F2] shadow-sm",
                        meta.dot
                      )} />
                    </div>

                    {/* Card */}
                    <div
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === "Enter" && setSelectedItem(item)}
                      className="flex-1 min-w-0 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.09)] active:scale-[0.99] transition-all duration-200 cursor-pointer overflow-hidden"
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="px-4 pt-3.5 pb-3">
                        {/* Badge row */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-full",
                            meta.pill
                          )}>
                            <Icon size={9.5} /><span>{item.category}</span>
                          </span>
                          {item.flightNumber && (
                            <span className="text-[10px] font-bold px-2 py-[3px] rounded-full bg-blue-50 text-blue-700 font-mono tracking-wide">
                              {item.flightNumber}
                            </span>
                          )}
                          {item.reservationStatus && (
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-[3px] rounded-full",
                              item.reservationStatus === "現場"
                                ? "bg-gray-100 text-gray-500"
                                : "bg-emerald-50 text-emerald-700"
                            )}>
                              {item.reservationStatus}
                            </span>
                          )}
                          {item.accommodationMeals && item.category === "住宿" && (
                            <span className="text-[10px] font-bold px-2 py-[3px] rounded-full bg-amber-50 text-amber-700">
                              {item.accommodationMeals}
                            </span>
                          )}
                          {item.fullBloomDate && (
                            <span className="text-[10px] font-bold px-2 py-[3px] rounded-full bg-pink-50 text-pink-600">
                              滿開 {item.fullBloomDate}
                            </span>
                          )}
                        </div>

                        {/* Title + cost row */}
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0 flex-1">
                            {item.flightNumber && item.departureAirport && item.arrivalAirport ? (
                              <div className="flex items-center gap-2 text-[15px] font-bold text-gray-900 leading-snug">
                                <span>{item.departureAirport}</span>
                                <Plane size={13} className="text-gray-300 shrink-0" />
                                <span>{item.arrivalAirport}</span>
                              </div>
                            ) : (
                              <p className="text-[15px] font-semibold text-gray-900 leading-snug">
                                {item.location}
                              </p>
                            )}
                            {item.category === "住宿" && item.roomInfo && (
                              <p className="text-xs text-amber-600 mt-0.5 truncate font-medium">
                                {item.roomInfo.split("\n")[0].replace(/^[^：:]+[：:]\s*/, "").trim()
                                  || item.roomInfo.split("\n")[0]}
                              </p>
                            )}
                            {item.originalName && !item.flightNumber && (
                              <p className="text-xs text-gray-400 mt-[3px] truncate">
                                {item.originalName}
                              </p>
                            )}
                          </div>
                          {cd && (
                            <div className="shrink-0 text-right space-y-[2px]">
                              <p className="text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap">{cd.main}</p>
                              {cd.sub && <p className="text-[10px] text-gray-400 tabular-nums whitespace-nowrap">{cd.sub}</p>}
                              {cd.isPerPerson && <p className="text-[9px] text-gray-300">每人</p>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card footer */}
                      {(item.website || item.googleMaps) && (
                        <div className="border-t border-black/[0.04] px-4 py-2 flex items-center gap-4">
                          {item.website && (
                            <a
                              href={item.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 hover:text-blue-500 transition-colors"
                            >
                              <Globe size={10} /><span>官網</span>
                            </a>
                          )}
                          {item.googleMaps && (
                            <a
                              href={item.googleMaps}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <MapIcon size={10} /><span>地圖</span>
                            </a>
                          )}
                          <ChevronRight size={11} className="ml-auto text-gray-200" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>

          {filteredItems.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <p className="text-sm text-gray-300 font-medium">今日尚無安排行程</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Detail dialog */}
      <DetailDialog
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        rates={rates}
        currency={tripData?.currency ?? "KRW"}
      />
    </div>
  );
}
