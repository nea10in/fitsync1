import { getAllPlansForProfile, buildAdherence, getPreviousWeekPlan } from "../db/workoutDb";
import { getNextSevenPlanDays } from "../lib/dates";
import type { OuraHealthSummary, PersonProfile, StoredWorkoutPlan, WorkoutPlan } from "../types";
import { matchExpertProfile } from "./expertGuidance";

export interface ProgressionContext {
  habitWeekNumber: number;
  consecutiveGoodWeeks: number;
  lastWeekAvgIntensity: number | null;
  lastWeekMaxIntensity: number | null;
  lastWeekCompletionRate: number | null;
  recommendedAvgIntensity: number;
  recommendedMaxIntensity: number;
  allowIntensityFive: boolean;
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function planIntensityStats(plan: StoredWorkoutPlan): {
  avg: number;
  max: number;
} {
  const all = plan.sessions.map((s) => s.intensity_level);
  return {
    avg: avg(all),
    max: Math.max(...all),
  };
}

function countConsecutiveGoodWeeks(plans: StoredWorkoutPlan[]): number {
  let count = 0;
  for (const plan of plans) {
    if (buildAdherence(plan).completionRate >= 0.7) count += 1;
    else break;
  }
  return count;
}

function ouraSupportsProgression(summary: OuraHealthSummary): boolean {
  if (summary.days.length === 0) return false;
  const recent = summary.days.slice(-7);
  const readiness = recent
    .map((d) => d.readinessScore)
    .filter((v): v is number => v != null);
  if (readiness.length < 3) return false;
  const avgReadiness = avg(readiness);
  const lowDays = readiness.filter((r) => r < 60).length;
  return avgReadiness >= 68 && lowDays <= 2;
}

export async function getProgressionContext(
  profileId: string,
  summary: OuraHealthSummary,
  profile?: PersonProfile,
): Promise<ProgressionContext> {
  const muscleFocus = profile
    ? matchExpertProfile(profile) === "men_building_muscle"
    : false;
  const age = profile?.age ?? null;
  const upcomingStart = getNextSevenPlanDays()[0].iso;
  const allPlans = await getAllPlansForProfile(profileId);
  const pastPlans = allPlans.filter((p) => p.weekEnd < upcomingStart);
  const habitWeekNumber = pastPlans.length + 1;

  const previous = await getPreviousWeekPlan(profileId);
  const adherence = previous ? buildAdherence(previous) : null;
  const completionRate = adherence?.completionRate ?? null;
  const stats = previous ? planIntensityStats(previous) : null;

  const consecutiveGoodWeeks = countConsecutiveGoodWeeks(
    pastPlans.sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
  );

  const goodAdherence = (completionRate ?? 0) >= 0.7;
  const strongAdherence = (completionRate ?? 0) >= 0.8;
  const recoveryOk = ouraSupportsProgression(summary);

  let recommendedMax = 2;
  let recommendedAvg = 1.5;

  if (habitWeekNumber === 1) {
    if (muscleFocus) {
      recommendedMax = recoveryOk ? 4 : 3;
      recommendedAvg = recoveryOk ? 2.5 : 2;
      if (age != null && age >= 40) {
        recommendedMax = Math.min(recommendedMax, recoveryOk ? 3 : 2);
        recommendedAvg = Math.min(recommendedAvg, recoveryOk ? 2.25 : 1.75);
      }
    } else {
      recommendedMax = recoveryOk ? 3 : 2;
      recommendedAvg = recoveryOk ? 2 : 1.5;
    }
  } else if (!goodAdherence) {
    recommendedMax = Math.max(1, Math.floor(stats?.max ?? 2) - 1);
    recommendedAvg = Math.max(1, (stats?.avg ?? 2) - 0.5);
  } else {
    const baseMax = stats?.max ?? 2;
    const step = consecutiveGoodWeeks >= 3 ? 1 : 0;
    const maxCap = muscleFocus ? 5 : 4;
    recommendedMax = Math.min(maxCap, Math.ceil(baseMax) + step);
    recommendedAvg = Math.min(
      muscleFocus ? 3.5 : 3.5,
      (stats?.avg ?? 2) + (consecutiveGoodWeeks >= 2 ? 0.5 : 0.25),
    );
    if (recoveryOk && consecutiveGoodWeeks >= 2) {
      recommendedMax = Math.min(maxCap, recommendedMax + 1);
      recommendedAvg += muscleFocus ? 0.35 : 0.25;
    }
  }

  const allowIntensityFive = muscleFocus
    ? habitWeekNumber >= 3 &&
      strongAdherence &&
      consecutiveGoodWeeks >= 2 &&
      recoveryOk &&
      goodAdherence
    : habitWeekNumber >= 5 &&
      strongAdherence &&
      consecutiveGoodWeeks >= 3 &&
      recoveryOk &&
      goodAdherence;

  if (allowIntensityFive) {
    recommendedMax = 5;
    recommendedAvg = Math.min(3.5, recommendedAvg + 0.25);
  }

  return {
    habitWeekNumber,
    consecutiveGoodWeeks,
    lastWeekAvgIntensity: stats?.avg ?? null,
    lastWeekMaxIntensity: stats?.max ?? null,
    lastWeekCompletionRate: completionRate,
    recommendedAvgIntensity: Math.round(recommendedAvg * 10) / 10,
    recommendedMaxIntensity: recommendedMax,
    allowIntensityFive,
  };
}

export function formatProgressionForPrompt(
  ctx: ProgressionContext,
  profile?: PersonProfile,
): string {
  const muscleFocus = profile
    ? matchExpertProfile(profile) === "men_building_muscle"
    : false;
  const lines = [
    `Habit week #${ctx.habitWeekNumber} with FitSync`,
    `Consecutive weeks ≥70% adherence: ${ctx.consecutiveGoodWeeks}`,
  ];

  if (ctx.lastWeekAvgIntensity != null) {
    lines.push(
      `Last week intensity — avg: ${ctx.lastWeekAvgIntensity.toFixed(1)}, max: ${ctx.lastWeekMaxIntensity}`,
    );
  }
  if (ctx.lastWeekCompletionRate != null) {
    lines.push(
      `Last week completion: ${Math.round(ctx.lastWeekCompletionRate * 100)}%`,
    );
  }

  lines.push(
    `THIS WEEK TARGETS: average intensity_level ≈ ${ctx.recommendedAvgIntensity}, max per session ≤ ${ctx.recommendedMaxIntensity}`,
    ctx.allowIntensityFive
      ? "One session MAY reach intensity 5 if it is the primary strength day and recovery is strong."
      : "Do NOT assign intensity 5 this week — habit still building.",
    "GRADUAL RAMP RULES:",
    "- Increase at most +1 intensity vs last week on any single session type",
    "- Never jump more than one intensity level day-over-day",
    "- If last week completion <70%, repeat or lower intensity — no progression",
    "- Spread harder sessions (3+) across the week; bookend with mobility/rest",
    "- Notes must state why intensity changed vs last week (e.g. 'Week 3 habit ramp +1')",
  );

  if (muscleFocus) {
    lines.push(
      "MUSCLE-BUILDING PRIORITY: Progression caps limit intensity, NOT strength session count — still schedule ≥4 strength days per plan composition rules.",
    );
    if (profile?.age != null || profile?.weightLb != null) {
      const bits = [
        profile.age != null ? `age ${profile.age}` : null,
        profile.weightLb != null ? `${profile.weightLb} lbs` : null,
      ].filter(Boolean);
      lines.push(
        `Use saved profile stats (${bits.join(", ")}) when setting duration, load, and recovery between strength sessions.`,
      );
    }
  }

  return lines.join("\n");
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function applyProgressionCaps(
  plan: WorkoutPlan,
  ctx: ProgressionContext,
): WorkoutPlan {
  let sessions = plan.sessions.map((s) => ({
    ...s,
    intensity_level: clamp(s.intensity_level, 1, ctx.recommendedMaxIntensity),
  }));

  if (!ctx.allowIntensityFive) {
    sessions = sessions.map((s) => ({
      ...s,
      intensity_level: Math.min(s.intensity_level, 4),
    }));
  } else {
    const peakIndex = sessions.reduce(
      (best, s, i) =>
        s.intensity_level > sessions[best].intensity_level ? i : best,
      0,
    );
    sessions = sessions.map((s, i) => ({
      ...s,
      intensity_level:
        i === peakIndex
          ? clamp(s.intensity_level, 1, 5)
          : Math.min(s.intensity_level, ctx.recommendedMaxIntensity),
    }));
  }

  if (
    ctx.lastWeekMaxIntensity != null &&
    (ctx.lastWeekCompletionRate ?? 0) >= 0.7
  ) {
    const maxJump = ctx.lastWeekMaxIntensity + 1;
    sessions = sessions.map((s) => ({
      ...s,
      intensity_level: Math.min(s.intensity_level, maxJump),
    }));
  }

  const currentAvg = avg(sessions.map((s) => s.intensity_level));
  if (currentAvg > ctx.recommendedAvgIntensity + 0.6) {
    const scale = ctx.recommendedAvgIntensity / currentAvg;
    sessions = sessions.map((s) => ({
      ...s,
      intensity_level: clamp(
        s.intensity_level * scale,
        1,
        ctx.recommendedMaxIntensity,
      ),
    }));
  }

  for (let i = 1; i < sessions.length; i++) {
    const prev = sessions[i - 1].intensity_level;
    const curr = sessions[i].intensity_level;
    if (curr > prev + 1) {
      sessions[i] = {
        ...sessions[i],
        intensity_level: prev + 1,
      };
    }
  }

  return { ...plan, sessions };
}
