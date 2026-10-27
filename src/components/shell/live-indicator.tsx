"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export function LiveIndicator() {
  const [count, setCount] = useState<number>(142);
  const containerRef = useRef<HTMLSpanElement>(null);
  const prevCountStr = useRef<string>("");

  useEffect(() => {
    // Periodically update shopper count slightly for realistic live feel
    const interval = setInterval(() => {
      setCount((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return Math.max(80, Math.min(240, prev + delta));
      });
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const countStr = count.toLocaleString("en-US");

  useEffect(() => {
    if (!containerRef.current) return;
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Check if digit strips need to be built
    const strips = containerRef.current.querySelectorAll<HTMLSpanElement>(".odo__strip");
    const digitsOnly = countStr.replace(/\D/g, "");

    [...digitsOnly].forEach((digitChar, i) => {
      const strip = strips[i];
      if (!strip) return;
      const digit = parseInt(digitChar, 10);
      if (isReduced) {
        gsap.set(strip, { y: `${-digit * 1.3}em` });
      } else {
        gsap.to(strip, {
          y: `${-digit * 1.3}em`,
          duration: 0.8,
          ease: "power3.out",
          overwrite: "auto",
        });
      }
    });

    prevCountStr.current = countStr;
  }, [countStr]);

  return (
    <div className="live" title="Shoppers on the website and in the two stores right now">
      <span className="live__dot" aria-hidden="true" />
      <span ref={containerRef} className="live__n" aria-hidden="true">
        {[...countStr].map((ch, idx) =>
          /\d/.test(ch) ? (
            <span key={idx} className="odo">
              <span className="odo__strip">
                {"0123456789".split("").map((num) => (
                  <span key={num}>{num}</span>
                ))}
              </span>
            </span>
          ) : (
            <span key={idx}>{ch}</span>
          )
        )}
      </span>
      <span className="sr-only">{count} shoppers live now</span>
      <span className="live__label">live now</span>
    </div>
  );
}
