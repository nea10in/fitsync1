import type { AppStep } from "../types";

const STEPS: { id: AppStep; label: string; number: number }[] = [
  { id: "profile", label: "Profile", number: 1 },
  { id: "connect", label: "Connect", number: 2 },
  { id: "dashboard", label: "Dashboard", number: 3 },
  { id: "export", label: "Export", number: 4 },
];

interface StepIndicatorProps {
  current: AppStep;
}

export default function StepIndicator({ current }: StepIndicatorProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <nav aria-label="Progress" className="flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((step, index) => {
        const active = index === currentIndex;
        const done = index < currentIndex;
        return (
          <div key={step.id} className="flex items-center gap-2">
            {index > 0 && (
              <span
                className={`hidden h-px w-4 sm:block ${done || active ? "bg-stone-400" : "bg-stone-200"}`}
              />
            )}
            <span
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs sm:text-sm sm:px-2.5 ${
                active
                  ? "bg-stone-900 text-white"
                  : done
                    ? "text-stone-600"
                    : "text-stone-400"
              }`}
            >
              <span className="font-medium">{step.number}</span>
              <span>{step.label}</span>
            </span>
          </div>
        );
      })}
    </nav>
  );
}
