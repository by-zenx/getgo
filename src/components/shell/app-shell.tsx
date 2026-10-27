"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { AmbientMesh } from "./ambient-mesh";
import { TopHeader } from "./top-header";
import { Dock } from "./dock";
import { FinderDialog } from "@/components/overlays/finder-dialog";
import { BellPopover } from "@/components/overlays/bell-popover";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isFinderOpen, setIsFinderOpen] = useState(false);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // 1. Immediately mark document as ready so html.js.ready .app { visibility: visible }
      document.documentElement.classList.add("ready");

      const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (isReduced) return;

      // 2. Exact Corbel Shell Entrance Timeline:
      // Fade in mesh, stagger brand/tabs/tools, slide in dock from left, stagger dock buttons, slide in main & pop live indicator
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

      tl.fromTo(
        ".mesh",
        { opacity: 0 },
        { opacity: 1, duration: 1.2, ease: "power2.out", clearProps: "opacity" },
        0
      )
        .fromTo(
          [".brand", ".tabs", ".top__tools > *"],
          { opacity: 0, y: -16 },
          {
            opacity: 1,
            y: 0,
            duration: 0.65,
            ease: "power3.out",
            stagger: 0.06,
            clearProps: "transform,opacity",
          },
          0.05
        )
        .fromTo(
          ".dock",
          { x: -90, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.9,
            ease: "power3.out",
            clearProps: "transform,opacity",
          },
          0.1
        )
        .fromTo(
          ".dock__btn",
          { opacity: 0, y: 12 },
          {
            opacity: 0.74,
            y: 0,
            duration: 0.5,
            stagger: 0.035,
            ease: "power3.out",
            clearProps: "transform",
          },
          0.25
        )
        .fromTo(
          ".main",
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 1.0,
            ease: "expo.out",
            clearProps: "transform,opacity",
          },
          0.08
        );
    },
    // The shell entrance is for the initial site load only. Route children
    // change inside this persistent component and must not replay the intro.
    { scope: shellRef, dependencies: [] }
  );

  return (
    <div ref={shellRef}>
      <AmbientMesh />

      <div className="app">
        <TopHeader
          isNotificationsOpen={isBellOpen}
          onOpenNotifications={() => setIsBellOpen((prev) => !prev)}
        />

        <Dock
          onOpenFinder={() => setIsFinderOpen(true)}
        />

        <main className="main" id="main" tabIndex={-1}>
          {children}
        </main>
      </div>

      <FinderDialog
        isOpen={isFinderOpen}
        onClose={() => setIsFinderOpen(false)}
      />

      <BellPopover
        isOpen={isBellOpen}
        onClose={() => setIsBellOpen(false)}
      />
    </div>
  );
}
