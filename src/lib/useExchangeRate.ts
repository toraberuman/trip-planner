import { useState, useEffect } from "react";

const TTL = 60 * 60 * 1000; // 1 hour
const PREFIX = "er_v1_";

export function useExchangeRate(baseCurrency: string) {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!baseCurrency) return;
    const key = PREFIX + baseCurrency;

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const { ts, r } = JSON.parse(raw) as { ts: number; r: Record<string, number> };
        if (Date.now() - ts < TTL) {
          setRates(r);
          setUpdatedAt(new Date(ts).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }));
          return;
        }
      }
    } catch { /* ignore */ }

    setLoading(true);
    fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`)
      .then(r => r.json())
      .then(data => {
        if (data.rates) {
          localStorage.setItem(key, JSON.stringify({ ts: Date.now(), r: data.rates }));
          setRates(data.rates);
          setUpdatedAt(new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [baseCurrency]);

  return { rates, loading, updatedAt };
}

// ---------------------------------------------------------------------------
// Helpers used by components
// ---------------------------------------------------------------------------

/** Parse numeric value + ISO currency code from a display string like "₩80,000" or "$2,000" */
export function parseAmount(str: string): { value: number; currency: string } | null {
  if (!str) return null;
  const krw = str.match(/₩\s*([\d,]+)/);
  if (krw) return { value: parseInt(krw[1].replace(/,/g, "")), currency: "KRW" };
  const jpy = str.match(/[¥￥]\s*([\d,]+)/);
  if (jpy) return { value: parseInt(jpy[1].replace(/,/g, "")), currency: "JPY" };
  // "$" in this context = TWD (NTD)
  const twd = str.match(/\$\s*([\d,]+)/);
  if (twd) return { value: parseInt(twd[1].replace(/,/g, "")), currency: "TWD" };
  return null;
}

/** Given parsed amount + rates (base = tripCurrency), return "≈ NT$X" or null */
export function toTWD(
  parsed: { value: number; currency: string } | null,
  rates: Record<string, number>,
  baseCurrency: string
): string | null {
  if (!parsed || !rates["TWD"]) return null;
  if (parsed.currency === "TWD") return null; // already TWD
  if (parsed.currency !== baseCurrency) return null; // different base, skip
  const twd = Math.round(parsed.value * rates["TWD"]);
  return `≈ NT$${twd.toLocaleString()}`;
}
