import type { OuraHealthSummary } from "../types";
import { formatDisplayDate } from "../lib/dates";

interface DataSummaryPanelProps {
  summary: OuraHealthSummary;
}

function MetricCell({ value, unit }: { value: number | null; unit?: string }) {
  if (value == null) {
    return <span className="text-stone-400">—</span>;
  }
  return (
    <span>
      {value}
      {unit && <span className="text-stone-500 text-xs ml-0.5">{unit}</span>}
    </span>
  );
}

export default function DataSummaryPanel({ summary }: DataSummaryPanelProps) {
  const recent = [...summary.days].reverse().slice(0, 7).reverse();

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-800">
          Oura data used for planning
        </h2>
        <p className="text-xs text-stone-500">
          {summary.dateRange.start} → {summary.dateRange.end} ·{" "}
          {summary.days.length} days
        </p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-xs text-stone-500">
              <th className="py-2 pr-3 font-medium">Day</th>
              <th className="py-2 pr-3 font-medium">Readiness</th>
              <th className="py-2 pr-3 font-medium">HRV</th>
              <th className="py-2 pr-3 font-medium">RHR</th>
              <th className="py-2 pr-3 font-medium">Sleep</th>
              <th className="py-2 font-medium">Activity</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((row) => (
              <tr key={row.day} className="border-b border-stone-50">
                <td className="py-2 pr-3 text-stone-700">
                  {formatDisplayDate(row.day)}
                </td>
                <td className="py-2 pr-3">
                  <MetricCell value={row.readinessScore} />
                </td>
                <td className="py-2 pr-3">
                  <MetricCell value={row.hrv} unit="ms" />
                </td>
                <td className="py-2 pr-3">
                  <MetricCell value={row.restingHeartRate} unit="bpm" />
                </td>
                <td className="py-2 pr-3">
                  <MetricCell value={row.sleepScore} />
                </td>
                <td className="py-2">
                  <MetricCell value={row.activityScore} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {summary.days.length > 7 && (
        <p className="mt-2 text-xs text-stone-500">
          Showing latest 7 of {summary.days.length} days ingested (14-day window).
        </p>
      )}
    </section>
  );
}
