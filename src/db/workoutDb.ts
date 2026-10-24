import { formatDisplayDate, getNextSevenPlanDays, getTodayISO } from "../lib/dates";
import type {
  StoredWorkoutPlan,
  StoredWorkoutSession,
  WorkoutAdherence,
  WorkoutPlan,
} from "../types";
import { NEHA_PROFILE_ID } from "../constants/profile";
import { openDb, planRecordId, STORES, tx, txWrite } from "./database";
import { migrateLegacyWorkoutPlansIfNeeded } from "./profileDb";
import { repairWorkoutPlansForMultiProfile } from "./workoutPlanRepair";

function toStoredSessions(sessions: WorkoutPlan["sessions"]): StoredWorkoutSession[] {
  return sessions.map((s) => ({
    ...s,
    completed: false,
    completedAt: null,
  }));
}

function planBounds(plan: WorkoutPlan): { weekStart: string; weekEnd: string } {
  const days = [...plan.sessions].map((s) => s.day).sort();
  return { weekStart: days[0], weekEnd: days[days.length - 1] };
}

function mergeSessions(
  previous: StoredWorkoutSession[],
  next: WorkoutPlan["sessions"],
): StoredWorkoutSession[] {
  const byDay = new Map(previous.map((s) => [s.day, s]));
  return next.map((session) => {
    const old = byDay.get(session.day);
    return {
      ...session,
      completed: old?.completed ?? false,
      completedAt: old?.completedAt ?? null,
    };
  });
}

export async function saveWorkoutPlan(
  profileId: string,
  plan: WorkoutPlan,
): Promise<StoredWorkoutPlan> {
  await migrateLegacyWorkoutPlansIfNeeded();
  await repairWorkoutPlansForMultiProfile();
  const { weekStart, weekEnd } = planBounds(plan);
  const id = planRecordId(profileId, weekStart);
  const existing = await getPlanByWeekStart(profileId, weekStart);

  const record: StoredWorkoutPlan = {
    id,
    profileId,
    weekStart,
    weekEnd,
    generatedAt: new Date().toISOString(),
    summary: plan.summary,
    sessions: existing
      ? mergeSessions(existing.sessions, plan.sessions)
      : toStoredSessions(plan.sessions),
  };

  await tx(STORES.workoutPlans, "readwrite", (store) => store.put(record));
  return record;
}

export function storedPlanToWorkoutPlan(stored: StoredWorkoutPlan): WorkoutPlan {
  return {
    summary: stored.summary,
    sessions: stored.sessions.map(
      ({ completed: _c, completedAt: _a, ...session }) => session,
    ),
  };
}

/** Latest saved plan that still covers today or the future (weekEnd >= today). */
export async function getActivePlanForProfile(
  profileId: string,
): Promise<StoredWorkoutPlan | null> {
  const today = getTodayISO();
  const plans = await getAllPlansForProfile(profileId);
  return plans.find((p) => p.weekEnd >= today) ?? null;
}

/** True when there is no plan or the last session day is before today. */
export function planNeedsRegeneration(
  plan: StoredWorkoutPlan | null,
  today = getTodayISO(),
): boolean {
  if (!plan) return true;
  return plan.weekEnd < today;
}

export function formatPlanDateRange(plan: StoredWorkoutPlan): string {
  return `${formatDisplayDate(plan.weekStart)} – ${formatDisplayDate(plan.weekEnd)}`;
}

export async function getPlanByWeekStart(
  profileId: string,
  weekStart: string,
): Promise<StoredWorkoutPlan | null> {
  try {
    const id = planRecordId(profileId, weekStart);
    const plan = await tx<StoredWorkoutPlan | undefined>(
      STORES.workoutPlans,
      "readonly",
      (store) => store.get(id),
    );
    return plan ?? null;
  } catch {
    return null;
  }
}

const NEHA_WORKOUTS_PURGE_FLAG = "fitsync_neha_workouts_purged_2026";

/** Remove every saved workout plan for a profile. */
export async function deleteAllWorkoutPlansForProfile(
  profileId: string,
): Promise<number> {
  await migrateLegacyWorkoutPlansIfNeeded();
  await repairWorkoutPlansForMultiProfile();
  const plans = await getAllPlansForProfile(profileId);
  if (plans.length === 0) return 0;

  await txWrite(STORES.workoutPlans, (store) => {
    for (const plan of plans) {
      store.delete(plan.id);
    }
  });
  return plans.length;
}

/** One-time wipe of Neha's workout history (requested cleanup). */
export async function purgeNehaWorkoutHistoryOnce(): Promise<void> {
  if (localStorage.getItem(NEHA_WORKOUTS_PURGE_FLAG)) return;
  await deleteAllWorkoutPlansForProfile(NEHA_PROFILE_ID);
  localStorage.setItem(NEHA_WORKOUTS_PURGE_FLAG, "1");
}

export async function getAllPlansForProfile(
  profileId: string,
): Promise<StoredWorkoutPlan[]> {
  await migrateLegacyWorkoutPlansIfNeeded();
  await repairWorkoutPlansForMultiProfile();
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.workoutPlans, "readonly");
    const store = tx.objectStore(STORES.workoutPlans);
    const index = store.index("profileId");
    const req = index.getAll(profileId);
    req.onsuccess = () => {
      const plans = (req.result as StoredWorkoutPlan[]).sort((a, b) =>
        b.weekStart.localeCompare(a.weekStart),
      );
      resolve(plans);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getPreviousWeekPlan(
  profileId: string,
): Promise<StoredWorkoutPlan | null> {
  const upcomingStart = getNextSevenPlanDays()[0].iso;
  const plans = await getAllPlansForProfile(profileId);
  return (
    plans.find((p) => p.weekEnd < upcomingStart) ??
    plans.find((p) => p.weekStart < upcomingStart) ??
    null
  );
}

export async function setSessionCompleted(
  planId: string,
  day: string,
  completed: boolean,
): Promise<StoredWorkoutPlan> {
  const plan = await tx<StoredWorkoutPlan | undefined>(
    STORES.workoutPlans,
    "readonly",
    (store) => store.get(planId),
  );
  if (!plan) throw new Error("Workout plan not found");

  const sessions = plan.sessions.map((s) =>
    s.day === day
      ? {
          ...s,
          completed,
          completedAt: completed ? new Date().toISOString() : null,
        }
      : s,
  );

  const updated: StoredWorkoutPlan = { ...plan, sessions };
  await tx(STORES.workoutPlans, "readwrite", (store) => store.put(updated));
  return updated;
}

export function buildAdherence(plan: StoredWorkoutPlan): WorkoutAdherence {
  const completedCount = plan.sessions.filter((s) => s.completed).length;
  const totalCount = plan.sessions.length;
  return {
    plan,
    completedCount,
    totalCount,
    completionRate: totalCount ? completedCount / totalCount : 0,
  };
}

export function formatAdherenceForPrompt(adherence: WorkoutAdherence): string {
  const intensities = adherence.plan.sessions.map((s) => s.intensity_level);
  const avgIntensity = intensities.length
    ? Math.round(
        (intensities.reduce((a, b) => a + b, 0) / intensities.length) * 10,
      ) / 10
    : null;

  const lines = adherence.plan.sessions.map((s) => {
    const status = s.completed ? "DONE" : "NOT DONE";
    return `- ${s.day} (${s.calendar_title}, ${s.session_type}, intensity ${s.intensity_level}): ${status}`;
  });

  const pct = Math.round(adherence.completionRate * 100);
  return [
    `Week ${adherence.plan.weekStart} → ${adherence.plan.weekEnd}`,
    `Completed ${adherence.completedCount}/${adherence.totalCount} sessions (${pct}%)`,
    avgIntensity != null ? `Average intensity last week: ${avgIntensity}/5` : null,
    ...lines,
    adherence.completionRate < 0.7
      ? "Adherence below 70% — hold volume/intensity steady or reduce slightly; do not ramp up."
      : "Adherence solid — increase intensity by at most +1 vs last week on select sessions.",
  ]
    .filter(Boolean)
    .join("\n");
}
