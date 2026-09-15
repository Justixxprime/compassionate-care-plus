"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/*
  Reveal
  ======
  Fades and lifts content into place as it scrolls into view. Used
  section-by-section on the homepage and long pages so the site feels
  alive while scrolling rather than dumping everything on screen at
  once - see PHASE_0_ARCHITECTURE.md section 48: animation must have a
  purpose and respect prefers-reduced-motion.

  How the reduced-motion case is handled: the CSS transition itself is
  neutralized globally in globals.css whenever the OS requests reduced
  motion (transition-duration forced to 0.01ms), so this component needs
  no special-case logic - the content still reveals on scroll, just
  without the animated motion.

  How the no-JS case is handled: see the <noscript> rule in
  src/app/layout.tsx, which forces every .reveal element back to fully
  visible if JavaScript never runs. Content is never permanently hidden.
*/

export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
      className={cn(
        "reveal transition-all duration-700 ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
