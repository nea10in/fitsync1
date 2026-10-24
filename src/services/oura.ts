import type { DailyHealthMetric, OuraHealthSummary } from "../types";
import { getLastNDaysRange } from "../lib/dates";
import { getOuraAccessToken } from "./ouraAuth";

const OURA_BASE = "/api/oura/v2/usercollection";

interface PaginatedResponse<T> {
  data: T[];
  next_token?: string | null;
}

interface DailyReadiness {
  day: string;
  score: number | null;
}

interface DailySleep {
  day: string;
  score: number | null;
}

interface DailyActivity {
  day: string;
  score: number | null;
}

interface SleepPeriod {
  day: string;
  average_hrv: number | null;
  lowest_heart_rate: number | null;
}

export class OuraApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "OuraApiError";
  }
}

async function ouraFetch<T>(
  path: string,
  params: Record<string, string>,
  profileId?: string,
): Promise<T[]> {
  const token = await getOuraAccessToken(profileId);
  const url = new URL(`${OURA_BASE}/${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const items: T[] = [];
  let nextToken: string | null = null;

  do {
    const requestUrl = new URL(url);
    if (nextToken) {
      requestUrl.searchParams.set("next_token", nextToken);
    }

    let response: Response;
    try {
      response = await fetch(requestUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      throw new OuraApiError(
        "Could not reach Oura API. Run FitSync with npm run dev (Vite proxy required for browser access).",
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new OuraApiError(
        "Your Oura session expired or lacks permission. Reconnect on the Connect step (OAuth2).",
        response.status,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new OuraApiError(
        `Oura API error (${response.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
        response.status,
      );
    }

    const page = (await response.json()) as PaginatedResponse<T>;
    items.push(...(page.data ?? []));
    nextToken = page.next_token ?? null;
  } while (nextToken);

  return items;
}

function mergeByDay(
  readiness: DailyReadiness[],
  dailySleep: DailySleep[],
  activity: DailyActivity[],
  sleepPeriods: SleepPeriod[],
): DailyHealthMetric[] {
  const byDay = new Map<string, DailyHealthMetric>();

  const ensure = (day: string): DailyHealthMetric => {
    let row = byDay.get(day);
    if (!row) {
      row = {
        day,
        readinessScore: null,
        hrv: null,
        restingHeartRate: null,
        sleepScore: null,
        activityScore: null,
      };
      byDay.set(day, row);
    }
    return row;
  };

  for (const r of readiness) {
    const row = ensure(r.day);
    row.readinessScore = r.score;
  }

  for (const s of dailySleep) {
    const row = ensure(s.day);
    row.sleepScore = s.score;
  }

  for (const a of activity) {
    const row = ensure(a.day);
    row.activityScore = a.score;
  }

  const hrvByDay = new Map<string, number[]>();
  const rhrByDay = new Map<string, number[]>();

  for (const period of sleepPeriods) {
    if (period.average_hrv != null) {
      const list = hrvByDay.get(period.day) ?? [];
      list.push(period.average_hrv);
      hrvByDay.set(period.day, list);
    }
    if (period.lowest_heart_rate != null) {
      const list = rhrByDay.get(period.day) ?? [];
      list.push(period.lowest_heart_rate);
      rhrByDay.set(period.day, list);
    }
  }

  for (const [day, values] of hrvByDay) {
    const row = ensure(day);
    row.hrv = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  for (const [day, values] of rhrByDay) {
    const row = ensure(day);
    row.restingHeartRate = Math.min(...values);
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function emptyOuraHealthSummary(): OuraHealthSummary {
  const dateRange = getLastNDaysRange(14);
  return {
    days: [],
    dateRange,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchOuraHealthData(
  days = 14,
  profileId?: string,
): Promise<OuraHealthSummary> {
  const dateRange = getLastNDaysRange(days);
  const params = {
    start_date: dateRange.start,
    end_date: dateRange.end,
  };

  const [readiness, dailySleep, activity, sleepPeriods] = await Promise.all([
    ouraFetch<DailyReadiness>("daily_readiness", params, profileId),
    ouraFetch<DailySleep>("daily_sleep", params, profileId),
    ouraFetch<DailyActivity>("daily_activity", params, profileId),
    ouraFetch<SleepPeriod>("sleep", params, profileId),
  ]);

  const merged = mergeByDay(readiness, dailySleep, activity, sleepPeriods);

  return {
    days: merged,
    dateRange,
    fetchedAt: new Date().toISOString(),
  };
}

export function summarizeOuraMetrics(summary: OuraHealthSummary): string {
  if (summary.days.length === 0) {
    return "No Oura wearable data — planning from profile, goals, health context, and workout adherence only.";
  }

  const scores = (key: keyof DailyHealthMetric) =>
    summary.days
      .map((d) => d[key])
      .filter((v): v is number => typeof v === "number");

  const avg = (values: number[]) =>
    values.length
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : null;

  const readiness = avg(scores("readinessScore"));
  const sleep = avg(scores("sleepScore"));
  const activity = avg(scores("activityScore"));
  const hrv = avg(scores("hrv"));
  const rhr = avg(scores("restingHeartRate"));

  return [
    `Date range: ${summary.dateRange.start} to ${summary.dateRange.end} (${summary.days.length} days)`,
    readiness != null ? `Avg readiness: ${readiness}` : null,
    sleep != null ? `Avg sleep score: ${sleep}` : null,
    activity != null ? `Avg activity score: ${activity}` : null,
    hrv != null ? `Avg HRV: ${hrv} ms` : null,
    rhr != null ? `Avg resting HR: ${rhr} bpm` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
