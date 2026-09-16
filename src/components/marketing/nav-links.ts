/*
  The site's navigation, defined once. Both the header and the footer read
  from this so a new page only has to be added in one place, and the two
  never quietly drift out of sync with each other.

  Matches the sitemap in docs/PHASE_0_ARCHITECTURE.md section 5.1.
*/

export const primaryNav = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Who we serve", href: "/who-we-serve" },
  { label: "How we care", href: "/how-we-care" },
  { label: "Resources", href: "/resources" },
  { label: "Contact", href: "/contact" },
] as const;

export const portalLinks = [
  { label: "Patient portal", href: "/sign-in" },
  { label: "Caregiver portal", href: "/sign-in" },
] as const;

export const brandName = "Cheliv Compassionate Care Plus";
