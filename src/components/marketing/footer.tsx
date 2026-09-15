import Link from "next/link";
import { primaryNav, portalLinks } from "./nav-links";

/*
  Footer
  ======
  Every legal link here (privacy, terms, accessibility, notice of privacy
  practices) points at a placeholder page, not invented legal text. See
  docs/PHASE_0_ARCHITECTURE.md section 88 - I do not write privacy
  policies, consent language or HIPAA notices myself. Those come from the
  organization or a qualified professional.
*/

export function Footer() {
  return (
    <footer className="border-t border-border bg-sage">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-h4 font-semibold text-ink">
              Compassionate Care Plus
            </p>
            <p className="mt-2 text-body-sm text-slate">
              Home health care. Texas.
              <br />
              <span className="text-caption">
                [Address to be confirmed by the organization]
              </span>
            </p>
          </div>

          <div>
            <p className="text-label font-semibold text-ink">Explore</p>
            <ul className="mt-3 space-y-2">
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-body-sm text-slate hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-label font-semibold text-ink">Portals</p>
            <ul className="mt-3 space-y-2">
              {portalLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-body-sm text-slate hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/request-care"
                  className="text-body-sm text-slate hover:text-ink"
                >
                  Request care
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-label font-semibold text-ink">Legal</p>
            <ul className="mt-3 space-y-2">
              <li>
                <span className="text-body-sm text-slate">
                  Privacy policy — placeholder
                </span>
              </li>
              <li>
                <span className="text-body-sm text-slate">
                  Terms of use — placeholder
                </span>
              </li>
              <li>
                <span className="text-body-sm text-slate">
                  Accessibility statement — placeholder
                </span>
              </li>
              <li>
                <span className="text-body-sm text-slate">
                  Notice of privacy practices — placeholder
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border-strong pt-6">
          <p className="text-caption text-slate">
            © 2026 Compassionate Care Plus Inc. Development build — content
            not yet confirmed by the organization. Not designed,
            represented, or offered for use with real patient information.
          </p>
        </div>
      </div>
    </footer>
  );
}
