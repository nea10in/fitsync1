import type { PlanDay } from "./dates";
import { isNehaProfile } from "./schedule";
import type { PersonProfile } from "../types";

const TIME_PATTERN = /(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/gi;

/** Neha defaults when schedule text does not specify a time. */
function defaultNehaSessionTime(planDay: PlanDay): string {
  switch (planDay.weekday) {
    case "Monday":
      return "8:30 AM";
    case "Tuesday":
    case "Wednesday":
    case "Thursday":
      return "6:30 PM";
    case "Friday":
      return "6:30 PM";
    case "Saturday":
    case "Sunday":
      return "9:00 AM";
    default:
      return "7:00 AM";
  }
}

function normalizeTimeToken(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toUpperCase().replace(/(\d)(AM|PM)/i, "$1 $2");
}

function extractTimes(text: string): string[] {
  const matches = text.match(TIME_PATTERN);
  return matches ? matches.map(normalizeTimeToken) : [];
}

function workStartsAtNine(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    /work\s+starts?\s+(?:at\s+)?9(?::00)?\s*am/.test(lower) ||
    /starts?\s+work\s+at\s+9(?::00)?\s*am/.test(lower) ||
    /office[^\n]{0,40}9(?::00)?\s*am/.test(lower) ||
    /9(?::00)?\s*am[^\n]{0,30}(?:work|office)/.test(lower)
  );
}

/** Infer session time from a profile's freeform schedule for a weekday. */
function timeFromScheduleLine(line: string): string | null {
  const lower = line.toLowerCase();

  if (workStartsAtNine(line)) {
    if (/before\s+9|early morning|7\s*(:00)?\s*am/.test(lower)) return "7:00 AM";
    if (/evening|after work|6\s*:\s*30/.test(lower)) return "6:30 PM";
    return "6:30 PM";
  }

  const explicit = extractTimes(line);
  if (explicit.length > 0) {
    const evening = explicit.find((t) => /PM/i.test(t));
    if (evening) return evening;
    return explicit[0];
  }

  if (/evening|after work/.test(lower)) return "6:30 PM";
  if (/morning/.test(lower) && !workStartsAtNine(line)) return "9:00 AM";

  return null;
}

function scheduleLineForWeekday(schedule: string, weekday: string): string | null {
  const lines = schedule.split("\n").map((l) => l.trim()).filter(Boolean);
  const weekdayLower = weekday.toLowerCase();

  const direct = lines.find((line) => line.toLowerCase().startsWith(weekdayLower));
  if (direct) return direct;

  if (weekday === "Tuesday" || weekday === "Wednesday" || weekday === "Thursday") {
    const range = lines.find((line) => /tuesday\s*[–-]\s*thursday/i.test(line));
    if (range) return range;
  }

  if (weekday === "Saturday" || weekday === "Sunday") {
    const range = lines.find((line) =>
      /(?:saturday|sunday|weekend|sat\s*[–-]\s*sun)/i.test(line),
    );
    if (range) return range;
  }

  return null;
}

export function defaultSessionTime(
  planDay: PlanDay,
  profile?: PersonProfile,
): string {
  const schedule = profile?.schedule?.trim() ?? "";
  if (schedule) {
    const line = scheduleLineForWeekday(schedule, planDay.weekday);
    if (line) {
      const inferred = timeFromScheduleLine(line);
      if (inferred) return inferred;
    }
  }

  if (profile && isNehaProfile(profile)) {
    return defaultNehaSessionTime(planDay);
  }

  return "7:00 AM";
}

function parseHour24(time: string): number | null {
  const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour;
}

/** Replace times that overlap stated work start (e.g. Friday 9 AM work). */
export function enforceScheduleTime(
  time: string,
  planDay: PlanDay,
  profile?: PersonProfile,
): string {
  const schedule = profile?.schedule?.trim() ?? "";
  if (!schedule) return time;

  const line = scheduleLineForWeekday(schedule, planDay.weekday);
  if (!line || !workStartsAtNine(line)) return time;

  const hour = parseHour24(time);
  if (hour == null) return defaultSessionTime(planDay, profile);
  if (hour >= 9 && hour < 17) return "6:30 PM";

  return time;
}

export function scheduleTimeRulesForPrompt(schedule: string): string {
  if (!schedule.trim()) return "";
  const lines: string[] = [
    "Workout time rules (from saved schedule):",
    "- Never set calendar_time_suggestion at or after a stated work start time on that day",
    "- If work starts at 9:00 AM, use early morning (e.g. 7:00 AM) or evening (e.g. 6:30 PM) only",
  ];
  if (/friday/i.test(schedule) && /9(?::00)?\s*am/i.test(schedule)) {
    lines.push("- Friday: do NOT use 9:00 AM or later — work starts at 9 AM");
  }
  return lines.join("\n");
}
