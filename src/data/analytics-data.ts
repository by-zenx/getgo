import { createInitialProducts } from "@/data/products-data";

export type AnalyticsRange = "7D" | "30D" | "90D" | "12M";
export type AnalyticsScope = "all" | "online" | "store";
export interface AnalyticsPoint {
  date: number;
  label: string;
  long: string;
  online: number;
  store: number;
  onlineOrders: number;
  storeOrders: number;
  onlineVisits: number;
  storeVisits: number;
}

export const ANALYTICS_RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "7D", label: "7D" }, { value: "30D", label: "30D" },
  { value: "90D", label: "90D" }, { value: "12M", label: "12M" },
];
export const TRAFFIC_SOURCES = ["Direct", "Search", "Social", "Email", "Referral"];
export const ANALYTICS_NOW = Date.UTC(2026, 9, 26, 12);
const DAY = 24 * 60 * 60 * 1000;

function random(seed: number) {
  let value = seed | 0;
  value = value + 0x6d2b79f5 | 0;
  let t = Math.imul(value ^ value >>> 15, 1 | value);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function utcDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(date);
}
function channelValue(channel: "online" | "store", date: Date, index: number, previous: boolean) {
  const dayIndex = Math.floor(date.getTime() / DAY);
  const weekday = date.getUTCDay();
  const seasonal = 1 + 0.08 * Math.sin((date.getUTCMonth() + 2) / 12 * Math.PI * 2);
  const week = channel === "online"
    ? [0.9, 0.96, 0.98, 1.02, 1.08, 1.15, 0.91][weekday]
    : [0.74, 0.68, 0.73, 0.79, 0.91, 1.34, 1.49][weekday];
  const trend = previous ? 0.91 : 1;
  const variance = 0.84 + random(dayIndex * 13 + (channel === "online" ? 3 : 17) + index * 31) * 0.32;
  const perDay = channel === "online" ? 3380 : 1520;
  return Math.round(perDay * seasonal * week * trend * variance);
}
function buildPoint(date: Date, label: string, long: string, index: number, previous: boolean): AnalyticsPoint {
  const online = channelValue("online", date, index, previous);
  const store = channelValue("store", date, index, previous);
  const onlineOrders = online / (82 * (0.94 + 0.12 * random(index * 17 + 4)));
  const storeOrders = store / (61 * (0.94 + 0.12 * random(index * 17 + 9)));
  return {
    date: date.getTime(), label, long, online, store,
    onlineOrders, storeOrders,
    onlineVisits: onlineOrders / (0.034 * (0.92 + 0.16 * random(index * 19 + 12))),
    storeVisits: storeOrders / (0.074 * (0.92 + 0.16 * random(index * 19 + 20))),
  };
}

export function createAnalyticsSeries(range: AnalyticsRange, previous = false): AnalyticsPoint[] {
  const count = range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 12;
  if (range === "12M") {
    const now = new Date(ANALYTICS_NOW);
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index - (previous ? 12 : 0), 15, 12));
      const monthSeason = [0.82, 0.86, 0.95, 0.91, 0.98, 0.96, 1.02, 1, 1.05, 1.1, 1.2, 1.32][date.getUTCMonth()];
      const baseline = 110000 * monthSeason * (previous ? 0.91 : 1);
      const online = baseline * 0.69 * (0.94 + random(date.getUTCMonth() * 29 + date.getUTCFullYear()) * 0.12);
      const store = baseline * 0.31 * (0.94 + random(date.getUTCMonth() * 37 + date.getUTCFullYear()) * 0.12);
      const point = buildPoint(date, utcDate(date, { month: "short" }), utcDate(date, { month: "short", year: "numeric" }), index, previous);
      return { ...point, online, store, onlineOrders: online / 82, storeOrders: store / 61, onlineVisits: online / 82 / 0.034, storeVisits: store / 61 / 0.074 };
    });
  }
  const now = new Date(ANALYTICS_NOW);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - count + index + (previous ? -count : 0), 12));
    const long = utcDate(date, { weekday: "short", month: "short", day: "numeric" });
    const label = range === "7D" ? utcDate(date, { weekday: "short" }) : utcDate(date, { month: "short", day: "numeric" });
    const point = buildPoint(date, label, long, index + (previous ? count : 0), previous);
    return range === "7D" ? { ...point, online: point.online * 1.12, store: point.store * 1.12, onlineOrders: point.onlineOrders * 1.12, storeOrders: point.storeOrders * 1.12 } : point;
  });
}

export function aggregateAnalytics(points: AnalyticsPoint[], scope: AnalyticsScope) {
  const channels = scope === "all" ? ["online", "store"] as const : [scope] as const;
  const revenue = points.reduce((total, point) => total + channels.reduce((sum, channel) => sum + point[channel], 0), 0);
  const orders = points.reduce((total, point) => total + channels.reduce((sum, channel) => sum + point[channel === "online" ? "onlineOrders" : "storeOrders"], 0), 0);
  const visits = points.reduce((total, point) => total + channels.reduce((sum, channel) => sum + point[channel === "online" ? "onlineVisits" : "storeVisits"], 0), 0);
  const returning = orders * (scope === "store" ? 0.49 : scope === "online" ? 0.31 : 0.36);
  return { revenue, orders, visits, returning, aov: revenue / Math.max(1, orders), conv: orders / Math.max(1, visits), ret: returning / Math.max(1, orders) };
}

export function analyticsProducts(revenue: number, scope: AnalyticsScope) {
  const products = createInitialProducts().filter((product) => product.status === "active");
  const weighted = products.map((product, index) => {
    const categoryWeight: Record<string, number> = { Software: 0.76, Services: 0.58, Support: 0.7, Training: 0.62, Hardware: 0.44 };
    const onlineWeight = categoryWeight[product.category] ?? 0.6;
    const channelWeight = scope === "online" ? onlineWeight : scope === "store" ? 1 - onlineWeight : 1;
    return { product, weight: product.sold30 * product.price * channelWeight * (0.78 + 0.44 * random(index * 31 + 7)) };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;
  return weighted.map(({ product, weight }) => {
    const productRevenue = Math.round(revenue * 0.72 * weight / total / product.price) * product.price;
    return { product, revenue: productRevenue, units: Math.max(1, Math.round(productRevenue / product.price)) };
  }).sort((a, b) => b.revenue - a.revenue);
}
