export type IntegrationCategory = "Payments" | "Point of sale" | "Shipping" | "Accounting" | "Marketing" | "Support";

export interface IntegrationRecord {
  id: string;
  name: string;
  cat: IntegrationCategory;
  desc: string;
  connected: boolean;
  hue: number;
  synced?: number;
}

export const INTEGRATION_STORAGE_KEY = "corbel:integrations";
export const INTEGRATION_CATEGORIES: IntegrationCategory[] = ["Payments", "Point of sale", "Shipping", "Accounting", "Marketing", "Support"];
export const INTEGRATION_PERMISSIONS: Record<IntegrationCategory, string[]> = {
  Payments: ["Take card and wallet payments at checkout", "Read orders, refunds and disputes", "Send payouts to your bank account"],
  "Point of sale": ["Read and update stock for both shops", "Create orders from in-store sales", "Read customer profiles at the till"],
  Shipping: ["Read orders and shipping addresses", "Buy and print shipping labels", "Send tracking updates to customers"],
  Accounting: ["Read orders, refunds and payouts", "Read tax and currency settings", "Create entries in your books"],
  Marketing: ["Read catalog items, prices and availability", "Read which customers agreed to marketing", "Track sales from campaigns"],
  Support: ["Read customer profiles and orders", "Create conversations in Leads", "Add notes to customer profiles"],
};

const NOW = Date.UTC(2026, 9, 26, 12);
const DAY = 24 * 60 * 60 * 1000;
const FIXTURES: IntegrationRecord[] = [
  { id: "i1", name: "Paywave", cat: "Payments", desc: "Card, Apple Pay and PayPal checkout with instant payouts.", connected: true, hue: 210, synced: NOW - 2 * DAY },
  { id: "i2", name: "Stockroom POS", cat: "Point of sale", desc: "Sell in your shops; stock syncs both ways.", connected: true, hue: 160, synced: NOW - 5 * DAY },
  { id: "i3", name: "Parcelpoint", cat: "Shipping", desc: "Print labels, compare carriers, track parcels.", connected: true, hue: 30, synced: NOW - 18 * DAY },
  { id: "i4", name: "Ledgerly", cat: "Accounting", desc: "Push every sale and refund to your books.", connected: false, hue: 140 },
  { id: "i5", name: "Chatterbox", cat: "Support", desc: "Website chat that lands in your Leads inbox.", connected: true, hue: 181, synced: NOW - DAY },
  { id: "i6", name: "Pinpoint Ads", cat: "Marketing", desc: "Sync your catalogue to shopping ads.", connected: false, hue: 350 },
  { id: "i7", name: "Taxwise", cat: "Accounting", desc: "Sales tax for every state, filed for you.", connected: false, hue: 200 },
  { id: "i8", name: "Inkwell Reviews", cat: "Marketing", desc: "Collect customer reviews and display them alongside catalog items.", connected: true, hue: 45, synced: NOW - 3 * DAY },
  { id: "i9", name: "Courier Plus", cat: "Shipping", desc: "Same-day local delivery from your shops.", connected: false, hue: 10 },
  { id: "i10", name: "Sheetsync", cat: "Accounting", desc: "A live spreadsheet of orders and stock.", connected: false, hue: 120 },
  { id: "i11", name: "Bookwell", cat: "Support", desc: "Let customers book in-store styling sessions.", connected: false, hue: 209 },
  { id: "i12", name: "Postline SMS", cat: "Marketing", desc: "Text shipping updates and back-in-stock alerts.", connected: false, hue: 209 },
];

export function createInitialIntegrations(): IntegrationRecord[] {
  return FIXTURES.map((integration) => ({ ...integration }));
}

export function integrationSyncLabel(timestamp?: number): string {
  if (!timestamp) return "Not connected";
  const days = Math.max(0, Math.floor((NOW - timestamp) / DAY));
  if (days === 0) return "Synced today";
  if (days === 1) return "Synced yesterday";
  return `Synced ${days} days ago`;
}
