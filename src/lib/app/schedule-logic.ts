// src/lib/app/schedule-logic.ts
//
// The small decisions behind the scheduling board (Milestone E2), kept
// apart from the database so they can be tested with made-up rows - the
// same split dashboard-logic.ts uses. Pure: no database, no
// "server-only".
//
// Deliberately works entirely in terms of office-timezone DATE KEYS
// ("2026-09-21", from src/lib/time.ts's orgDateKey), never raw Date
// arithmetic across a timezone boundary. A calendar day is not a fixed
// number of milliseconds once daylight saving is in play, so all the
// "next day" / "start of week" math below happens on the KEY (a plain
// calendar date, manipulated as UTC midnight, which is safe precisely
// because nothing here claims it is a real moment in time) and only
// orgDateKey() itself talks to a real Date + timezone.

import { orgDateKey } from "@/lib/time";

export interface ScheduleVisit {
  id: string;
  scheduledStart: Date;
  status: string;
}

// Adds (or subtracts) whole days to a "YYYY-MM-DD" key.
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

// The Monday of the week that contains this key (Monday..Sunday weeks,
// matching how the office schedules staff).
export function mondayOfWeekContaining(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun .. 6 Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return addDaysToKey(key, diffToMonday);
}

// The seven keys of the week starting at mondayKey, Monday first.
export function weekKeys(mondayKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(mondayKey, i));
}

// "Mon, Sep 21" for a date key - reads it as a plain calendar date, with
// no timezone conversion, since a key already IS an office-timezone day.
export function labelForKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export interface ScheduleDay<T> {
  dateKey: string;
  label: string;
  isToday: boolean;
  visits: T[];
}

// Buckets visits into the seven days of the week starting at mondayKey,
// each day sorted earliest-first. Cancelled visits are left out - a
// cancelled slot is not something the board needs to show as taking up
// the day. Visits outside the requested week are simply not returned.
export function buildScheduleWeek<T extends ScheduleVisit>(
  visits: readonly T[],
  mondayKey: string,
  todayKey: string,
): ScheduleDay<T>[] {
  const keys = weekKeys(mondayKey);
  const byKey = new Map<string, T[]>(keys.map((k) => [k, []]));

  for (const v of visits) {
    if (v.status === "cancelled") continue;
    const bucket = byKey.get(orgDateKey(v.scheduledStart));
    bucket?.push(v);
  }

  for (const bucket of byKey.values()) {
    bucket.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
  }

  return keys.map((k) => ({
    dateKey: k,
    label: labelForKey(k),
    isToday: k === todayKey,
    visits: byKey.get(k) ?? [],
  }));
}
