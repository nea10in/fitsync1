import { useCallback, useState } from "react";
import type { AppStep, OuraHealthSummary, PersonProfile, WorkoutPlan } from "./types";
import {
  getActiveProfileId,
  hasProfileReady,
  setActiveProfileId,
} from "./lib/storage";
import { getProfile } from "./db/profileDb";
import StepIndicator from "./components/StepIndicator";
import ProfileStep from "./components/ProfileStep";
import ConnectStep from "./components/ConnectStep";
import DashboardStep from "./components/DashboardStep";
import ExportStep from "./components/ExportStep";
import OuraOAuthHandler from "./components/OuraOAuthHandler";

export default function App() {
  const [step, setStep] = useState<AppStep>("profile");
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [, setOuraSummary] = useState<OuraHealthSummary | null>(null);
  const isOAuthCallback = window.location.pathname === "/oauth/callback";

  const onPlanReady = useCallback(
    (generated: WorkoutPlan, summary: OuraHealthSummary | null) => {
      setPlan(generated);
      setOuraSummary(summary);
    },
    [],
  );

  const onProfileReady = useCallback((p: PersonProfile) => {
    setProfile(p);
    setActiveProfileId(p.id);
    setStep(hasProfileReady(p) ? "dashboard" : "connect");
  }, []);

  const onOAuthSuccess = useCallback(async () => {
    const activeId = getActiveProfileId();
    if (!activeId) {
      setStep("profile");
      return;
    }
    const p = await getProfile(activeId);
    setProfile(p);
    setStep(p && hasProfileReady(p) ? "dashboard" : "connect");
  }, []);

  if (isOAuthCallback) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
            <h1 className="text-xl font-semibold">FitSync</h1>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <OuraOAuthHandler onSuccess={onOAuthSuccess} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              FitSync
            </h1>
            {profile && (
              <span className="text-sm text-stone-500">
                Active: <span className="font-medium text-stone-800">{profile.name}</span>
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-stone-500">
            Recovery-aware workouts per person
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <StepIndicator current={step} />
            {step !== "profile" && (
              <button
                type="button"
                onClick={() => setStep("profile")}
                className="text-xs font-medium text-stone-600 underline hover:text-stone-900"
              >
                Change profile
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {step === "profile" && <ProfileStep onContinue={onProfileReady} />}

        {step === "connect" && profile && (
          <ConnectStep profile={profile} onContinue={() => setStep("dashboard")} />
        )}

        {step === "dashboard" && profile && (
          <div className="space-y-4">
            <DashboardStep profile={profile} onPlanReady={onPlanReady} />
            {plan && (
              <button
                type="button"
                onClick={() => setStep("export")}
                className="text-sm font-medium text-stone-700 underline"
              >
                Continue to calendar export →
              </button>
            )}
            <div className="flex flex-wrap gap-4 text-xs text-stone-500">
              <button type="button" onClick={() => setStep("profile")} className="hover:text-stone-700">
                Switch profile
              </button>
              <button type="button" onClick={() => setStep("connect")} className="hover:text-stone-700">
                Edit connections
              </button>
            </div>
          </div>
        )}

        {step === "export" && (
          <div className="space-y-4">
            <ExportStep plan={plan} onBack={() => setStep("dashboard")} />
            <button
              type="button"
              onClick={() => setStep("dashboard")}
              className="text-sm text-stone-500 hover:text-stone-700"
            >
              ← Back to dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
