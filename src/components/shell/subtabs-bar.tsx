"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";

interface SubtabConfig {
  key: string;
  items: { href: string; label: string; key: string }[];
}

let sharedSubtabPosition: { groupKey: string; coords: { l: number; r: number } } | null = null;

const SUBTAB_GROUPS: Record<string, SubtabConfig> = {
  customers: {
    key: "customers",
    items: [
      { href: "/customers", label: "Customers", key: "customers" },
      { href: "/feedback", label: "Feedback", key: "feedback" },
    ],
  },
  feedback: {
    key: "customers",
    items: [
      { href: "/customers", label: "Customers", key: "customers" },
      { href: "/feedback", label: "Feedback", key: "feedback" },
    ],
  },
  messages: {
    key: "messages",
    items: [
      { href: "/messages", label: "Inbox", key: "messages" },
      { href: "/email", label: "Email", key: "email" },
    ],
  },
  email: {
    key: "messages",
    items: [
      { href: "/messages", label: "Inbox", key: "messages" },
      { href: "/email", label: "Email", key: "email" },
    ],
  },
  automations: {
    key: "automations",
    items: [
      { href: "/automations", label: "Automations", key: "automations" },
      { href: "/integrations", label: "Integrations", key: "integrations" },
    ],
  },
  integrations: {
    key: "automations",
    items: [
      { href: "/automations", label: "Automations", key: "automations" },
      { href: "/integrations", label: "Integrations", key: "integrations" },
    ],
  },
  workspace: {
    key: "workspace",
    items: [
      { href: "/workspace/spring-launch", label: "Spring Launch", key: "spring-launch" },
      { href: "/workspace/retail-plan", label: "Retail Plan", key: "retail-plan" },
    ],
  },
};

export function SubtabsBar() {
  const pathname = usePathname();
  const segment = pathname.split("/")[1] || "";
  const group = SUBTAB_GROUPS[segment];

  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!group) {
      sharedSubtabPosition = null;
      return;
    }
    const track = trackRef.current;
    const pill = pillRef.current;
    if (!track || !pill) return;

    const activeItem = group.items.find((i) => pathname === i.href || (i.href !== "/" && pathname.startsWith(i.href))) || group.items[0];
    const targetEl = track.querySelector<HTMLAnchorElement>(`[data-key="${activeItem.key}"]`);

    if (!targetEl || !targetEl.offsetWidth) {
      gsap.to(pill, { opacity: 0, duration: 0.2, overwrite: "auto" });
      sharedSubtabPosition = null;
      return;
    }

    const trackWidth = track.scrollWidth;
    const trackHeight = track.offsetHeight;
    const left = targetEl.offsetLeft;
    const right = trackWidth - (targetEl.offsetLeft + targetEl.offsetWidth);
    const top = targetEl.offsetTop;
    const bottom = trackHeight - (targetEl.offsetTop + targetEl.offsetHeight);
    const makeClip = (l: number, r: number) => `inset(${top}px ${r}px ${bottom}px ${l}px round 999px)`;
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!sharedSubtabPosition || sharedSubtabPosition.groupKey !== group.key || isReduced) {
      gsap.set(pill, { clipPath: makeClip(left, right) });
      gsap.to(pill, { opacity: 1, duration: 0.2, overwrite: "auto" });
      sharedSubtabPosition = { groupKey: group.key, coords: { l: left, r: right } };
      return;
    }

    const coords = sharedSubtabPosition.coords;
    const movingRight = left > coords.l;
    gsap.killTweensOf(coords);
    const updateClip = () => gsap.set(pill, { clipPath: makeClip(coords.l, coords.r) });
    let completedEdges = 0;
    const settle = () => {
      completedEdges += 1;
      if (completedEdges !== 2) return;
      gsap.to(coords, { l: left, r: right, duration: 0.18, ease: "back.out(1.35)", onUpdate: updateClip });
    };

    gsap.to(pill, { opacity: 1, duration: 0.2, overwrite: "auto" });
    gsap.to(coords, {
      l: left,
      duration: movingRight ? 0.55 : 0.36,
      ease: movingRight ? "power3.inOut" : "power3.out",
      onUpdate: updateClip,
      onComplete: settle,
    });
    gsap.to(coords, {
      r: right,
      duration: movingRight ? 0.36 : 0.55,
      ease: movingRight ? "power3.out" : "power3.inOut",
      onUpdate: updateClip,
      onComplete: settle,
    });
  }, [group, pathname]);

  if (!group) {
    return (
      <nav className="subtabs" aria-label="In this section" hidden>
        <div className="subtabs__track">
          <span className="subtabs__pill" aria-hidden="true" />
        </div>
      </nav>
    );
  }

  return (
    <nav className="subtabs" aria-label="In this section">
      <div ref={trackRef} className="subtabs__track">
        {group.items.map((item) => {
          const isCurrent = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.key}
              href={item.href}
              className="subtab"
              data-key={item.key}
              aria-current={isCurrent ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
        <span ref={pillRef} className="subtabs__pill" aria-hidden="true">
          {group.items.map((item) => <span key={item.key}>{item.label}</span>)}
        </span>
      </div>
    </nav>
  );
}
