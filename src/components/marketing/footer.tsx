import Link from "next/link";
import { primaryNav, portalLinks, brandName } from "./nav-links";

/*
  Footer
  ======
  The four legal links (privacy, terms, accessibility, notice of privacy
  practices) are intentionally NOT linked to real content yet - writing
  actual privacy policy, terms, or HIPAA notice language is a genuine
  legal exposure for the organization if done wrong, so that one boundary
  holds regardless of how the rest of the site's tone changed. They are
  shown as plain, unlabelled text rather than flagged "placeholder" -
  see docs/PUBLIC_WEBSITE.md for why this is the one thing still held
  back even though the rest of the site no longer visibly flags
  unfinished content.
*/

export function Footer() {
  return (
    <footer className="border-t border-border bg-sage">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-h4 font-semibold text-ink">
              {brandName}
            </p>
            <p className="mt-2 text-body-sm text-slate">
              Home health care serving Texas.
              <br />
              4434 Blue Bonnet Dr, Suite 151
              <br />
              Stafford, TX 77477
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
              <li className="text-body-sm text-slate">Privacy policy</li>
              <li className="text-body-sm text-slate">Terms of use</li>
              <li className="text-body-sm text-slate">Accessibility statement</li>
              <li className="text-body-sm text-slate">
                Notice of privacy practices
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border-strong pt-6">
          <p className="text-caption text-slate">
            © 2026 {brandName} Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
