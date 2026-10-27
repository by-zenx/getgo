import { createInitialOrders, ORDER_CUSTOMERS, type OrderRecord } from "@/data/orders-data";

export type CustomerTagKey = "vip" | "wholesale" | "new" | "subscriber";
export type CustomerChannel = "online" | "store";

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  channel: CustomerChannel;
  joined: number;
  tags: CustomerTagKey[];
  hue: number;
  note: string;
}

export const CUSTOMER_STORAGE_KEY = "corbel:customers";
export const CUSTOMER_TAGS: { key: CustomerTagKey; label: string; tone: string }[] = [
  { key: "vip", label: "VIP", tone: "sea" },
  { key: "wholesale", label: "Wholesale", tone: "amber" },
  { key: "new", label: "New", tone: "mint" },
  { key: "subscriber", label: "Subscriber", tone: "blue" },
];
export const CUSTOMER_SEGMENTS: { key: "all" | CustomerTagKey; label: string; title: string }[] = [
  { key: "all", label: "All", title: "All customers" },
  { key: "vip", label: "VIP", title: "VIP customers" },
  { key: "wholesale", label: "Wholesale", title: "Wholesale accounts" },
  { key: "new", label: "New", title: "New customers" },
  { key: "subscriber", label: "Subscribers", title: "Newsletter subscribers" },
];

const NOW = Date.UTC(2026, 9, 26, 12);
const DAY = 24 * 60 * 60 * 1000;
const SEEDS: Omit<CustomerRecord, "email" | "phone">[] = [
  { id: "c1", name: "Elena Marsh", city: "Portland, OR", tags: ["vip", "subscriber"], hue: 330, channel: "online", joined: NOW - 640 * DAY, note: "Prefers recycled packaging. Gifts often; offer a gift note." },
  { id: "c2", name: "Theo Lindqvist", city: "Seattle, WA", tags: ["subscriber"], hue: 200, channel: "online", joined: NOW - 410 * DAY, note: "" },
  { id: "c3", name: "Amara Okoye", city: "Austin, TX", tags: ["vip"], hue: 25, channel: "store", joined: NOW - 980 * DAY, note: "Interior designer; buys for client projects." },
  { id: "c4", name: "Wren & Field Cafe", city: "Denver, CO", tags: ["wholesale"], hue: 150, channel: "online", joined: NOW - 520 * DAY, note: "Net-30 terms. Mugs and carafes for two cafes." },
  { id: "c5", name: "Sofia Bianchi", city: "Brooklyn, NY", tags: ["new"], hue: 181, channel: "online", joined: NOW - 9 * DAY, note: "" },
  { id: "c6", name: "Marcus Hale", city: "Chicago, IL", tags: ["subscriber"], hue: 215, channel: "store", joined: NOW - 300 * DAY, note: "" },
  { id: "c7", name: "Hana Sato", city: "San Diego, CA", tags: ["vip", "subscriber"], hue: 350, channel: "online", joined: NOW - 760 * DAY, note: "" },
  { id: "c8", name: "Oliver Grant", city: "Boston, MA", tags: [], hue: 45, channel: "store", joined: NOW - 150 * DAY, note: "" },
  { id: "c9", name: "Ines Duarte", city: "Miami, FL", tags: ["new", "subscriber"], hue: 10, channel: "online", joined: NOW - 4 * DAY, note: "" },
  { id: "c10", name: "Kofi Mensah", city: "Atlanta, GA", tags: ["subscriber"], hue: 170, channel: "online", joined: NOW - 220 * DAY, note: "" },
  { id: "c11", name: "Greta Novak", city: "Minneapolis, MN", tags: [], hue: 209, channel: "store", joined: NOW - 390 * DAY, note: "" },
  { id: "c12", name: "The Linen Room", city: "Charleston, SC", tags: ["wholesale", "vip"], hue: 209, channel: "online", joined: NOW - 860 * DAY, note: "Boutique stockist. Reorders towels every six weeks." },
  { id: "c13", name: "Ravi Kapoor", city: "Phoenix, AZ", tags: ["new"], hue: 60, channel: "online", joined: NOW - 2 * DAY, note: "" },
  { id: "c14", name: "Clara Jensen", city: "Madison, WI", tags: ["subscriber"], hue: 190, channel: "store", joined: NOW - 470 * DAY, note: "" },
];

export function createInitialCustomers(): CustomerRecord[] {
  const orderCustomers = new Map(ORDER_CUSTOMERS.map((customer) => [customer.id, customer] as const));
  return SEEDS.map((seed) => {
    const orderCustomer = orderCustomers.get(seed.id);
    const email = seed.id === "c1" ? "elena@northwind.test" : seed.id === "c4" ? "orders@wrenandfield.test" : seed.id === "c5" ? "sofia@northwind.test" : seed.id === "c8" ? "oliver@northwind.test" : seed.id === "c12" ? "buying@linenroom.test" : seed.id === "c13" ? "ravi@northwind.test" : orderCustomer?.email ?? "customer@example.test";
    const phoneDigits = String(1000 + (parseInt(seed.id.slice(1), 10) * 7919) % 9000);
    return { ...seed, tags: [...seed.tags], email, phone: `+1 (555) 01${phoneDigits.slice(0, 2)}-${phoneDigits.slice(2)}` };
  });
}

export function customerOrderTotal(order: OrderRecord): number {
  return order.lines.reduce((sum, line) => sum + line.qty * line.price, 0) + order.shipping;
}

export function customerPaidOrders(id: string, orders: OrderRecord[]) {
  return orders.filter((order) => order.customerId === id && order.status !== "refunded" && order.status !== "cancelled");
}

export function customerLifetimeValue(id: string, orders: OrderRecord[]) {
  return customerPaidOrders(id, orders).reduce((sum, order) => sum + customerOrderTotal(order), 0);
}

export function createCustomerSpendSeries(customer: CustomerRecord, orders: OrderRecord[]) {
  const now = new Date(NOW);
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
    const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    const orderSpend = customerPaidOrders(customer.id, orders).filter((order) => order.placed >= date.getTime() && order.placed < next.getTime()).reduce((sum, order) => sum + customerOrderTotal(order), 0);
    const elapsedMonths = Math.max(0, Math.min(11, Math.floor((NOW - customer.joined) / (30 * DAY))));
    const eligible = index >= Math.max(0, 11 - elapsedMonths);
    const hash = customer.id.split("").reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7) + index * 137;
    const historical = eligible && index < 11 && Math.abs(Math.sin(hash)) > 0.35 ? Math.round((customer.tags.includes("wholesale") ? 220 : customer.tags.includes("vip") ? 105 : 38) * (0.35 + Math.abs(Math.sin(hash * 1.7)))) : 0;
    return { month: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date), value: Math.round(orderSpend || historical), current: index === 11 };
  });
  return monthly;
}
