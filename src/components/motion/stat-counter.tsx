"use client";

import { useEffect, useRef, useState } from "react";

/*
  StatCounter
  ===========
  Counts up to a real number when it scrolls into view. Used on the About
  page's "why choose us" stats, now that those numbers are confirmed real
  rather than placeholders.

  Reduced motion: checked directly via matchMedia, since this is a JS
  animation (requestAnimationFrame), not a CSS transition - the global
  CSS override in globals.css only catches CSS animations/transitions,
  so this component checks for itself and jumps straight to the final
  number instead of counting.
*/

export function StatCounter({
  target,
  prefix = "",
  suffix = "",
  duration = 1400,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;

        if (prefersReduced) {
          setValue(target);
          observer.disconnect();
          return;
        }

        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          // ease-out so the count settles rather than stopping abruptly
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(eased * target));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {value}
      {suffix}
    </span>
  );
}
