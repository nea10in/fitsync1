import { useEffect, useState } from "react";
import type { PersonProfile } from "../types";
import {
  buildNehaProfile,
  createEmptyProfile,
  ensureSeedProfiles,
  listProfiles,
  saveProfile,
} from "../db/profileDb";
import { schedulePlaceholder } from "../lib/schedule";
import { getActiveProfileId, setActiveProfileId } from "../lib/storage";

interface ProfileStepProps {
  onContinue: (profile: PersonProfile) => void;
}

type ProfileForm = Omit<PersonProfile, "id" | "createdAt" | "updatedAt">;

const emptyForm = (): ProfileForm => ({
  name: "",
  gender: null,
  age: null,
  weightLb: null,
  useOuraData: false,
  goals: "",
  healthConditions: "",
  schedule: "",
});

function profileToForm(profile: PersonProfile): ProfileForm {
  return {
    name: profile.name,
    gender: profile.gender,
    age: profile.age,
    weightLb: profile.weightLb,
    useOuraData: profile.useOuraData,
    goals: profile.goals,
    healthConditions: profile.healthConditions,
    schedule: profile.schedule,
  };
}

function profileSummary(profile: PersonProfile): string {
  const parts = [
    profile.gender === "male"
      ? "male"
      : profile.gender === "female"
        ? "female"
        : null,
    profile.age != null ? `age ${profile.age}` : null,
    profile.weightLb != null ? `${profile.weightLb} lbs` : null,
    profile.useOuraData ? "Oura" : "no Oura",
  ].filter(Boolean);
  return parts.join(" · ");
}

export default function ProfileStep({ onContinue }: ProfileStepProps) {
  const [profiles, setProfiles] = useState<PersonProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | "new">("new");
  const [form, setForm] = useState<ProfileForm>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProfiles() {
    setLoading(true);
    setError(null);
    try {
      const list = await listProfiles();
      setProfiles(list);
      const activeId = getActiveProfileId();
      const active = list.find((p) => p.id === activeId);
      const initial = active ?? list.find((p) => p.name === "Neha") ?? list[0];
      if (initial) {
        setSelectedId(initial.id);
        setForm(profileToForm(initial));
      } else {
        setSelectedId("new");
        setForm(emptyForm());
      }
    } catch (err) {
      const neha = buildNehaProfile();
      setProfiles([neha]);
      setSelectedId(neha.id);
      setForm(profileToForm(neha));
      setError(
        err instanceof Error
          ? `${err.message} Showing Neha's profile offline — save to retry.`
          : "Could not load profiles from database. Showing Neha's profile offline.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfiles();
  }, []);

  function selectProfile(id: string) {
    setSelectedId(id);
    const profile = profiles.find((p) => p.id === id);
    if (profile) setForm(profileToForm(profile));
    setEditing(false);
    setError(null);
  }

  function handlePickerChange(value: string) {
    if (value === "new") {
      setSelectedId("new");
      setForm(emptyForm());
      setEditing(true);
    } else {
      selectProfile(value);
    }
    setError(null);
  }

  function openEditForm() {
    if (selectedId === "new") {
      setForm(emptyForm());
    } else {
      const profile = profiles.find((p) => p.id === selectedId);
      if (profile) setForm(profileToForm(profile));
    }
    setEditing(true);
    setError(null);
  }

  async function handleSaveAndContinue() {
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!form.gender) {
      setError("Gender is required — workout plans differ for male and female.");
      return;
    }

    let record: PersonProfile;
    if (selectedId === "new") {
      record = {
        ...createEmptyProfile(form.name),
        ...form,
        name: form.name.trim(),
        goals: form.goals.trim(),
        healthConditions: form.healthConditions.trim(),
        schedule: form.schedule.trim(),
      };
    } else {
      const existing = profiles.find((p) => p.id === selectedId);
      if (!existing) {
        setError("Profile not found.");
        return;
      }
      record = {
        ...existing,
        ...form,
        name: form.name.trim(),
        goals: form.goals.trim(),
        healthConditions: form.healthConditions.trim(),
        schedule: form.schedule.trim(),
      };
    }

    const saved = await saveProfile(record);
    setProfiles((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    setSelectedId(saved.id);
    setActiveProfileId(saved.id);
    setEditing(false);
    onContinue(saved);
  }

  async function handleContinueExisting(profile: PersonProfile) {
    if (!profile.gender) {
      setError("Select gender and save before continuing.");
      selectProfile(profile.id);
      setEditing(true);
      return;
    }
    setActiveProfileId(profile.id);
    onContinue(profile);
  }

  if (loading) {
    return <p className="text-sm text-stone-500">Loading profiles…</p>;
  }

  const selectedProfile =
    selectedId !== "new" ? profiles.find((p) => p.id === selectedId) : null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">Who is this for?</h2>
        <p className="mt-1 text-sm text-stone-600">
          Select an existing profile or create a new one. Each person keeps their
          own workout history.
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-stone-900">
            Select profile
          </span>
          <select
            value={selectedId === "new" ? "new" : selectedId}
            onChange={(e) => handlePickerChange(e.target.value)}
            className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
          >
            {profiles.length === 0 && (
              <option value="new">+ Create new profile</option>
            )}
            {profiles.length > 0 && (
              <optgroup label={`Saved profiles (${profiles.length})`}>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.useOuraData ? "" : " — no Oura"}
                  </option>
                ))}
              </optgroup>
            )}
            {profiles.length > 0 && (
              <option value="new">+ Create new profile</option>
            )}
          </select>
        </label>

        {profiles.length === 0 && !loading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>No profiles in the database yet.</p>
          <button
            type="button"
            onClick={() => void ensureSeedProfiles().then(() => loadProfiles())}
            className="mt-2 font-medium underline"
          >
            Create Neha&apos;s profile
          </button>
        </div>
      )}

        {profiles.length > 0 && (
          <ul className="space-y-2">
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => selectProfile(p.id)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                    selectedId === p.id
                      ? "border-stone-900 bg-stone-50 ring-1 ring-stone-900"
                      : "border-stone-200 bg-white hover:border-stone-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-stone-900">{p.name}</span>
                    {selectedId === p.id && (
                      <span className="text-xs font-medium text-stone-600">Selected</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500">{profileSummary(p)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedProfile && !editing && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void handleContinueExisting(selectedProfile)}
              className="flex-1 rounded-lg border-2 border-stone-900 bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
            >
              Continue with {selectedProfile.name}
            </button>
            <button
              type="button"
              onClick={openEditForm}
              className="text-sm font-medium text-stone-600 underline hover:text-stone-900 sm:px-2"
            >
              Edit profile
            </button>
          </div>
        )}

        {selectedId === "new" && !editing && (
          <button
            type="button"
            onClick={openEditForm}
            className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-50"
          >
            Set up new profile
          </button>
        )}
      </div>

      {editing && (
        <>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-stone-800">
          {selectedId === "new" ? "New profile details" : `Edit ${form.name || "profile"}`}
        </h3>
        <p className="text-xs text-stone-500">
          {selectedId === "new"
            ? "Fill in the details below, then create and continue."
            : "Update any fields below, then save and continue."}
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-sm font-medium text-stone-800">Name *</span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </label>

        <fieldset className="rounded-lg border border-stone-200 px-4 py-3">
          <legend className="px-1 text-sm font-medium text-stone-800">
            Gender *
          </legend>
          <label className="mt-2 flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="gender"
              checked={form.gender === "female"}
              onChange={() => setForm((f) => ({ ...f, gender: "female" }))}
            />
            <span className="text-sm text-stone-700">Female</span>
          </label>
          <label className="mt-3 flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="gender"
              checked={form.gender === "male"}
              onChange={() => setForm((f) => ({ ...f, gender: "male" }))}
            />
            <span className="text-sm text-stone-700">Male</span>
          </label>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-stone-800">Age</span>
            <input
              type="number"
              min={1}
              max={120}
              value={form.age ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  age: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-800">Weight (lbs)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={form.weightLb ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  weightLb: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-stone-800">Goals</span>
          <textarea
            rows={3}
            value={form.goals}
            onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-stone-800">
            Health conditions to consider
          </span>
          <textarea
            rows={2}
            value={form.healthConditions}
            onChange={(e) =>
              setForm((f) => ({ ...f, healthConditions: e.target.value }))
            }
            className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-stone-800">Weekly schedule</span>
          <p className="mt-1 text-xs text-stone-500">
            Trainer appointments, office/work days, gym access days, and preferred
            workout times. Plans are built around this.
          </p>
          <textarea
            rows={6}
            value={form.schedule}
            onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
            placeholder={
              selectedId === "new"
                ? schedulePlaceholder({ id: "new" })
                : schedulePlaceholder({ id: selectedId })
            }
            className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </label>

        <fieldset className="rounded-lg border border-stone-200 px-4 py-3">
          <legend className="px-1 text-sm font-medium text-stone-800">
            Data source
          </legend>
          <label className="mt-2 flex cursor-pointer items-start gap-3">
            <input
              type="radio"
              name="dataSource"
              checked={form.useOuraData}
              onChange={() => setForm((f) => ({ ...f, useOuraData: true }))}
              className="mt-1"
            />
            <span className="text-sm text-stone-700">
              <span className="font-medium">Use Oura Ring data</span>
            </span>
          </label>
          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input
              type="radio"
              name="dataSource"
              checked={!form.useOuraData}
              onChange={() => setForm((f) => ({ ...f, useOuraData: false }))}
              className="mt-1"
            />
            <span className="text-sm text-stone-700">
              <span className="font-medium">No Oura — profile-based planning</span>
            </span>
          </label>
        </fieldset>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void handleSaveAndContinue()}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-50"
        >
          {selectedId === "new" ? "Create profile & continue" : "Save changes & continue"}
        </button>
        {selectedId !== "new" && (
          <button
            type="button"
            onClick={() => {
              const profile = profiles.find((p) => p.id === selectedId);
              if (profile) setForm(profileToForm(profile));
              setEditing(false);
              setError(null);
            }}
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            Cancel
          </button>
        )}
      </div>
        </>
      )}
    </section>
  );
}
