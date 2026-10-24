import { clearOAuthProfileId, getOAuthProfileId, getOuraRedirectUri } from "../lib/ouraOAuth";
import {
  clearOuraTokens,
  getOuraClientId,
  getOuraClientSecret,
  getOuraTokens,
  requireActiveProfileId,
  setOuraTokens,
  type OuraTokens,
} from "../lib/storage";

const TOKEN_URL = "/api/oura/oauth/token";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
}

export class OuraAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OuraAuthError";
  }
}

function expiresAtFromSeconds(expiresIn: number): number {
  return Date.now() + expiresIn * 1000;
}

async function postToken(
  profileId: string,
  body: URLSearchParams,
): Promise<OuraTokens> {
  const clientId = getOuraClientId(profileId);
  const clientSecret = getOuraClientSecret(profileId);

  if (!clientId || !clientSecret) {
    throw new OuraAuthError(
      "Oura client ID and secret are required. Add them on the Connect step.",
    );
  }

  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    throw new OuraAuthError(
      "Could not reach Oura token endpoint. Run FitSync with npm run dev.",
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new OuraAuthError(
      `Oura authorization failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await response.json()) as TokenResponse;
  if (!data.access_token || !data.refresh_token) {
    throw new OuraAuthError("Oura returned an incomplete token response.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: expiresAtFromSeconds(data.expires_in ?? 86400),
  };
}

export function isOuraConnected(profileId: string): boolean {
  return Boolean(getOuraTokens(profileId)?.refreshToken);
}

export async function exchangeAuthorizationCode(
  profileId: string,
  code: string,
): Promise<void> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getOuraRedirectUri(),
  });
  const tokens = await postToken(profileId, body);
  setOuraTokens(profileId, tokens);
}

export async function refreshOuraAccessToken(profileId: string): Promise<string> {
  const existing = getOuraTokens(profileId);
  if (!existing?.refreshToken) {
    throw new OuraAuthError(
      "Not connected to Oura. Sign in again from the Connect step.",
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: existing.refreshToken,
  });
  const tokens = await postToken(profileId, body);
  setOuraTokens(profileId, tokens);
  return tokens.accessToken;
}

export async function getOuraAccessToken(profileId?: string): Promise<string> {
  const id = profileId ?? requireActiveProfileId();
  const tokens = getOuraTokens(id);
  if (!tokens) {
    throw new OuraAuthError(
      "Not connected to Oura. Complete OAuth on the Connect step.",
    );
  }

  const bufferMs = 5 * 60 * 1000;
  if (Date.now() < tokens.expiresAt - bufferMs) {
    return tokens.accessToken;
  }

  return refreshOuraAccessToken(id);
}

export function disconnectOura(profileId: string): void {
  clearOuraTokens(profileId);
  sessionStorage.removeItem("fitsync_oura_oauth_state");
  clearOAuthProfileId();
}

export async function handleOuraOAuthCallback(
  search: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const params = new URLSearchParams(search);
  const error = params.get("error");
  if (error) {
    const description = params.get("error_description");
    return {
      ok: false,
      error: description ?? `Oura authorization denied (${error}).`,
    };
  }

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = sessionStorage.getItem("fitsync_oura_oauth_state");
  const profileId = getOAuthProfileId() ?? requireActiveProfileId();

  if (!code) {
    return { ok: false, error: "Missing authorization code from Oura." };
  }

  if (!expectedState || state !== expectedState) {
    return { ok: false, error: "Invalid OAuth state. Try connecting again." };
  }

  sessionStorage.removeItem("fitsync_oura_oauth_state");
  clearOAuthProfileId();

  try {
    await exchangeAuthorizationCode(profileId, code);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Token exchange failed.",
    };
  }
}
