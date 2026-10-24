/** Scopes required for daily readiness, sleep, activity, and sleep periods. */
export const OURA_SCOPES = "daily";

const OAUTH_PROFILE_KEY = "fitsync_oura_oauth_profile_id";

export function getOuraRedirectUri(): string {
  return `${window.location.origin}/oauth/callback`;
}

export function buildOuraAuthorizeUrl(
  clientId: string,
  profileId: string,
): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem("fitsync_oura_oauth_state", state);
  sessionStorage.setItem(OAUTH_PROFILE_KEY, profileId);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getOuraRedirectUri(),
    response_type: "code",
    scope: OURA_SCOPES,
    state,
  });

  return `https://cloud.ouraring.com/oauth/authorize?${params}`;
}

export function getOAuthProfileId(): string | null {
  return sessionStorage.getItem(OAUTH_PROFILE_KEY);
}

export function clearOAuthProfileId(): void {
  sessionStorage.removeItem(OAUTH_PROFILE_KEY);
}
