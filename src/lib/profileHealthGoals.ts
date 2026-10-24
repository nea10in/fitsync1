import type { PersonProfile } from "../types";

export function hasGoals(profile: PersonProfile): boolean {
  return Boolean(profile.goals.trim());
}

export function hasHealthConditions(profile: PersonProfile): boolean {
  return Boolean(profile.healthConditions.trim());
}

/** Mandatory prompt block so goals and medical context shape every session. */
export function formatGoalsAndHealthGuidance(profile: PersonProfile): string {
  const goals = profile.goals.trim();
  const conditions = profile.healthConditions.trim();

  if (!goals && !conditions) {
    return `## Goals & medical context
No goals or health conditions saved for ${profile.name}.
- Use expert panel and physiology defaults
- Note in plan summary that adding goals and health conditions will improve personalization`;
  }

  const parts = ["## Goals & medical context (MANDATORY — every session must reflect these)"];

  if (goals) {
    parts.push(
      `### Stated goals`,
      goals,
      `Goal application rules:`,
      `- Plan summary must explain how this week's sessions support the goals above`,
      `- Session notes must tie specific exercises to at least one stated goal where relevant`,
      `- Do not program sessions that contradict these goals (e.g. all cardio when goal is muscle/strength)`,
    );
  }

  if (conditions) {
    parts.push(
      `### Health conditions & medical considerations`,
      conditions,
      `Medical safety rules:`,
      `- Treat every condition above as a hard constraint — modify intensity, exercise selection, and duration`,
      `- Favor low-impact options and longer warm-ups when autoimmune, thyroid, cardiac, joint, or metabolic conditions apply`,
      `- Avoid sudden volume or intensity spikes; prefer steady progressive overload`,
      `- When unsure, choose the more conservative session and explain the modification in notes`,
      `- If a condition suggests medical clearance for exercise, note "confirm with your clinician" in summary — do not prescribe treatment`,
    );
  }

  if (goals && conditions) {
    parts.push(
      `### Goals + conditions together`,
      `- Balance ambition (goals) with safety (conditions) — when they conflict, conditions win`,
      `- Example: strength goals with hyperthyroidism/autoimmune → gradual load, adequate recovery, anti-inflammatory recovery days`,
    );
  }

  return parts.join("\n");
}
