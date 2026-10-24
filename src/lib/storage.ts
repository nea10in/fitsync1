import { NEHA_PROFILE_ID } from "../constants/profile";

const ACTIVE_PROFILE_KEY = "fitsync_active_profile_id";
const LEGACY_ANTHROPIC_KEY = "fitsync_anthropic_key";

const LEGACY_OURA_CLIENT_ID = "fitsync_oura_client_id";
const LEGACY_OURA_CLIENT_SECRET = "fitsync_oura_client_secret";
const LEGACY_OURA_TOKENS = "fitsync_oura_tokens";
const LEGACY_GROQ_KEY = "fitsync_groq_key";

export interface OuraTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function scopedKey(profileId: string, suffix: string): string {
  return `fitsync_${profileId}_${suffix}`;
}

export function getActiveProfileId(): string | null {
  return localStorage.getItem(ACTIVE_PROFILE_KEY);
}

export function setActiveProfileId(profileId: string): void {
  localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
}

export function requireActiveProfileId(): string {
  const id = getActiveProfileId();
  if (!id) throw new Error("No active profile selected.");
  return id;
}

function copyIfEmpty(profileId: string, suffix: string, value: string | null): boolean {
  if (!value?.trim()) return false;
  const key = scopedKey(profileId, suffix);
  if (localStorage.getItem(key)) return false;
  localStorage.setItem(key, value.trim());
  return true;
}

function firstScopedValue(suffix: string): string {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("fitsync_") || !key.endsWith(`_${suffix}`)) continue;
    if (
      key === LEGACY_OURA_CLIENT_ID ||
      key === LEGACY_OURA_CLIENT_SECRET ||
      key === LEGACY_OURA_TOKENS ||
      key === LEGACY_GROQ_KEY
    ) {
      continue;
    }
    const value = localStorage.getItem(key);
    if (value?.trim()) return value;
  }
  return "";
}

let nehaCredentialMigrationRunning = false;

function hasScopedValue(profileId: string, suffix: string): boolean {
  return Boolean(localStorage.getItem(scopedKey(profileId, suffix))?.trim());
}

/** Move pre-profile Oura/Groq credentials onto Neha's profile. */
export function migrateLegacyCredentialsToNeha(): void {
  if (nehaCredentialMigrationRunning) return;
  nehaCredentialMigrationRunning = true;

  const profileId = NEHA_PROFILE_ID;
  let migrated = false;

  try {
    migrated =
      copyIfEmpty(profileId, "oura_client_id", localStorage.getItem(LEGACY_OURA_CLIENT_ID)) ||
      migrated;
    migrated =
      copyIfEmpty(
        profileId,
        "oura_client_secret",
        localStorage.getItem(LEGACY_OURA_CLIENT_SECRET),
      ) || migrated;
    migrated =
      copyIfEmpty(profileId, "oura_tokens", localStorage.getItem(LEGACY_OURA_TOKENS)) ||
      migrated;
    if (!hasScopedValue(profileId, "oura_client_id")) {
      migrated =
        copyIfEmpty(profileId, "oura_client_id", firstScopedValue("oura_client_id")) ||
        migrated;
    }
    if (!hasScopedValue(profileId, "oura_client_secret")) {
      migrated =
        copyIfEmpty(profileId, "oura_client_secret", firstScopedValue("oura_client_secret")) ||
        migrated;
    }
    if (!hasScopedValue(profileId, "oura_tokens")) {
      const tokens = firstScopedValue("oura_tokens");
      if (tokens) {
        migrated = copyIfEmpty(profileId, "oura_tokens", tokens) || migrated;
      }
    }

    migrateScopedGroqKeysToGlobal();

  if (localStorage.getItem(LEGACY_OURA_CLIENT_ID)) {
    localStorage.removeItem(LEGACY_OURA_CLIENT_ID);
    migrated = true;
  }
  if (localStorage.getItem(LEGACY_OURA_CLIENT_SECRET)) {
    localStorage.removeItem(LEGACY_OURA_CLIENT_SECRET);
    migrated = true;
  }
  if (localStorage.getItem(LEGACY_OURA_TOKENS)) {
    localStorage.removeItem(LEGACY_OURA_TOKENS);
    migrated = true;
  }
    if (migrated) {
      setActiveProfileId(profileId);
    }
  } finally {
    nehaCredentialMigrationRunning = false;
  }
}

function readLegacyScoped(
  profileId: string,
  suffix: string,
  legacyKey: string,
): string {
  const scoped = localStorage.getItem(scopedKey(profileId, suffix));
  if (scoped) return scoped;
  if (profileId === NEHA_PROFILE_ID) {
    migrateLegacyCredentialsToNeha();
    return localStorage.getItem(scopedKey(profileId, suffix)) ?? "";
  }
  if (profileId === getActiveProfileId()) {
    const legacy = localStorage.getItem(legacyKey);
    if (legacy) {
      localStorage.setItem(scopedKey(profileId, suffix), legacy);
      localStorage.removeItem(legacyKey);
      return legacy;
    }
  }
  return "";
}

export function getOuraClientId(profileId: string): string {
  return readLegacyScoped(profileId, "oura_client_id", "fitsync_oura_client_id");
}

export function setOuraClientId(profileId: string, id: string): void {
  localStorage.setItem(scopedKey(profileId, "oura_client_id"), id.trim());
}

export function getOuraClientSecret(profileId: string): string {
  return readLegacyScoped(
    profileId,
    "oura_client_secret",
    "fitsync_oura_client_secret",
  );
}

export function setOuraClientSecret(profileId: string, secret: string): void {
  localStorage.setItem(scopedKey(profileId, "oura_client_secret"), secret.trim());
}

export function getOuraTokens(profileId: string): OuraTokens | null {
  if (profileId === NEHA_PROFILE_ID && !localStorage.getItem(scopedKey(profileId, "oura_tokens"))) {
    migrateLegacyCredentialsToNeha();
  }

  const raw = localStorage.getItem(scopedKey(profileId, "oura_tokens"));
  if (!raw) {
    const legacy = localStorage.getItem(LEGACY_OURA_TOKENS);
    if (legacy && (profileId === getActiveProfileId() || profileId === NEHA_PROFILE_ID)) {
      try {
        const tokens = JSON.parse(legacy) as OuraTokens;
        setOuraTokens(profileId, tokens);
        localStorage.removeItem(LEGACY_OURA_TOKENS);
        return tokens;
      } catch {
        return null;
      }
    }
    return null;
  }
  try {
    return JSON.parse(raw) as OuraTokens;
  } catch {
    return null;
  }
}

export function setOuraTokens(profileId: string, tokens: OuraTokens): void {
  localStorage.setItem(scopedKey(profileId, "oura_tokens"), JSON.stringify(tokens));
}

export function clearOuraTokens(profileId: string): void {
  localStorage.removeItem(scopedKey(profileId, "oura_tokens"));
}

let groqKeyMigrationDone = false;

function purgeScopedGroqKeys(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("fitsync_") && key.endsWith("_groq_key") && key !== LEGACY_GROQ_KEY) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

/** One Groq key for the whole app — migrate any per-profile copies. */
export function migrateScopedGroqKeysToGlobal(): void {
  if (groqKeyMigrationDone) return;
  groqKeyMigrationDone = true;

  if (!localStorage.getItem(LEGACY_GROQ_KEY)?.trim()) {
    const scoped = firstScopedValue("groq_key");
    if (scoped) {
      localStorage.setItem(LEGACY_GROQ_KEY, scoped.trim());
    } else {
      const legacyAnthropic = localStorage.getItem(LEGACY_ANTHROPIC_KEY);
      if (legacyAnthropic?.trim()) {
        localStorage.setItem(LEGACY_GROQ_KEY, legacyAnthropic.trim());
      }
    }
  }

  purgeScopedGroqKeys();
  localStorage.removeItem(LEGACY_ANTHROPIC_KEY);
}

export function getGroqKey(): string {
  migrateScopedGroqKeysToGlobal();
  return localStorage.getItem(LEGACY_GROQ_KEY) ?? "";
}

export function setGroqKey(key: string): void {
  localStorage.setItem(LEGACY_GROQ_KEY, key.trim());
  localStorage.removeItem(LEGACY_ANTHROPIC_KEY);
  purgeScopedGroqKeys();
}

export function hasGroqKey(): boolean {
  return Boolean(getGroqKey().trim());
}

export function hasOuraConnection(profileId: string): boolean {
  return Boolean(getOuraTokens(profileId)?.accessToken);
}

/** Ready to generate: Groq required; Oura only if profile uses it. */
export function hasProfileReady(profile: {
  id: string;
  useOuraData: boolean;
}): boolean {
  if (!hasGroqKey()) return false;
  if (profile.useOuraData) return hasOuraConnection(profile.id);
  return true;
}

/** @deprecated Use hasProfileReady with full profile */
export function hasCredentials(profileId: string): boolean {
  return hasGroqKey() && hasOuraConnection(profileId);
}
