import { NEHA_PROFILE_ID } from "../constants/profile";
import { NEHA_SCHEDULE } from "../lib/schedule";
import type { PersonProfile } from "../types";
import { migrateLegacyCredentialsToNeha } from "../lib/storage";
import { openDb, STORES, tx, txWrite } from "./database";

export { NEHA_PROFILE_ID };

const MIGRATION_FLAG = "fitsync_profiles_migrated_v2";

const NEHA_GOALS =
  "Total fitness — mind, body and soul alignment and long-term sustainable habit building. Developing all-day high energy to sustain ambitious living. Keeping inflammation low and building an identity as a daily exerciser over time.";

const NEHA_CONDITIONS =
  "Hyperthyroidism, autoimmune Graves disease, obesity, pre-diabetic.";

function now(): string {
  return new Date().toISOString();
}

function normalizeProfile(raw: PersonProfile): PersonProfile {
  const legacy = raw as PersonProfile & { weightKg?: number | null };
  let weightLb = raw.weightLb ?? null;
  if (weightLb == null && legacy.weightKg != null) {
    weightLb = Math.round(legacy.weightKg * 2.20462);
  }
  return {
    ...raw,
    gender: raw.gender ?? null,
    weightLb,
    useOuraData: raw.useOuraData ?? false,
    schedule: raw.schedule ?? "",
  };
}

export function createEmptyProfile(name: string): PersonProfile {
  const ts = now();
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    gender: null,
    age: null,
    weightLb: null,
    useOuraData: false,
    goals: "",
    healthConditions: "",
    schedule: "",
    createdAt: ts,
    updatedAt: ts,
  };
}

export function buildNehaProfile(createdAt?: string): PersonProfile {
  const ts = createdAt ?? now();
  return {
    id: NEHA_PROFILE_ID,
    name: "Neha",
    gender: "female",
    age: 41,
    weightLb: 208,
    useOuraData: true,
    goals: NEHA_GOALS,
    healthConditions: NEHA_CONDITIONS,
    schedule: NEHA_SCHEDULE,
    createdAt: ts,
    updatedAt: now(),
  };
}

async function readAllProfiles(): Promise<PersonProfile[]> {
  try {
    await openDb();
    const rows = await tx<PersonProfile[]>(
      STORES.profiles,
      "readonly",
      (store) => store.getAll(),
    );
    return rows ?? [];
  } catch {
    return [];
  }
}

export async function saveProfile(profile: PersonProfile): Promise<PersonProfile> {
  const record: PersonProfile = normalizeProfile({
    ...profile,
    updatedAt: now(),
  });
  await tx(STORES.profiles, "readwrite", (store) => store.put(record));
  return record;
}

/** Create or repair Neha's profile (idempotent). */
export async function ensureSeedProfiles(): Promise<PersonProfile> {
  const profiles = await readAllProfiles();
  const existing = profiles.find(
    (p) => p.id === NEHA_PROFILE_ID || p.name.toLowerCase() === "neha",
  );

  const seed = buildNehaProfile(existing?.createdAt);
  const record: PersonProfile = existing
    ? {
        ...seed,
        id: existing.id,
        createdAt: existing.createdAt,
        schedule: existing.schedule?.trim() ? existing.schedule.trim() : seed.schedule,
      }
    : seed;

  await saveProfile(record);
  migrateLegacyCredentialsToNeha();
  return record;
}

export async function migrateLegacyWorkoutPlansIfNeeded(): Promise<void> {
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  try {
    const db = await openDb();
    if (!db.objectStoreNames.contains(STORES.workoutPlans)) {
      localStorage.setItem(MIGRATION_FLAG, "1");
      return;
    }

    const plans = await tx<Record<string, unknown>[]>(
      STORES.workoutPlans,
      "readonly",
      (store) => store.getAll(),
    );

    const needsMigration = plans.some((p) => !p.profileId);
    if (!needsMigration) {
      localStorage.setItem(MIGRATION_FLAG, "1");
      return;
    }

    const neha = await ensureSeedProfiles();

    await txWrite(STORES.workoutPlans, (store) => {
      for (const raw of plans) {
        if (raw.profileId) continue;
        const weekStart = String(raw.weekStart ?? raw.id);
        const migrated = {
          ...raw,
          profileId: neha.id,
          id: `${neha.id}:${weekStart}`,
          weekStart,
        };
        store.put(migrated);
        if (raw.id !== migrated.id) {
          store.delete(String(raw.id));
        }
      }
    });

    localStorage.setItem(MIGRATION_FLAG, "1");
  } catch {
    // Don't block the app if legacy migration fails
    localStorage.setItem(MIGRATION_FLAG, "1");
  }
}

export async function listProfiles(): Promise<PersonProfile[]> {
  try {
    await ensureSeedProfiles();
  } catch {
    // fall through — return Neha from builder below
  }

  try {
    await migrateLegacyWorkoutPlansIfNeeded();
  } catch {
    localStorage.setItem(MIGRATION_FLAG, "1");
  }

  let profiles = await readAllProfiles();

  if (profiles.length === 0) {
    const neha = buildNehaProfile();
    try {
      await saveProfile(neha);
      profiles = [neha];
    } catch {
      profiles = [neha];
    }
  }

  return profiles.map(normalizeProfile).sort((a, b) => {
    if (a.name === "Neha") return -1;
    if (b.name === "Neha") return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function getProfile(id: string): Promise<PersonProfile | null> {
  try {
    await ensureSeedProfiles();
    const raw = await tx<PersonProfile | undefined>(
      STORES.profiles,
      "readonly",
      (store) => store.get(id),
    );
    return raw ? normalizeProfile(raw) : null;
  } catch {
    if (id === NEHA_PROFILE_ID) return buildNehaProfile();
    return null;
  }
}

export async function deleteProfile(id: string): Promise<void> {
  if (id === NEHA_PROFILE_ID) return;
  await tx(STORES.profiles, "readwrite", (store) => store.delete(id));
}
