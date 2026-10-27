"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SubtabsBar } from "./subtabs-bar";
import { LiveIndicator } from "./live-indicator";

interface PageHeadingProps {
  title: string;
}

export function PageHeading({ title }: PageHeadingProps) {
  const headingRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (isReduced) return;

      const chars = headingRef.current?.querySelectorAll(".ch");
      if (!chars || !chars.length) return;

      // Exact Corbel bi character spring reveal:
      // chars flip up from underneath the word span with slight rotation
      gsap.fromTo(
        chars,
        { yPercent: 115, rotation: 6, opacity: 0 },
        {
          yPercent: 0,
          rotation: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power4.out",
          stagger: 0.02,
          delay: 0.1,
          clearProps: "transform,opacity",
        }
      );
    },
    { dependencies: [title], scope: headingRef }
  );

  return (
    <div ref={headingRef} className="head">
      <h1 className="head__title" id="page-title" tabIndex={-1}>
        {title.split(" ").map((word, wIdx) => (
          <span key={wIdx} className="word">
            {[...word].map((ch, cIdx) => (
              <span key={cIdx} className="ch">
                {ch}
              </span>
            ))}
            {wIdx < title.split(" ").length - 1 && "\u00A0"}
          </span>
        ))}
      </h1>

      <SubtabsBar />

      <LiveIndicator />
    </div>
  );
}
