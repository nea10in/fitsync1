import type { OuraHealthSummary, PersonProfile, WorkoutPlan } from "../types";
import { getNextSevenPlanDays } from "../lib/dates";
import { formatGoalsAndHealthGuidance } from "../lib/profileHealthGoals";
import { formatProfilePhysiology } from "../lib/profilePhysiology";
import { isNehaProfile, scheduleForProfile } from "../lib/schedule";
import { scheduleTimeRulesForPrompt } from "../lib/scheduleTimes";
import {
  applyProgressionCaps,
  formatProgressionForPrompt,
  type ProgressionContext,
} from "./progression";
import {
  formatExpertGuidanceForPrompt,
  formatPlanCompositionRules,
  matchExpertProfile,
} from "./expertGuidance";
import { normalizeWorkoutPlan } from "./planNormalize";
import { summarizeOuraMetrics } from "./oura";

/** Free-tier friendly model on Groq — strong at structured JSON. */
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "/api/groq/openai/v1/chat/completions";

export class GroqApiError extends Error {
  constructor(
    message: string,
    public readonly rawPrompt: string,
  ) {
    super(message);
    this.name = "GroqApiError";
  }
}

function genderLabel(gender: PersonProfile["gender"]): string | null {
  if (gender === "male") return "Male";
  if (gender === "female") return "Female";
  return null;
}

function formatProfileContext(profile: PersonProfile): string {
  return [
    `Name: ${profile.name}`,
    genderLabel(profile.gender)
      ? `Gender: ${genderLabel(profile.gender)}`
      : null,
    profile.age != null ? `Age: ${profile.age} (use for expert match & recovery)` : "Age: not set",
    profile.weightLb != null
      ? `Weight: ${profile.weightLb} lbs (use for protein targets & lift scaling)`
      : "Weight: not set",
    `Uses Oura Ring data: ${profile.useOuraData ? "yes" : "no"}`,
    profile.goals.trim() ? `Goals: ${profile.goals.trim()}` : null,
    profile.healthConditions.trim()
      ? `Health conditions / considerations: ${profile.healthConditions.trim()}`
      : null,
    profile.schedule.trim()
      ? `Weekly schedule: (see schedule section below)`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildWorkoutPrompt(
  profile: PersonProfile,
  summary: OuraHealthSummary,
  lastWeekAdherence?: string,
  progressionGuidance?: string,
): string {
  const planDays = getNextSevenPlanDays(profile);
  const scheduleText = scheduleForProfile(profile);
  const exampleTime = isNehaProfile(profile) ? "8:30 AM" : "7:00 AM";
  const calendarBlock = planDays
    .map(
      (d, i) =>
        `Session ${i + 1}: day="${d.iso}" (${d.weekday}) — ${d.context}`,
    )
    .join("\n");

  const metricsBlock =
    profile.useOuraData && summary.days.length > 0
      ? summary.days
          .map(
            (d) =>
              `${d.day}: readiness=${d.readinessScore ?? "—"}, HRV=${d.hrv ?? "—"}ms, RHR=${d.restingHeartRate ?? "—"}bpm, sleep=${d.sleepScore ?? "—"}, activity=${d.activityScore ?? "—"}`,
          )
          .join("\n")
      : "Not using Oura data for this profile — plan from profile details, adherence history, and conservative recovery assumptions.";

  const trends = summarizeOuraMetrics(summary);

  return `You are a personal workout planning assistant for FitSync.

## Active profile
${formatProfileContext(profile)}

${formatProfilePhysiology(profile)}

${formatGoalsAndHealthGuidance(profile)}

${formatExpertGuidanceForPrompt(profile)}

${formatPlanCompositionRules(profile)}

## Slow ramp rule (all expert panels)
Do not program a maximal week — increase only one variable (duration, intensity, or density) when adherence and recovery support it

${
  scheduleText
    ? `## Weekly schedule (mandatory — ${profile.name}'s availability)
${scheduleText}

Schedule rules for this plan:
- Honor every fixed appointment and location constraint above (trainer, office, gym access)
- location "home" on days marked home-only; "gym" only on days gym is available
- calendar_time_suggestion must match preferred times listed above when specified
- Do not double-book strength on days with a fixed trainer session unless schedule allows it
${scheduleTimeRulesForPrompt(scheduleText) ? `\n${scheduleTimeRulesForPrompt(scheduleText)}` : ""}`
    : `## Weekly schedule
No fixed weekly schedule saved for ${profile.name}. Use flexible, realistic session times.
- Do NOT assume office days, gym access, Monday trainer, or Fri–Sun gym unless stated in goals
- Default to home-friendly sessions unless the profile goals imply otherwise`
}

## REQUIRED 7-day calendar (use these EXACT dates)
${calendarBlock}

CRITICAL DATE RULES:
- The "day" field MUST be the exact ISO date string shown above for each session (e.g. "${planDays[0].iso}")
- calendar_title must describe the workout ONLY — do NOT put a weekday name in the title (use "Yoga" not "Sunday Yoga")
- calendar_time_suggestion MUST use the correct weekday abbreviation for that date (e.g. "${planDays[0].weekdayShort} ${exampleTime}" for ${planDays[0].iso})
- Sessions must appear in chronological order matching the list above

## Recovery data inputs
${metricsBlock}

## Trend summary
${trends}
${
  progressionGuidance
    ? `
## Intensity progression (mandatory — gradual habit ramp)
${progressionGuidance}`
    : ""
}
${
  lastWeekAdherence
    ? `
## Last week workout adherence (from user's log)
${lastWeekAdherence}

Use adherence to calibrate this plan:
- If completion < 70%, keep intensity/volume the same or lower — repeat key missed habits at easier dose
- If completion ≥ 70% and Oura recovery is strong, allow a small progressive step (one extra set or +5 min, not both)
- Reference specific missed sessions in notes when re-scheduling similar work`
    : ""
}

## Task
Using recovery trends and the expert ramp principles above, produce the 7-day plan for the exact dates listed.

Respond with ONLY valid JSON (no markdown fences):
{
  "summary": "2-3 sentences linking recovery trends to this person's goals and health conditions",
  "sessions": [
    {
      "day": "YYYY-MM-DD",
      "session_type": "strength | mobility | zone2_walk | yoga | rest",
      "duration_minutes": 30,
      "intensity_level": 1,
      "location": "home",
      "notes": "specific guidance citing ramp logic (e.g. mobility-first, Zone 2, recovery)",
      "calendar_title": "short title WITHOUT weekday name",
      "calendar_time_suggestion": "${planDays[0].weekdayShort} ${exampleTime}"
    }
  ]
}

Rules:
- Exactly 7 sessions, one per required date above
- intensity_level: integer 1–5; follow progression targets above — gradual increase only when habit week and adherence support it
- Follow the plan composition section above for session_type mix (strength count, cardio caps, etc.)
- location must follow this profile's weekly schedule (home-only days vs gym-available days)
- Match calendar_time_suggestion to fixed times in the profile schedule when provided`;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function validatePlan(data: unknown): WorkoutPlan {
  if (!data || typeof data !== "object") {
    throw new Error("Response is not a JSON object");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.summary !== "string") {
    throw new Error('Missing "summary" string');
  }
  if (!Array.isArray(obj.sessions)) {
    throw new Error('Missing "sessions" array');
  }
  const sessions = obj.sessions.map((s, i) => {
    if (!s || typeof s !== "object") throw new Error(`Session ${i} invalid`);
    const row = s as Record<string, unknown>;
    const required = [
      "day",
      "session_type",
      "duration_minutes",
      "intensity_level",
      "location",
      "notes",
      "calendar_title",
      "calendar_time_suggestion",
    ] as const;
    const missing = required.filter((k) => row[k] == null || row[k] === "");
    if (missing.length) {
      throw new Error(`Session ${i} missing: ${missing.join(", ")}`);
    }
    if (row.location !== "home" && row.location !== "gym") {
      throw new Error(`Session ${i}: location must be home or gym`);
    }
    return {
      day: String(row.day),
      session_type: String(row.session_type),
      duration_minutes: Number(row.duration_minutes),
      intensity_level: Number(row.intensity_level),
      location: row.location as "home" | "gym",
      notes: String(row.notes),
      calendar_title: String(row.calendar_title),
      calendar_time_suggestion: String(row.calendar_time_suggestion),
    };
  });
  if (sessions.length !== 7) {
    throw new Error(`Expected 7 sessions, got ${sessions.length}`);
  }
  return { summary: obj.summary, sessions };
}

export async function generateWorkoutPlan(
  profile: PersonProfile,
  apiKey: string,
  summary: OuraHealthSummary,
  lastWeekAdherence?: string,
  progression?: ProgressionContext,
): Promise<{ plan: WorkoutPlan; prompt: string }> {
  const progressionGuidance = progression
    ? formatProgressionForPrompt(progression, profile)
    : undefined;
  const prompt = buildWorkoutPrompt(
    profile,
    summary,
    lastWeekAdherence,
    progressionGuidance,
  );

  let response: Response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 4096,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              matchExpertProfile(profile) === "men_building_muscle"
                ? "You output only valid JSON workout plans. Never put weekday names in calendar_title. Always match day ISO dates exactly. Honor the profile's goals and health conditions in every session and the summary. For men building muscle: at least 4 strength sessions per week with compound lifts in notes. Apply the expert panel and Huberman recovery principles. Increase intensity gradually only when progression targets allow it."
                : "You output only valid JSON workout plans. Never put weekday names in calendar_title. Always match day ISO dates exactly. Honor the profile's stated goals and health conditions in every session note and the plan summary. Apply the profile-matched expert coaching panel and Huberman Lab principles. Increase intensity gradually only when progression targets allow it.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
  } catch {
    throw new GroqApiError(
      "Could not reach Groq API. Run FitSync with npm run dev (Vite proxy required).",
      prompt,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GroqApiError(
      `Groq API error (${response.status})${body ? `: ${body.slice(0, 300)}` : ""}`,
      prompt,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content;
  if (!text) {
    throw new GroqApiError("Empty response from Groq", prompt);
  }

  try {
    const parsed = JSON.parse(extractJson(text)) as unknown;
    const raw = validatePlan(parsed);
    let plan = normalizeWorkoutPlan(raw, profile);
    if (progression) {
      plan = applyProgressionCaps(plan, progression);
    }
    return { plan, prompt };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid JSON";
    throw new GroqApiError(`Could not parse workout plan: ${msg}`, prompt);
  }
}
