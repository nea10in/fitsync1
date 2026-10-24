import { useEffect, useState } from "react";
import { handleOuraOAuthCallback } from "../services/ouraAuth";
import ErrorBanner from "./ErrorBanner";

interface OuraOAuthHandlerProps {
  onSuccess: () => void;
}

export default function OuraOAuthHandler({ onSuccess }: OuraOAuthHandlerProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const result = await handleOuraOAuthCallback(window.location.search);
      if (cancelled) return;

      window.history.replaceState({}, "", "/");

      if (result.ok) {
        onSuccess();
      } else {
        setError(result.error);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [onSuccess]);

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorBanner title="Oura sign-in failed" message={error} />
        <a href="/" className="text-sm font-medium text-stone-700 underline">
          Back to Connect
        </a>
      </div>
    );
  }

  return (
    <p className="text-sm text-stone-600">Completing Oura sign-in…</p>
  );
}
