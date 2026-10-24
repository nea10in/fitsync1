import type { WorkoutPlan } from "../types";
import { downloadIcs } from "../services/ics";

interface ExportStepProps {
  plan: WorkoutPlan | null;
  onBack: () => void;
}

export default function ExportStep({ plan, onBack }: ExportStepProps) {
  if (!plan) {
    return (
      <section className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-600">
        Generate a workout plan first, then return here to export your calendar file.
        <button
          type="button"
          onClick={onBack}
          className="mt-4 block w-full text-sm font-medium text-stone-900 underline"
        >
          Back to Generate
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">Export to calendar</h2>
        <p className="mt-1 text-sm text-stone-600">
          Download an .ics file with {plan.sessions.length} events and 30-minute reminders.
          Import into Apple Calendar, Google Calendar, or any iCal app.
        </p>
      </div>

      <button
        type="button"
        onClick={() => downloadIcs(plan.sessions)}
        className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800"
      >
        Download fitsync-workouts.ics
      </button>

      <ul className="text-sm text-stone-600 space-y-1">
        {plan.sessions.map((s) => (
          <li key={s.day}>
            {s.day} — {s.calendar_title} ({s.calendar_time_suggestion})
          </li>
        ))}
      </ul>
    </section>
  );
}
