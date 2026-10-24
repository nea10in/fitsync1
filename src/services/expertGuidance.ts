import type { PersonProfile } from "../types";

export type ExpertProfileCategory =
  | "teen_beginner"
  | "women_40_plus"
  | "men_building_muscle"
  | "general";

const TEEN_MIN_AGE = 13;
const TEEN_MAX_AGE = 19;
const WOMEN_40_PLUS_AGE = 40;
const MEN_MUSCLE_MIN_AGE = 18;

const MUSCLE_GOAL_PATTERN =
  /\b(muscle|strength|hypertrophy|bulk|lean bulk|gain muscle|lifting|lift weights|weight training|get stronger|bodybuilding|resistance)\b/i;

export function maleMuscleGoals(goals: string): boolean {
  return MUSCLE_GOAL_PATTERN.test(goals);
}

export function matchExpertProfile(profile: PersonProfile): ExpertProfileCategory {
  const age = profile.age;

  if (age != null && age >= TEEN_MIN_AGE && age <= TEEN_MAX_AGE) {
    return "teen_beginner";
  }
  if (profile.gender === "female" && age != null && age >= WOMEN_40_PLUS_AGE) {
    return "women_40_plus";
  }
  if (
    profile.gender === "male" &&
    ((age != null && age >= MEN_MUSCLE_MIN_AGE) || maleMuscleGoals(profile.goals))
  ) {
    return "men_building_muscle";
  }
  return "general";
}

export function expertProfileLabel(category: ExpertProfileCategory): string {
  switch (category) {
    case "teen_beginner":
      return "Teenagers starting out";
    case "women_40_plus":
      return "Women 40+";
    case "men_building_muscle":
      return "Men building muscle";
    default:
      return "General (Huberman-led)";
  }
}

const HUBERMAN_GUIDANCE = `**Andrew Huberman — Huberman Lab (apply to EVERY session plan)**
- Consistency beats intensity: anchor workouts at similar times; use the same pre-workout cues to build habit
- Huberman habit ladder: lock in frequency at low intensity before adding load, duration, or density
- Zone 2 cardio (conversational pace) for aerobic base; true rest or mobility when readiness/HRV trend down
- Protect sleep: avoid late high-intensity on office nights; respect nervous-system recovery between hard days
- Ramp volume AND intensity slowly — one progressive variable at a time when adherence ≥ 70%
- Morning light and regular sleep/wake timing support recovery (note in rest-day guidance when relevant)
- Dopamine management: do not make every session maximal — mix easy wins with occasional challenge`;

const WOMEN_40_PLUS_GUIDANCE = `**Dr. Stacy Sims (female physiology & performance)**
- Women are not small men: program for female physiology — recovery, fueling, and bone health matter
- Prioritize heavy-ish resistance and brief high-intensity work for bone density and lean mass (especially 40+)
- Protein and leucine around training; hydrate with electrolytes — do not under-fuel hard sessions
- Favor compound lifts (squat/hinge/lunge patterns) with joint-safe progressions; mobility before load
- Adjust session difficulty to energy/recovery — back off when Oura readiness is low or inflammation is high

**Dr. Gabrielle Lyon (muscle-centric longevity)**
- Muscle is the organ of longevity — resistance training is non-negotiable, not "optional toning"
- Protein-forward recovery: distribute protein across the day; cite muscle-preservation in session notes
- Strength > excessive cardio for body composition; cardio supports health, lifting drives metabolic reserve
- Quality reps and progressive resistance over random burnout circuits

**Natalie Jill (functional, age-strong habits)**
- Functional, real-life movement patterns; meet the person where they are this week
- Habit stacking and accountability — short wins build identity as a daily mover
- Unprocessed, anti-inflammatory lifestyle alignment in notes when health conditions apply
- Bodyweight and band-friendly options when gym access is limited

**Yoga With Adriene (accessible mobility & stress relief)**
- "Find what feels good" — breath-linked yoga and mobility, not performance pressure
- Home-friendly flows for recovery days, office-week evenings, and stress down-regulation
- Gentle spine/hip opening before strength; use yoga as active recovery, not a skipped rest day`;

const TEEN_BEGINNER_GUIDANCE = `**Chloe Ting (beginner home programs)**
- Structured, follow-along friendly sessions; minimal or no equipment
- Short progressive circuits (15–30 min) that feel achievable — build consistency before difficulty
- Clear session themes (core, full body, low impact) so teens know what to expect
- Encourage form focus over speed; celebrate completion, not exhaustion

**MadFit (apartment-friendly training)**
- At-home HIIT, strength, and low-impact options with beginner modifications always available
- Realistic time blocks; no gym required on home/office days
- Mix cardio and strength across the week — avoid stacking back-to-back HIIT on low-readiness days
- Offer easier regressions in notes when intensity must stay low

**Fitness Blender (balanced, evidence-based basics)**
- Balanced cardio + strength; emphasize proper form and scalable intensity
- Low-impact alternatives on tired days; no gimmicks — sustainable weekly structure
- Teach movement quality; progress reps/time before adding complexity
- Rest and recovery days are part of the program, not failure`;

const MEN_BUILDING_MUSCLE_GUIDANCE = `**Jeff Nippard (science-based hypertrophy)**
- Evidence-based rep ranges: roughly 6–12 for hypertrophy, compounds + isolation as appropriate
- Progressive overload with excellent form; mind-muscle connection on accessory work
- Push/pull/legs or upper/lower thinking — balance chest, back, legs, shoulders across the week
- Track quality sets; avoid junk volume that impairs recovery

**AthleanX — Jeff Cavaliere (athletic strength & joint health)**
- Train like an athlete: compound movements, core stability, and carryover to real life
- Prehab in every plan: face pulls, rotator cuff, scapular control — bulletproof shoulders
- Correct imbalances; do not over-emphasize mirror muscles at the expense of posterior chain
- Intensity with control — no ego lifting; stop sets before form breaks down

**Jeremy Ethier (science-based form & selection)**
- Optimal exercise selection for each muscle group; teach setup and cues in session notes
- Beginner-to-intermediate friendly progressions; full ROM and controlled eccentrics
- Frequency over heroic single sessions — consistent weekly stimulus beats one killer workout

**Dr. Mike Israetel — Renaissance Periodization (volume & fatigue)**
- Manage volume landmarks sensibly: add sets gradually, not all at once
- Leave 1–3 reps in reserve (RIR) on most working sets during habit-building weeks
- Deload via lower intensity/volume when adherence drops or Oura recovery trends down
- Hypertrophy priority: enough weekly sets per muscle group spread across sessions, not one marathon day`;

const GENERAL_GUIDANCE = `**General coaching (no specialist panel matched — age/gender missing or outside defined groups)**
- Apply Huberman habit and recovery principles as the primary framework
- Favor accessible, form-first sessions (Fitness Blender style): scalable cardio + strength
- Match session difficulty to stated goals and health conditions; gradual ramp only
- If profile is female under 40: bias bone-loading strength and adequate recovery between hard days
- If profile is male under 18: use teen-friendly progressions even if age was not set`;

function categoryGuidance(category: ExpertProfileCategory): string {
  switch (category) {
    case "women_40_plus":
      return WOMEN_40_PLUS_GUIDANCE;
    case "teen_beginner":
      return TEEN_BEGINNER_GUIDANCE;
    case "men_building_muscle":
      return MEN_BUILDING_MUSCLE_GUIDANCE;
    default:
      return GENERAL_GUIDANCE;
  }
}

export function formatExpertGuidanceForPrompt(profile: PersonProfile): string {
  const category = matchExpertProfile(profile);
  const label = expertProfileLabel(category);

  return `## Expert coaching panel (matched to this profile)
Profile match: **${label}**
Experts: ${
    category === "women_40_plus"
      ? "Dr. Stacy Sims, Dr. Gabrielle Lyon, Natalie Jill, Yoga With Adriene + Huberman Lab"
      : category === "teen_beginner"
        ? "Chloe Ting, MadFit, Fitness Blender + Huberman Lab"
        : category === "men_building_muscle"
          ? "Jeff Nippard, AthleanX, Jeremy Ethier, Dr. Mike Israetel + Huberman Lab"
          : "Huberman Lab (primary) with accessible fitness principles"
  }

Apply ALL guidance below when writing session notes, exercise selection, and intensity. Still obey schedule constraints and progression caps.

### Universal foundation
${HUBERMAN_GUIDANCE}

### Profile-specific experts
${categoryGuidance(category)}`;
}

export function formatPlanCompositionRules(profile: PersonProfile): string {
  const category = matchExpertProfile(profile);

  if (category === "men_building_muscle") {
    const age = profile.age;
    const weight = profile.weightLb;
    const statsLine =
      age != null && weight != null
        ? `- Calibrate ALL strength volume and recovery for **age ${age}** and **${weight} lbs** from the profile physiology section`
        : age != null
          ? `- Calibrate strength volume and recovery for **age ${age}** from the profile physiology section`
          : weight != null
            ? `- Calibrate load progressions for **${weight} lbs** and cite protein targets from the profile physiology section`
            : `- Add age and weight on the profile for better strength calibration`;

    return `## Plan composition (men building muscle — mandatory)
${statsLine}
- Include at least **4 sessions** with session_type **"strength"** this week
- Split push, pull, and legs across the week (upper/lower or push/pull/legs)
- Cap cardio/mobility: at most **1** zone2_walk and **1** mobility or yoga session unless Oura recovery is poor
- Strength sessions: **35–50 min** when schedule allows; notes must name compound lifts (squat/hinge, press, row/pull)
- Hypertrophy is the priority — do NOT default to walks, yoga, or generic "movement" days
- Still respect Huberman recovery: no back-to-back max-effort strength days; leave 1–3 RIR on working sets during early habit weeks
- At least **2 strength sessions** may reach intensity 3+ when progression targets allow`;
  }

  if (category === "teen_beginner") {
    return `## Plan composition (teen beginner)
- Mix strength and cardio; keep sessions 15–30 min and approachable
- At least 3 sessions at intensity 1–2 during habit-building weeks (weeks 1–3)
- Include 1 rest or light mobility day`;
  }

  if (category === "women_40_plus") {
    return `## Plan composition (women 40+)
- Strength 2–3×/week minimum; bone-loading and joint-safe progressions
- At least 3 sessions at intensity 1–2 during habit-building weeks (weeks 1–3)
- Yoga/mobility for recovery; Zone 2 for metabolic health — balance with Lyon/Sims strength priority`;
  }

  return `## Plan composition (general)
- Balanced mix of strength, mobility, and cardio aligned with stated goals
- At least 3 sessions at intensity 1–2 during habit-building weeks (weeks 1–3)
- Include at least one rest or recovery day if readiness trend is weak`;
}
