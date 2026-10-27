"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { Icon } from "@/components/icons/svg-sprite";

interface FinderItem {
  group: string;
  id: string;
  title: string;
  meta?: string;
  icon: string;
  href: string;
}

const SEARCH_ITEMS: FinderItem[] = [
  { group: "Pages", id: "p-dash", title: "Dashboard", meta: "Overview & KPIs", icon: "grid", href: "/dashboard" },
  { group: "Pages", id: "p-orders", title: "Orders", meta: "128 total", icon: "cart", href: "/orders" },
  { group: "Pages", id: "p-products", title: "Products", meta: "Catalog & stock", icon: "box", href: "/products" },
  { group: "Pages", id: "p-customers", title: "Customers", meta: "Directory & feedback", icon: "users", href: "/customers" },
  { group: "Pages", id: "p-messages", title: "Messages", meta: "Inbox & email", icon: "chat", href: "/messages" },
  { group: "Pages", id: "p-analytics", title: "Analytics", meta: "Channel performance", icon: "chart", href: "/analytics" },
  { group: "Pages", id: "p-automations", title: "Automations", meta: "Flows & triggers", icon: "zap", href: "/automations" },
  { group: "Pages", id: "p-workspace", title: "Workspace", meta: "Project boards", icon: "board", href: "/workspace" },
  { group: "Pages", id: "p-settings", title: "Settings", meta: "Store, theme, plan", icon: "gear", href: "/settings" },
  { group: "Products", id: "pr-1", title: "Merino Wool Blanket", meta: "Stock: 42 · $180", icon: "tag", href: "/products" },
  { group: "Products", id: "pr-2", title: "Washed Linen Throw", meta: "Stock: 18 · $120", icon: "tag", href: "/products" },
  { group: "Orders", id: "o-1", title: "Order #CR-4821", meta: "Kumo Retail · $1,420", icon: "cart", href: "/orders" },
  { group: "Customers", id: "c-1", title: "Kumo Retail", meta: "Fleet licence · High value", icon: "users", href: "/customers" },
];

export function FinderDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const showFinder = () => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const box = dialog.querySelector<HTMLElement>(".finder__box");
    if (box && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(
        box,
        { opacity: 0, y: -14, scale: 0.97, transformOrigin: "50% 0%" },
        { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "power3.out", overwrite: true }
      );
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          showFinder();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      showFinder();
      inputRef.current?.focus();
    } else {
      if (dialog.open) dialog.close();
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filtered = query.trim()
    ? SEARCH_ITEMS.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.meta?.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_ITEMS;

  const handleSelect = (item: FinderItem) => {
    onClose();
    router.push(item.href);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="finder"
      id="finder"
      aria-label="Search"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      onCancel={onClose}
    >
      <div className="finder__box">
        <label className="finder__field">
          <Icon name="search" />
          <input
            ref={inputRef}
            id="finder-q"
            type="text"
            placeholder="Search pages, products, orders, customers…"
            autoComplete="off"
            spellCheck="false"
            role="combobox"
            aria-expanded="true"
            aria-controls="finder-list"
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
          />
          <kbd onClick={onClose} style={{ cursor: "pointer" }}>
            Esc
          </kbd>
        </label>
        <ul className="finder__list" id="finder-list" role="listbox" aria-label="Results">
          {filtered.map((item, idx) => (
            <li
              key={item.id}
              className="finder__hit"
              role="option"
              aria-selected={idx === selectedIndex}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <span className="lead">
                <Icon name={item.icon} />
              </span>
              <b>{item.title}</b>
              {item.meta && <small>{item.meta}</small>}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="empty">
              <b>No matching results</b>
              <span>Try searching for pages, customers or order IDs</span>
            </li>
          )}
        </ul>
      </div>
    </dialog>
  );
}
