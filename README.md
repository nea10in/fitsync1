# FitSync

Personal, client-side workout planner powered by Oura Ring data and Groq (free tier).

## Quick start

```bash
npm install
npm run dev
```

Open **http://localhost:5173**.

**Important:** Oura and Groq block direct browser requests (CORS). FitSync uses Vite dev/preview proxies (`/api/oura`, `/api/groq`). Use `npm run dev` or `npm run preview`.

## Oura setup (OAuth2)

Personal access tokens were **deprecated December 2025**. FitSync uses OAuth2 only.

1. Go to [cloud.ouraring.com → My Applications](https://cloud.ouraring.com/oauth/applications) and create an application.
2. Add this **redirect URI** (must match exactly):
   - `http://localhost:5173/oauth/callback`
3. Copy the **client ID** and **client secret** into FitSync Connect step.
4. Click **Connect with Oura** and approve access (scope: `daily` for readiness, sleep, activity).

Tokens (access + refresh) are stored in `localStorage` on your machine. The client secret is also stored locally so tokens can be refreshed without a separate backend — acceptable for a personal local tool only.

## Groq key

Sign up at [console.groq.com](https://console.groq.com), create a free API key, and paste it on Step 1.

## Flow

1. **Profile** — Create or select a person (name, age, weight, goals, health conditions)
2. **Connect** — Per-profile Oura OAuth2 + Groq API key
3. **Generate** — Review last week's completions → Oura data → Groq → 7-day plan (saved per profile)
4. **Export** — Download `.ics` for Apple/Google Calendar

## Multi-profile data model

All history is keyed by `profileId` in IndexedDB (`fitsync-db`):

| Store | Contents |
|-------|----------|
| `profiles` | Person details (name, age, weightKg, goals, healthConditions) |
| `workout_plans` | Weekly plans + completion status, id = `{profileId}:{weekStart}` |

Credentials (Oura tokens, Groq key, OAuth client id/secret) are in **localStorage** scoped per profile: `fitsync_{profileId}_*`.

Switch profiles anytime from the Generate step. Each person's workout history, adherence, and intensity progression are independent.

## Deploy to the cloud

FitSync can be hosted so anyone with the URL can open it from any computer. **Profiles and workout history stay in each browser** (IndexedDB/localStorage) — they do not sync across devices unless you use the same browser profile.

### Option A — Vercel (recommended, free tier)

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Vercel auto-detects Vite. Deploy (uses `vercel.json` + `api/` proxies).
4. Copy your production URL, e.g. `https://fitsync-xyz.vercel.app`.
5. **Oura OAuth:** In [My Applications](https://cloud.ouraring.com/oauth/applications), add redirect URI:
   - `https://YOUR-DOMAIN.vercel.app/oauth/callback`
6. Re-connect Oura on the Connect step using the new URL.

### Option B — Render / Railway / Fly.io

Uses `server.mjs` (static files + API proxies):

```bash
npm install
npm run build
npm start   # listens on PORT (default 3000)
```

On [Render](https://render.com): New **Web Service** → connect repo → it can use `render.yaml`. Set start command to `npm start`.

Add Oura redirect URI: `https://YOUR-APP.onrender.com/oauth/callback`

### Local production test

```bash
npm run build
npm start
# open http://localhost:3000
```

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Vite proxies (local dev) · Vercel serverless or `server.mjs` (production)
