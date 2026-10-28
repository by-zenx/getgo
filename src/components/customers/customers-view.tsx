"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type CSSProperties } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Icon } from "@/components/icons/svg-sprite";
import { CUSTOMER_SEGMENTS, CUSTOMER_STORAGE_KEY, CUSTOMER_TAGS, createCustomerSpendSeries, createInitialCustomers, customerLifetimeValue, customerOrderTotal, customerPaidOrders, type CustomerRecord, type CustomerTagKey } from "@/data/customers-data";
import { createInitialOrders, type OrderRecord } from "@/data/orders-data";
import { createInitialMessageThreads } from "@/data/messages-data";

const ORDER_STORAGE_KEY = "corbel:orders";
const THREAD_STORAGE_KEY = "corbel:messages:threads";
const NOW = Date.UTC(2026, 9, 26, 12);
const DAY = 24 * 60 * 60 * 1000;
type SortKey = "spend" | "orders" | "last" | "name" | "joined";

function readCustomers(raw: string): CustomerRecord[] | null {
  try {
    const parsed = JSON.parse(raw) as CustomerRecord[];
    return Array.isArray(parsed) && parsed.every((customer) => typeof customer.id === "string" && typeof customer.name === "string" && Array.isArray(customer.tags)) ? parsed : null;
  } catch { return null; }
}
function formatCurrency(value: number, decimals = false) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 }).format(value); }
function number(value: number) { return Math.round(value).toLocaleString("en-US"); }
function initials(name: string) { return name.replace(/&/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join(""); }
function customerLabel(name: string) { return /^(the\s|&|\b(cafe|room|studio|co\.?|shop|store|ltd|inc)\b)/i.test(name) ? name : name.split(" ")[0] ?? name; }
function dateLabel(value: number, full = false) {
  return new Intl.DateTimeFormat("en-US", { month: full ? "long" : "short", day: "numeric", year: full ? "numeric" : undefined, timeZone: "UTC" }).format(value);
}
function relativeDate(value: number) {
  const days = Math.max(0, Math.floor((NOW - value) / DAY));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return dateLabel(value);
}
function statusPill(status: OrderRecord["status"]) {
  const tone: Record<OrderRecord["status"], string> = { pending: "amber", paid: "blue", packed: "sea", shipped: "blue", delivered: "mint", refunded: "gray", cancelled: "coral" };
  const label: Record<OrderRecord["status"], string> = { pending: "Pending", paid: "Paid", packed: "Packed", shipped: "Shipped", delivered: "Delivered", refunded: "Refunded", cancelled: "Cancelled" };
  return <span className={`pill pill--${tone[status]}`}>{label[status]}</span>;
}

function AnimatedStat({ label, value, format, meta }: { label: string; value: number; format?: "currency" | "percent"; meta: string }) {
  const valueRef = useRef<HTMLElement>(null);
  useGSAP(() => {
    const element = valueRef.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const counter = { value: 0 };
    const render = () => { element.textContent = format === "currency" ? formatCurrency(counter.value) : format === "percent" ? `${counter.value.toFixed(0)}%` : number(counter.value); };
    if (reduced) { counter.value = value; render(); return; }
    gsap.to(counter, { value, duration: 0.95, delay: 0.12, ease: "power2.out", onUpdate: render });
  }, { dependencies: [value, format], scope: valueRef });
  return <div className="stat"><span className="stat__label">{label}</span><b ref={valueRef} className="stat__val">{format === "currency" ? formatCurrency(value) : format === "percent" ? `${Math.round(value)}%` : number(value)}</b><span className="stat__meta">{meta}</span></div>;
}

export function CustomersView({ customerId }: { customerId?: string }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const addDialogRef = useRef<HTMLDialogElement>(null);
  const [customers, setCustomers] = useState<CustomerRecord[]>(createInitialCustomers);
  const customersRef = useRef(customers);
  const [orders, setOrders] = useState<OrderRecord[]>(createInitialOrders);
  const [threads, setThreads] = useState(createInitialMessageThreads);
  const [segment, setSegment] = useState<"all" | CustomerTagKey>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("spend");
  const [ascending, setAscending] = useState(false);
  const [sortSelect, setSortSelect] = useState("spend-desc");
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [profileNote, setProfileNote] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [formError, setFormError] = useState("");
  const [formTags, setFormTags] = useState<CustomerTagKey[]>(["new"]);
  const [storageReady, setStorageReady] = useState(false);

  const activeSegment = CUSTOMER_SEGMENTS.find((item) => item.key === segment) ?? CUSTOMER_SEGMENTS[0];
  const customer = customers.find((item) => item.id === customerId) ?? null;
  const filteredCustomers = useMemo(() => {
    const search = query.trim().toLowerCase();
    const rows = customers.filter((item) => (segment === "all" || item.tags.includes(segment)) && (!search || `${item.name} ${item.email} ${item.city}`.toLowerCase().includes(search)));
    const value = (item: CustomerRecord) => {
      const customerOrders = orders.filter((order) => order.customerId === item.id).sort((a, b) => b.placed - a.placed);
      if (sort === "name") return item.name.toLowerCase();
      if (sort === "joined") return item.joined;
      if (sort === "orders") return customerOrders.length;
      if (sort === "last") return customerOrders[0]?.placed ?? 0;
      return customerLifetimeValue(item.id, orders);
    };
    return rows.sort((a, b) => {
      const av = value(a); const bv = value(b);
      const compared = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return (ascending ? 1 : -1) * compared || a.name.localeCompare(b.name);
    });
  }, [customers, orders, segment, query, sort, ascending]);

  useEffect(() => { customersRef.current = customers; }, [customers]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (saved) {
        const parsed = readCustomers(saved);
        // Restore saved records in the existing mount effect to preserve startup behavior.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed) { setCustomers(parsed); customersRef.current = parsed; }
      } else localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(createInitialCustomers()));
      const savedOrders = localStorage.getItem(ORDER_STORAGE_KEY);
      if (savedOrders) setOrders(JSON.parse(savedOrders) as OrderRecord[]);
      const savedThreads = localStorage.getItem(THREAD_STORAGE_KEY);
      if (savedThreads) {
        const parsed = JSON.parse(savedThreads) as typeof threads;
        if (Array.isArray(parsed)) setThreads(parsed);
      }
    } catch { /* Keep the starter records available if browser storage is unavailable. */ }
    finally { setStorageReady(true); }
  }, []);
  useEffect(() => {
    if (!customer) return;
    // Keep the profile draft synchronized with the selected customer as before.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfileNote(customer.note);
    setNoteDraft(customer.note);
  }, [customer?.id, customer?.note]);
  useEffect(() => {
    const dialog = addDialogRef.current;
    if (!dialog) return;
    if (addOpen && !dialog.open) {
      dialog.showModal();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(dialog.querySelector(".modal__box"), { opacity: 0, y: 14, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power3.out" });
    } else if (!addOpen && dialog.open) dialog.close();
  }, [addOpen]);

  useGSAP(() => {
    if (!storageReady) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!customerId) {
      gsap.fromTo(".cus-stats .stat", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.42, stagger: 0.055, delay: 0.1, ease: "power3.out" });
      const rows = rootRef.current?.querySelectorAll<HTMLElement>(".cus-table tbody tr[data-id]");
      if (rows?.length) gsap.fromTo(rows, { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.32, stagger: 0.018, delay: 0.1, ease: "power2.out", clearProps: "transform,opacity" });
    } else {
      const bars = rootRef.current?.querySelectorAll<HTMLElement>(".cus-chart__bar");
      if (bars?.length) gsap.fromTo(bars, { scaleY: 0, transformOrigin: "bottom" }, { scaleY: 1, duration: 0.7, stagger: 0.035, delay: 0.15, ease: "power3.out", clearProps: "transform" });
    }
  }, { dependencies: [customerId, segment, query, sortSelect, storageReady], scope: rootRef });

  const persist = (next: CustomerRecord[]) => {
    customersRef.current = next;
    setCustomers(next);
    try { localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(next)); } catch { /* Keep changes for this visit. */ }
  };
  const announce = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2800); };
  const changeSort = (nextValue: string) => {
    const [nextSort, direction] = nextValue.split("-") as [SortKey, "asc" | "desc"];
    setSort(nextSort); setAscending(direction === "asc"); setSortSelect(nextValue);
  };
  const toggleTag = (record: CustomerRecord, tag: CustomerTagKey) => {
    const contains = record.tags.includes(tag);
    const next = customersRef.current.map((item) => item.id === record.id ? { ...item, tags: contains ? item.tags.filter((key) => key !== tag) : [...item.tags, tag].sort((a, b) => CUSTOMER_TAGS.findIndex((entry) => entry.key === a) - CUSTOMER_TAGS.findIndex((entry) => entry.key === b)) } : item);
    persist(next);
    announce(`${CUSTOMER_TAGS.find((item) => item.key === tag)?.label} ${contains ? "removed from" : "added to"} ${record.name}`);
  };
  const exportCsv = (records = filteredCustomers) => {
    const esc = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [["Name", "Email", "Phone", "City", "Channel", "Orders", "Lifetime spend", "Last order", "Customer since", "Tags"]];
    records.forEach((record) => {
      const customerOrders = orders.filter((order) => order.customerId === record.id).sort((a, b) => b.placed - a.placed);
      rows.push([record.name, record.email, record.phone, record.city, record.channel === "online" ? "Online" : "In store", String(customerOrders.length), customerLifetimeValue(record.id, orders).toFixed(2), customerOrders[0] ? new Date(customerOrders[0].placed).toISOString().slice(0, 10) : "", new Date(record.joined).toISOString().slice(0, 10), record.tags.map((tag) => CUSTOMER_TAGS.find((item) => item.key === tag)?.label).filter(Boolean).join("; ")]);
    });
    const url = URL.createObjectURL(new Blob([rows.map((row) => row.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `corbel-customers-${segment}.csv`; anchor.click(); URL.revokeObjectURL(url);
    announce(`Exported ${records.length} customer${records.length === 1 ? "" : "s"}`);
  };
  const addCustomer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) { setFormError("Enter a name and a valid email address."); return; }
    if (customersRef.current.some((item) => item.email.toLowerCase() === email)) { setFormError("A customer with this email already exists."); return; }
    const ids = customersRef.current.map((item) => Number(item.id.replace(/^c/, ""))).filter(Number.isFinite);
    const id = `c${Math.max(0, ...ids) + 1}`;
    // This timestamp and color are generated only when the user creates a customer.
    // eslint-disable-next-line react-hooks/purity
    const customer: CustomerRecord = { id, name, email, phone: String(form.get("phone") ?? "").trim(), city: String(form.get("city") ?? "").trim() || "—", channel: String(form.get("channel")) === "store" ? "store" : "online", joined: Date.now(), tags: [...formTags], hue: 170 + ((ids.length * 37) % 180), note: "" };
    persist([customer, ...customersRef.current]);
    setAddOpen(false); setFormError(""); setFormTags(["new"]); setSegment("all"); setQuery("");
    router.push(`/customers/${id}`);
  };
  const saveNote = () => {
    if (!customer || noteDraft === profileNote) return;
    const clean = noteDraft.trim();
    persist(customersRef.current.map((item) => item.id === customer.id ? { ...item, note: clean } : item));
    setProfileNote(clean); setNoteDraft(clean); announce(`Note saved for ${customer.name}`);
  };
  const copyEmail = async () => {
    if (!customer) return;
    try { await navigator.clipboard.writeText(customer.email); announce(`Copied ${customer.email}`); }
    catch { announce("Could not reach the clipboard. Select the email to copy it."); }
  };

  if (customerId && !customer && !storageReady) return <div data-view="customers" className="view cus-prof" aria-busy="true"><div className="card empty"><Icon name="clock" /><span>Loading customer…</span></div></div>;
  if (customerId && !customer) return <div data-view="customers" className="view cus-prof"><div className="card empty"><Icon name="users" /><b>Customer not found</b><span>This customer may have been removed.</span><Link className="btn" href="/customers">All customers</Link></div></div>;

  if (customer) {
    const allCustomerOrders = orders.filter((order) => order.customerId === customer.id).sort((a, b) => b.placed - a.placed);
    const paidOrders = customerPaidOrders(customer.id, orders);
    const lifetimeValue = customerLifetimeValue(customer.id, orders);
    const averageOrder = paidOrders.length ? lifetimeValue / paidOrders.length : 0;
    const lastOrder = allCustomerOrders[0];
    const spendSeries = createCustomerSpendSeries(customer, orders);
    const peak = Math.max(1, ...spendSeries.map((month) => month.value));
    const gridPeak = Math.ceil(peak / (peak > 2000 ? 1000 : peak > 800 ? 500 : peak > 300 ? 200 : peak > 120 ? 100 : 50)) * (peak > 2000 ? 1000 : peak > 800 ? 500 : peak > 300 ? 200 : peak > 120 ? 100 : 50);
    const relatedThreads = threads.filter((thread) => thread.customerId === customer.id).sort((a, b) => (b.msgs.at(-1)?.at ?? 0) - (a.msgs.at(-1)?.at ?? 0));
    const changeTag = (tag: CustomerTagKey) => toggleTag(customer, tag);
    return <div ref={rootRef} data-view="customers" className="view cus-prof">
      <div className="toolbar cus-pbar"><Link className="cus-back" href="/customers"><Icon name="chev" className="cus-back__ico" />All customers</Link><div className="toolbar__end"><button className="btn" type="button" onClick={copyEmail}><Icon name="copy" />Copy email</button><Link className="btn btn--primary" href="/messages"><Icon name="chat" />Send message</Link></div></div>
      <section className="card cus-hero" aria-labelledby="cus-name"><div className="cus-hero__id"><span className="av av--lg" style={{ "--h": customer.hue } as CSSProperties}>{initials(customer.name)}</span><div className="cus-hero__txt"><h2 className="cus-hero__name" id="cus-name">{customer.name}</h2><ul className="cus-hero__contact" aria-label="Contact"><li><a href={`mailto:${customer.email}`}>{customer.email}</a></li>{customer.phone && <li><a href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`}>{customer.phone}</a></li>}<li>{customer.city}</li></ul></div></div><div className="cus-hero__ltv"><span className="stat__label">Lifetime value</span><b className="cus-hero__val">{formatCurrency(lifetimeValue)}</b><span className="stat__meta">Across {number(allCustomerOrders.length)} order{allCustomerOrders.length === 1 ? "" : "s"}</span></div></section>
      <section className="card statbar cus-tiles" style={{ "--n": 3 } as CSSProperties} aria-label="Order figures"><AnimatedStat label="Orders" value={allCustomerOrders.length} meta={`${allCustomerOrders.filter((order) => order.placed > NOW - 30 * DAY).length} in the last 30 days`} /><AnimatedStat label="Average order" value={averageOrder} format="currency" meta="All time, after refunds" /><div className="stat"><span className="stat__label">Last order</span><b className="stat__val">{lastOrder ? relativeDate(lastOrder.placed) : "None yet"}</b><span className="stat__meta">{lastOrder ? <><span className="mono">{lastOrder.id}</span> for {formatCurrency(customerOrderTotal(lastOrder))}</> : "Waiting for a first order"}</span></div></section>
      <div className="cus-pgrid"><div className="cus-col">
        <section className="card" aria-labelledby="cus-chart-t"><div className="card__head"><h3 className="card__title" id="cus-chart-t">Monthly spend</h3><span className="card__actions card__sub cus-chart__read" aria-hidden="true">Last 12 months</span></div><div className="cus-chart" role="img" aria-label={`Spend by month, last 12 months: ${spendSeries.map((item) => `${item.month} ${formatCurrency(item.value)}`).join(", ")}`}><div className="cus-chart__grid" aria-hidden="true"><span data-v={formatCurrency(gridPeak)} /><span data-v={formatCurrency(gridPeak / 2)} /><span data-v="$0" /></div>{lifetimeValue <= 0 && <p className="cus-chart__none">No spend in the last 12 months yet</p>}<div className="cus-chart__bars">{spendSeries.map((item) => <div key={item.month} className={`cus-chart__col${item.current ? " is-cur" : ""}`} title={`${item.month}: ${formatCurrency(item.value)}`}><span className="cus-chart__bar" style={{ height: `${Math.max(0, item.value / gridPeak * 100).toFixed(2)}%` }} /><span className="cus-chart__m">{item.month}</span></div>)}</div></div></section>
        <section className="card" aria-labelledby="cus-orders-t"><div className="card__head"><h3 className="card__title" id="cus-orders-t">Order history</h3>{allCustomerOrders.length > 0 && <span className="card__actions card__sub">{number(allCustomerOrders.length)} recent</span>}</div>{allCustomerOrders.length ? <ul className="cus-orders">{allCustomerOrders.slice(0, 6).map((order) => <li key={order.id}><Link className="cus-ord" href={`/orders#/orders/${order.id.replace(/^#/, "")}`}><span className="cus-ord__id mono">{order.id}</span><span className="cus-ord__when">{relativeDate(order.placed)}</span><span className="cus-ord__items">{order.lines.reduce((sum, line) => sum + line.qty, 0)} item{order.lines.reduce((sum, line) => sum + line.qty, 0) === 1 ? "" : "s"} {order.channel === "store" ? "in store" : "online"}</span>{statusPill(order.status)}<b className="cus-ord__total">{formatCurrency(customerOrderTotal(order))}</b><Icon name="chev" className="cus-ord__go" /></Link></li>)}</ul> : <div className="empty"><Icon name="cart" /><b>No orders yet</b><span>Orders from this customer will show up here.</span></div>}{allCustomerOrders.length > 6 && <p className="cus-earlier">Plus {number(allCustomerOrders.length - 6)} earlier order{allCustomerOrders.length - 6 === 1 ? "" : "s"}.</p>}</section>
      </div><div className="cus-col">
        <section className="card" aria-labelledby="cus-about-t"><div className="card__head"><h3 className="card__title" id="cus-about-t">About</h3></div><dl className="cus-facts"><div><dt>Customer since</dt><dd>{dateLabel(customer.joined, true)}</dd></div><div><dt>Shops with us</dt><dd>{customer.channel === "online" ? "Online" : "In store"}</dd></div></dl><div className="cus-tagset"><p className="cus-tagset__h" id="cus-tags-l">Tags</p><div className="chips cus-hero__tags" role="group" aria-labelledby="cus-tags-l">{CUSTOMER_TAGS.map((tag) => <button key={tag.key} className="chip cus-tagchip" type="button" data-tag={tag.key} aria-pressed={customer.tags.includes(tag.key)} onClick={() => changeTag(tag.key)}><Icon name={customer.tags.includes(tag.key) ? "check" : "plus"} />{tag.label}</button>)}</div></div></section>
        <section className="card" aria-labelledby="cus-note-t"><div className="card__head"><h3 className="card__title" id="cus-note-t">Notes</h3><span className="card__actions card__sub">Only your team sees these</span></div><label className="sr-only" htmlFor="cus-note">Notes about {customer.name}</label><textarea className="textarea cus-note" id="cus-note" placeholder="Sizes, preferences, anything worth remembering" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} /><div className="cus-note__foot"><span className="card__sub">{noteDraft !== profileNote ? "Unsaved changes" : profileNote ? "Saved" : "No notes yet"}</span><button className="btn btn--sm cus-save" type="button" disabled={noteDraft === profileNote} onClick={saveNote}>Save note</button></div></section>
        <section className="card" aria-labelledby="cus-conv-t"><div className="card__head"><h3 className="card__title" id="cus-conv-t">Conversations</h3></div>{relatedThreads.length ? <ul className="cus-threads">{relatedThreads.map((thread) => { const last = thread.msgs.at(-1); return <li key={thread.id}><Link className="cus-thread" href={`/messages?thread=${thread.id}`}><span className="cus-thread__ico"><Icon name={thread.channel === "chat" ? "chat" : "mail"} /></span><span className="cus-thread__txt"><b>{thread.subject}</b><small>{last ? `${last.from === "me" ? "You: " : ""}${last.text}` : "No messages yet"}</small></span><span className="cus-thread__meta">{last ? relativeDate(last.at) : ""}{thread.unread && <i className="dot" aria-label="Unread" />}</span></Link></li>; })}</ul> : <div className="empty"><Icon name="chat" /><b>No conversations yet</b><span>Messages from this customer will show up here.</span></div>}</section>
      </div></div>
      {toast && <div className="toasts" aria-live="polite"><div className="toast" role="status"><span className="toast__ico"><Icon name="check" /></span><span>{toast}</span></div></div>}
    </div>;
  }

  const segmentCustomers = customers.filter((item) => segment === "all" || item.tags.includes(segment));
  const newThisMonth = segmentCustomers.filter((item) => item.joined >= Date.UTC(2026, 9, 1));
  const repeatCount = segmentCustomers.filter((item) => orders.filter((order) => order.customerId === item.id).length >= 2).length;
  const segmentLtv = segmentCustomers.reduce((sum, item) => sum + customerLifetimeValue(item.id, orders), 0);
  const onlineCount = segmentCustomers.filter((item) => item.channel === "online").length;
  const upToDate = filteredCustomers.length === segmentCustomers.length;
  return <div ref={rootRef} data-view="customers" className="view cus-list">
    <div className="toolbar cus-bar"><div className="chips cus-segs" role="group" aria-label="Customer segment">{CUSTOMER_SEGMENTS.map((item) => <button key={item.key} className="chip" type="button" data-seg={item.key} aria-pressed={segment === item.key} onClick={() => setSegment(item.key)}>{item.label}<span className="cus-chip-n">{customers.filter((customerItem) => item.key === "all" || customerItem.tags.includes(item.key)).length}</span></button>)}</div><div className="toolbar__end"><button className="btn" type="button" onClick={() => exportCsv()}><Icon name="download" />Export</button><button className="btn btn--primary" type="button" onClick={() => { setFormError(""); setFormTags(["new"]); setAddOpen(true); }}><Icon name="plus" />Add customer</button></div></div>
    <section className="card statbar cus-stats" style={{ "--n": 4 } as CSSProperties} aria-label="Segment figures"><AnimatedStat label="Customers" value={segmentCustomers.length} meta={`${number(onlineCount)} online, ${number(segmentCustomers.length - onlineCount)} in store`} /><AnimatedStat label="New this month" value={newThisMonth.length} meta="Joined since Oct 1" /><AnimatedStat label="Repeat rate" value={segmentCustomers.length ? repeatCount / segmentCustomers.length * 100 : 0} format="percent" meta="Ordered more than once" /><AnimatedStat label="Average lifetime value" value={segmentCustomers.length ? segmentLtv / segmentCustomers.length : 0} format="currency" meta={`${formatCurrency(segmentLtv)} spent in total`} /></section>
    <section className="card cus-tablecard" aria-labelledby="cus-table-title"><div className="card__head cus-tablehead"><h2 className="card__title" id="cus-table-title"><span>{activeSegment.title}</span><span className="cus-showing" aria-live="polite">{upToDate ? filteredCustomers.length : `${filteredCustomers.length} of ${segmentCustomers.length}`}</span></h2><div className="card__actions"><label className="input-icon cus-search"><span className="sr-only">Search customers</span><Icon name="search" /><input className="input" type="search" placeholder="Name, email or city" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="cus-sort"><span className="sr-only">Sort customers</span><select className="select" value={sortSelect} onChange={(event) => changeSort(event.target.value)}><option value="spend-desc">Highest spend</option><option value="spend-asc">Lowest spend</option><option value="orders-desc">Most orders</option><option value="orders-asc">Fewest orders</option><option value="last-desc">Ordered most recently</option><option value="last-asc">Ordered longest ago</option><option value="joined-desc">Newest customers</option><option value="joined-asc">Longest with us</option><option value="name-asc">Name, A to Z</option><option value="name-desc">Name, Z to A</option></select></label></div></div><div className="table-wrap"><table className="table cus-table"><thead><tr><th scope="col" aria-sort={sort === "name" ? ascending ? "ascending" : "descending" : undefined}><button className="sort" type="button" onClick={() => changeSort(`name-${sort === "name" && !ascending ? "asc" : "desc"}`)}>Customer<Icon name="arrow-up" className="cus-sort-ico" /></button></th><th scope="col">City</th><th scope="col">Channel</th><th scope="col" className="num" aria-sort={sort === "orders" ? ascending ? "ascending" : "descending" : undefined}><button className="sort" type="button" onClick={() => changeSort(`orders-${sort === "orders" && !ascending ? "asc" : "desc"}`)}>Orders<Icon name="arrow-up" className="cus-sort-ico" /></button></th><th scope="col" className="num" aria-sort={sort === "spend" ? ascending ? "ascending" : "descending" : undefined}><button className="sort" type="button" onClick={() => changeSort(`spend-${sort === "spend" && !ascending ? "asc" : "desc"}`)}><span className="cus-long">Lifetime spend</span><span className="cus-short">Spend</span><Icon name="arrow-up" className="cus-sort-ico" /></button></th><th scope="col" aria-sort={sort === "last" ? ascending ? "ascending" : "descending" : undefined}><button className="sort" type="button" onClick={() => changeSort(`last-${sort === "last" && !ascending ? "asc" : "desc"}`)}>Last order<Icon name="arrow-up" className="cus-sort-ico" /></button></th><th scope="col">Tags</th></tr></thead><tbody>{filteredCustomers.length ? filteredCustomers.map((item) => {
      const itemOrders = orders.filter((order) => order.customerId === item.id).sort((a, b) => b.placed - a.placed);
      return <tr key={item.id} data-id={item.id} onClick={(event) => { if (!(event.target as HTMLElement).closest("a")) router.push(`/customers/${item.id}`); }}><td><div className="cell-main"><span className="av" style={{ "--h": item.hue } as CSSProperties}>{initials(item.name)}</span><span className="cus-who"><Link className="cus-link" href={`/customers/${item.id}`}><b>{item.name}</b></Link><small>{item.email}</small></span></div></td><td>{item.city}</td><td><span className="cus-chan"><Icon name={item.channel === "online" ? "globe" : "store"} />{item.channel === "online" ? "Online" : "In store"}</span></td><td className="num">{number(itemOrders.length)}</td><td className="num"><b className="cus-spend">{formatCurrency(customerLifetimeValue(item.id, orders), true)}</b></td><td>{itemOrders[0] ? <span title={dateLabel(itemOrders[0].placed, true)}>{relativeDate(itemOrders[0].placed)}</span> : <span className="cus-none">No orders yet</span>}</td><td><div className="cus-tags">{item.tags.length ? item.tags.map((tag) => <span key={tag} className="cus-tag">{CUSTOMER_TAGS.find((entry) => entry.key === tag)?.label}</span>) : <span className="cus-none">None</span>}</div></td></tr>;
    }) : <tr className="cus-empty"><td colSpan={7}><div className="empty"><Icon name="users" /><b>No customers match</b><span>{query.trim() ? `Nothing for “${query.trim()}” in this segment.` : "No one is in this segment yet."}</span></div></td></tr>}</tbody></table></div></section>
    <dialog ref={addDialogRef} className="modal" aria-label="Add customer" onCancel={() => setAddOpen(false)} onClose={() => setAddOpen(false)} onClick={(event) => { if (event.target === addDialogRef.current) setAddOpen(false); }}><form className="modal__box" onSubmit={addCustomer} noValidate><header className="modal__head"><h2 className="modal__title">Add customer</h2><button className="icon-btn" type="button" aria-label="Close" onClick={() => setAddOpen(false)}><Icon name="x" /></button></header><div className="modal__body"><div className="cus-form"><div className="field"><label className="label" htmlFor="cus-f-name">Full name or business</label><input className="input" id="cus-f-name" name="name" autoComplete="off" required placeholder="For example, Nora Quinn" /></div><div className="cus-form__two"><div className="field"><label className="label" htmlFor="cus-f-email">Email</label><input className="input" id="cus-f-email" name="email" type="email" autoComplete="off" required placeholder="nora@example.com" /></div><div className="field"><label className="label" htmlFor="cus-f-phone">Phone</label><input className="input" id="cus-f-phone" name="phone" type="tel" autoComplete="off" placeholder="(555) 010-0000" /></div></div><div className="cus-form__two"><div className="field"><label className="label" htmlFor="cus-f-city">City</label><input className="input" id="cus-f-city" name="city" autoComplete="off" placeholder="Portland, OR" /></div><div className="field"><label className="label" htmlFor="cus-f-chan">Shops with us</label><select className="select" id="cus-f-chan" name="channel"><option value="online">Online</option><option value="store">In store</option></select></div></div><fieldset className="field cus-form__tags"><legend className="label">Tags</legend><div className="chips">{CUSTOMER_TAGS.map((tag) => <button key={tag.key} className="chip cus-tagchip" type="button" aria-pressed={formTags.includes(tag.key)} onClick={() => setFormTags((current) => current.includes(tag.key) ? current.filter((key) => key !== tag.key) : [...current, tag.key])}><Icon name={formTags.includes(tag.key) ? "check" : "plus"} />{tag.label}</button>)}</div></fieldset>{formError && <p className="cus-form__err" role="alert">{formError}</p>}</div></div><footer className="modal__foot"><button className="btn" type="button" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn btn--primary" type="submit"><Icon name="plus" />Add customer</button></footer></form></dialog>
    {toast && <div className="toasts" aria-live="polite"><div className="toast" role="status"><span className="toast__ico"><Icon name="check" /></span><span>{toast}</span></div></div>}
  </div>;
}
