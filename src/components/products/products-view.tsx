"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Icon } from "@/components/icons/svg-sprite";
import { ProgressMeter } from "@/components/ui/progress-meter";
import { moveSegmentPill } from "@/lib/segment-motion";
import { PRODUCT_CATEGORIES, createInitialProducts, type ProductCategory, type ProductRecord, type ProductStatus } from "@/data/products-data";

const PRODUCTS_KEY = "corbel:products";
const VIEW_KEY = "corbel:products:view";
type ProductViewMode = "grid" | "table";
type ProductFilterStatus = "all" | ProductStatus;
type SortMode = "best" | "price-desc" | "price-asc" | "stock" | "name";

const STATUSES: { value: ProductFilterStatus; label: string }[] = [
  { value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" },
];
const SORTS: { value: SortMode; label: string }[] = [
  { value: "best", label: "Best-selling" }, { value: "price-desc", label: "Price: high to low" }, { value: "price-asc", label: "Price: low to high" }, { value: "stock", label: "Stock: lowest first" }, { value: "name", label: "Name: A to Z" },
];

function ProductSegment({
  options,
  value,
  label,
  className = "",
  onChange,
}: {
  options: { value: string; label: string; content?: React.ReactNode }[];
  value: string;
  label: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const positioned = useRef(false);
  useGSAP(() => {
    const group = groupRef.current;
    const pill = pillRef.current;
    const active = group?.querySelector<HTMLButtonElement>(`button[data-value="${CSS.escape(value)}"]`);
    if (!group || !pill || !active) return;
    moveSegmentPill(pill, active, !positioned.current);
    positioned.current = true;
  }, { dependencies: [value], scope: groupRef });
  return <div ref={groupRef} className={`seg ${className}`.trim()} role="group" aria-label={label}>
    <span ref={pillRef} className="seg__pill" aria-hidden="true" />
    {options.map((option) => <button key={option.value} data-value={option.value} type="button" aria-pressed={value === option.value} aria-label={option.label} onClick={() => onChange(option.value)}>{option.content ?? option.label}</button>)}
  </div>;
}

function safeProducts(value: string): ProductRecord[] | null {
  try {
    const parsed = JSON.parse(value) as ProductRecord[];
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item.id === "string" && typeof item.name === "string" && typeof item.stock === "number")) return null;
    return parsed;
  } catch { return null; }
}

function money(value: number, decimals = 2) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

function number(value: number) { return new Intl.NumberFormat("en-US").format(value); }
function margin(product: ProductRecord) { return product.price > 0 ? (product.price - product.cost) / product.price : 0; }
function stockState(product: ProductRecord) { return product.stock <= 0 ? "out" : product.stock <= product.reorderAt ? "low" : "ok"; }
function stockLabel(product: ProductRecord) { return ({ ok: "In stock", low: "Low stock", out: "Out of stock" })[stockState(product)]; }
function restockAmount(product: ProductRecord) { return Math.max(10, Math.round(product.reorderAt * 2 / 5 / 5) * 5); }
function coverDescription(product: ProductRecord) {
  if (product.stock <= 0) return "None left to sell";
  if (!product.sold30) return "No recent sales";
  const days = Math.round(product.stock / (product.sold30 / 30));
  return days < 1 ? "Less than a day of cover" : `About ${days} ${days === 1 ? "day" : "days"} of cover`;
}
function productHue(category: ProductCategory) { return ({ Kitchen: 210, Table: 35, Bath: 190, Garden: 120, Desk: 45 })[category]; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

function ProductThumb({ product, size = 44, extraClass = "" }: { product: ProductRecord; size?: number; extraClass?: string }) {
  return <span className={`thumb ${extraClass}`.trim()} style={{ "--h": product.hue, "--s": `${size}px` } as React.CSSProperties} aria-hidden="true">{initials(product.name)}</span>;
}

function AnimatedNumber({ value, format }: { value: number; format: (value: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const counter = useRef({ value: 0 });
  useGSAP(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      counter.current.value = value;
      element.textContent = format(value);
      return;
    }
    gsap.to(counter.current, { value, duration: 0.9, ease: "power3.out", overwrite: "auto", onUpdate: () => { element.textContent = format(counter.current.value); } });
  }, { dependencies: [value] });
  return <span ref={ref}>{format(0)}</span>;
}

function makeSalesSeries(product: ProductRecord) {
  return Array.from({ length: 30 }, (_, index) => {
    const seed = product.hue + index * 19 + Number(product.id.slice(1)) * 13;
    const wave = Math.sin(seed * 0.47) * 0.38 + Math.cos(seed * 0.19) * 0.2 + 1;
    return product.sold30 ? Math.max(0, Math.round(product.sold30 / 30 * wave)) : 0;
  });
}

function stockMeter(product: ProductRecord, size = "") {
  const ratio = product.stock <= 0 ? 0 : Math.min(1, product.stock / Math.max(1, product.reorderAt * 3));
  return <div className={`meter prd-meter ${size}`} data-state={stockState(product)} role="img" aria-label={`${number(product.stock)} in stock, reorder at ${number(product.reorderAt)}`}><ProgressMeter value={ratio} /></div>;
}

export function ProductsView({ productId = null }: { productId?: string | null }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const addDialogRef = useRef<HTMLDialogElement>(null);
  const detailDialogRef = useRef<HTMLDialogElement>(null);
  const [products, setProducts] = useState<ProductRecord[]>(createInitialProducts);
  const [viewMode, setViewMode] = useState<ProductViewMode>("grid");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState<ProductFilterStatus>("all");
  const [sort, setSort] = useState<SortMode>("best");
  const [addOpen, setAddOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<ProductCategory>("Kitchen");
  const [newStatus, setNewStatus] = useState<Exclude<ProductStatus, "archived">>("active");
  const [addPriceDraft, setAddPriceDraft] = useState("");
  const [addCostDraft, setAddCostDraft] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [priceDraft, setPriceDraft] = useState("");
  const [priceError, setPriceError] = useState("");
  const [chartIndex, setChartIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PRODUCTS_KEY);
      if (stored) {
        const parsed = safeProducts(stored);
        if (parsed) setProducts(parsed);
      } else localStorage.setItem(PRODUCTS_KEY, JSON.stringify(createInitialProducts()));
      if (localStorage.getItem(VIEW_KEY) === '"table"') setViewMode("table");
    } catch { /* Keep the catalog available for this session if storage is blocked. */ }
  }, []);

  const selectedProduct = products.find((product) => product.id === productId) ?? null;
  const filteredProducts = useMemo(() => {
    const search = query.trim().toLowerCase();
    const comparators: Record<SortMode, (a: ProductRecord, b: ProductRecord) => number> = {
      best: (a, b) => b.sold30 - a.sold30,
      "price-desc": (a, b) => b.price - a.price,
      "price-asc": (a, b) => a.price - b.price,
      stock: (a, b) => a.stock - b.stock,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return products.filter((product) => (category === "All" || product.category === category)
      && (status === "all" || product.status === status)
      && (!search || `${product.name} ${product.sku}`.toLowerCase().includes(search)))
      .sort(comparators[sort]);
  }, [products, query, category, status, sort]);

  const metrics = useMemo(() => {
    const live = products.filter((product) => product.status === "active");
    const nonArchived = products.filter((product) => product.status !== "archived");
    return {
      stockValue: nonArchived.reduce((sum, product) => sum + Math.max(0, product.stock) * product.cost, 0),
      units: nonArchived.reduce((sum, product) => sum + Math.max(0, product.stock), 0),
      low: live.filter((product) => stockState(product) === "low"),
      out: live.filter((product) => stockState(product) === "out"),
      averageMargin: live.length ? live.reduce((sum, product) => sum + margin(product), 0) / live.length : 0,
      activeCount: live.length,
    };
  }, [products]);

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(".prd-stats > *", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.06, clearProps: "transform,opacity" });
    gsap.fromTo(".prd-bar > *", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out", stagger: 0.07, delay: 0.1, clearProps: "transform,opacity" });
    const cards = rootRef.current?.querySelectorAll<HTMLElement>(".prd-card, .prd-table tbody tr");
    if (cards?.length) gsap.fromTo(cards, { opacity: 0, y: 9 }, { opacity: 1, y: 0, duration: 0.38, ease: "power3.out", stagger: 0.025, delay: 0.22, clearProps: "transform,opacity" });
  }, { dependencies: [filteredProducts.map((product) => product.id).join(","), viewMode], scope: rootRef });

  useEffect(() => {
    const dialog = addDialogRef.current;
    if (!dialog) return;
    if (addOpen && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>("#pa-name")?.focus();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(dialog.querySelector(".modal__box"), { opacity: 0, y: 16, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.34, ease: "power3.out" });
    } else if (!addOpen && dialog.open) dialog.close();
  }, [addOpen]);

  useEffect(() => {
    const dialog = detailDialogRef.current;
    if (!dialog) return;
    if (selectedProduct && !dialog.open) {
      dialog.showModal();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(dialog.querySelector(".sheet__box"), { opacity: 0, x: 26 }, { opacity: 1, x: 0, duration: 0.48, ease: "power3.out" });
        gsap.fromTo(dialog.querySelectorAll(".prd-sh > *"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.42, stagger: 0.045, delay: 0.12, ease: "power3.out" });
        const sparkLine = dialog.querySelector<SVGPathElement>(".prd-spark__line");
        if (sparkLine) {
          const length = sparkLine.getTotalLength();
          gsap.fromTo(sparkLine, { strokeDasharray: `${length} ${length}`, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1.1, delay: 0.3, ease: "power2.out", clearProps: "strokeDasharray,strokeDashoffset" });
        }
        const sparkArea = dialog.querySelector<SVGPathElement>(".prd-spark__area");
        if (sparkArea) gsap.fromTo(sparkArea, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.55, ease: "power2.out" });
      }
    } else if (!selectedProduct && dialog.open) dialog.close();
  }, [productId, selectedProduct]);

  useEffect(() => {
    setPriceDraft(selectedProduct?.price.toFixed(2) ?? "");
    setPriceError("");
    setChartIndex(null);
  }, [productId, selectedProduct?.price]);

  const persistProducts = (next: ProductRecord[]) => {
    setProducts(next);
    try { localStorage.setItem(PRODUCTS_KEY, JSON.stringify(next)); } catch { /* State stays available for this session. */ }
  };
  const updateProduct = (id: string, updater: (product: ProductRecord) => ProductRecord) => {
    persistProducts(products.map((product) => product.id === id ? updater(product) : product));
  };
  const closeDetails = () => router.replace("/products");
  const openAddProduct = () => {
    setFormErrors({});
    setAddPriceDraft("");
    setAddCostDraft("");
    addDialogRef.current?.querySelector<HTMLFormElement>("form")?.reset();
    setAddOpen(true);
  };
  const setView = (next: ProductViewMode) => {
    setViewMode(next);
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(next)); } catch {}
  };
  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  };

  const addProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const rawPrice = String(form.get("price") ?? "");
    const rawCost = String(form.get("cost") ?? "");
    const rawStock = String(form.get("stock") ?? "");
    const rawReorder = String(form.get("reorder") ?? "");
    const price = Number(rawPrice);
    const cost = Number(rawCost);
    const stock = Number(rawStock);
    const reorderAt = Number(rawReorder);
    const description = String(form.get("desc") ?? "").trim();
    const errors: Record<string, string> = {};
    if (name.length < 2) errors.name = "Enter a product name.";
    if (!rawPrice || !Number.isFinite(price) || price <= 0) errors.price = "Enter a price above $0.";
    if (!rawCost || !Number.isFinite(cost) || cost < 0) errors.cost = "Enter a valid unit cost.";
    if (!rawStock || !Number.isInteger(stock) || stock < 0) errors.stock = "Enter a whole number of units.";
    if (!rawReorder || !Number.isInteger(reorderAt) || reorderAt < 0) errors.reorder = "Enter a whole number reorder point.";
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    const id = `p${Math.max(0, ...products.map((product) => Number(product.id.slice(1)) || 0)) + 1}`;
    const record: ProductRecord = {
      id,
      sku: `HS-${newCategory.slice(0, 3).toUpperCase()}-${id.slice(1).padStart(3, "0")}`,
      name,
      category: newCategory,
      price,
      cost,
      stock,
      reorderAt,
      sold30: 0,
      rating: 0,
      reviews: 0,
      hue: productHue(newCategory),
      status: newStatus,
      description,
    };
    persistProducts([...products, record]);
    event.currentTarget.reset();
    setFormErrors({});
    setNewCategory("Kitchen");
    setNewStatus("active");
    setAddPriceDraft("");
    setAddCostDraft("");
    setAddOpen(false);
    announce(`${name} added to products`);
  };

  const savePrice = () => {
    if (!selectedProduct) return;
    const nextPrice = Math.round(Number(priceDraft) * 100) / 100;
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) { setPriceError("Enter a price above $0."); return; }
    setPriceError("");
    if (nextPrice !== selectedProduct.price) {
      updateProduct(selectedProduct.id, (product) => ({ ...product, price: nextPrice }));
      setPriceDraft(nextPrice.toFixed(2));
      announce(nextPrice <= selectedProduct.cost ? `${selectedProduct.name} now sells at or below cost` : `Price saved for ${selectedProduct.name}`);
    }
  };

  const productFormError = (field: string) => formErrors[field] ? <small className="prd-err">{formErrors[field]}</small> : null;
  const previewPrice = Number(addPriceDraft);
  const previewCost = Number(addCostDraft);
  const addMarginPreview = addPriceDraft && addCostDraft && previewPrice > 0 && previewCost >= 0
    ? `${Math.round((previewPrice - previewCost) / previewPrice * 100)}% · ${money(previewPrice - previewCost)} per unit`
    : "Enter price and cost";

  if (productId && !selectedProduct) {
    return <div ref={rootRef} data-view="products" className="prd"><section className="card"><div className="empty"><Icon name="box" /><b>Product not found</b><span>This product may have been removed from the catalog.</span><button className="btn" type="button" onClick={closeDetails}>Back to products</button></div></section></div>;
  }

  return (
    <div ref={rootRef} data-view="products" className="prd">
      <section className="card statbar prd-stats" style={{ "--n": 4 } as React.CSSProperties} aria-label="Catalogue figures">
        <div className="stat prd-stat"><p className="stat__label">Stock value at cost</p><p className="stat__val"><AnimatedNumber value={metrics.stockValue} format={(value) => money(value, 0)} /></p><p className="stat__meta">{number(metrics.units)} units on hand</p></div>
        <div className="stat prd-stat"><p className="stat__label">Low stock</p><p className="stat__val"><AnimatedNumber value={metrics.low.length} format={(value) => number(Math.round(value))} /></p><p className="stat__meta">{metrics.low.length ? `${metrics.low[0].name}${metrics.low.length > 1 ? ` and ${metrics.low.length - 1} more` : ""}` : "All above reorder point"}</p></div>
        <div className="stat prd-stat"><p className="stat__label">Out of stock</p><p className="stat__val"><AnimatedNumber value={metrics.out.length} format={(value) => number(Math.round(value))} /></p><p className="stat__meta">{metrics.out.length ? `${metrics.out[0].name}${metrics.out.length > 1 ? ` and ${metrics.out.length - 1} more` : ""}` : "Everything is in stock"}</p></div>
        <div className="stat prd-stat"><p className="stat__label">Average margin</p><p className="stat__val"><AnimatedNumber value={metrics.averageMargin * 100} format={(value) => `${value.toFixed(1)}%`} /></p><p className="stat__meta">Across {metrics.activeCount} active products</p><div className="meter prd-stat__meter"><ProgressMeter value={metrics.averageMargin} /></div></div>
      </section>

      <div className="prd-bar">
        <div className="toolbar">
          <label className="input-icon prd-search"><Icon name="search" /><span className="sr-only">Search products</span><input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or SKU" autoComplete="off" /></label>
          <span className="card__sub prd-count" aria-live="polite">{filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}</span>
          <div className="toolbar__end">
            <label className="prd-sort"><span className="sr-only">Sort by</span><select className="select" value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>{SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <ProductSegment className="seg--sm prd-view" label="Product view" value={viewMode} onChange={(value) => setView(value as ProductViewMode)} options={[{ value: "grid", label: "Grid view", content: <Icon name="grid" /> }, { value: "table", label: "Table view", content: <Icon name="board" /> }]} />
            <button className="btn btn--primary" type="button" onClick={openAddProduct}><Icon name="plus" />Add product</button>
          </div>
        </div>
        <div className="toolbar prd-filters">
          <div className="chips" role="group" aria-label="Category"><button className="chip" type="button" aria-pressed={category === "All"} onClick={() => setCategory("All")}>All</button>{PRODUCT_CATEGORIES.map((item) => <button key={item} className="chip" type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <div className="toolbar__end"><ProductSegment className="seg--sm prd-status" label="Status" value={status} onChange={(value) => setStatus(value as ProductFilterStatus)} options={STATUSES} /></div>
        </div>
      </div>

      <div className={viewMode === "grid" ? "prd-list prd-grid" : "prd-list"} aria-live="polite">
        {filteredProducts.length === 0 ? <section className="card"><div className="empty"><Icon name="box" /><b>{query || category !== "All" || status !== "all" ? "No products match" : "No products yet"}</b><span>{query || category !== "All" || status !== "all" ? "Try another search or clear a filter." : "Add a product to start building your catalog."}</span></div></section>
          : viewMode === "grid" ? filteredProducts.map((product) => <article key={product.id} className="prd-card" data-id={product.id}>
            <button className="prd-card__in" type="button" onClick={() => router.push(`/products/${product.id}`)} aria-label={`Open ${product.name}`}>
              <span className="prd-card__ring" aria-hidden="true" />
              <span className="prd-card__top"><ProductThumb product={product} /><span className="prd-card__pills">{product.status !== "active" && <span className={`pill pill--${product.status === "draft" ? "sea" : "gray"}`}>{product.status}</span>}{(product.status !== "draft" || product.stock > 0) && <span className={`pill pill--${stockState(product) === "ok" ? "mint" : stockState(product) === "low" ? "amber" : "coral"}`}>{stockLabel(product)}</span>}</span></span>
              <span className="prd-card__name"><b>{product.name}</b><span className="mono">{product.sku}</span></span>
              <span className="prd-card__price"><b>{money(product.price)}</b><span>{Math.round(margin(product) * 100)}% margin</span></span>
              <span className="prd-card__stock"><span className="prd-card__stockrow"><span><b>{number(product.stock)}</b> in stock</span><span>reorder at {number(product.reorderAt)}</span></span>{stockMeter(product)}</span>
              <span className="prd-card__foot"><span className="prd-rating">{product.reviews ? <><Icon name="star" /><b>{product.rating.toFixed(1)}</b><small>({number(product.reviews)})</small></> : <small>No reviews yet</small>}</span><span><b>{number(product.sold30)}</b> sold, 30 days</span></span>
            </button>
          </article>)
          : <section className="card prd-tablecard"><div className="table-wrap"><table className="table prd-table"><thead><tr><th scope="col">Product</th><th scope="col">Category</th><th scope="col" className="num">Price</th><th scope="col" className="num prd-col-cost">Cost</th><th scope="col" className="num">Margin</th><th scope="col">Stock</th><th scope="col" className="num">Sold, 30 days</th><th scope="col">Rating</th><th scope="col">Status</th></tr></thead>
            <tbody>{filteredProducts.map((product) => <tr key={product.id} data-id={product.id} tabIndex={0} aria-label={`${product.name}, open details`} onClick={() => router.push(`/products/${product.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/products/${product.id}`); } }}>
              <td><span className="cell-main"><ProductThumb product={product} size={36} /><span><b>{product.name}</b><small className="mono">{product.sku}</small></span></span></td><td>{product.category}</td><td className="num">{money(product.price)}</td><td className="num prd-col-cost">{money(product.cost)}</td><td className="num">{Math.round(margin(product) * 100)}%</td><td><span className="prd-tstock"><b>{number(product.stock)}</b>{stockMeter(product, "prd-meter--sm")}</span></td><td className="num">{number(product.sold30)}</td><td>{product.reviews ? <span className="prd-rating"><Icon name="star" /><b>{product.rating.toFixed(1)}</b><small>({number(product.reviews)})</small></span> : <span className="prd-rating"><small>No reviews yet</small></span>}</td><td><span className="prd-tpills">{product.status !== "active" && <span className={`pill pill--${product.status === "draft" ? "sea" : "gray"}`}>{product.status}</span>}{(product.status !== "draft" || product.stock > 0) && <span className={`pill pill--${stockState(product) === "ok" ? "mint" : stockState(product) === "low" ? "amber" : "coral"}`}>{stockLabel(product)}</span>}</span></td>
            </tr>)}</tbody></table></div></section>}
      </div>

      <dialog ref={addDialogRef} className="modal" aria-label="Add product" onCancel={() => setAddOpen(false)} onClick={(event) => { if (event.target === addDialogRef.current) setAddOpen(false); }}>
        <form className="modal__box" onSubmit={addProduct} noValidate>
          <header className="modal__head"><h2>Add product</h2><button className="icon-btn" type="button" aria-label="Close" onClick={() => setAddOpen(false)}><Icon name="x" /></button></header>
          <div className="modal__body"><div className="prd-form">
            <div className="field prd-form__wide"><label className="label" htmlFor="pa-name">Name</label><input className="input" id="pa-name" name="name" autoComplete="off" placeholder="Product name" aria-invalid={Boolean(formErrors.name)} />{productFormError("name")}</div>
            <div className="field"><label className="label" htmlFor="pa-cat">Category</label><select className="select" id="pa-cat" value={newCategory} onChange={(event) => setNewCategory(event.target.value as ProductCategory)}>{PRODUCT_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label className="label" htmlFor="pa-status">Status</label><select className="select" id="pa-status" value={newStatus} onChange={(event) => setNewStatus(event.target.value as typeof newStatus)}><option value="active">Active, on sale now</option><option value="draft">Draft, hidden from customers</option></select></div>
            <div className="field"><label className="label" htmlFor="pa-price">Price</label><span className="prd-cur"><span aria-hidden="true">$</span><input className="input" id="pa-price" name="price" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" value={addPriceDraft} onChange={(event) => setAddPriceDraft(event.target.value)} aria-invalid={Boolean(formErrors.price)} /></span>{productFormError("price")}</div>
            <div className="field"><label className="label" htmlFor="pa-cost">Unit cost</label><span className="prd-cur"><span aria-hidden="true">$</span><input className="input" id="pa-cost" name="cost" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={addCostDraft} onChange={(event) => setAddCostDraft(event.target.value)} aria-invalid={Boolean(formErrors.cost)} /></span>{productFormError("cost")}</div>
            <div className="field"><label className="label" htmlFor="pa-stock">Stock on hand</label><input className="input" id="pa-stock" name="stock" type="number" inputMode="numeric" min="0" step="1" defaultValue="0" aria-invalid={Boolean(formErrors.stock)} />{productFormError("stock")}</div>
            <div className="field"><label className="label" htmlFor="pa-reorder">Reorder point</label><input className="input" id="pa-reorder" name="reorder" type="number" inputMode="numeric" min="0" step="1" defaultValue="20" aria-invalid={Boolean(formErrors.reorder)} />{productFormError("reorder")}</div>
            <div className="field prd-form__wide"><label className="label" htmlFor="pa-desc">Description</label><textarea className="textarea" id="pa-desc" name="desc" rows={3} placeholder="What it is made of, its size, and why people love it." /></div>
            <p className="prd-form__margin prd-form__wide"><span>Margin</span><b>{addMarginPreview}</b></p>
          </div></div>
          <footer className="modal__foot"><button className="btn" type="button" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn btn--primary" type="submit"><Icon name="plus" />Add product</button></footer>
        </form>
      </dialog>

      <dialog ref={detailDialogRef} className="sheet" aria-label={selectedProduct ? `Product details: ${selectedProduct.name}` : "Product details"} onCancel={(event) => { event.preventDefault(); closeDetails(); }} onClick={(event) => { if (event.target === detailDialogRef.current) closeDetails(); }}>
        {selectedProduct && <div className="sheet__box"><header className="sheet__head"><h2>{selectedProduct.name}</h2><button className="icon-btn" type="button" aria-label="Close product details" onClick={closeDetails}><Icon name="x" /></button></header>
          <div className="sheet__body"><div className="prd-sh">
            <div className="prd-sh__hero"><ProductThumb product={selectedProduct} size={84} extraClass="prd-sh__thumb" /><div className="prd-sh__id"><span className="mono">{selectedProduct.sku}</span><span className="prd-sh__meta">{selectedProduct.category}{selectedProduct.reviews > 0 && <span className="prd-rating"><Icon name="star" /><b>{selectedProduct.rating.toFixed(1)}</b><small>({number(selectedProduct.reviews)})</small></span>}</span><span className="prd-sh__pills">{selectedProduct.status !== "active" && <span className={`pill pill--${selectedProduct.status === "draft" ? "sea" : "gray"}`}>{selectedProduct.status}</span>}{(selectedProduct.status !== "draft" || selectedProduct.stock > 0) && <span className={`pill pill--${stockState(selectedProduct) === "ok" ? "mint" : stockState(selectedProduct) === "low" ? "amber" : "coral"}`}>{stockLabel(selectedProduct)}</span>}</span></div></div>
            <p className="prd-sh__desc">{selectedProduct.description}</p>
            <section className="prd-sh__money" aria-label="Pricing"><div className="prd-tile"><label className="label" htmlFor="ps-price">Price</label><span className="prd-cur prd-cur--lg"><span aria-hidden="true">$</span><input className="input" id="ps-price" type="number" inputMode="decimal" min="0.01" step="0.01" value={priceDraft} aria-describedby="ps-price-hint" aria-invalid={Boolean(priceError)} onChange={(event) => { setPriceDraft(event.target.value); setPriceError(""); }} onBlur={savePrice} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); savePrice(); event.currentTarget.blur(); } }} /></span><small className={`prd-tile__hint${priceError ? " is-err" : ""}`} id="ps-price-hint">{priceError || "Press Enter to save"}</small></div><div className="prd-tile"><span className="label">Unit cost</span><b className="prd-tile__v">{money(selectedProduct.cost)}</b><small className="prd-tile__hint">From supplier</small></div><div className="prd-tile"><span className="label">Margin</span><b className="prd-tile__v">{(margin(selectedProduct) * 100).toFixed(1)}%</b><small className="prd-tile__hint">{money(selectedProduct.price - selectedProduct.cost)} per unit</small></div></section>
            <section className="prd-sh__block" aria-labelledby="ps-stock-h"><div className="prd-sh__bhead"><h3 id="ps-stock-h">Stock</h3><span className={`pill pill--${stockState(selectedProduct) === "ok" ? "mint" : stockState(selectedProduct) === "low" ? "amber" : "coral"}`}>{stockLabel(selectedProduct)}</span></div><div className="prd-sh__stock"><div><b className="prd-sh__big">{number(selectedProduct.stock)}</b><span className="prd-sh__unit">units on hand</span></div><div className="prd-step" role="group" aria-label="Adjust stock"><button className="icon-btn" type="button" aria-label="Remove one unit" onClick={() => { if (selectedProduct.stock > 0) updateProduct(selectedProduct.id, (product) => ({ ...product, stock: product.stock - 1 })); }}><span aria-hidden="true">−</span></button><span className="prd-step__n" aria-live="polite">{number(selectedProduct.stock)}</span><button className="icon-btn" type="button" aria-label="Add one unit" onClick={() => updateProduct(selectedProduct.id, (product) => ({ ...product, stock: product.stock + 1 }))}><Icon name="plus" /></button></div></div>{stockMeter(selectedProduct, "prd-meter--lg")}<div className="prd-sh__stockfoot"><span className="prd-sh__cover"><span>{coverDescription(selectedProduct)}</span><small>Reorder point {number(selectedProduct.reorderAt)} units</small></span><button className="btn btn--sm" type="button" onClick={() => { const qty = restockAmount(selectedProduct); updateProduct(selectedProduct.id, (product) => ({ ...product, stock: product.stock + qty })); announce(`Restocked ${selectedProduct.name}: +${number(qty)} units`); }}><Icon name="truck" />Restock +{number(restockAmount(selectedProduct))}</button></div></section>
            <section className="prd-sh__block" aria-labelledby="ps-sales-h"><div className="prd-sh__bhead"><h3 id="ps-sales-h">Sales, last 30 days</h3><span className="prd-sh__total"><b>{number(selectedProduct.sold30)}</b> units, {money(selectedProduct.sold30 * selectedProduct.price, 0)}</span></div>
              {selectedProduct.sold30 > 0 ? <SalesSparkline product={selectedProduct} activeIndex={chartIndex} onIndex={setChartIndex} /> : <p className="card__sub">Sales history will appear after this product has sold.</p>}
            </section>
            <section className="prd-sh__block" aria-labelledby="ps-status-h"><div className="prd-sh__bhead"><h3 id="ps-status-h">Product status</h3></div><label className="sr-only" htmlFor="ps-status">Product status</label><select className="select" id="ps-status" value={selectedProduct.status} onChange={(event) => { const nextStatus = event.target.value as ProductStatus; updateProduct(selectedProduct.id, (product) => ({ ...product, status: nextStatus })); announce(`${selectedProduct.name} ${nextStatus === "active" ? "is on sale" : nextStatus === "draft" ? "moved to drafts" : "archived"}`); }}><option value="active">Active, on sale online and in shops</option><option value="draft">Draft, hidden from customers</option><option value="archived">Archived, no longer sold</option></select></section>
          </div></div><footer className="sheet__foot"><button className="btn btn--dark" type="button" onClick={closeDetails}>Done</button></footer>
        </div>}
      </dialog>
      {notice && <div className="toasts" aria-live="polite"><div className="toast" role="status"><span className="toast__ico"><Icon name="check" /></span><span>{notice}</span></div></div>}
    </div>
  );
}

function SalesSparkline({ product, activeIndex, onIndex }: { product: ProductRecord; activeIndex: number | null; onIndex: (index: number | null) => void }) {
  const values = useMemo(() => makeSalesSeries(product), [product.id, product.sold30]);
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => ({ x: (index / (values.length - 1)) * 600, y: 94 - (value / max) * 76, value }));
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L600,104 L0,104 Z`;
  const selected = activeIndex === null ? null : points[activeIndex];
  return <div className="prd-spark" data-spark onPointerLeave={() => onIndex(null)} onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onIndex(Math.max(0, Math.min(29, Math.round((event.clientX - rect.left) / rect.width * 29)))); }}>
    <svg viewBox="0 0 600 110" preserveAspectRatio="none" aria-label="Daily product sales over the last 30 days" role="img"><defs><linearGradient id="ps-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--primary)", stopOpacity: 0.22 }} /><stop offset="1" style={{ stopColor: "var(--primary)", stopOpacity: 0 }} /></linearGradient></defs><path className="prd-spark__area" d={area} /><path className="prd-spark__line" d={line} />{selected && <><line x1={selected.x} x2={selected.x} y1="0" y2="104" stroke="var(--line-2)" /><circle cx={selected.x} cy={selected.y} r="5" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.5" /></>}</svg>
    {selected && <span className="prd-spark__tip" style={{ left: `${selected.x / 6}%` }}>{selected.value} sold · day {activeIndex! + 1}</span>}
    <div className="prd-spark__axis"><span>30 days ago</span><span>Today</span></div>
  </div>;
}
