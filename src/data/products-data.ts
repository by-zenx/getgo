export type ProductCategory = "Software" | "Services" | "Support" | "Training" | "Hardware";
export type ProductStatus = "active" | "draft" | "archived";

export interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  price: number;
  cost: number;
  stock: number;
  reorderAt: number;
  sold30: number;
  rating: number;
  reviews: number;
  hue: number;
  status: ProductStatus;
  description: string;
}

export const PRODUCT_CATEGORIES: ProductCategory[] = ["Software", "Services", "Support", "Training", "Hardware"];

const FIXTURES = ([
  { id: "p1", name: "Rapport CRM — Team", category: "Software", price: 89, cost: 18, stock: 240, reorderAt: 40, sold30: 126, rating: 4.8, reviews: 42, hue: 210, status: "active", description: "Core CRM workspace for teams of up to five, billed monthly." },
  { id: "p2", name: "Rapport CRM — Growth", category: "Software", price: 179, cost: 32, stock: 120, reorderAt: 25, sold30: 84, rating: 4.9, reviews: 31, hue: 225, status: "active", description: "Advanced pipeline, forecasting and reporting for growing teams." },
  { id: "p3", name: "Sales Process Review", category: "Services", price: 950, cost: 420, stock: 8, reorderAt: 2, sold30: 5, rating: 4.9, reviews: 18, hue: 155, status: "active", description: "A two hour review of your sales stages, handoffs and follow-up." },
  { id: "p4", name: "CRM Data Migration", category: "Services", price: 2400, cost: 1180, stock: 6, reorderAt: 2, sold30: 3, rating: 4.7, reviews: 12, hue: 175, status: "active", description: "One-time transfer and validation of up to 25,000 CRM records." },
  { id: "p5", name: "Implementation Workshop", category: "Training", price: 680, cost: 260, stock: 12, reorderAt: 3, sold30: 7, rating: 4.8, reviews: 24, hue: 45, status: "active", description: "A guided half-day session to configure teams, stages and reports." },
  { id: "p6", name: "Admin Certification", category: "Training", price: 320, cost: 110, stock: 24, reorderAt: 6, sold30: 11, rating: 4.6, reviews: 16, hue: 35, status: "active", description: "Self-paced administrator course with a practical assessment." },
  { id: "p7", name: "Priority Support — Annual", category: "Support", price: 1200, cost: 390, stock: 45, reorderAt: 10, sold30: 14, rating: 4.9, reviews: 28, hue: 195, status: "active", description: "Annual priority support with a one hour initial response target." },
  { id: "p8", name: "Named Success Manager", category: "Support", price: 650, cost: 280, stock: 10, reorderAt: 3, sold30: 4, rating: 5.0, reviews: 9, hue: 185, status: "active", description: "Monthly planning call and adoption guidance from a named advisor." },
  { id: "p9", name: "USB-C Conference Speaker", category: "Hardware", price: 149, cost: 72, stock: 38, reorderAt: 12, sold30: 18, rating: 4.5, reviews: 21, hue: 270, status: "active", description: "Portable speakerphone for clear hybrid customer calls." },
  { id: "p10", name: "HD Meeting Camera", category: "Hardware", price: 229, cost: 116, stock: 26, reorderAt: 8, sold30: 13, rating: 4.6, reviews: 19, hue: 255, status: "active", description: "Wide-angle USB camera with automatic light correction." },
  { id: "p11", name: "Rapport CRM — Enterprise", category: "Software", price: 349, cost: 68, stock: 60, reorderAt: 15, sold30: 22, rating: 4.8, reviews: 17, hue: 235, status: "active", description: "Expanded CRM access and controls for multi-team organizations." },
  { id: "p12", name: "Workflow Design Session", category: "Services", price: 520, cost: 215, stock: 10, reorderAt: 3, sold30: 6, rating: 4.7, reviews: 14, hue: 165, status: "active", description: "A focused session to map one process and configure its workflow." },
  { id: "p13", name: "Data Health Check", category: "Services", price: 380, cost: 145, stock: 14, reorderAt: 4, sold30: 9, rating: 4.8, reviews: 11, hue: 145, status: "active", description: "Review duplicate, incomplete and outdated CRM records." },
  { id: "p14", name: "Sales Team Essentials", category: "Training", price: 180, cost: 58, stock: 32, reorderAt: 8, sold30: 16, rating: 4.7, reviews: 20, hue: 55, status: "active", description: "Short course on recording activity and managing pipeline follow-ups." },
  { id: "p15", name: "Extended Support — Annual", category: "Support", price: 780, cost: 250, stock: 30, reorderAt: 8, sold30: 8, rating: 4.8, reviews: 13, hue: 205, status: "active", description: "Annual support plan with extended weekday coverage." },
  { id: "p16", name: "CRM Admin Essentials", category: "Training", price: 240, cost: 82, stock: 18, reorderAt: 5, sold30: 0, rating: 0, reviews: 0, hue: 65, status: "draft", description: "New admin onboarding course, currently being prepared for release." },
] satisfies Omit<ProductRecord, "sku">[]).map((item) => ({ ...item, sku: `RG-${item.category.slice(0, 3).toUpperCase()}-${item.id.slice(1).padStart(3, "0")}` }));

export function createInitialProducts() {
  return FIXTURES.map((product) => ({ ...product }));
}
