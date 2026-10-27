"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Icon } from "@/components/icons/svg-sprite";

export interface NotificationItem {
  id: string;
  title: string;
  meta: string;
  unread: boolean;
  icon: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  { id: "n1", title: "New order #CR-4824 from Aldercrest Hotels ($2,140)", meta: "12m ago · Online checkout", unread: true, icon: "cart" },
  { id: "n2", title: "Low stock alert: Merino Wool Blanket (8 left in main warehouse)", meta: "1h ago · Inventory monitor", unread: true, icon: "alert" },
  { id: "n3", title: "Amara won Renewal contract ($54,450)", meta: "3h ago · Sales pipeline", unread: false, icon: "star" },
  { id: "n4", title: "Weekly automated digest sent to team", meta: "1d ago · Automations", unread: false, icon: "mail" },
];

export function BellPopover({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const popRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const pop = popRef.current;
      if (!isOpen || !pop || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        pop,
        { opacity: 0, y: -10, scale: 0.97, transformOrigin: "100% 0%" },
        { opacity: 1, y: 0, scale: 1, duration: 0.36, ease: "power3.out", overwrite: true }
      );
    },
    { dependencies: [isOpen], revertOnUpdate: true }
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const bellBtn = document.getElementById("bell-btn");
      if (
        popRef.current &&
        !popRef.current.contains(e.target as Node) &&
        bellBtn &&
        !bellBtn.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const markAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popRef}
      className="pop"
      id="bell-pop"
      role="dialog"
      aria-label="Notifications"
      style={{
        position: "fixed",
        top: "68px",
        right: "clamp(14px, 3vw, 48px)",
      }}
    >
      <div className="pop__head">
        <b>Notifications</b>
        <button className="link-btn" type="button" id="read-all" onClick={markAllRead}>
          Mark all read
        </button>
      </div>
      <ul className="pop__list" id="bell-list">
        {items.map((n) => (
          <li key={n.id} className={n.unread ? "is-unread" : undefined}>
            <span className="n-ico">
              <Icon name={n.icon} />
            </span>
            <div>
              <p>{n.title}</p>
              <small>{n.meta}</small>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
