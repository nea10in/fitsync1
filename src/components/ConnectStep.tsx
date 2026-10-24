import { useState } from "react";
import {
  getGroqKey,
  getOuraClientId,
  getOuraClientSecret,
  hasOuraConnection,
  setGroqKey,
  setOuraClientId,
  setOuraClientSecret,
} from "../lib/storage";
import { getOuraRedirectUri, buildOuraAuthorizeUrl } from "../lib/ouraOAuth";
import { disconnectOura, isOuraConnected } from "../services/ouraAuth";
import type { PersonProfile } from "../types";

interface ConnectStepProps {
  profile: PersonProfile;
  onContinue: () => void;
}

export default function ConnectStep({ profile, onContinue }: ConnectStepProps) {
  const [clientId, setClientIdState] = useState(() =>
    getOuraClientId(profile.id),
  );
  const [clientSecret, setClientSecretState] = useState(() =>
    getOuraClientSecret(profile.id),
  );
  const [groqKey, setGroqKeyState] = useState(() => getGroqKey());
  const [ouraConnected, setOuraConnected] = useState(() =>
    isOuraConnected(profile.id),
  );
  const [saved, setSaved] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const redirectUri = getOuraRedirectUri();
  const needsOura = profile.useOuraData;
  const canContinue =
    groqKey.trim().length > 0 && (!needsOura || ouraConnected);

  function persistAppCredentials() {
    setGroqKey(groqKey);
    if (needsOura) {
      setOuraClientId(profile.id, clientId);
      setOuraClientSecret(profile.id, clientSecret);
    }
  }

  function handleConnectOura() {
    setConnectError(null);
    if (!clientId.trim() || !clientSecret.trim()) {
      setConnectError("Enter your Oura OAuth client ID and secret first.");
      return;
    }
    persistAppCredentials();
    window.location.href = buildOuraAuthorizeUrl(clientId.trim(), profile.id);
  }

  function handleDisconnect() {
    disconnectOura(profile.id);
    setOuraConnected(false);
    setSaved(false);
  }

  function handleSave() {
    persistAppCredentials();
    if (needsOura && !hasOuraConnection(profile.id)) {
      setConnectError("Connect Oura before continuing, or switch to profile-based planning.");
      return;
    }
    setSaved(true);
    onContinue();
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">
          Connect — {profile.name}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          {needsOura
            ? "Connect Oura for this profile. The Groq API key is shared across all profiles."
            : "Oura is off for this profile. The Groq API key is shared across all profiles."}
        </p>
      </div>

      {needsOura && (
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Oura Ring (OAuth2)</h3>
            <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-stone-600">
              <li>
                <a
                  href="https://cloud.ouraring.com/oauth/applications"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Create an Oura app
                </a>
              </li>
              <li>
                Redirect URI:{" "}
                <code className="rounded bg-stone-100 px-1 break-all">{redirectUri}</code>
              </li>
            </ol>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-stone-800">Oura client ID</span>
            <input
              type="text"
              autoComplete="off"
              value={clientId}
              onChange={(e) => {
                setClientIdState(e.target.value);
                setSaved(false);
              }}
              className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-stone-800">Oura client secret</span>
            <input
              type="password"
              autoComplete="off"
              value={clientSecret}
              onChange={(e) => {
                setClientSecretState(e.target.value);
                setSaved(false);
              }}
              className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </label>

          {ouraConnected ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-emerald-700">Oura connected</span>
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-sm text-stone-600 underline"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectOura}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium"
            >
              Connect with Oura
            </button>
          )}
        </div>
      )}

      {!needsOura && (
        <p className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Planning for {profile.name} uses profile details and workout history — no
          wearable connection needed. You can enable Oura anytime on the Profile step.
        </p>
      )}

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-sm font-medium text-stone-800">Groq API key *</span>
          <p className="mt-1 text-xs text-stone-500">
            One key for everyone using FitSync in this browser.
          </p>
          <input
            type="password"
            autoComplete="off"
            value={groqKey}
            onChange={(e) => {
              setGroqKeyState(e.target.value);
              setSaved(false);
            }}
            placeholder="gsk_..."
            className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {connectError && <p className="text-sm text-red-700">{connectError}</p>}

      <button
        type="button"
        disabled={!canContinue}
        onClick={handleSave}
        className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white disabled:bg-stone-300"
      >
        Save & continue
      </button>

      {saved && (
        <p className="text-sm text-emerald-700">
          Saved{needsOura ? ` for ${profile.name}` : ""}.
        </p>
      )}
    </section>
  );
}
