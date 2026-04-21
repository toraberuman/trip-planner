import React, { useState, useMemo, useEffect } from "react";
import {
  Plane,
  Hotel,
  MapPin,
  Utensils,
  ExternalLink,
  Calendar,
  Users,
  ChevronRight,
  CloudRain,
  Sun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudSnow,
  CloudLightning,
  Loader2,
  RefreshCw,
  Map as MapIcon,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { TripData, ItineraryItem } from "./types";
import { parseItineraryCSV, hashString } from "./lib/csvParser";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

// ---------------------------------------------------------------------------
// Config — set VITE_SHEET_URL in Cloudflare Pages environment variables
// ---------------------------------------------------------------------------
const SHEET_URL = import.meta.env.VITE_SHEET_URL as string | undefined;
const CACHE_KEY = "trip_v1";

// ---------------------------------------------------------------------------
// Category map
// ---------------------------------------------------------------------------
const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  交通: Plane,
  住宿: Hotel,
  活動: MapPin,
  飲食: Utensils,
};

const CATEGORY_COLORS: Record<string, string> = {
  交通: "bg-blue-50 text-blue-600 border-blue-200",
  住宿: "bg-orange-50 text-orange-600 border-orange-200",
  活動: "bg-purple-50 text-purple-600 border-purple-200",
  飲食: "bg-red-50 text-red-600 border-red-200",
};

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------
interface WeatherPoint {
  time: string;
  temp: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}

function weatherIcon(code: number) {
  if (code === 0) return { icon: Sun, color: "text-orange-400" };
  if (code <= 3) return { icon: Cloud, color: "text-gray-400" };
  if (code === 45 || code === 48) return { icon: CloudFog, color: "text-gray-400" };
  if (code <= 57) return { icon: CloudDrizzle, color: "text-blue-400" };
  if (code <= 67) return { icon: CloudRain, color: "text-blue-500" };
  if (code <= 77) return { icon: CloudSnow, color: "text-blue-200" };
  if (code <= 82) return { icon: CloudRain, color: "text-blue-500" };
  if (code <= 86) return { icon: CloudSnow, color: "text-blue-200" };
  if (code <= 99) return { icon: CloudLightning, color: "text-purple-500" };
  return { icon: Sun, color: "text-orange-400" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const parseRoomDetails = (text: string) =>
  text
    .split("\n")
    .map((line) => {
      const m = line.match(/^(.*?)[：:](.*)$/);
      return m ? { label: m[1].trim(), value: m[2].trim() } : { label: "", value: line.trim() };
    })
    .filter((r) => r.label || r.value);

const Linkify = ({ text }: { text: string }) => {
  const urlRe = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRe);
  return (
    <>
      {parts.map((p, i) =>
        p.match(urlRe) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherPoint[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null);

  useEffect(() => { loadItinerary(); }, []);

  async function loadItinerary(force = false) {
    setLoading(true);
    setError(null);
    try {
      if (!SHEET_URL) throw new Error("未設定 VITE_SHEET_URL 環境變數");

      const res = await fetch(SHEET_URL);
      if (!res.ok) throw new Error(`無法取得試算表 (${res.status})`);
      const csv = await res.text();
      const hash = hashString(csv);

      if (!force) {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const { h, d } = JSON.parse(cached) as { h: string; d: TripData };
            if (h === hash && d?.items?.length) {
              setTripData(d);
              setSelectedDate(d.items[0].date);
              setLoading(false);
              return;
            }
          }
        } catch { /* ignore bad cache */ }
      }

      console.log("[trip-planner] CSV 前 300 字：\n", csv.slice(0, 300));
      const data = parseItineraryCSV(csv);
      console.log("[trip-planner] 解析結果：", data);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ h: hash, d: data }));
      setTripData(data);
      if (data.items.length) setSelectedDate(data.items[0].date);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }

  const dates = useMemo(() => {
    if (!tripData) return [];
    return [...new Set(tripData.items.map((i) => i.date))].filter(Boolean).sort();
  }, [tripData]);

  useEffect(() => {
    if (dates.length && !selectedDate) setSelectedDate(dates[0]);
  }, [dates, selectedDate]);

  const filteredItems = useMemo(
    () => (tripData && selectedDate ? tripData.items.filter((i) => i.date === selectedDate) : []),
    [tripData, selectedDate]
  );

  const dateInfo = useMemo(() => {
    const d = new Date((tripData?.dateRange ?? "").split(" to ")[0] + "T00:00:00");
    if (isNaN(d.getTime())) return { year: "—", month: "—" };
    return { year: d.getFullYear().toString(), month: `${d.getMonth() + 1}月` };
  }, [tripData]);

  // weather fetch
  useEffect(() => {
    if (!tripData?.weatherLat || !tripData?.weatherLon || !selectedDate) {
      setWeatherData([]);
      return;
    }
    setWeatherLoading(true);
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${tripData.weatherLat}&longitude=${tripData.weatherLon}&hourly=temperature_2m,weather_code&timezone=auto`
    )
      .then((r) => r.json())
      .then((data) => {
        const points: WeatherPoint[] = [];
        if (data.hourly?.time) {
          data.hourly.time.forEach((t: string, idx: number) => {
            if (!t.startsWith(selectedDate!)) return;
            const hour = parseInt(t.substring(11, 13));
            if (hour < 6 || hour > 20 || hour % 2 !== 0) return;
            const { icon, color } = weatherIcon(data.hourly.weather_code[idx]);
            points.push({
              time: t.substring(11, 16),
              temp: `${Math.round(data.hourly.temperature_2m[idx])}°`,
              icon,
              color,
            });
          });
        }
        setWeatherData(points);
      })
      .catch(() => setWeatherData([]))
      .finally(() => setWeatherLoading(false));
  }, [tripData?.weatherLat, tripData?.weatherLon, selectedDate]);

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
        <button
          onClick={() => loadItinerary()}
          className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:scale-105 transition-transform text-sm"
        >
          重試
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main UI
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
          {tripData?.travelers && (
            <div className="flex items-center space-x-1 text-gray-400 text-xs font-bold">
              <Users size={14} />
              <span>{tripData.travelers}</span>
            </div>
          )}
        </div>
      </header>

      {/* Date Selector */}
      <div className="sticky top-0 z-10 bg-[#FDFBF2]/80 backdrop-blur-md border-b border-gray-100 mb-8">
        <div className="max-w-2xl mx-auto px-6 py-4 flex space-x-6 overflow-x-auto no-scrollbar">
          {dates.map((date) => {
            const d = new Date(date + "T00:00:00");
            const selected = selectedDate === date;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "flex flex-col items-center min-w-[50px] space-y-1 transition-all",
                  selected ? "text-gray-900" : "text-gray-300 hover:text-gray-400"
                )}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span
                  className={cn(
                    "text-2xl font-serif font-bold relative",
                    selected &&
                      "after:content-[''] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-red-500 after:rounded-full"
                  )}
                >
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero image */}
      <div className="max-w-2xl mx-auto px-6 mb-12">
        <div className="relative h-48 rounded-3xl overflow-hidden shadow-xl group">
          <img
            src={
              filteredItems[0]?.heroImage ||
              tripData?.heroImage ||
              `https://picsum.photos/seed/${encodeURIComponent(tripData?.title ?? "trip")}/800/400`
            }
            alt="hero"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-6 left-6 text-white space-y-1">
            <div className="flex items-center space-x-2 text-[10px] font-bold opacity-80">
              <Calendar size={12} />
              <span>{selectedDate}</span>
              {filteredItems[0]?.location && (
                <>
                  <span className="mx-1">•</span>
                  <MapPin size={12} />
                  <span>{filteredItems[0].location}</span>
                </>
              )}
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              {filteredItems[0]?.location ? `抵達 ${filteredItems[0].location}` : "開始今日行程"}
            </h2>
          </div>
        </div>
      </div>

      {/* Weather strip */}
      <div className="max-w-2xl mx-auto px-6 mb-12">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif font-bold text-gray-900">
            {filteredItems[0]?.location ?? "目的地"} 天氣
          </h3>
          <a
            href={
              tripData?.weatherWebsite ??
              `https://weather.com/weather/today/l/${tripData?.weatherLat ?? 35},${tripData?.weatherLon ?? 139}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-blue-500 flex items-center space-x-1 hover:underline"
          >
            <span>天氣預報</span>
            <ChevronRight size={12} />
          </a>
        </div>
        <div className="flex justify-between items-center py-4 border-y border-gray-100 overflow-x-auto no-scrollbar min-h-[88px]">
          {weatherLoading ? (
            <div className="w-full flex justify-center">
              <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
            </div>
          ) : weatherData.length > 0 ? (
            weatherData.map((w, i) => (
              <div key={i} className="flex flex-col items-center space-y-2 min-w-[50px]">
                <span className="text-[10px] font-bold text-gray-300">{w.time}</span>
                <w.icon size={16} className={w.color} />
                <span className="text-sm font-medium text-gray-600">{w.temp}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-300 w-full text-center italic">尚無天氣資料</p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-2xl mx-auto px-6 space-y-8 relative">
        <div className="absolute left-[3.25rem] top-0 bottom-0 w-px bg-gray-100 hidden sm:block" />

        <AnimatePresence mode="popLayout">
          {filteredItems.map((item, idx) => {
            const Icon = CATEGORY_ICONS[item.category] ?? MapPin;
            const colorClass = CATEGORY_COLORS[item.category] ?? "bg-gray-50 text-gray-600 border-gray-200";

            return (
              <motion.div
                key={`${item.date}-${item.time}-${idx}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-start space-x-6 group"
              >
                <div className="w-12 pt-1 text-right shrink-0">
                  <span className="text-xs font-bold text-gray-900 font-mono">{item.time}</span>
                </div>

                <div className="flex-1 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <div className={cn("flex items-center space-x-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider", colorClass)}>
                      <Icon size={12} />
                      <span>{item.category}</span>
                    </div>
                    {item.accommodationMeals && (
                      <div className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-md text-[10px] font-bold">
                        {item.accommodationMeals}
                      </div>
                    )}
                  </div>

                  {/* Title + cost */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-lg font-bold text-gray-900 leading-tight">{item.location}</h4>
                      {item.category === "住宿" && item.roomType && (
                        <p className="text-sm text-orange-600 font-medium whitespace-pre-line line-clamp-2">
                          {item.roomType}
                        </p>
                      )}
                      {item.description && (
                        <p className="text-xs text-gray-400 font-medium">{item.description}</p>
                      )}
                    </div>
                    {item.cost && (
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-gray-900">{item.cost}</div>
                        <div className="text-[10px] text-gray-300 font-bold uppercase">(每人)</div>
                      </div>
                    )}
                  </div>

                  {/* Footer links */}
                  <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {item.website && (
                        <a href={item.website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-[10px] font-bold text-gray-400 hover:text-blue-500 transition-colors">
                          <Globe size={12} /><span>官方網站</span>
                        </a>
                      )}
                      {item.googleMaps && (
                        <a href={item.googleMaps} target="_blank" rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors">
                          <MapIcon size={12} /><span>Google Maps</span>
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-all"
                    >
                      <ChevronRight size={16} />
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

      {/* Detail Dialog */}
      <Dialog.Root open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 bg-white p-6 shadow-lg sm:rounded-3xl max-h-[85vh] overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <Dialog.Title className="text-lg font-semibold">{selectedItem?.category} 詳細資訊</Dialog.Title>
            <Dialog.Description className="text-sm text-gray-900 font-medium mt-1">{selectedItem?.location}</Dialog.Description>
            {selectedItem?.originalName && (
              <p className="text-xs text-gray-500 mt-1">{selectedItem.originalName}</p>
            )}

            <div className="py-4 space-y-4">
              {selectedItem?.address && (
                <div className="flex items-start space-x-3">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200 whitespace-nowrap">地址</span>
                  <span className="text-sm text-gray-700 pt-0.5">
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedItem.address)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-blue-500 hover:underline inline-flex items-center">
                      {selectedItem.address}<ExternalLink size={12} className="ml-1 shrink-0" />
                    </a>
                  </span>
                </div>
              )}
              {selectedItem?.phone && (
                <div className="flex items-start space-x-3">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200 whitespace-nowrap">電話</span>
                  <span className="text-sm text-gray-700 pt-0.5"><Linkify text={selectedItem.phone} /></span>
                </div>
              )}
              {selectedItem?.roomType && (
                <div className="space-y-3">
                  {parseRoomDetails(selectedItem.roomType).map((detail, i) => (
                    <div key={i} className="flex items-start space-x-3">
                      {detail.label ? (
                        <>
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap">{detail.label}</span>
                          <span className="text-sm text-gray-700 pt-0.5"><Linkify text={detail.value} /></span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-700"><Linkify text={detail.value} /></span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {selectedItem?.accommodationMeals && (
                <div className="flex items-start space-x-3">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap">餐食</span>
                  <span className="text-sm text-gray-700 pt-0.5"><Linkify text={selectedItem.accommodationMeals} /></span>
                </div>
              )}
              {selectedItem?.description && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-gray-900">備註</h4>
                  <p className="text-sm text-gray-500 whitespace-pre-line"><Linkify text={selectedItem.description} /></p>
                </div>
              )}
              {selectedItem?.address && (
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">地圖預覽</h4>
                  <div className="h-48 rounded-xl overflow-hidden border border-gray-200">
                    <iframe
                      width="100%" height="100%"
                      style={{ border: 0 }} loading="lazy" allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedItem.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    />
                  </div>
                </div>
              )}
            </div>

            <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity">
              <X className="h-4 w-4" />
              <span className="sr-only">關閉</span>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* FAB: refresh */}
      <button
        onClick={() => loadItinerary(true)}
        disabled={loading}
        title="重新載入行程"
        className={cn(
          "fixed bottom-8 right-8 w-14 h-14 bg-gray-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-20",
          loading && "opacity-50 cursor-not-allowed"
        )}
      >
        {loading ? <Loader2 className="animate-spin" size={22} /> : <RefreshCw size={22} />}
      </button>
    </div>
  );
}
