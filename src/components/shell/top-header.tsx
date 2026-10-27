"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/svg-sprite";
import { NavTabs } from "./nav-tabs";

interface TopHeaderProps {
  onOpenNotifications?: () => void;
  isNotificationsOpen?: boolean;
  hasUnread?: boolean;
}

export function TopHeader({ onOpenNotifications, isNotificationsOpen = false, hasUnread = true }: TopHeaderProps) {
  const [storeName, setStoreName] = useState("Corbel Supply Co.");
  const [profileName, setProfileName] = useState("Mara Reyes");
  const [planLabel, setPlanLabel] = useState("Pro trial, 9 days left");

  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem("corbel:settings") || "{}");
      if (settings.store) setStoreName(settings.store);
      if (settings.name) setProfileName(settings.name);
      if (settings.plan === "Plus") setPlanLabel("Corbel Plus");
    } catch {}

    const handleSettingsUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ store?: string; name?: string; plan?: string }>).detail;
      if (detail.store) setStoreName(detail.store);
      if (detail.name) setProfileName(detail.name);
      if (detail.plan) setPlanLabel(detail.plan === "Plus" ? "Corbel Plus" : "Pro trial, 9 days left");
    };
    window.addEventListener("corbel:settings-update", handleSettingsUpdate);
    return () => window.removeEventListener("corbel:settings-update", handleSettingsUpdate);
  }, []);

  const profileInitials = profileName.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();

  return (
    <header className="top">
      <Link className="brand" href="/dashboard" aria-label="Corbel: dashboard">
        <span className="brand__mark">
          <Icon name="logo" />
        </span>
        <span className="brand__txt">
          <b>{storeName}</b>
          <small>{planLabel}</small>
        </span>
      </Link>

      <NavTabs />

      <div className="top__tools">
        <button
          className="ibtn ibtn--glass"
          type="button"
          id="bell-btn"
          aria-label="Notifications"
          aria-haspopup="dialog"
          aria-expanded={isNotificationsOpen}
          onClick={onOpenNotifications}
        >
          <Icon name="bell" />
          {hasUnread && <span className="bell__dot" />}
        </button>

        <div className="team" aria-label="Team online: 4 people">
          <span className="av av--sm" style={{ ["--h" as any]: "206" }}>
            MR
          </span>
          <span className="av av--sm" style={{ ["--h" as any]: "162" }}>
            JO
          </span>
          <span className="av av--sm" style={{ ["--h" as any]: "12" }}>
            AP
          </span>
          <span className="av av--sm av--more">+2</span>
        </div>

        <Link className="me" href="/settings" aria-label={`Your profile: ${profileName}`}>
          <span className="av" style={{ ["--h" as any]: "206" }}>
            {profileInitials}
          </span>
        </Link>
      </div>
    </header>
  );
}
