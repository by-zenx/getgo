"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

/** A theme-aware progress fill that grows from zero on mount and on value changes. */
export function ProgressMeter({ value }: { value: number }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const progress = Math.max(0, Math.min(1, value));

  useGSAP(() => {
    const fill = fillRef.current;
    if (!fill) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(fill, { scaleX: progress });
      return;
    }
    gsap.fromTo(fill, { scaleX: 0 }, { scaleX: progress, duration: 0.95, ease: "power3.out", overwrite: "auto" });
  }, { dependencies: [progress] });

  return <div ref={fillRef} className="meter__fill" />;
}
