"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { primaryNav, brandName } from "./nav-links";

/*
  Header
  ======
  No real logo exists yet (see docs/PHASE_0_ARCHITECTURE.md section 14 -
  I do not invent a final logo). Until Compassionate Care Plus supplies
  one, the wordmark is plain text. Swapping in a real mark later is a
  one-line change here, not a redesign.

  The mobile menu uses a native <details>/<summary> element rather than a
  hand-built dropdown with its own JavaScript and ARIA wiring. The browser
  already knows how to make this keyboard-accessible and screen-reader
  friendly for free; I only need to style it. If a more elaborate mobile
  menu is wanted later (animated panel, etc.), this is the file to revisit.

  The header is sticky and gains a subtle shadow once the page scrolls -
  a small, purposeful bit of motion (not decoration) that keeps
  navigation reachable on long pages and gives the site a considered,
  "alive" feel per PHASE_0_ARCHITECTURE.md section 10. This is the reason
  the component is a Client Component - everything else about it could
  render on the server.
*/

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-paper/95 backdrop-blur transition-shadow duration-300 ${
        scrolled
          ? "border-border-strong shadow-[0_1px_0_rgba(23,36,32,0.06),0_8px_24px_-16px_rgba(23,36,32,0.25)]"
          : "border-border shadow-none"
      }`}
    >
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-display text-h3 font-semibold text-ink"
        >
          {brandName}
        </Link>

        {/* Desktop navigation */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-8 lg:flex"
        >
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-body-sm font-medium text-ink hover:text-pine"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/sign-in"
            className="text-body-sm font-medium text-ink hover:text-pine"
          >
            Sign in
          </Link>
          <Link href="/request-care" className={buttonVariants({ size: "sm" })}>
            Request care
          </Link>
        </div>

        {/* Mobile menu */}
        <details className="group relative lg:hidden">
          <summary
            aria-label="Open menu"
            className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md border border-border-strong [&::-webkit-details-marker]:hidden"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 5h14M3 10h14M3 15h14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </summary>

          <div className="absolute right-0 top-14 w-64 rounded-md border border-border bg-white p-4 shadow-raised">
            <nav aria-label="Primary" className="flex flex-col gap-1">
              {primaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-sm px-2 py-2 text-body font-medium text-ink hover:bg-sage"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="my-3 border-t border-border" />
            <Link
              href="/sign-in"
              className="block rounded-sm px-2 py-2 text-body font-medium text-ink hover:bg-sage"
            >
              Sign in
            </Link>
            <div className="mt-3">
              <Link
                href="/request-care"
                className={buttonVariants({ size: "sm", className: "w-full" })}
              >
                Request care
              </Link>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
