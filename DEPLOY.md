# Loopader — Deployment Guide (100% Free Tier)

## 1. Neon Postgres (Database)
1. Go to https://neon.tech → Sign up (free, no card).
2. Create project → region nearest your users (e.g. `US-East` or `EU-Central`).
3. Copy the **pooled connection string** from the dashboard.
4. Set it as `DATABASE_URL` in your env.

## 2. Upstash Redis (Cache / Rate limiting / Quotas)
1. Go to https://upstash.com → Create database (free tier).
2. Under **REST API** copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Set both env vars.

## 3. Vercel (App)
1. Push this repo to GitHub.
2. Go to https://vercel.com → Import the repo.
3. Set the build command to `npm run build`, output `Next.js`.
4. Add ALL env vars from `.env.example` (database, redis, auth secrets, Groq, Finnhub, Stripe, JazzCash, EasyPaisa, Resend, FCM, Turnstile…).
5. Deploy. Vercel auto-deploys on every push to `main`.

**Env helpers (generate locally):**
```
openssl rand -base64 32        # NEXTAUTH_SECRET
openssl rand -hex 32           # JWT_ACCESS_SECRET, ENCRYPTION_KEY
```

## 4. Vercel Cron (scheduled jobs)
`vercel.json` (already committed):
```json
{
  "crons": [
    { "path": "/api/cron?type=daily", "schedule": "0 0 * * *" },
    { "path": "/api/cron?type=weekly", "schedule": "0 9 * * 1" }
  ]
}
```
- **daily** (00:00 UTC): streak evaluation + freeze consumption, daily mission reset, streak reminders.
- **weekly** (Mon 09:00 UTC): leaderboard finalized (top-20 snapshot + podium notifications), weekly AI review emails.
- Cron endpoints require `Authorization: Bearer <CRON_SECRET>` (set `CRON_SECRET` on Vercel).
- **Sub-daily jobs live on the Render worker, NOT Vercel** (Vercel Hobby allows daily crons only):
  - every 5s: SL/TP + margin checks + pending order triggers + price alerts (`worker/stopout.ts`)
  - every 5s: live quote broadcast, every 5min: Market Mood sentiment refresh, hourly: FX-rate cache warm (`worker/socket.ts`)

## 5. Render (Socket.io + Stop-out workers)
1. Go to https://render.com → **New → Background Worker** (free tier: 750h/mo — run TWO services or one combined).
2. Connect the GitHub repo → root directory: `worker/`.
3. Build: `npm install` · Start: `npm run start` (socket.io) — or `npm run start:stopout` for a second worker running the SL/TP/margin engine.
4. Add env: `PORT`, `ALLOWED_ORIGIN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, provider keys, `RESEND_API_KEY`, `RESEND_FROM`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `DATABASE_URL` (Prisma direct connection for the stop-out worker).
5. Copy the Render URL into `NEXT_PUBLIC_SOCKET_URL` on Vercel.
6. Health check: `GET /` on the worker URL returns `{"status":"ok","service":"loopader-worker"}`.

## 6. Cloudflare (CDN + DDoS + WAF + SSL)
1. Add your domain to Cloudflare (free).
2. Point nameservers to Cloudflare.
3. DNS: `A`/`CNAME` record → Vercel IP / `cname.vercel-dns.com`.
4. Cloudflare auto-provisions free SSL. Enable **proxy (orange cloud)**.

## 7. Cloudflare Turnstile
1. Cloudflare Dashboard → Turnstile → Add site.
2. Get `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`.

## 8. Firebase (push notifications)
1. https://console.firebase.google.com → New project.
2. Project settings → Service account → generate key.
3. Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (Vercel + Render).
4. Cloud Messaging tab → Web push certificate → `NEXT_PUBLIC_FCM_VAPID_KEY`.
5. Mobile push tokens are registered per-user via `POST /api/push/register` — the Expo app calls this automatically on login. Push is sent through Expo Push API (mobile) and FCM (web); both are best-effort and silently skipped when unconfigured.

## 9. Mobile (React Native / Expo, `mobile/`)
```bash
cd mobile
npm install
eas login
eas init                              # creates EAS project — copy the projectId
eas build --platform ios --profile production
eas build --platform android --profile production
eas update --channel production       # OTA updates
```
- Set `extra.apiUrl` / `extra.socketUrl` in `mobile/app.json` to the live Vercel + Render URLs.
- Paste the EAS `projectId` into `mobile/app.json` → `extra.eas.projectId`, and the Expo updates URL into `updates.url` (both are placeholders until `eas init` runs).
- `mobile/eas.json` defines dev/preview/production build profiles with OTA channels.

## 10. First deploy order
1. Neon + Upstash created.
2. Env vars set on Vercel.
3. `npx prisma db push` + `npx prisma db seed` (run once against Neon).
4. Deploy Vercel app.
5. Deploy Render workers.
6. Point Cloudflare DNS.
7. Follow `GO-LIVE-CHECKLIST.md`.
