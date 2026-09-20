// src/lib/time.ts
//
// Dates and times for a business that lives in ONE timezone.
//
// The rule from PHASE_0_ARCHITECTURE.md section 7: store every timestamp
// in UTC, and render it in the organization's timezone. The office is in
// Stafford, Texas, so "10:00 am" on a schedule always means 10:00 am
// Central time, no matter where the server runs (Vercel runs in UTC) or
// where the person looking at it happens to be sitting.
//
// The one tricky direction is going FROM what someone typed ("2026-09-21
// at 10:00") TO a real moment in time. A form gives us a wall-clock time
// with no timezone attached, and the right UTC moment depends on whether
// daylight saving is in effect on that date in Texas. There is no date
// library in this project on purpose (fewer dependencies, a clean
// npm audit), so this file does that conversion itself using the
// Intl API that every JavaScript runtime already ships with.
//
// This file is pure - no database, no "server-only" - so both server code
// and Client Components can import it.

export const ORG_TIMEZONE = "America/Chicago";

// How far ahead of UTC the given timezone is at the given moment, in
// minutes. Negative for Texas (UTC-5 in summer, UTC-6 in winter).
function offsetMinutesAt(utcMillis: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMillis));

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  // What the wall clock in that timezone reads at this moment, expressed
  // as if it were UTC - the difference from the real UTC moment IS the offset.
  const wallAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((wallAsUtc - utcMillis) / 60000);
}

// Turns a wall-clock time in the organization's timezone into the real
// UTC moment. Accepts the format an <input type="datetime-local"> gives:
// "2026-09-21T10:00". Returns null for anything that is not a real date.
//
// The approach: guess the offset, apply it, then check the guess by
// asking what the offset actually is at the resulting moment. Doing the
// check a second time is what makes dates right next to a daylight
// saving change come out correctly.
export function orgLocalToUtc(
  local: string,
  timeZone: string = ORG_TIMEZONE,
): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!match) return null;

  const y = Number(match[1]);
  const mo = Number(match[2]);
  const d = Number(match[3]);
  const h = Number(match[4]);
  const mi = Number(match[5]);

  // Reject things like February 30th or 25:00 rather than letting Date
  // quietly roll them forward into a different, valid-looking moment.
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(asUtc);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    check.getUTCHours() !== h ||
    check.getUTCMinutes() !== mi
  ) {
    return null;
  }

  const firstGuess = asUtc - offsetMinutesAt(asUtc, timeZone) * 60000;
  const corrected = asUtc - offsetMinutesAt(firstGuess, timeZone) * 60000;
  return new Date(corrected);
}

// "Mon, Sep 21" - the day, in the organization's timezone.
export function formatOrgDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ORG_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

// "10:00 AM" - the time of day, in the organization's timezone.
export function formatOrgTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ORG_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// "10:00 AM to 11:00 AM" - a visit's window.
export function formatOrgTimeRange(start: Date, end: Date): string {
  return `${formatOrgTime(start)} to ${formatOrgTime(end)}`;
}

// A calendar date with no time of day, such as a date of birth. A form
// gives "1948-03-14"; we store it as midnight UTC and always show it in
// UTC too, so the day never shifts by one depending on where the server
// or the person happens to be. (The visit helpers above are for a moment
// in time in Texas; a birthday is not a moment, it is a day.)
// Returns null for anything that is not a real date, so February 30th is
// refused instead of quietly becoming March 2nd.
export function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const y = Number(match[1]);
  const mo = Number(match[2]);
  const d = Number(match[3]);

  const date = new Date(Date.UTC(y, mo - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

// "Mar 14, 1948" - a calendar date stored as midnight UTC.
export function formatCalendarDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
