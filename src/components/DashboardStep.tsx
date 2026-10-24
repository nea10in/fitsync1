import { useCallback, useEffect, useState } from "react";
import type {
  AppError,
  OuraHealthSummary,
  PersonProfile,
  StoredWorkoutPlan,
  WorkoutPlan,
} from "../types";
import { NEHA_PROFILE_ID } from "../constants/profile";
import { getGroqKey } from "../lib/storage";
import {
  buildAdherence,
  formatAdherenceForPrompt,
  formatPlanDateRange,
  getActivePlanForProfile,
  getPreviousWeekPlan,
  planNeedsRegeneration,
  purgeNehaWorkoutHistoryOnce,
  saveWorkoutPlan,
  setSessionCompleted,
  storedPlanToWorkoutPlan,
} from "../db/workoutDb";
import {
  emptyOuraHealthSummary,
  fetchOuraHealthData,
  OuraApiError,
} from "../services/oura";
import { OuraAuthError } from "../services/ouraAuth";
import { GroqApiError, generateWorkoutPlan } from "../services/groq";
import { getProgressionContext } from "../services/progression";
import DataSummaryPanel from "./DataSummaryPanel";
import WorkoutPlanCard from "./WorkoutPlanCard";
import WorkoutTracker from "./WorkoutTracker";
import ErrorBanner from "./ErrorBanner";

interface DashboardStepProps {
  profile: PersonProfile;
  onPlanReady: (plan: WorkoutPlan, summary: OuraHealthSummary | null) => void;
}

export default function DashboardStep({
  profile,
  onPlanReady,
}: DashboardStepProps) {
  const [loading, setLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<StoredWorkoutPlan | null>(null);
  const [previousWeekPlan, setPreviousWeekPlan] = useState<StoredWorkoutPlan | null>(
    null,
  );
  const [ouraSummary, setOuraSummary] = useState<OuraHealthSummary | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  const needsNewPlan = planNeedsRegeneration(activePlan);

  const loadPlans = useCallback(async () => {
    setDbLoading(true);
    try {
      if (profile.id === NEHA_PROFILE_ID || profile.name === "Neha") {
        await purgeNehaWorkoutHistoryOnce();
      }
      const [active, previous] = await Promise.all([
        getActivePlanForProfile(profile.id),
        getPreviousWeekPlan(profile.id),
      ]);
      setActivePlan(active);
      setPreviousWeekPlan(previous);
    } catch {
      setActivePlan(null);
      setPreviousWeekPlan(null);
    } finally {
      setDbLoading(false);
    }
  }, [profile.id]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (activePlan && !planNeedsRegeneration(activePlan)) {
      onPlanReady(storedPlanToWorkoutPlan(activePlan), null);
    }
  }, [activePlan, onPlanReady]);

  async function handleToggleActive(day: string, completed: boolean) {
    if (!activePlan) return;
    const updated = await setSessionCompleted(activePlan.id, day, completed);
    setActivePlan(updated);
  }

  async function handleTogglePrevious(day: string, completed: boolean) {
    if (!previousWeekPlan) return;
    const updated = await setSessionCompleted(previousWeekPlan.id, day, completed);
    setPreviousWeekPlan(updated);
  }

  async function handleGenerateNewPlan() {
    setLoading(true);
    setError(null);

    const groqKey = getGroqKey();
    const adherenceText = previousWeekPlan
      ? formatAdherenceForPrompt(buildAdherence(previousWeekPlan))
      : undefined;

    try {
      const summary = profile.useOuraData
        ? await fetchOuraHealthData(14, profile.id)
        : emptyOuraHealthSummary();
      setOuraSummary(summary);

      const progression = await getProgressionContext(
        profile.id,
        summary,
        profile,
      );

      const { plan: generated } = await generateWorkoutPlan(
        profile,
        groqKey,
        summary,
        adherenceText,
        progression,
      );

      const stored = await saveWorkoutPlan(profile.id, generated);
      setActivePlan(stored);
      onPlanReady(generated, summary);
      await loadPlans();
    } catch (err) {
      if (err instanceof OuraAuthError || err instanceof OuraApiError) {
        setError({ title: "Oura connection failed", message: err.message });
      } else if (err instanceof GroqApiError) {
        setError({
          title: "Workout plan generation failed",
          message: err.message,
          rawPrompt: err.rawPrompt,
        });
      } else {
        setError({
          title: "Something went wrong",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const showAdherenceReminder =
    previousWeekPlan && !previousWeekPlan.sessions.some((s) => s.completed);

  const activeWorkoutPlan = activePlan
    ? storedPlanToWorkoutPlan(activePlan)
    : null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">
          Dashboard — {profile.name}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Your saved workout plan loads here. A new plan is generated only when
          the current one has ended.
        </p>
      </div>

      {dbLoading ? (
        <p className="text-sm text-stone-500">Loading saved workouts…</p>
      ) : activePlan && !needsNewPlan ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-medium">Current plan through {formatPlanDateRange(activePlan)}</p>
          <p className="mt-1 text-emerald-800">
            Loaded from your saved workouts — no new AI generation needed until this
            plan ends.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            {activePlan
              ? `Last plan ended ${formatPlanDateRange(activePlan)}`
              : "No saved workout plan yet"}
          </p>
          <p className="mt-1">
            Generate a new 7-day plan to get started or continue after your last
            plan ended.
          </p>
        </div>
      )}

      {error && (
        <ErrorBanner
          title={error.title}
          message={error.message}
          rawPrompt={error.rawPrompt}
          missingFields={error.missingFields}
        />
      )}

      {previousWeekPlan && (
        <WorkoutTracker
          plan={previousWeekPlan}
          title={`${profile.name} — previous plan`}
          description="Mark completions from the prior week — used when generating the next plan."
          onToggle={(day, completed) => void handleTogglePrevious(day, completed)}
        />
      )}

      {showAdherenceReminder && needsNewPlan && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Tip: check off last week&apos;s sessions before generating so the next
          plan reflects what {profile.name} actually did.
        </p>
      )}

      {needsNewPlan && (
        <button
          type="button"
          onClick={() => void handleGenerateNewPlan()}
          disabled={loading}
          className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white disabled:bg-stone-400"
        >
          {loading
            ? profile.useOuraData
              ? "Fetching Oura & generating plan…"
              : "Generating new plan…"
            : activePlan
              ? "Generate next 7-day plan"
              : "Generate first workout plan"}
        </button>
      )}

      {ouraSummary && profile.useOuraData && ouraSummary.days.length > 0 && (
        <DataSummaryPanel summary={ouraSummary} />
      )}

      {activePlan && activeWorkoutPlan && (
        <div className="space-y-4">
          <WorkoutTracker
            plan={activePlan}
            title={`${profile.name} — this week's workouts`}
            description="Check off sessions as you complete them. Progress is saved per profile."
            onToggle={(day, completed) => void handleToggleActive(day, completed)}
          />

          <p className="rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-700">
            {activeWorkoutPlan.summary}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeWorkoutPlan.sessions.map((session) => (
              <WorkoutPlanCard key={session.day} session={session} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
