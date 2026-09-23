# Loopader

The most advanced forex brokerage platform ever built — combining the best of Exness, IC Markets, XM, eToro and TradingView, plus features no broker has shipped:

1. 3D interactive landing page (React Three Fiber)
2. Passkey / WebAuthn login
3. Figma-style live collaborative charts
4. AI Trading Coach (Groq, Llama 3.3 70B — free)
5. "Market Mood" sentiment gauge
6. Duolingo-style gamification
7. AI Trading Journal
8. 2-minute onboarding
9. Simple UI on top, institutional power underneath

## Stack

Next.js 14 (App Router, TypeScript) · Tailwind · shadcn/ui · Framer Motion · React Three Fiber · TradingView Lightweight Charts · PostgreSQL (Neon) · Redis (Upstash) · Socket.io · NextAuth + WebAuthn · Groq/Gemini · multi-provider market data · Prisma.

## Getting started

```bash
npm install
cp .env.example .env   # fill in values (see comments in .env.example)
npx prisma generate
npx prisma db push
npm run dev
```

App runs at http://localhost:3000. Socket.io worker runs separately (see `worker/`).

## Folder structure

- `app/` — (landing, auth, dashboard, trade, wallet, social, coach, admin) route groups + `/api` routes
- `components/` — ui, charts, three, social, gamification
- `lib/` — db, auth, market-data, ai, payments, security, gamification
- `prisma/` — schema + seed
- `worker/` — Socket.io server (Render)

## Documentation

- `DEPLOY.md` — full free-tier deployment guide (filled in during Phase 18)
- `GO-LIVE-CHECKLIST.md` — pre-launch checklist (filled in during Phase 18)

**Risk warning:** Trading involves risk of loss. Loopader is a technology platform.
