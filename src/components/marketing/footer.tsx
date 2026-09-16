import Link from "next/link";
import { MapPin, Phone, Clock } from "lucide-react";
import { LogoMark } from "./logo-mark";
import { primaryNav, portalLinks, brandName } from "./nav-links";

/*
  Footer
  ======
  Expanded after feedback referencing Mayo Clinic's footer - not copying
  its exact categories (Researchers, Students, Businesses don't apply to
  a home health agency), but matching the spirit: genuinely comprehensive,
  organized into clear sections, not a thin four-column afterthought.

  The four legal links (privacy, terms, accessibility, notice of privacy
  practices) are intentionally NOT linked to real content yet - writing
  actual privacy policy, terms, or HIPAA notice language is a genuine
  legal exposure for the organization if done wrong, so that one boundary
  holds regardless of how the rest of the site's tone changed. See
  docs/PUBLIC_WEBSITE.md.
*/

export function Footer() {
  return (
    <footer className="border-t border-border bg-ink text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          {/* Brand + contact */}
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark className="h-8 w-8 flex-none" />
              <span className="leading-none">
                <span className="block font-display text-body-lg font-semibold text-white">
                  Cheliv
                </span>
                <span className="block text-caption text-white/60">
                  Compassionate Care Plus
                </span>
              </span>
            </div>
            <p className="mt-6 max-w-xs text-body-sm text-white/70">
              Home health care serving Texas, with the same attention we
              would give our own family.
            </p>

            <div className="mt-6 space-y-3 text-body-sm text-white/70">
              <div className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 flex-none text-marigold" aria-hidden="true" />
                <span>
                  4434 Blue Bonnet Dr, Suite 151
                  <br />
                  Stafford, TX 77477
                </span>
              </div>
              <div className="flex gap-3">
                <Phone className="mt-0.5 h-4 w-4 flex-none text-marigold" aria-hidden="true" />
                <a href="tel:2819037551" className="hover:text-white">
                  (281) 903-7551
                </a>
              </div>
              <div className="flex gap-3">
                <Clock className="mt-0.5 h-4 w-4 flex-none text-marigold" aria-hidden="true" />
                <span>Monday to Friday, 9:00 am to 5:00 pm</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-label font-semibold uppercase tracking-wide text-white/50">
              Explore
            </p>
            <ul className="mt-4 space-y-3">
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-body-sm text-white/70 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-label font-semibold uppercase tracking-wide text-white/50">
              For professionals
            </p>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/contact"
                  className="text-body-sm text-white/70 hover:text-white"
                >
                  Refer a patient
                </Link>
              </li>
              <li>
                <Link
                  href="/how-we-care"
                  className="text-body-sm text-white/70 hover:text-white"
                >
                  Our care process
                </Link>
              </li>
            </ul>

            <p className="mt-8 text-label font-semibold uppercase tracking-wide text-white/50">
              Portals
            </p>
            <ul className="mt-4 space-y-3">
              {portalLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-body-sm text-white/70 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-label font-semibold uppercase tracking-wide text-white/50">
              Legal
            </p>
            <ul className="mt-4 space-y-3">
              <li className="text-body-sm text-white/50">Privacy policy</li>
              <li className="text-body-sm text-white/50">Terms of use</li>
              <li className="text-body-sm text-white/50">Accessibility statement</li>
              <li className="text-body-sm text-white/50">
                Notice of privacy practices
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-caption text-white/50">
            © 2026 {brandName} Inc. All rights reserved.
          </p>
          <p className="text-caption text-white/50">
            Licensed home health provider, Texas
          </p>
        </div>
      </div>
    </footer>
  );
}
