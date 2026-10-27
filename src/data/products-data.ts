export type ProductCategory = "Kitchen" | "Table" | "Bath" | "Garden" | "Desk";
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

export const PRODUCT_CATEGORIES: ProductCategory[] = ["Kitchen", "Table", "Bath", "Garden", "Desk"];

const FIXTURES: ProductRecord[] = [
  { id: "p1", name: "Stoneware Mug, Fog", category: "Kitchen", price: 24, cost: 8.5, stock: 214, reorderAt: 60, sold30: 386, rating: 4.8, reviews: 412, hue: 210, status: "active", description: "Hand-thrown 350 ml mug with a satin fog glaze." },
  { id: "p2", name: "Linen Tea Towels, set of 3", category: "Kitchen", price: 32, cost: 11, stock: 128, reorderAt: 40, sold30: 241, rating: 4.7, reviews: 198, hue: 30, status: "active", description: "Stonewashed European linen in oat, rust and ink." },
  { id: "p3", name: "Oak Serving Board", category: "Table", price: 58, cost: 21, stock: 46, reorderAt: 25, sold30: 132, rating: 4.9, reviews: 156, hue: 35, status: "active", description: "Solid white oak, oiled, with a carved juice groove." },
  { id: "p4", name: "Copper Watering Can", category: "Garden", price: 74, cost: 29, stock: 12, reorderAt: 20, sold30: 64, rating: 4.6, reviews: 88, hue: 25, status: "active", description: "A 1.5 litre can with a long brass rose." },
  { id: "p5", name: "Ceramic Planter, Sand", category: "Garden", price: 38, cost: 13, stock: 96, reorderAt: 30, sold30: 175, rating: 4.5, reviews: 140, hue: 45, status: "active", description: "Matte sand-glaze planter with a drainage saucer." },
  { id: "p6", name: "Waffle Bath Towel", category: "Bath", price: 42, cost: 15, stock: 158, reorderAt: 50, sold30: 228, rating: 4.7, reviews: 263, hue: 190, status: "active", description: "Turkish cotton waffle weave that dries fast." },
  { id: "p7", name: "Brass Desk Lamp", category: "Desk", price: 129, cost: 52, stock: 18, reorderAt: 12, sold30: 41, rating: 4.8, reviews: 57, hue: 42, status: "active", description: "Solid brass arm, linen shade, dimmable LED." },
  { id: "p8", name: "Walnut Pen Tray", category: "Desk", price: 36, cost: 12, stock: 74, reorderAt: 25, sold30: 118, rating: 4.6, reviews: 92, hue: 25, status: "active", description: "Turned from a single block of black walnut." },
  { id: "p9", name: "Enamel Colander", category: "Kitchen", price: 34, cost: 12, stock: 0, reorderAt: 20, sold30: 96, rating: 4.4, reviews: 77, hue: 10, status: "active", description: "Speckled enamel over steel, with two loop handles." },
  { id: "p10", name: "Glass Carafe, 1 L", category: "Table", price: 28, cost: 9, stock: 188, reorderAt: 40, sold30: 204, rating: 4.7, reviews: 171, hue: 190, status: "active", description: "Mouth-blown borosilicate with a cup lid." },
  { id: "p11", name: "Wool Throw, Moss", category: "Bath", price: 118, cost: 46, stock: 33, reorderAt: 15, sold30: 52, rating: 4.9, reviews: 66, hue: 110, status: "active", description: "Lambswool throw with a fringed edge." },
  { id: "p12", name: "Beeswax Candles, pair", category: "Table", price: 22, cost: 6.5, stock: 260, reorderAt: 80, sold30: 412, rating: 4.8, reviews: 388, hue: 48, status: "active", description: "Hand-dipped pure beeswax, 25 cm tapers." },
  { id: "p13", name: 'Cast Iron Skillet, 10"', category: "Kitchen", price: 64, cost: 24, stock: 7, reorderAt: 15, sold30: 88, rating: 4.9, reviews: 214, hue: 230, status: "active", description: "Pre-seasoned, pours from both sides." },
  { id: "p14", name: "Rattan Storage Basket", category: "Bath", price: 46, cost: 17, stock: 61, reorderAt: 20, sold30: 97, rating: 4.5, reviews: 81, hue: 38, status: "active", description: "Hand-woven rattan with leather handles." },
  { id: "p15", name: "Pour-over Kettle", category: "Kitchen", price: 89, cost: 34, stock: 39, reorderAt: 15, sold30: 73, rating: 4.7, reviews: 103, hue: 200, status: "active", description: "Gooseneck spout, 0.9 litre, matte black." },
  { id: "p16", name: "Cotton Bath Mat", category: "Bath", price: 29, cost: 9.5, stock: 0, reorderAt: 30, sold30: 0, rating: 0, reviews: 0, hue: 170, status: "draft", description: "Tufted organic cotton, 50 × 80 cm. Launching in spring." },
].map((product) => ({ ...product, sku: `HS-${product.category.slice(0, 3).toUpperCase()}-${product.id.slice(1).padStart(3, "0")}` }));

export function createInitialProducts() {
  return FIXTURES.map((product) => ({ ...product }));
}
