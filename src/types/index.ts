export interface DailyHealthMetric {
  day: string;
  readinessScore: number | null;
  hrv: number | null;
  restingHeartRate: number | null;
  sleepScore: number | null;
  activityScore: number | null;
}

export interface OuraHealthSummary {
  days: DailyHealthMetric[];
  dateRange: { start: string; end: string };
  fetchedAt: string;
}

export interface WorkoutSession {
  day: string;
  session_type: string;
  duration_minutes: number;
  intensity_level: number;
  location: "home" | "gym";
  notes: string;
  calendar_title: string;
  calendar_time_suggestion: string;
}

export interface WorkoutPlan {
  summary: string;
  sessions: WorkoutSession[];
}

export interface StoredWorkoutSession extends WorkoutSession {
  completed: boolean;
  completedAt: string | null;
}

export type ProfileGender = "male" | "female";

export interface PersonProfile {
  id: string;
  name: string;
  gender: ProfileGender | null;
  age: number | null;
  weightLb: number | null;
  useOuraData: boolean;
  goals: string;
  healthConditions: string;
  /** Weekly availability: trainer times, office days, gym access, preferred session times. */
  schedule: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredWorkoutPlan {
  id: string;
  profileId: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  summary: string;
  sessions: StoredWorkoutSession[];
}

export interface WorkoutAdherence {
  plan: StoredWorkoutPlan;
  completedCount: number;
  totalCount: number;
  completionRate: number;
}

export type AppStep = "profile" | "connect" | "dashboard" | "export";

export interface AppError {
  title: string;
  message: string;
  rawPrompt?: string;
  missingFields?: string[];
}
