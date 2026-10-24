import type { WorkoutSession } from "../types";
import { parseLocalDate } from "../lib/dates";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local floating time — matches user's calendar timezone on import. */
function formatIcsLocal(date: Date): string {
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Parse time from suggestion; date always comes from session.day (local). */
function parseSessionStart(day: string, suggestion: string): Date {
  const base = parseLocalDate(day);
  const match = suggestion.match(
    /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i,
  );
  if (!match) {
    base.setHours(7, 0, 0, 0);
    return base;
  }
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  base.setHours(hours, minutes, 0, 0);
  return base;
}

function uid(day: string, title: string): string {
  return `${day}-${title.replace(/\s+/g, "-").toLowerCase()}@fitsync`;
}

export function buildIcsCalendar(sessions: WorkoutSession[]): string {
  const now = formatIcsLocal(new Date());
  const events = sessions.map((session) => {
    const start = parseSessionStart(
      session.day,
      session.calendar_time_suggestion,
    );
    const end = new Date(start.getTime() + session.duration_minutes * 60_000);
    const description = [
      `Type: ${session.session_type}`,
      `Duration: ${session.duration_minutes} min`,
      `Intensity: ${session.intensity_level}/5`,
      `Location: ${session.location}`,
      "",
      session.notes,
    ].join("\\n");

    return [
      "BEGIN:VEVENT",
      `UID:${uid(session.day, session.calendar_title)}`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatIcsLocal(start)}`,
      `DTEND:${formatIcsLocal(end)}`,
      `SUMMARY:${escapeIcs(session.calendar_title)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs("Workout in 30 minutes")}`,
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FitSync//Workout Plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    events.join("\r\n"),
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(sessions: WorkoutSession[], filename = "fitsync-workouts.ics"): void {
  const ics = buildIcsCalendar(sessions);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
