export interface DashboardKPI {
  id: string;
  title: string;
  val: string;
  delta: string;
  deltaPositive: boolean;
  meta: string;
  href: string;
  linkText: string;
  info: string;
}

export const DASHBOARD_KPIS: DashboardKPI[] = [
  {
    id: "active",
    title: "Active sales",
    val: "$18,420",
    delta: "+8%",
    deltaPositive: true,
    meta: "14 orders in transit",
    href: "/orders",
    linkText: "See orders",
    info: "Value of orders placed but not yet delivered.",
  },
  {
    id: "revenue",
    title: "Revenue",
    val: "$142,860",
    delta: "+14%",
    deltaPositive: true,
    meta: "vs $125.4K last month",
    href: "/analytics",
    linkText: "See analytics",
    info: "Revenue this month across the channels shown.",
  },
  {
    id: "units",
    title: "Units sold",
    val: "1,284",
    delta: "+9%",
    deltaPositive: true,
    meta: "86% of monthly target",
    href: "/products",
    linkText: "See products",
    info: "Items sold this month against the monthly target.",
  },
  {
    id: "conv",
    title: "Conversion rate",
    val: "3.42%",
    delta: "+0.4%",
    deltaPositive: true,
    meta: "Online + in-store checkout",
    href: "/analytics",
    linkText: "See funnel",
    info: "Share of visits that end in an order.",
  },
];

export const MONTHLY_REVENUE = [
  { month: "Jan", val: 84000, max: 160000, isForecast: false },
  { month: "Feb", val: 92000, max: 160000, isForecast: false },
  { month: "Mar", val: 110000, max: 160000, isForecast: false },
  { month: "Apr", val: 98000, max: 160000, isForecast: false },
  { month: "May", val: 124000, max: 160000, isForecast: false },
  { month: "Jun", val: 118000, max: 160000, isForecast: false },
  { month: "Jul", val: 132000, max: 160000, isForecast: false },
  { month: "Aug", val: 128000, max: 160000, isForecast: false },
  { month: "Sep", val: 136000, max: 160000, isForecast: false },
  { month: "Oct", val: 142860, max: 160000, isForecast: false, isCurrent: true },
  { month: "Nov", val: 154000, max: 160000, isForecast: true },
  { month: "Dec", val: 168000, max: 160000, isForecast: true },
];

export const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HEATMAP_PERIODS = ["12–8a", "8a–12p", "12–4p", "4p–12a"];

// Heat levels 0-4
export const HEATMAP_GRID: number[][] = [
  [0, 1, 1, 0, 1, 2, 2], // 12-8a
  [2, 3, 3, 2, 3, 4, 3], // 8a-12p
  [3, 4, 4, 3, 4, 4, 4], // 12-4p
  [2, 3, 3, 4, 4, 3, 2], // 4p-12a
];

export const DEVICE_VISITS = [
  { label: "Mobile", pct: 58, count: "27.9K", color: "var(--c1)" },
  { label: "Desktop", pct: 34, count: "16.4K", color: "var(--c2)" },
  { label: "Tablet", pct: 8, count: "3.9K", color: "var(--c4)" },
];
