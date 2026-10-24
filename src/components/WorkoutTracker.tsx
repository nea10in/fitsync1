import { formatDisplayDate } from "../lib/dates";
import type { StoredWorkoutPlan } from "../types";
import { buildAdherence } from "../db/workoutDb";

interface WorkoutTrackerProps {
  plan: StoredWorkoutPlan;
  title: string;
  description?: string;
  onToggle: (day: string, completed: boolean) => void;
  disabled?: boolean;
}

export default function WorkoutTracker({
  plan,
  title,
  description,
  onToggle,
  disabled = false,
}: WorkoutTrackerProps) {
  const adherence = buildAdherence(plan);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
        <span className="text-xs text-stone-500">
          {adherence.completedCount}/{adherence.totalCount} done (
          {Math.round(adherence.completionRate * 100)}%)
        </span>
      </div>
      {description && (
        <p className="mt-1 text-xs text-stone-600">{description}</p>
      )}
      <ul className="mt-3 space-y-2">
        {plan.sessions.map((session) => (
          <li
            key={session.day}
            className="flex items-start gap-3 rounded-lg border border-stone-100 px-3 py-2"
          >
            <input
              type="checkbox"
              checked={session.completed}
              disabled={disabled}
              onChange={(e) => onToggle(session.day, e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300"
              aria-label={`Mark ${session.calendar_title} as done`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-stone-900">
                {session.calendar_title}
              </p>
              <p className="text-xs text-stone-500">
                {formatDisplayDate(session.day)} · {session.session_type} ·{" "}
                {session.duration_minutes} min · {session.location}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
