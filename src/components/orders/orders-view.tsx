"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Icon } from "@/components/icons/svg-sprite";
import { moveSegmentPill } from "@/lib/segment-motion";
import {
  createInitialOrders,
  ORDER_CUSTOMERS,
  type OrderChannel,
  type OrderRecord,
  type OrderStatus,
} from "@/data/orders-data";

type StatusFilter = "all" | OrderStatus | "closed";
type SortKey = "placed" | "total";
type ConfirmAction = "cancel" | "refund" | null;

const ORDER_KEY = "corbel:orders";
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  refunded: "Refunded",
  cancelled: "Cancelled",
};
const STATUS_TONES: Record<OrderStatus, string> = {
  pending: "amber",
  paid: "blue",
  packed: "sea",
  shipped: "blue",
  delivered: "mint",
  refunded: "gray",
  cancelled: "coral",
};
const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "closed", label: "Closed" },
];
const STATUS_STEPS: OrderStatus[] = ["pending", "paid", "packed", "shipped", "delivered"];
const CHANNELS: { value: "all" | OrderChannel; label: string }[] = [
  { value: "all", label: "All channels" },
  { value: "online", label: "Online" },
  { value: "store", label: "In store" },
];

function totalItems(order: OrderRecord) {
  return order.lines.reduce((sum, line) => sum + line.qty, 0);
}

function subtotal(order: OrderRecord) {
  return order.lines.reduce((sum, line) => sum + line.qty * line.price, 0);
}

function total(order: OrderRecord) {
  return subtotal(order) + order.shipping;
}

function formatCurrency(value: number, fractions = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractions,
    maximumFractionDigits: fractions,
  }).format(value);
}

function formatPlaced(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(timestamp);
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function customerFor(order: OrderRecord) {
  return ORDER_CUSTOMERS.find((customer) => customer.id === order.customerId);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function isClosed(status: OrderStatus) {
  return status === "refunded" || status === "cancelled";
}

function progressIndex(status: OrderStatus) {
  if (isClosed(status)) return STATUS_STEPS.indexOf("delivered");
  return STATUS_STEPS.indexOf(status);
}

function statusPill(status: OrderStatus) {
  return <span className={`pill pill--${STATUS_TONES[status]}`}>{STATUS_LABELS[status]}</span>;
}

function advanceOrder(order: OrderRecord, target: OrderStatus): OrderRecord {
  const currentIndex = STATUS_STEPS.indexOf(order.status);
  const targetIndex = STATUS_STEPS.indexOf(target);
  if (currentIndex < 0 || targetIndex <= currentIndex || isClosed(order.status)) return order;
  const now = Date.now();
  const history = [...order.history];
  for (let index = currentIndex + 1; index <= targetIndex; index += 1) {
    history.push({ status: STATUS_STEPS[index], at: now, by: "Mara Reyes" });
  }
  return { ...order, status: target, history };
}

function emptyState(query: string) {
  return (
    <div className="empty">
      <Icon name="cart" />
      <b>{query ? "No orders match your search" : "No orders here"}</b>
      <span>{query ? "Try another order number or customer name." : "Orders in this state will show up here."}</span>
    </div>
  );
}

export function OrdersView() {
  const rootRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabsPillRef = useRef<HTMLSpanElement>(null);
  const tabPillPositionedRef = useRef(false);
  const detailDialogRef = useRef<HTMLDialogElement>(null);
  const actionDialogRef = useRef<HTMLDialogElement>(null);
  const [orders, setOrders] = useState<OrderRecord[]>(createInitialOrders);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<"all" | OrderChannel>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("placed");
  const [sortDirection, setSortDirection] = useState(-1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [notice, setNotice] = useState("");
  const [monthStart, setMonthStart] = useState(Date.UTC(2026, 9, 1));

  const normalizedQuery = query.trim().toLowerCase().replace(/^#/, "");
  const matchingOrders = useMemo(() => orders.filter((order) => {
    const customer = customerFor(order);
    const matchesChannel = channelFilter === "all" || order.channel === channelFilter;
    const matchesQuery = !normalizedQuery || order.id.replace(/^#/, "").toLowerCase().includes(normalizedQuery) || customer?.name.toLowerCase().includes(normalizedQuery);
    return matchesChannel && matchesQuery;
  }), [orders, channelFilter, normalizedQuery]);
  const filteredOrders = useMemo(() => matchingOrders
    .filter((order) => statusFilter === "all" || (statusFilter === "closed" ? isClosed(order.status) : order.status === statusFilter))
    .sort((first, second) => {
      const difference = sortKey === "total" ? total(first) - total(second) : first.placed - second.placed;
      return difference * sortDirection;
    }), [matchingOrders, statusFilter, sortKey, sortDirection]);
  const activeOrder = orders.find((order) => order.id === activeOrderId) ?? null;
  const activeCustomer = activeOrder ? customerFor(activeOrder) : undefined;
  const selectedOrders = orders.filter((order) => selectedIds.includes(order.id));
  const shownIds = filteredOrders.map((order) => order.id);
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selectedIds.includes(id));
  const selectedProgress = selectedOrders.map((order) => STATUS_STEPS.indexOf(order.status));
  const canMarkPacked = selectedProgress.some((progress) => progress >= 1 && progress < STATUS_STEPS.indexOf("packed"));
  const canMarkShipped = selectedProgress.some((progress) => progress >= 1 && progress < STATUS_STEPS.indexOf("shipped"));
  const openOrders = orders.filter((order) => ["pending", "paid", "packed"].includes(order.status));
  const readyToShip = orders.filter((order) => order.status === "paid" || order.status === "packed");
  const liveOrders = orders.filter((order) => !isClosed(order.status));
  const averageOrderValue = liveOrders.length ? liveOrders.reduce((sum, order) => sum + total(order), 0) / liveOrders.length : 0;
  const refundedThisMonth = orders.filter((order) => order.status === "refunded" && order.history.some((item) => item.status === "refunded" && item.at >= monthStart));
  const refundTotal = refundedThisMonth.reduce((sum, order) => sum + total(order), 0);

  useEffect(() => {
    const now = new Date();
    setMonthStart(new Date(now.getFullYear(), now.getMonth(), 1).getTime());
    try {
      const stored = localStorage.getItem(ORDER_KEY);
      if (stored) setOrders(JSON.parse(stored) as OrderRecord[]);
      else setOrders(createInitialOrders(Date.now()));
    } catch {}

    const readHash = () => {
      const match = window.location.hash.match(/^#\/orders\/(\d+)/);
      setActiveOrderId(match ? `#${match[1]}` : null);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  useEffect(() => {
    const visible = new Set(shownIds);
    setSelectedIds((current) => {
      const next = current.filter((id) => visible.has(id));
      return next.length === current.length ? current : next;
    });
  }, [shownIds.join("|")]);

  useGSAP(() => {
    const active = tabsRef.current?.querySelector<HTMLElement>(`[data-value="${statusFilter}"]`);
    if (!active || !tabsPillRef.current) return;
    moveSegmentPill(tabsPillRef.current, active, !tabPillPositionedRef.current);
    tabPillPositionedRef.current = true;
  }, { dependencies: [statusFilter], scope: rootRef });

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows = rootRef.current?.querySelectorAll<HTMLElement>(".ord-table tbody tr");
    if (rows?.length) gsap.fromTo(rows, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.42, ease: "power3.out", stagger: 0.018, clearProps: "transform,opacity" });
  }, { dependencies: [filteredOrders.map((order) => `${order.id}:${order.status}`).join("|")], scope: rootRef });

  useEffect(() => {
    const dialog = detailDialogRef.current;
    if (!dialog) return;
    if (activeOrderId && activeOrder && !dialog.open) {
      dialog.showModal();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(dialog.querySelector(".sheet__box"), { opacity: 0, x: 28 }, { opacity: 1, x: 0, duration: 0.48, ease: "power3.out" });
      }
    } else if ((!activeOrderId || !activeOrder) && dialog.open) dialog.close();
  }, [activeOrderId, activeOrder]);

  useEffect(() => {
    const dialog = actionDialogRef.current;
    if (!dialog) return;
    if (confirmAction && !dialog.open) {
      dialog.showModal();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(dialog.querySelector(".modal__box"), { opacity: 0, y: 18, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.38, ease: "power3.out" });
      }
    } else if (!confirmAction && dialog.open) dialog.close();
  }, [confirmAction]);

  const persistOrders = (next: OrderRecord[]) => {
    setOrders(next);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch {}
  };

  const flashNotice = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3400);
  };

  const openOrder = (id: string) => {
    const normalized = id.startsWith("#") ? id.slice(1) : id;
    window.history.pushState(null, "", `${window.location.pathname}#/orders/${normalized}`);
    setActiveOrderId(`#${normalized}`);
  };

  const closeOrder = () => {
    window.history.replaceState(null, "", `${window.location.pathname}#/orders`);
    setActiveOrderId(null);
  };

  const updateOrder = (id: string, updater: (order: OrderRecord) => OrderRecord) => {
    persistOrders(orders.map((order) => order.id === id ? updater(order) : order));
  };

  const changeStatus = (id: string, status: OrderStatus) => {
    updateOrder(id, (order) => advanceOrder(order, status));
    const order = orders.find((item) => item.id === id);
    if (order) flashNotice(`Order ${order.id} marked as ${STATUS_LABELS[status].toLowerCase()}`);
  };

  const bulkChangeStatus = (target: "packed" | "shipped") => {
    const targetIndex = STATUS_STEPS.indexOf(target);
    const eligibleIds = selectedOrders
      .filter((order) => {
        const index = STATUS_STEPS.indexOf(order.status);
        return index >= 1 && index < targetIndex;
      })
      .map((order) => order.id);
    if (!eligibleIds.length) return;
    const eligible = new Set(eligibleIds);
    persistOrders(orders.map((order) => eligible.has(order.id) ? advanceOrder(order, target) : order));
    setSelectedIds([]);
    flashNotice(`${eligibleIds.length} ${eligibleIds.length === 1 ? "order" : "orders"} marked as ${STATUS_LABELS[target].toLowerCase()}`);
  };

  const confirmOrderAction = () => {
    if (!activeOrder || !confirmAction) return;
    const status: OrderStatus = confirmAction === "refund" ? "refunded" : "cancelled";
    const next = { ...activeOrder, status, history: [...activeOrder.history, { status, at: Date.now(), by: "Mara Reyes" }] };
    persistOrders(orders.map((order) => order.id === activeOrder.id ? next : order));
    setConfirmAction(null);
    flashNotice(confirmAction === "refund" ? `Refunded ${formatCurrency(total(activeOrder))} on ${activeOrder.id}` : `Order ${activeOrder.id} cancelled`);
  };

  const exportCsv = () => {
    if (!filteredOrders.length) {
      flashNotice("Nothing to export with these filters");
      return;
    }
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["Order", "Placed", "Customer", "Email", "Channel", "Items", "Subtotal", "Shipping", "Total", "Payment", "Status"],
      ...filteredOrders.map((order) => {
        const customer = customerFor(order);
        return [order.id, new Date(order.placed).toISOString(), customer?.name ?? "", customer?.email ?? "", order.channel === "online" ? "Online" : "In store", totalItems(order), subtotal(order).toFixed(2), order.shipping.toFixed(2), total(order).toFixed(2), order.payment, STATUS_LABELS[order.status]];
      }),
    ];
    const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
    const now = new Date();
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `corbel-orders-${statusFilter}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    flashNotice(`Exported ${filteredOrders.length} ${filteredOrders.length === 1 ? "order" : "orders"} to CSV`);
  };

  const downloadInvoice = (order: OrderRecord) => {
    const customer = customerFor(order);
    const itemLines = order.lines.map((line) => `${line.name}  ${line.qty} x ${formatCurrency(line.price, 2)}  ${formatCurrency(line.qty * line.price, 2)}`);
    const body = [
      "CORBEL SUPPLY CO.",
      "Homewares · online and at our Main St and Harbor shops",
      "",
      `Invoice ${order.id} · ${formatTimestamp(order.placed)}`,
      "-".repeat(58),
      "Bill to",
      customer?.name ?? "Guest",
      customer?.email ?? "",
      order.address,
      "-".repeat(58),
      ...itemLines,
      "-".repeat(58),
      `Subtotal  ${formatCurrency(subtotal(order), 2)}`,
      `Shipping  ${order.shipping ? formatCurrency(order.shipping, 2) : "Free"}`,
      `Total     ${formatCurrency(total(order), 2)}`,
      "",
      `Paid by ${order.payment} · Status: ${STATUS_LABELS[order.status]}`,
      "",
      "Thank you for shopping with Corbel Supply Co.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `corbel-invoice-${order.id.replace(/^#/, "")}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    flashNotice(`Invoice for ${order.id} downloaded`);
  };

  const handleRowKey = (event: KeyboardEvent<HTMLTableRowElement>, order: OrderRecord) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter") {
      event.preventDefault();
      openOrder(order.id);
    } else if (event.key === " ") {
      event.preventDefault();
      setSelectedIds((current) => current.includes(order.id) ? current.filter((id) => id !== order.id) : [...current, order.id]);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const row = event.key === "ArrowDown" ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling;
      (row as HTMLTableRowElement | null)?.focus();
    }
  };

  const closeConfirm = () => setConfirmAction(null);
  const currentProgress = activeOrder ? progressIndex(activeOrder.status) : -1;
  const nextStatus = activeOrder && !isClosed(activeOrder.status) && currentProgress < STATUS_STEPS.length - 1
    ? STATUS_STEPS[currentProgress + 1]
    : null;

  return (
    <div ref={rootRef} data-view="orders">
      <section className="card statbar ord-stats" style={{ ["--n" as any]: 4 }} aria-label="Order figures">
        <div className="stat ord-stat"><p className="stat__label">Open orders</p><p className="stat__val">{openOrders.length}</p><p className="stat__meta">{openOrders.filter((order) => order.status === "pending").length || "All paid"}</p></div>
        <div className="stat ord-stat"><p className="stat__label">To ship today</p><p className="stat__val">{readyToShip.length}</p><p className="stat__meta">{readyToShip.filter((order) => order.status === "packed").length} packed, {readyToShip.filter((order) => order.status === "paid").length} to pack</p></div>
        <div className="stat ord-stat"><p className="stat__label">Average order value</p><p className="stat__val">{formatCurrency(averageOrderValue)}</p><p className="stat__meta">Across {liveOrders.length} orders</p></div>
        <div className="stat ord-stat"><p className="stat__label">Refunds this month</p><p className="stat__val">{formatCurrency(refundTotal)}</p><p className="stat__meta">{refundedThisMonth.length ? `${refundedThisMonth.length} ${refundedThisMonth.length === 1 ? "refund" : "refunds"} this month` : "No refunds this month"}</p></div>
      </section>

      <div className="ord-bar">
        <div className="ord-tabs-scroll">
          <div ref={tabsRef} className="seg ord-tabs" role="tablist" aria-label="Order status">
            <span ref={tabsPillRef} className="seg__pill" aria-hidden="true" />
            {STATUS_TABS.map((tab) => (
              <button key={tab.value} type="button" role="tab" data-value={tab.value} aria-controls="ord-panel" aria-selected={statusFilter === tab.value} tabIndex={statusFilter === tab.value ? 0 : -1} title={tab.value === "closed" ? "Refunded and cancelled orders" : undefined} onClick={() => setStatusFilter(tab.value)}>
                {tab.label}<span className="ord-tabs__n">{tab.value === "all" ? matchingOrders.length : tab.value === "closed" ? matchingOrders.filter((order) => isClosed(order.status)).length : matchingOrders.filter((order) => order.status === tab.value).length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar">
          <label className="input-icon ord-search">
            <Icon name="search" /><span className="sr-only">Search orders</span>
            <input className="input" type="search" placeholder="Order number or customer" value={query} autoComplete="off" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="chips" role="group" aria-label="Channel">
            {CHANNELS.map((channel) => <button key={channel.value} className="chip" type="button" aria-pressed={channelFilter === channel.value} onClick={() => setChannelFilter(channel.value)}>{channel.label}</button>)}
          </div>
          <div className="toolbar__end"><button className="btn" type="button" aria-label="Export CSV" onClick={exportCsv}><Icon name="download" /><span className="ord-export__t">Export CSV</span></button></div>
        </div>
      </div>

      <section className="card ord-card" id="ord-panel" role="tabpanel" aria-label="Orders">
        {filteredOrders.length ? <div className="table-wrap"><table className="table ord-table">
          <thead><tr>
            <th scope="col" className="ord-cbox"><label className="ord-check"><input type="checkbox" aria-label="Select all shown orders" checked={allShownSelected} ref={(input) => { if (input) input.indeterminate = selectedIds.length > 0 && !allShownSelected; }} onChange={(event) => setSelectedIds(event.target.checked ? shownIds : [])} /><span className="sr-only">Select all shown orders</span></label></th>
            <th scope="col">Order</th><th scope="col">Customer</th>
            <th scope="col" aria-sort={sortKey === "placed" ? sortDirection < 0 ? "descending" : "ascending" : undefined}><button className="sort" type="button" onClick={() => { setSortKey("placed"); setSortDirection((direction) => sortKey === "placed" ? direction * -1 : -1); }}>Placed<Icon name="chev-down" /></button></th>
            <th scope="col">Channel</th><th scope="col" className="num">Items</th>
            <th scope="col" className="num" aria-sort={sortKey === "total" ? sortDirection < 0 ? "descending" : "ascending" : undefined}><button className="sort" type="button" onClick={() => { setSortKey("total"); setSortDirection((direction) => sortKey === "total" ? direction * -1 : -1); }}>Total<Icon name="chev-down" /></button></th>
            <th scope="col" className="ord-col-pay">Payment</th><th scope="col">Status</th>
          </tr></thead>
          <tbody>{filteredOrders.map((order) => {
            const customer = customerFor(order);
            const selected = selectedIds.includes(order.id);
            return <tr key={order.id} data-id={order.id} tabIndex={0} className={selected ? "is-selected" : undefined} aria-label={`Order ${order.id}, ${customer?.name ?? "Guest"}, ${STATUS_LABELS[order.status]}`} onClick={(event) => {
              if ((event.target as HTMLElement).closest("input, label, button, a")) return;
              openOrder(order.id);
            }} onKeyDown={(event) => handleRowKey(event, order)}>
              <td className="ord-cbox"><label className="ord-check"><input type="checkbox" checked={selected} aria-label={`Select order ${order.id}`} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))} /><span className="sr-only">Select order {order.id}</span></label></td>
              <td><a className="mono ord-id" href={`#/orders/${order.id.slice(1)}`} onClick={(event) => { event.preventDefault(); openOrder(order.id); }}>{order.id}</a></td>
              <td><span className="cell-main"><span className="av av--sm" style={{ ["--h" as any]: customer?.hue ?? 220 }}>{customer ? initials(customer.name) : "?"}</span><span><b>{customer?.name ?? "Guest"}</b><small>{customer?.city}</small></span></span></td>
              <td title={formatTimestamp(order.placed)}>{formatPlaced(order.placed)}</td>
              <td><span className="ord-ch"><Icon name={order.channel === "online" ? "globe" : "store"} />{order.channel === "online" ? "Online" : "In store"}</span></td>
              <td className="num">{totalItems(order)}</td><td className="num ord-total">{formatCurrency(total(order))}</td>
              <td className="ord-col-pay">{order.payment}</td><td data-f="status">{statusPill(order.status)}</td>
            </tr>;
          })}</tbody>
        </table></div> : emptyState(normalizedQuery)}
      </section>

      <div className="ord-bulk" role="region" aria-label="Bulk actions" hidden={!selectedIds.length}>
        <span className="ord-bulk__n" aria-live="polite">{selectedIds.length} selected</span>
        <button className="btn btn--sm ord-bulk__btn" type="button" disabled={!canMarkPacked} onClick={() => bulkChangeStatus("packed")}><Icon name="box" />Mark as packed</button>
        <button className="btn btn--sm ord-bulk__btn" type="button" disabled={!canMarkShipped} onClick={() => bulkChangeStatus("shipped")}><Icon name="truck" />Mark as shipped</button>
        <button className="btn btn--sm btn--ghost ord-bulk__clear" type="button" onClick={() => setSelectedIds([])}><Icon name="x" /><span>Clear</span></button>
      </div>

      <dialog ref={detailDialogRef} className="sheet" aria-label={activeOrder ? `Order ${activeOrder.id}` : "Order details"} onCancel={closeOrder} onClick={(event) => { if (event.target === detailDialogRef.current) closeOrder(); }}>
        {activeOrder && <div className="sheet__box">
          <header className="sheet__head"><h2>Order {activeOrder.id}</h2><button className="icon-btn" type="button" aria-label="Close order details" onClick={closeOrder}><Icon name="x" /></button></header>
          <div className="sheet__body">
            <div className="ord-sh">
              <div className="ord-sh__meta">{statusPill(activeOrder.status)}<span>Placed {formatTimestamp(activeOrder.placed)}</span><span className="ord-ch"><Icon name={activeOrder.channel === "online" ? "globe" : "store"} />{activeOrder.channel === "online" ? "Online" : "In store"}</span></div>
              {isClosed(activeOrder.status) && <div className={`ord-banner ${activeOrder.status === "refunded" ? "ord-banner--refund" : "ord-banner--cancel"}`}><Icon name={activeOrder.status === "refunded" ? "info" : "x"} /><p><b>{activeOrder.status === "refunded" ? "Refunded" : "Cancelled"}{activeOrder.history.filter((entry) => entry.status === activeOrder.status).at(-1) ? ` on ${formatTimestamp(activeOrder.history.filter((entry) => entry.status === activeOrder.status).at(-1)!.at)}` : ""}.</b> {activeOrder.status === "refunded" ? `${formatCurrency(total(activeOrder))} went back to the customer by ${activeOrder.payment === "Cash" ? "cash" : activeOrder.payment}.` : "Nothing was charged and no stock left the shelf."}</p></div>}
              <div className={`ord-steps${isClosed(activeOrder.status) ? " is-closed" : ""}`}>
                <span className="ord-steps__track" aria-hidden="true"><span className="ord-steps__fill" style={{ transform: `scaleX(${Math.max(0, currentProgress) / (STATUS_STEPS.length - 1)})` }} /></span>
                <ol aria-label="Fulfilment progress">{STATUS_STEPS.map((step, index) => {
                  const history = [...activeOrder.history].reverse().find((entry) => entry.status === step);
                  const completed = index < currentProgress || index === currentProgress && isClosed(activeOrder.status);
                  const current = index === currentProgress && !isClosed(activeOrder.status);
                  return <li key={step} className={`ord-step${completed ? " is-done" : current ? " is-current" : ""}`}><span className="ord-step__dot"><Icon name="check" /><i>{index + 1}</i></span><b>{STATUS_LABELS[step]}</b><small>{history && index <= currentProgress ? <>{formatPlaced(history.at)}<br />{new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(history.at)}</> : "—"}</small></li>;
                })}</ol>
              </div>
              <section className="ord-sec" aria-labelledby="order-items-title">
                <h3 id="order-items-title">Items <span>{totalItems(activeOrder)}</span></h3>
                <ul className="ord-lines">{activeOrder.lines.map((line, index) => <li key={`${line.productId}-${index}`}><span className="thumb" style={{ ["--h" as any]: line.hue, ["--s" as any]: "40px" }} aria-hidden="true">{initials(line.name)}</span><span className="ord-lines__name"><Link href="/products">{line.name}</Link><small>{line.qty} × {formatCurrency(line.price)}</small></span><b>{formatCurrency(line.qty * line.price)}</b></li>)}</ul>
                <dl className="ord-sum"><div><dt>Subtotal</dt><dd>{formatCurrency(subtotal(activeOrder))}</dd></div><div><dt>Shipping</dt><dd>{activeOrder.shipping ? formatCurrency(activeOrder.shipping, 2) : activeOrder.channel === "store" ? "Collected" : "Free"}</dd></div><div className="ord-sum__total"><dt>Total</dt><dd>{formatCurrency(total(activeOrder))}</dd></div></dl>
              </section>
              <section className="ord-two"><div className="ord-box"><h3>{activeOrder.channel === "store" ? "Pickup" : "Ship to"}</h3><p>{activeCustomer?.name}<br />{activeOrder.address}</p></div><div className="ord-box"><h3>Payment</h3><p>{activeOrder.payment}<br /><span data-o="pay">{activeOrder.status === "pending" ? "Awaiting payment" : activeOrder.status === "cancelled" ? "Not charged" : activeOrder.status === "refunded" ? "Refunded" : "Paid"}</span></p></div></section>
              {activeCustomer && <section className="ord-cust"><span className="av av--lg" style={{ ["--h" as any]: activeCustomer.hue }}>{initials(activeCustomer.name)}</span><span className="ord-cust__who"><b>{activeCustomer.name}</b><small>{activeCustomer.email}</small><small>Customer since {activeCustomer.city}</small></span><Link className="btn btn--sm" href="/customers">View customer</Link></section>}
              <section className="ord-sec" aria-labelledby="order-activity-title"><h3 id="order-activity-title">Activity</h3><ul className="ord-act">{[...activeOrder.history].reverse().map((entry, index) => <li key={`${entry.status}-${entry.at}-${index}`}><span className={`ord-act__dot ord-act__dot--${entry.status}`} /><span><b>{entry.status === "pending" ? "Order placed" : `Marked as ${STATUS_LABELS[entry.status].toLowerCase()}`}</b><small><span>{formatTimestamp(entry.at)}</span><span>{entry.by}</span></small></span></li>)}</ul></section>
            </div>
          </div>
          <footer className="sheet__foot"><button className="btn btn--ghost" type="button" aria-label="Download invoice" onClick={() => downloadInvoice(activeOrder)}><Icon name="download" /><span className="ord-foot__t">Invoice</span></button><span className="ord-foot__end">{activeOrder.status === "pending" && <button className="btn btn--danger" type="button" onClick={() => setConfirmAction("cancel")}>Cancel order</button>}{!isClosed(activeOrder.status) && activeOrder.status !== "pending" && <button className="btn btn--danger" type="button" onClick={() => setConfirmAction("refund")}>Refund</button>}{nextStatus ? <button className="btn btn--primary" type="button" onClick={() => changeStatus(activeOrder.id, nextStatus)}>Mark as {STATUS_LABELS[nextStatus].toLowerCase()}</button> : <button className="btn btn--primary" type="button" onClick={closeOrder}>Done</button>}</span></footer>
        </div>}
      </dialog>

      <dialog ref={actionDialogRef} className="modal" aria-label="Confirm order action" onCancel={() => setConfirmAction(null)} onClick={(event) => { if (event.target === actionDialogRef.current) setConfirmAction(null); }}>
        {activeOrder && confirmAction && <div className="modal__box"><header className="modal__head"><h2>{confirmAction === "refund" ? `Refund order ${activeOrder.id}?` : `Cancel order ${activeOrder.id}?`}</h2><button className="icon-btn" type="button" aria-label="Close" onClick={() => setConfirmAction(null)}><Icon name="x" /></button></header><div className="modal__body"><p className="card__sub">{confirmAction === "refund" ? `${formatCurrency(total(activeOrder))} goes back to ${activeCustomer?.name ?? "the customer"} by ${activeOrder.payment === "Cash" ? "cash" : activeOrder.payment}. This can’t be undone.` : "The customer hasn’t paid yet, so nothing is charged. They get a cancellation email."}</p></div><footer className="modal__foot"><button className="btn" type="button" onClick={() => setConfirmAction(null)}>Keep order</button><button className="btn btn--primary" type="button" onClick={confirmOrderAction}>{confirmAction === "refund" ? "Refund order" : "Cancel order"}</button></footer></div>}
      </dialog>

      {notice && <div className="toasts" aria-live="polite"><div className="toast" role="status"><span className="toast__ico"><Icon name="check" /></span><span>{notice}</span></div></div>}
    </div>
  );
}
