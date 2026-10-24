import type { PersonProfile, WorkoutPlan, WorkoutSession } from "../types";
import {
  getNextSevenPlanDays,
  getWeekdayName,
  getWeekdayShort,
  isGymAvailable,
  type PlanDay,
} from "../lib/dates";
import { defaultSessionTime, enforceScheduleTime } from "../lib/scheduleTimes";

const WEEKDAY_PATTERN =
  /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/gi;

const TIME_PATTERN = /(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i;

function enforceLocation(
  location: "home" | "gym",
  planDay: PlanDay,
  profile?: PersonProfile,
): "home" | "gym" {
  if (location === "gym" && !isGymAvailable(planDay.iso, profile)) {
    return "home";
  }
  return location;
}

function extractTime(suggestion: string, fallback: string): string {
  const match = suggestion.match(TIME_PATTERN);
  return match ? match[1].replace(/\s+/g, " ").trim() : fallback;
}

/** Remove weekday words that don't match the session's actual date. */
export function sanitizeCalendarTitle(title: string, iso: string): string {
  const correct = getWeekdayName(iso).toLowerCase();
  const correctShort = getWeekdayShort(iso).toLowerCase();

  let cleaned = title.trim();
  cleaned = cleaned.replace(WEEKDAY_PATTERN, (match) => {
    const lower = match.toLowerCase();
    if (lower === correct || lower === correctShort) return match;
    return "";
  });
  cleaned = cleaned.replace(/\s*[-–—|:]\s*/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || title.trim();
}

export function fixTimeSuggestion(
  suggestion: string,
  planDay: PlanDay,
  profile?: PersonProfile,
): string {
  const raw = extractTime(suggestion, defaultSessionTime(planDay, profile));
  const time = enforceScheduleTime(raw, planDay, profile);
  return `${planDay.weekdayShort} ${time}`;
}

function normalizeSession(
  session: WorkoutSession,
  planDay: PlanDay,
  profile?: PersonProfile,
): WorkoutSession {
  return {
    ...session,
    day: planDay.iso,
    location: enforceLocation(session.location, planDay, profile),
    calendar_title: sanitizeCalendarTitle(session.calendar_title, planDay.iso),
    calendar_time_suggestion: fixTimeSuggestion(
      session.calendar_time_suggestion,
      planDay,
      profile,
    ),
  };
}

/**
 * Force sessions onto the correct 7-day calendar.
 * LLMs often mismatch weekday names in titles vs the `day` field.
 */
export function normalizeWorkoutPlan(
  plan: WorkoutPlan,
  profile?: PersonProfile,
): WorkoutPlan {
  const planDays = getNextSevenPlanDays(profile);
  const byDay = new Map(plan.sessions.map((s) => [s.day, s]));
  const sorted = [...plan.sessions].sort((a, b) => a.day.localeCompare(b.day));

  const sessions = planDays.map((planDay, index) => {
    const matched =
      byDay.get(planDay.iso) ??
      sorted[index] ??
      sorted.find((s) => getWeekdayName(s.day) === planDay.weekday);
    if (!matched) {
      throw new Error(`Missing session for ${planDay.iso} (${planDay.weekday})`);
    }
    return normalizeSession(matched, planDay, profile);
  });

  return { ...plan, sessions };
}
