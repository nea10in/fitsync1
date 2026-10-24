import type { PersonProfile } from "../types";
import { matchExpertProfile } from "../services/expertGuidance";

/** ~0.8–1.0 g per lb bodyweight (Lyon / RP muscle-centric range). */
export function proteinTargetGrams(weightLb: number): { low: number; high: number } {
  return {
    low: Math.round(weightLb * 0.8),
    high: Math.round(weightLb),
  };
}

export function hasPhysiologyData(profile: PersonProfile): boolean {
  return profile.age != null || profile.weightLb != null;
}

function ageRecoveryGuidance(profile: PersonProfile): string[] {
  const age = profile.age;
  if (age == null) return [];

  const lines: string[] = [`Age ${age}:`];

  if (age >= 13 && age <= 19) {
    lines.push(
      "Teen recovery is fast but form and joint safety come first — avoid maximal loading; favor technique and consistency.",
    );
  } else if (age >= 20 && age <= 39) {
    lines.push(
      "Prime training age — can handle 4 strength sessions/week if recovery and schedule allow; still use gradual load progression.",
    );
  } else if (age >= 40 && age <= 54) {
    lines.push(
      "Allow 48h between hard strength sessions for same muscle groups; prioritize warm-up and joint prep (AthleanX prehab).",
    );
  } else if (age >= 55) {
    lines.push(
      "Favor controlled tempos, longer warm-ups, and extra mobility; limit high-impact plyometrics unless goals demand them.",
    );
  }

  return lines;
}

function weightGuidance(profile: PersonProfile): string[] {
  const weight = profile.weightLb;
  if (weight == null) return [];

  const protein = proteinTargetGrams(weight);
  const lines = [
    `Weight ${weight} lbs:`,
    `Daily protein target for muscle recovery: ${protein.low}–${protein.high} g (spread across meals, extra on training days).`,
  ];

  if (profile.gender === "male" && matchExpertProfile(profile) === "men_building_muscle") {
    lines.push(
      "Strength selection: compound lifts (squat/hinge, press, row) scaled to current bodyweight — progress reps/load gradually, not session heroics.",
    );
    if (weight >= 200) {
      lines.push(
        "Support body composition with Zone 2 cardio in addition to lifting; low-impact options on recovery days.",
      );
    }
  }

  return lines;
}

/** Age and weight from the saved profile — used to scale plans, not generic defaults. */
export function formatProfilePhysiology(profile: PersonProfile): string {
  if (!hasPhysiologyData(profile)) {
    return `## Profile physiology
Age and weight are not set on this profile. Use conservative volume and note in the plan summary that age/weight should be added for better personalization.`;
  }

  const parts = [
    "## Profile physiology (use this person's saved age & weight)",
    ...ageRecoveryGuidance(profile),
    ...weightGuidance(profile),
  ];

  if (profile.age != null && profile.weightLb != null) {
    parts.push(
      `Plan for a ${profile.age}-year-old${profile.gender ? ` ${profile.gender}` : ""} athlete at ${profile.weightLb} lbs — session duration, lift progressions, and recovery must match this profile, not a generic template.`,
    );
  }

  return parts.join("\n");
}
