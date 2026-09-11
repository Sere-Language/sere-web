"use client";

import { useEffect, useRef, useState } from "react";

interface RevealProps {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Reveals its children as they scroll into view.
 *
 * Content renders visible on the server. We only hide it after mount, and only
 * when the element is still below the fold — so nothing is ever stuck hidden if
 * JavaScript or IntersectionObserver is unavailable.
 */
export default function Reveal({ delay = 0, className, children }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Leave anything already on screen alone — avoids a flash of hidden content.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    setArmed(true);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const state = shown ? "reveal-in" : armed ? "reveal-armed" : "";

  return (
    <div
      ref={ref}
      className={`${state} ${className ?? ""}`}
      style={shown && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
