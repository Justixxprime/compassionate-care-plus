// src/lib/document-constants.ts
//
// The fixed vocabulary for documents, in one place. Pure data and pure
// functions - no database, no "server-only" - so the upload form (a
// Client Component) and the server-side rules in src/lib/documents.ts
// read the SAME list. If they ever disagreed, the server's answer would
// win: the browser is never trusted.

// What kind of document it is, and whether that kind is RESTRICTED.
// Restricted categories are the ones that carry identity and money
// details (an ID scan, an insurance card). Only administrative roles
// may see them. Clinical staff need the clinical paperwork, not a
// patient's ID number or policy number.
export const DOCUMENT_CATEGORIES = [
  { key: "consent_form", label: "Consent form", restricted: false },
  { key: "physician_order", label: "Physician order", restricted: false },
  { key: "care_correspondence", label: "Care correspondence", restricted: false },
  { key: "insurance", label: "Insurance", restricted: true },
  { key: "identification", label: "Identification", restricted: true },
] as const;

export type DocumentCategoryKey = (typeof DOCUMENT_CATEGORIES)[number]["key"];

export function isDocumentCategory(value: string): value is DocumentCategoryKey {
  return DOCUMENT_CATEGORIES.some((c) => c.key === value);
}

export function categoryLabel(key: string): string {
  return DOCUMENT_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

// Fail CLOSED: a category this list does not know about counts as
// restricted. If a row ever holds a category that was removed or
// mistyped, it is hidden from clinical accounts rather than shown to them.
export function isRestrictedCategory(key: string): boolean {
  const found = DOCUMENT_CATEGORIES.find((c) => c.key === key);
  return found ? found.restricted : true;
}

export const UNRESTRICTED_CATEGORY_KEYS: string[] = DOCUMENT_CATEGORIES.filter(
  (c) => !c.restricted,
).map((c) => c.key);

// WHO SEES RESTRICTED DOCUMENTS BY DEFAULT. Only the two administrator
// roles. Anyone else (a clinical supervisor, a nurse) sees a restricted
// document only when an administrator has shared it with them on purpose
// (src/lib/document-grants.ts). "Administrative" is not enough on its own:
// a clinical supervisor reaches every patient, but has no default right to
// an ID number or a policy number.
export const RESTRICTED_ROLE_KEYS = ["SUPER_ADMIN", "ADMIN"] as const;

// How long a share lasts. The keys are what a form sends; the server maps
// them to a real end time and refuses anything else.
export const GRANT_DURATIONS = [
  { key: "7_days", label: "7 days", days: 7 },
  { key: "30_days", label: "30 days", days: 30 },
  { key: "until_revoked", label: "Until I take it back", days: null },
] as const;

export type GrantDurationKey = (typeof GRANT_DURATIONS)[number]["key"];

export function isGrantDuration(value: string): value is GrantDurationKey {
  return GRANT_DURATIONS.some((d) => d.key === value);
}

// The end time for a share that starts at `now`, or null for "no end".
export function grantExpiry(key: GrantDurationKey, now: Date): Date | null {
  const found = GRANT_DURATIONS.find((d) => d.key === key);
  if (!found || found.days === null) return null;
  return new Date(now.getTime() + found.days * 24 * 60 * 60 * 1000);
}

// Size and text limits.
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024; // 2 MB
export const TITLE_MAX = 120;
export const FILE_NAME_MAX = 120;

// Which files are accepted. The type is worked out from the file's own
// first bytes (its "magic number"), never from the file name or from
// what the browser says it is, because both of those are typed by the
// sender. A text file renamed to .pdf is still a text file.
export type AcceptedContentType = "application/pdf" | "image/png" | "image/jpeg";

export function detectContentType(bytes: Uint8Array): AcceptedContentType | null {
  const startsWith = (sig: number[]) =>
    bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b);

  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  return null;
}

const EXTENSION_FOR: Record<AcceptedContentType, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

// Turns whatever name the browser sent into a safe one: no folders, no
// odd characters, a sensible length, and an extension that matches what
// the file REALLY is.
export function safeFileName(raw: string, type: AcceptedContentType): string {
  const lastPart = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = lastPart
    .replace(/[\u0000-\u001f\u007f"<>:|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const dot = cleaned.lastIndexOf(".");
  const base = (dot > 0 ? cleaned.slice(0, dot) : cleaned).trim() || "document";
  const ext = EXTENSION_FOR[type];
  const room = FILE_NAME_MAX - ext.length - 1;
  return `${base.slice(0, room)}.${ext}`;
}
