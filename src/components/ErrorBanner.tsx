interface ErrorBannerProps {
  title: string;
  message: string;
  rawPrompt?: string;
  missingFields?: string[];
}

export default function ErrorBanner({
  title,
  message,
  rawPrompt,
  missingFields,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-red-800">{message}</p>
      {missingFields && missingFields.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-sm text-red-800">
          {missingFields.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      )}
      {rawPrompt && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium">
            View prompt used (run manually in Groq or any LLM)
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded bg-red-100/80 p-3 text-xs whitespace-pre-wrap">
            {rawPrompt}
          </pre>
        </details>
      )}
    </div>
  );
}
