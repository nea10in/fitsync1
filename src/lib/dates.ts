import { isNehaProfile } from "./schedule";
import type { PersonProfile } from "../types";

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar date as YYYY-MM-DD (avoids UTC shift from toISOString). */
export function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local date as YYYY-MM-DD. */
export function getTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return formatDateISO(d);
}

export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function getWeekdayName(iso: string): (typeof WEEKDAY_NAMES)[number] {
  return WEEKDAY_NAMES[parseLocalDate(iso).getDay()];
}

export function getWeekdayShort(iso: string): (typeof WEEKDAY_SHORT)[number] {
  return WEEKDAY_SHORT[parseLocalDate(iso).getDay()];
}

export interface PlanDay {
  iso: string;
  weekday: (typeof WEEKDAY_NAMES)[number];
  weekdayShort: (typeof WEEKDAY_SHORT)[number];
  context: string;
}

/** Neha only: gym Fri–Sun. Other profiles: no day-level gym restriction here. */
export function isGymAvailable(iso: string, profile?: PersonProfile): boolean {
  if (!profile || !isNehaProfile(profile)) return true;
  const dow = parseLocalDate(iso).getDay();
  return dow === 5 || dow === 0 || dow === 6;
}

function nehaContextForWeekday(dow: number): string {
  switch (dow) {
    case 1:
      return "home only; fixed trainer strength 8:30 AM (30 min) — no other strength";
    case 2:
    case 3:
    case 4:
      return "office day; home only — short evening session";
    case 5:
      return "Friday office — work starts 9:00 AM; gym before 9 AM or evening ~6:30 PM only";
    case 0:
    case 6:
      return "weekend; home or gym available";
    default:
      return "";
  }
}

function contextForWeekday(dow: number, profile?: PersonProfile): string {
  if (profile && isNehaProfile(profile)) {
    return nehaContextForWeekday(dow);
  }
  return `${WEEKDAY_NAMES[dow]} — follow this profile's weekly schedule`;
}

/** The next 7 calendar days starting tomorrow (local time). */
export function getNextSevenPlanDays(profile?: PersonProfile): PlanDay[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1);

  const days: PlanDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dow = d.getDay();
    days.push({
      iso: formatDateISO(d),
      weekday: WEEKDAY_NAMES[dow],
      weekdayShort: WEEKDAY_SHORT[dow],
      context: contextForWeekday(dow, profile),
    });
  }
  return days;
}

export function getLastNDaysRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return {
    start: formatDateISO(start),
    end: formatDateISO(end),
  };
}

export function formatDisplayDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
