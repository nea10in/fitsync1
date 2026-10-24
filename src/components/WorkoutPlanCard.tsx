import type { WorkoutSession } from "../types";
import { formatDisplayDate } from "../lib/dates";

interface WorkoutPlanCardProps {
  session: WorkoutSession;
}

export default function WorkoutPlanCard({ session }: WorkoutPlanCardProps) {
  return (
    <article className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {formatDisplayDate(session.day)}
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-stone-900">
            {session.calendar_title}
          </h3>
        </div>
        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
          {session.location}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-stone-500">Type</dt>
          <dd className="font-medium capitalize">{session.session_type}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Duration</dt>
          <dd className="font-medium">{session.duration_minutes} min</dd>
        </div>
        <div>
          <dt className="text-stone-500">Intensity</dt>
          <dd className="font-medium">{session.intensity_level}/5</dd>
        </div>
        <div>
          <dt className="text-stone-500">Suggested time</dt>
          <dd className="font-medium">{session.calendar_time_suggestion}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm leading-relaxed text-stone-600">{session.notes}</p>
    </article>
  );
}
