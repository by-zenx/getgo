"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons/svg-sprite";

interface DockProps {
  onOpenFinder?: () => void;
  workspaceCount?: number | string;
}

export function Dock({ onOpenFinder, workspaceCount = 11 }: DockProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [boardCount, setBoardCount] = useState(workspaceCount);

  useEffect(() => {
    const syncTheme = () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const syncWorkspaceCount = () => {
      try {
        const boards = JSON.parse(localStorage.getItem("corbel:workspace:boards") || "null") as { columns?: { id: string; cards: unknown[] }[] }[] | null;
        if (!Array.isArray(boards)) {
          setBoardCount(workspaceCount);
          return;
        }
        setBoardCount(boards.reduce((sum, board) => sum + (board.columns ?? []).reduce((count, column) => count + (column.id === "done" ? 0 : column.cards.length), 0), 0));
      } catch {
        setBoardCount(workspaceCount);
      }
    };
    syncWorkspaceCount();
    window.addEventListener("storage", syncWorkspaceCount);
    window.addEventListener("corbel:workspace-updated", syncWorkspaceCount);
    return () => {
      window.removeEventListener("storage", syncWorkspaceCount);
      window.removeEventListener("corbel:workspace-updated", syncWorkspaceCount);
    };
  }, [workspaceCount]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem("corbel:theme", JSON.stringify(nextTheme));
    } catch (e) {}
  };

  const isCurrent = (route: string) => {
    return pathname.startsWith(`/${route}`);
  };

  return (
    <nav className="dock" aria-label="Workspace and tools">
      <button
        className="dock__btn"
        type="button"
        id="open-finder"
        aria-haspopup="dialog"
        aria-label="Search (⌘K)"
        onClick={onOpenFinder}
      >
        <Icon name="search" />
        <span className="dock__tip">
          Search <kbd>⌘K</kbd>
        </span>
      </button>

      <span className="dock__sep" aria-hidden="true" />

      <Link
        className="dock__btn"
        href="/workspace"
        data-route="workspace"
        aria-label="Workspace"
        aria-current={isCurrent("workspace") ? "page" : undefined}
      >
        <Icon name="board" />
          {boardCount !== undefined && (
          <span className="dock__count" data-count="workspace">
            {boardCount}
          </span>
        )}
        <span className="dock__tip">Workspace</span>
      </Link>

      <Link
        className="dock__btn"
        href="/settings"
        data-route="settings"
        aria-label="Settings"
        aria-current={isCurrent("settings") ? "page" : undefined}
      >
        <Icon name="gear" />
        <span className="dock__tip">Settings</span>
      </Link>

      <Link
        className="dock__btn"
        href="/help"
        data-route="help"
        aria-label="Help center"
        aria-current={isCurrent("help") ? "page" : undefined}
      >
        <Icon name="help" />
        <span className="dock__tip">Help center</span>
      </Link>

      <span className="dock__sep" aria-hidden="true" />

      <Link
        className="dock__btn dock__upgrade"
        href="/settings/plan"
        aria-label="Unlock forecasting: upgrade to Corbel Plus"
      >
        <Icon name="spark" />
        <span className="dock__tip">Upgrade to Corbel Plus</span>
      </Link>

      <button
        className="dock__btn"
        type="button"
        id="theme-btn"
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        onClick={toggleTheme}
      >
        <Icon name={theme === "dark" ? "sun" : "moon"} className="theme-ico" />
        <span className="dock__tip">Theme</span>
      </button>
    </nav>
  );
}
