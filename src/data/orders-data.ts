export type OrderStatus = "pending" | "paid" | "packed" | "shipped" | "delivered" | "refunded" | "cancelled";
export type OrderChannel = "online" | "store";

export interface OrderCustomer {
  id: string;
  name: string;
  email: string;
  city: string;
  hue: number;
  channel: OrderChannel;
  wholesale?: boolean;
}

export interface OrderLine {
  productId: string;
  name: string;
  hue: number;
  qty: number;
  price: number;
}

export interface OrderHistoryItem {
  status: OrderStatus;
  at: number;
  by: string;
}

export interface OrderRecord {
  id: string;
  customerId: string;
  lines: OrderLine[];
  shipping: number;
  status: OrderStatus;
  channel: OrderChannel;
  payment: string;
  placed: number;
  address: string;
  history: OrderHistoryItem[];
  note: string;
}

export const ORDER_CUSTOMERS: OrderCustomer[] = [
  { id: "c1", name: "Elena Marsh", email: "elena@northwind.test", city: "Portland, OR", hue: 330, channel: "online" },
  { id: "c2", name: "Theo Lindqvist", email: "theo@northwind.test", city: "Seattle, WA", hue: 200, channel: "online" },
  { id: "c3", name: "Amara Okoye", email: "amara@northwind.test", city: "Austin, TX", hue: 25, channel: "store" },
  { id: "c4", name: "Wren & Field Café", email: "orders@wrenandfield.test", city: "Denver, CO", hue: 150, channel: "online", wholesale: true },
  { id: "c5", name: "Sofia Bianchi", email: "sofia@northwind.test", city: "Brooklyn, NY", hue: 181, channel: "online" },
  { id: "c6", name: "Marcus Hale", email: "marcus@northwind.test", city: "Chicago, IL", hue: 215, channel: "store" },
  { id: "c7", name: "Hana Sato", email: "hana@northwind.test", city: "San Diego, CA", hue: 350, channel: "online" },
  { id: "c8", name: "Oliver Grant", email: "oliver@northwind.test", city: "Boston, MA", hue: 45, channel: "store" },
  { id: "c9", name: "Ines Duarte", email: "ines@northwind.test", city: "Miami, FL", hue: 10, channel: "online" },
  { id: "c10", name: "Kofi Mensah", email: "kofi@northwind.test", city: "Atlanta, GA", hue: 170, channel: "online" },
  { id: "c11", name: "Greta Novak", email: "greta@northwind.test", city: "Minneapolis, MN", hue: 209, channel: "store" },
  { id: "c12", name: "The Linen Room", email: "buying@linenroom.test", city: "Charleston, SC", hue: 209, channel: "online", wholesale: true },
  { id: "c13", name: "Ravi Kapoor", email: "ravi@northwind.test", city: "Phoenix, AZ", hue: 60, channel: "online" },
  { id: "c14", name: "Clara Jensen", email: "clara@northwind.test", city: "Madison, WI", hue: 190, channel: "store" },
];

const PRODUCTS = [
  { id: "p1", name: "Stoneware Mug, Fog", price: 24, hue: 210 },
  { id: "p2", name: "Linen Tea Towels, set of 3", price: 32, hue: 30 },
  { id: "p3", name: "Oak Serving Board", price: 58, hue: 35 },
  { id: "p4", name: "Copper Watering Can", price: 74, hue: 25 },
  { id: "p5", name: "Ceramic Planter, Sand", price: 38, hue: 45 },
  { id: "p6", name: "Waffle Bath Towel", price: 42, hue: 170 },
  { id: "p7", name: "Brass Desk Lamp", price: 129, hue: 42 },
  { id: "p8", name: "Walnut Pen Tray", price: 36, hue: 25 },
  { id: "p9", name: "Enamel Colander", price: 34, hue: 10 },
  { id: "p10", name: "Glass Carafe, 1 L", price: 28, hue: 190 },
  { id: "p11", name: "Wool Throw, Moss", price: 118, hue: 110 },
];

const SEED_STATUSES: OrderStatus[] = [
  "pending", "pending", "paid", "paid", "paid", "packed", "packed", "shipped", "shipped", "shipped",
  "delivered", "delivered", "delivered", "delivered", "delivered", "delivered", "refunded", "cancelled",
  "paid", "packed", "shipped", "delivered", "delivered", "pending", "paid", "packed", "shipped", "delivered", "refunded", "cancelled",
];
const PROGRESS: OrderStatus[] = ["pending", "paid", "packed", "shipped", "delivered"];
const FIXTURE_TIME = Date.UTC(2026, 9, 26, 12);

export function createInitialOrders(now = FIXTURE_TIME): OrderRecord[] {
  return SEED_STATUSES.map((status, index) => {
    const customer = ORDER_CUSTOMERS[(index * 5 + 2) % ORDER_CUSTOMERS.length];
    const lineCount = 1 + (index % 3);
    const lines: OrderLine[] = Array.from({ length: lineCount }, (_, lineIndex) => {
      const product = PRODUCTS[(index * 3 + lineIndex * 4) % PRODUCTS.length];
      return {
        productId: product.id,
        name: product.name,
        hue: product.hue,
        qty: customer.wholesale ? 6 + ((index + lineIndex) % 10) : 1 + ((index + lineIndex) % 2),
        price: product.price,
      };
    });
    const channel = index % 5 === 0 ? "store" : customer.channel;
    const subtotal = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
    const placed = now - (index * 1.15 + (index % 4) * 0.4 + 0.5) * 24 * 60 * 60 * 1000;
    const terminalPath = status === "refunded" || status === "cancelled" ? "delivered" : status;
    const stepIndex = PROGRESS.indexOf(terminalPath);
    const history: OrderHistoryItem[] = [{ status: "pending", at: placed, by: "Checkout" }];
    for (let step = 1; step <= stepIndex; step += 1) {
      history.push({ status: PROGRESS[step], at: placed + step * 2.5 * 60 * 60 * 1000, by: step === 1 ? "Payment" : step % 2 ? "Leo Tanaka" : "Jonah Okafor" });
    }
    if (status === "refunded" || status === "cancelled") {
      history.push({ status, at: placed + (stepIndex + 1) * 3 * 60 * 60 * 1000, by: "Priya Shah" });
    }
    const street = ["Alder", "Birch", "Cedar", "Maple", "Willow"][index % 5];
    return {
      id: `#${10482 - index}`,
      customerId: customer.id,
      lines,
      shipping: channel === "store" || subtotal > 75 ? 0 : 6.5,
      status,
      channel,
      payment: channel === "store" ? ["Card", "Apple Pay", "Cash"][index % 3] : ["Card", "Apple Pay", "PayPal"][index % 3],
      placed,
      address: channel === "store" ? "Collected in store" : `${120 + index * 13} ${street} St, ${customer.city}`,
      history,
      note: "",
    };
  });
}

export const ORDER_STATUSES = ["pending", "paid", "packed", "shipped", "delivered"] as const;
