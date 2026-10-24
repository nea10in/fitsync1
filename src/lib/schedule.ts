import { NEHA_PROFILE_ID } from "../constants/profile";
import type { PersonProfile } from "../types";

/** Neha's fixed weekly pattern — not used as a default for other profiles. */
export const NEHA_SCHEDULE = `Monday: Home only. Fixed personal trainer at 8:30 AM (30 min strength) — no other strength this day.

Tuesday–Thursday: Office days. Home workouts only; short evening sessions around 6:30 PM.

Friday: Office day — work starts 9:00 AM. Gym available but not during work hours; use early morning (7:00 AM) or evening (~6:30 PM) only. Never schedule workouts at 9:00 AM or later on Friday.

Saturday–Sunday: Gym available (home or gym). Prefer morning sessions around 9:00 AM when possible.

General: Do not stack heavy strength on back-to-back low-readiness days.`;

export const GENERIC_SCHEDULE_PLACEHOLDER = `Example:
Monday: Home — morning strength 7:00 AM
Wednesday: Gym available — evening session 6:00 PM
Saturday: Long walk or yoga — flexible timing

Describe trainer appointments, work/office days, gym access, and preferred times.`;

export function isNehaProfile(profile: Pick<PersonProfile, "id">): boolean {
  return profile.id === NEHA_PROFILE_ID;
}

export function scheduleForProfile(profile: PersonProfile): string {
  if (profile.schedule?.trim()) return profile.schedule.trim();
  if (isNehaProfile(profile)) return NEHA_SCHEDULE;
  return "";
}

export function schedulePlaceholder(profile: Pick<PersonProfile, "id">): string {
  return isNehaProfile(profile) ? NEHA_SCHEDULE : GENERIC_SCHEDULE_PLACEHOLDER;
}
