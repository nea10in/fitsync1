import { NEHA_PROFILE_ID } from "../constants/profile";
import type { StoredWorkoutPlan } from "../types";
import { planRecordId, STORES, tx, txWrite } from "./database";

const REPAIR_FLAG = "fitsync_workout_plans_v4_repaired";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isLegacyPlanId(id: string): boolean {
  return ISO_DATE.test(id) && !id.includes(":");
}

/** Fix legacy single-profile plan rows after removing unique weekStart index. */
export async function repairWorkoutPlansForMultiProfile(): Promise<void> {
  if (localStorage.getItem(REPAIR_FLAG)) return;

  try {
    const plans = await tx<StoredWorkoutPlan[]>(
      STORES.workoutPlans,
      "readonly",
      (store) => store.getAll(),
    );

    if (plans.length === 0) {
      localStorage.setItem(REPAIR_FLAG, "1");
      return;
    }

    await txWrite(STORES.workoutPlans, (store) => {
      const seen = new Set<string>();

      for (const raw of plans) {
        const weekStart = String(raw.weekStart ?? raw.id);
        const profileId = raw.profileId ?? NEHA_PROFILE_ID;
        const canonicalId = planRecordId(profileId, weekStart);
        const dedupeKey = `${profileId}:${weekStart}`;

        if (seen.has(dedupeKey)) {
          store.delete(String(raw.id));
          continue;
        }
        seen.add(dedupeKey);

        const repaired: StoredWorkoutPlan = {
          ...raw,
          id: canonicalId,
          profileId,
          weekStart,
          weekEnd: String(raw.weekEnd ?? weekStart),
        };

        store.put(repaired);

        if (String(raw.id) !== canonicalId) {
          store.delete(String(raw.id));
        }
      }

      for (const raw of plans) {
        if (isLegacyPlanId(String(raw.id))) {
          store.delete(String(raw.id));
        }
      }
    });

    localStorage.setItem(REPAIR_FLAG, "1");
  } catch {
    localStorage.setItem(REPAIR_FLAG, "1");
  }
}
