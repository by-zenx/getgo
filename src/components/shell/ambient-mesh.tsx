"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export function AmbientMesh() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (isReduced) return;

      const orbs = containerRef.current?.querySelectorAll("i");
      if (!orbs) return;

      // Exact Corbel parameters:
      // x: [60, -50, 40], y: [40, -60, 50], scale: [1.08, .94, 1.1], duration: 14 + t * 4, ease: sine.inOut
      const xOffsets = [60, -50, 40];
      const yOffsets = [40, -60, 50];
      const scales = [1.08, 0.94, 1.1];

      orbs.forEach((orb, i) => {
        gsap.to(orb, {
          x: xOffsets[i % 3],
          y: yOffsets[i % 3],
          scale: scales[i % 3],
          duration: 14 + i * 4,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      });
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="mesh" aria-hidden="true">
      <i className="mesh__a" />
      <i className="mesh__b" />
      <i className="mesh__c" />
    </div>
  );
}
